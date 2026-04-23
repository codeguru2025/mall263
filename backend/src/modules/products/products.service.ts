import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchService } from '../search/search.service';
import { ProductStatus, StallAnalyticsEventType, WalletTransactionType, WalletTransactionStatus, Prisma } from '@prisma/client';
import { containsContactInfo } from '../../common/contact-info.util';

// Default boost pricing in USD — DB-overridable via AppSetting keys: product_boost_price_7, product_boost_price_14, product_boost_price_30
const DEFAULT_BOOST_PRICES: Record<number, number> = { 7: 1.00, 14: 2.00, 30: 4.00 };

const BUYER_TRIAL_DAYS = 7;

/** Haversine great-circle distance in km between two WGS-84 coordinate pairs. */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function assertNoContactInfo(fields: Record<string, string | undefined>) {
  for (const [field, value] of Object.entries(fields)) {
    if (value && containsContactInfo(value)) {
      throw new BadRequestException(
        `Your product ${field} contains information that is not allowed — phone numbers, WhatsApp, ` +
        `emails, social handles, links, or contact phrases are not permitted. ` +
        `Descriptions must only describe the product: what it is, its features, materials, and care instructions.`,
      );
    }
  }
}

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private searchService: SearchService,
  ) {}

  private async getBoostPrice(days: number): Promise<number> {
    const key = `product_boost_price_${days}`;
    const row = await this.prisma.appSetting.findUnique({ where: { key } });
    if (row) {
      const n = parseFloat(row.value);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return DEFAULT_BOOST_PRICES[days] ?? 1.00;
  }

  async create(stallId: string, data: {
    name: string;
    categoryId?: string;
    description?: string;
    brand?: string;
    tags?: string[];
    currency?: string;
    variants: Array<{
      name: string;
      sku?: string;
      barcode?: string;
      color?: string;
      size?: string;
      material?: string;
      costPrice: number;
      sellingPrice: number;
      stockQuantity: number;
    }>;
    images?: Array<{ url: string; alt?: string; isPrimary?: boolean }>;
  }, requesterId: string) {
    if (!data.variants || data.variants.length === 0) {
      throw new BadRequestException('At least one variant is required');
    }

    // Verify the caller owns or is an attendant of this stall
    const stall = await this.prisma.stall.findUnique({
      where: { id: stallId },
      select: {
        merchant: { select: { userId: true } },
        attendants: { where: { userId: requesterId }, select: { userId: true } },
      },
    });
    if (!stall) throw new NotFoundException('Stall not found');

    const requester = await this.prisma.user.findUnique({ where: { id: requesterId }, select: { role: true } });
    const privilegedRoles = ['SUPER_ADMIN', 'ADMIN_OPS', 'FIELD_AGENT'];
    const isPrivileged = requester && privilegedRoles.includes(requester.role);
    const isOwner = stall.merchant.userId === requesterId;
    const isAttendant = stall.attendants.length > 0;

    if (!isPrivileged && !isOwner && !isAttendant) {
      throw new ForbiddenException('You do not have permission to add products to this stall');
    }

    assertNoContactInfo({ name: data.name, description: data.description, brand: data.brand });

    const prices = data.variants.map(v => v.sellingPrice);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const slug = this.generateSlug(data.name);

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          stallId,
          categoryId: data.categoryId,
          name: data.name,
          slug,
          description: data.description,
          brand: data.brand,
          tags: data.tags || [],
          status: ProductStatus.ACTIVE,
          minPrice,
          maxPrice,
          currency: data.currency || 'USD',
          variants: {
            create: data.variants.map((v) => ({
              name: v.name,
              sku: v.sku,
              barcode: v.barcode,
              color: v.color,
              size: v.size,
              material: v.material,
              costPrice: v.costPrice,
              sellingPrice: v.sellingPrice,
              inventory: {
                create: {
                  quantity: v.stockQuantity,
                  reservedQty: 0,
                  lowStockThreshold: 5,
                },
              },
            })),
          },
          images: data.images ? {
            create: data.images.map((img, idx) => ({
              url: img.url,
              alt: img.alt,
              isPrimary: img.isPrimary || idx === 0,
              sortOrder: idx,
            })),
          } : undefined,
        },
        include: {
          variants: { include: { inventory: true } },
          images: true,
          category: true,
          stall: { select: { id: true, name: true, stallNumber: true } },
        },
      });

      return product;
    }).then(async (product) => {
      await this.searchService.indexProduct(product.id);
      return product;
    });
  }

  async findById(id: string, userId?: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        variants: { include: { inventory: true }, where: { isActive: true } },
        images: { orderBy: { sortOrder: 'asc' } },
        category: true,
        stall: {
          include: {
            mall: { select: { id: true, name: true, city: true } },
            merchant: {
              select: {
                businessName: true,
                logoUrl: true,
                user: { select: { firstName: true, lastName: true, phone: true } },
              },
            },
          },
        },
      },
    });

    if (!product) throw new NotFoundException('Product not found');

    await this.prisma.product.update({ where: { id }, data: { viewCount: { increment: 1 } } });

    if (product.status === ProductStatus.ACTIVE) {
      void this.prisma.stallAnalyticsEvent
        .create({
          data: {
            stallId: product.stallId,
            type: StallAnalyticsEventType.PRODUCT_DETAIL_VIEW,
            productId: product.id,
          },
        })
        .catch(() => {});
    }

    // Trial users (first 7 days) and funded users see full seller details
    let showSeller = false;
    if (userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
      if (user) {
        const accountAgeDays = (Date.now() - user.createdAt.getTime()) / 86_400_000;
        if (accountAgeDays < BUYER_TRIAL_DAYS) {
          showSeller = true;
        } else {
          const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
          if (wallet && parseFloat(wallet.availableBalance.toString()) > 0) {
            showSeller = true;
          }
        }
      }
    }

    if (!showSeller) {
      return {
        ...product,
        stall: {
          id: product.stall.id,
          name: '🔒 Fund wallet to see seller',
          stallNumber: '***',
          logoUrl: null,
          mall: product.stall.mall ? { city: product.stall.mall.city } : null,
          merchant: {
            businessName: '***',
            logoUrl: null,
            user: { firstName: '***', lastName: '***', phone: '***' },
          },
        },
      };
    }

    return product;
  }

  async findByStall(stallId: string, params: { status?: ProductStatus; page?: number; limit?: number; search?: string }) {
    const { status, search } = params;
    const page = Number.isFinite(params.page) ? Math.max(1, params.page!) : 1;
    const limit = Number.isFinite(params.limit) ? Math.max(1, params.limit!) : 20;
    const where: any = { stallId };
    if (status) where.status = status;
    if (search?.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { brand: { contains: search.trim(), mode: 'insensitive' } },
        { variants: { some: { sku: { contains: search.trim(), mode: 'insensitive' } } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          variants: {
            include: {
              inventory: true,
              _count: { select: { posSaleItems: true } },
            },
          },
          images: { where: { isPrimary: true }, take: 1 },
          category: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async updateProduct(productId: string, stallId: string, data: Partial<{
    name: string; description: string; brand: string; tags: string[];
    categoryId: string; status: ProductStatus;
  }>) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');
    if (product.stallId !== stallId) throw new ForbiddenException('Not your product');

    assertNoContactInfo({ name: data.name, description: data.description, brand: data.brand });

    // Only pass safe updatable scalar fields to avoid Prisma rejecting relation keys
    const { name, description, brand, tags, categoryId, status } = data;
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (brand !== undefined) updateData.brand = brand;
    if (tags !== undefined) updateData.tags = tags;
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (status !== undefined) updateData.status = status;

    return this.prisma.product.update({
      where: { id: productId },
      data: updateData,
      include: { variants: true, images: true },
    });
  }

  async updateVariant(variantId: string, data: Partial<{
    name: string; color: string; size: string; costPrice: number;
    sellingPrice: number; isActive: boolean;
  }>) {
    return this.prisma.productVariant.update({
      where: { id: variantId },
      data,
      include: { inventory: true },
    });
  }

  async browse(params: {
    categoryId?: string;
    mallId?: string;
    stallId?: string;
    minPrice?: number;
    maxPrice?: number;
    page?: number;
    limit?: number;
    sortBy?: string;
    nearLat?: number;
    nearLng?: number;
    radiusKm?: number;
  }) {
    const { categoryId, mallId, stallId, sortBy } = params;
    // Guard against NaN — enableImplicitConversion can turn missing query params into NaN
    const page = Number.isFinite(params.page) ? Math.max(1, params.page!) : 1;
    const limit = Number.isFinite(params.limit) ? Math.max(1, params.limit!) : 20;
    const where: any = { status: ProductStatus.ACTIVE };

    if (categoryId) where.categoryId = categoryId;

    // ── Geo filter ──────────────────────────────────────────────────────────
    // If nearLat/nearLng supplied, find malls within radiusKm (default 10km)
    // and restrict to products sold from those malls.
    let effectiveMallId = mallId;
    if (Number.isFinite(params.nearLat) && Number.isFinite(params.nearLng)) {
      const radius = Number.isFinite(params.radiusKm) ? params.radiusKm! : 10;
      const allMalls = await this.prisma.mall.findMany({
        where: { latitude: { not: null }, longitude: { not: null } },
        select: { id: true, latitude: true, longitude: true },
      });
      const nearbyMallIds = allMalls
        .filter((m) => haversineKm(params.nearLat!, params.nearLng!, m.latitude!, m.longitude!) <= radius)
        .map((m) => m.id);

      if (nearbyMallIds.length === 0) {
        return { data: [], total: 0, page, limit, totalPages: 0 };
      }
      // If a specific mallId was already given, intersect (keep only if it's nearby)
      if (effectiveMallId) {
        if (!nearbyMallIds.includes(effectiveMallId)) {
          return { data: [], total: 0, page, limit, totalPages: 0 };
        }
      } else {
        // Set where.stall.mallId to the nearby set
        where.stall = { mallId: { in: nearbyMallIds } };
      }
    }

    if (stallId) {
      where.stallId = stallId;
    } else if (!where.stall) {
      // Marketplace browse: respect the merchant's showOnMarketplace toggle.
      // Shops with no settings row default to visible (showOnMarketplace DEFAULT TRUE).
      where.stall = {
        ...(effectiveMallId ? { mallId: effectiveMallId } : {}),
        OR: [
          { shopSettings: null },
          { shopSettings: { showOnMarketplace: true } },
        ],
      };
    } else {
      // Geo filter already set stall, add mallId and marketplace visibility on top
      where.stall = {
        ...where.stall,
        ...(effectiveMallId ? { mallId: effectiveMallId } : {}),
        OR: [
          { shopSettings: null },
          { shopSettings: { showOnMarketplace: true } },
        ],
      };
    }
    if (Number.isFinite(params.minPrice)) where.minPrice = { gte: params.minPrice };
    if (Number.isFinite(params.maxPrice)) where.maxPrice = { lte: params.maxPrice };

    // Promoted products (not expired) float to the top, then apply the chosen sort
    const now = new Date();
    let secondaryOrder: any = { createdAt: 'desc' };
    if (sortBy === 'price_asc') secondaryOrder = { minPrice: 'asc' };
    if (sortBy === 'price_desc') secondaryOrder = { maxPrice: 'desc' };
    if (sortBy === 'popular') secondaryOrder = { viewCount: 'desc' };

    const orderBy: any[] = [
      // Promoted and still valid → isPromoted=true floats up; expired boosts fall back
      { isPromoted: 'desc' },
      secondaryOrder,
    ];

    const include = {
      images: { where: { isPrimary: true }, take: 1 },
      category: { select: { name: true, slug: true } },
      stall: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
          mall: { select: { name: true, city: { select: { name: true } } } },
          merchant: { select: { logoUrl: true } },
        },
      },
      variants: { select: { sellingPrice: true, color: true, size: true }, where: { isActive: true } },
    };

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({ where, skip: (page - 1) * limit, take: limit, include, orderBy }),
      this.prisma.product.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /** TikTok-style ranking: exploration noise + views + trust + category/mall affinity from client hints */
  async forYou(params: {
    categoryIds?: string[];
    mallId?: string;
    excludeProductIds?: string[];
    page?: number;
    limit?: number;
  }) {
    const page = Number.isFinite(params.page) ? Math.max(1, params.page!) : 1;
    const limit = Number.isFinite(params.limit) ? Math.max(1, Math.min(40, params.limit!)) : 20;
    const catSet = new Set((params.categoryIds || []).filter(Boolean));
    const exclude = new Set((params.excludeProductIds || []).filter(Boolean));

    const include = {
      images: { where: { isPrimary: true }, take: 1 },
      category: { select: { name: true, slug: true } },
      stall: {
        select: {
          id: true,
          name: true,
          mallId: true,
          logoUrl: true,
          mall: { select: { name: true, city: { select: { name: true } } } },
          merchant: { include: { user: { include: { trustScore: true } } } },
        },
      },
      variants: { select: { sellingPrice: true, color: true, size: true }, where: { isActive: true } },
    } as const;

    const [popular, recent] = await Promise.all([
      this.prisma.product.findMany({
        where: { status: ProductStatus.ACTIVE },
        take: 130,
        orderBy: { viewCount: 'desc' },
        include,
      }),
      this.prisma.product.findMany({
        where: { status: ProductStatus.ACTIVE },
        take: 130,
        orderBy: { createdAt: 'desc' },
        include,
      }),
    ]);

    const merged = new Map<string, (typeof popular)[0]>();
    for (const p of popular) merged.set(p.id, p);
    for (const p of recent) if (!merged.has(p.id)) merged.set(p.id, p);
    const pool = [...merged.values()];

    // Remove any products whose descriptions leak contact info (historical data).
    const clean = pool.filter(
      (p) => !containsContactInfo(p.name) && !containsContactInfo(p.description ?? ''),
    );

    const scored = clean.map((p) => {
      let s = Math.random() * 1.8;
      s += Math.log1p(p.viewCount) * 0.42;
      if (p.categoryId && catSet.has(p.categoryId)) s += 5;
      if (params.mallId && p.stall.mallId === params.mallId) s += 3.6;
      const trust = parseFloat(p.stall.merchant.user.trustScore?.overallScore?.toString() || '50');
      s += (trust / 100) * 2.2;
      if (exclude.has(p.id)) s -= 3.5;
      return { p, s };
    });

    scored.sort((a, b) => b.s - a.s);
    const ordered = scored.map((x) => x.p);
    const start = (page - 1) * limit;
    const slice = ordered.slice(start, start + limit);

    return {
      data: slice,
      total: ordered.length,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(ordered.length / limit)),
    };
  }

  async getCategories() {
    return this.prisma.category.findMany({
      where: { isActive: true },
      include: { children: { where: { isActive: true } } },
      orderBy: { sortOrder: 'asc' },
    });
  }

  // ── Promoted Listings ─────────────────────────────────────────────────────

  /**
   * Seller boosts a product for 7, 14, or 30 days.
   * Fee is deducted from their wallet immediately using a serializable transaction.
   */
  async boostProduct(userId: string, productId: string, days: 7 | 14 | 30): Promise<{ promotedUntil: Date; fee: number }> {
    const fee = await this.getBoostPrice(days);
    if (!fee) throw new BadRequestException('Invalid boost duration. Choose 7, 14, or 30 days.');

    // Verify product ownership: product → stall → merchant → user
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { stall: { include: { merchant: { select: { userId: true } } } } },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (product.stall.merchant.userId !== userId) throw new ForbiddenException('You do not own this product');

    const promotedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new NotFoundException('Wallet not found');

      const feeDec = new Prisma.Decimal(fee);
      if (wallet.availableBalance.lessThan(feeDec)) {
        throw new BadRequestException(
          `Insufficient wallet balance. Need $${fee.toFixed(2)}, available: $${wallet.availableBalance.toFixed(2)}`,
        );
      }

      const balanceBefore = wallet.availableBalance;
      const balanceAfter = balanceBefore.sub(feeDec);

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { availableBalance: balanceAfter, lastActivityAt: new Date() },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: WalletTransactionType.FEE,
          amount: feeDec,
          balanceBefore,
          balanceAfter,
          status: WalletTransactionStatus.COMPLETED,
          description: `Listing boost: ${product.name} (${days} days)`,
          completedAt: new Date(),
        },
      });

      await tx.product.update({
        where: { id: productId },
        data: { isPromoted: true, promotedUntil },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return { promotedUntil, fee };
  }

  /** Boost pricing lookup (public — shown in UI before confirming). */
  async getBoostPricing(): Promise<{ days: number; fee: number }[]> {
    const durations = [7, 14, 30];
    const prices = await Promise.all(durations.map((d) => this.getBoostPrice(d)));
    return durations.map((d, i) => ({ days: d, fee: prices[i] }));
  }

  /** Daily cron: clear expired boosts so they stop floating to the top. */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async expirePromotedListings() {
    await this.prisma.product.updateMany({
      where: { isPromoted: true, promotedUntil: { lt: new Date() } },
      data: { isPromoted: false },
    });
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private generateSlug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
  }
}
