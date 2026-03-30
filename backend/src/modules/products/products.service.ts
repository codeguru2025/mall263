import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductStatus } from '@prisma/client';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

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
    });
  }

  async findById(id: string, buyerTier?: 'FREE' | 'FUNDED' | 'ACTIVE_BUYER') {
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
              include: {
                user: { select: { firstName: true, lastName: true, phone: true } },
              },
            },
          },
        },
      },
    });

    if (!product) throw new NotFoundException('Product not found');

    // Increment view count
    await this.prisma.product.update({ where: { id }, data: { viewCount: { increment: 1 } } });

    // Apply buying power visibility rules
    if (buyerTier === 'FREE') {
      return {
        ...product,
        stall: {
          id: product.stall.id,
          name: '🔒 Fund wallet to see seller',
          stallNumber: '***',
          mall: product.stall.mall ? { city: product.stall.mall.city } : null,
          merchant: { user: { firstName: '***', lastName: '***', phone: '***' } },
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

    return this.prisma.product.update({
      where: { id: productId },
      data,
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
    minPrice?: number;
    maxPrice?: number;
    page?: number;
    limit?: number;
    sortBy?: string;
  }) {
    const { categoryId, mallId, sortBy } = params;
    // Guard against NaN — enableImplicitConversion can turn missing query params into NaN
    const page = Number.isFinite(params.page) ? Math.max(1, params.page!) : 1;
    const limit = Number.isFinite(params.limit) ? Math.max(1, params.limit!) : 20;
    const where: any = { status: ProductStatus.ACTIVE };

    if (categoryId) where.categoryId = categoryId;
    if (mallId) where.stall = { mallId };
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
          stall: { select: { id: true, name: true, mall: { select: { name: true, city: true } } } },
          variants: { select: { sellingPrice: true, color: true, size: true }, where: { isActive: true } },
        },
        orderBy,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
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
