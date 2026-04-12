import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SearchService } from '../search/search.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { ProductStatus, StallAnalyticsEventType } from '@prisma/client';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private searchService: SearchService,
    private subscriptionsService: SubscriptionsService,
  ) {}

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
  }) {
    if (!data.variants || data.variants.length === 0) {
      throw new BadRequestException('At least one variant is required');
    }

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

    // Decide visibility: trial users, funded users, and active buyers see full details
    let showSeller = false;
    if (userId) {
      const sub = await this.subscriptionsService.getStatus(userId);
      if (sub.fullyAccess) {
        showSeller = true;
      } else {
        const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
        if (wallet && parseFloat(wallet.availableBalance.toString()) > 0) {
          showSeller = true;
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

  async findByStall(stallId: string, params: { status?: ProductStatus; page?: number; limit?: number }) {
    const { status } = params;
    const page = Number.isFinite(params.page) ? Math.max(1, params.page!) : 1;
    const limit = Number.isFinite(params.limit) ? Math.max(1, params.limit!) : 20;
    const where: any = { stallId };
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          variants: { include: { inventory: true } },
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

    // Only pass safe updatable scalar fields to avoid Prisma rejecting relation keys
    const { name, description, brand, tags, categoryId, status } = data as any;
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
  }) {
    const { categoryId, mallId, stallId, sortBy } = params;
    // Guard against NaN — enableImplicitConversion can turn missing query params into NaN
    const page = Number.isFinite(params.page) ? Math.max(1, params.page!) : 1;
    const limit = Number.isFinite(params.limit) ? Math.max(1, params.limit!) : 20;
    const where: any = { status: ProductStatus.ACTIVE };

    if (categoryId) where.categoryId = categoryId;
    if (stallId) where.stallId = stallId;
    else if (mallId) where.stall = { mallId };
    if (Number.isFinite(params.minPrice)) where.minPrice = { gte: params.minPrice };
    if (Number.isFinite(params.maxPrice)) where.maxPrice = { lte: params.maxPrice };

    let orderBy: any = { createdAt: 'desc' };
    if (sortBy === 'price_asc') orderBy = { minPrice: 'asc' };
    if (sortBy === 'price_desc') orderBy = { maxPrice: 'desc' };
    if (sortBy === 'popular') orderBy = { viewCount: 'desc' };

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          images: { where: { isPrimary: true }, take: 1 },
          category: { select: { name: true, slug: true } },
          stall: {
            select: {
              id: true,
              name: true,
              logoUrl: true,
              mall: { select: { name: true, city: true } },
              merchant: { select: { logoUrl: true } },
            },
          },
          variants: { select: { sellingPrice: true, color: true, size: true }, where: { isActive: true } },
        },
        orderBy,
      }),
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
          mall: { select: { name: true, city: true } },
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

    const scored = pool.map((p) => {
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

  private generateSlug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
  }
}
