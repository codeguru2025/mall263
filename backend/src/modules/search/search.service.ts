import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolveStoreLogo } from '../../common/utils/store-branding';
import { PrismaService } from '../../prisma/prisma.service';
import { MeiliSearch, Index } from 'meilisearch';
import { ProductStatus, Prisma } from '@prisma/client';

interface SearchParams {
  categoryId?: string;
  mallId?: string;
  city?: string;
  page?: number;
  limit?: number;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: string;
  inStock?: boolean;
  nearLat?: number;
  nearLng?: number;
  radiusKm?: number;
}

/** Haversine great-circle distance in km. */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface ProductSearchDoc {
  id: string;
  name: string;
  description: string;
  brand: string;
  category: string;
  categoryId: string;
  tags: string[];
  colors: string[];
  sizes: string[];
  minPrice: number;
  maxPrice: number;
  stallId: string;
  stallName: string;
  mallId: string;
  mallName: string;
  city: string;
  inStock: boolean;
  /** Mirrors `StallShopSettings.showOnMarketplace`. Stalls without a settings
   *  row are treated as opted-in (value = true). */
  showOnMarketplace: boolean;
  trustScore: number;
  viewCount: number;
  createdAt: number;
  imageUrl: string;
  storeLogoUrl: string;
}

@Injectable()
export class SearchService implements OnModuleInit {
  private client: MeiliSearch;
  private productsIndex: Index;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    this.client = new MeiliSearch({
      host: this.config.get('MEILISEARCH_HOST', 'http://localhost:7700'),
      apiKey: this.config.get('MEILISEARCH_API_KEY', ''),
    });
  }

  async onModuleInit() {
    try {
      this.productsIndex = this.client.index('products');
      await this.configureIndex();
      await this.reindexAll();
    } catch (e) {
      console.warn('Meilisearch not available, search will use DB fallback:', (e as Error).message);
    }
  }

  private async configureIndex() {
    await this.productsIndex.updateSettings({
      searchableAttributes: ['name', 'description', 'brand', 'category', 'tags', 'colors', 'sizes'],
      filterableAttributes: ['categoryId', 'mallId', 'stallId', 'city', 'inStock', 'showOnMarketplace', 'minPrice', 'maxPrice', 'trustScore'],
      sortableAttributes: ['minPrice', 'maxPrice', 'trustScore', 'viewCount', 'createdAt'],
      rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness'],
      typoTolerance: { enabled: true, minWordSizeForTypos: { oneTypo: 3, twoTypos: 6 } },
      synonyms: {
        sneakers: ['trainers', 'kicks', 'tennis shoes'],
        pants: ['trousers', 'slacks'],
        tshirt: ['t-shirt', 'tee', 'top'],
        cellphone: ['phone', 'mobile', 'smartphone'],
        handbag: ['bag', 'purse'],
      },
    });
  }

  async search(query: string, params: {
    categoryId?: string;
    mallId?: string;
    city?: string;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
    sortBy?: string;
    page?: number;
    limit?: number;
    nearLat?: number;
    nearLng?: number;
    radiusKm?: number;
  }) {
    const { categoryId, city, sortBy } = params;
    const page = Number.isFinite(params.page) ? Math.max(1, params.page!) : 1;
    const limit = Number.isFinite(params.limit) ? Math.max(1, params.limit!) : 20;
    const minPrice = Number.isFinite(params.minPrice) ? params.minPrice : undefined;
    const maxPrice = Number.isFinite(params.maxPrice) ? params.maxPrice : undefined;
    const inStock = params.inStock;

    // ── Geo filter: resolve nearby mall IDs before querying Meilisearch ─────
    let effectiveMallId = params.mallId;
    let nearbyMallIds: string[] | undefined;
    if (Number.isFinite(params.nearLat) && Number.isFinite(params.nearLng)) {
      const radius = Number.isFinite(params.radiusKm) ? params.radiusKm! : 10;
      const allMalls = await this.prisma.mall.findMany({
        where: { latitude: { not: null }, longitude: { not: null } },
        select: { id: true, latitude: true, longitude: true },
      });
      nearbyMallIds = allMalls
        .filter((m) => haversineKm(params.nearLat!, params.nearLng!, m.latitude!, m.longitude!) <= radius)
        .map((m) => m.id);
      if (nearbyMallIds.length === 0) {
        return { data: [], total: 0, page, limit, totalPages: 0, query };
      }
      // If a specific mall was already chosen, keep it only if it's nearby
      if (effectiveMallId && !nearbyMallIds.includes(effectiveMallId)) {
        return { data: [], total: 0, page, limit, totalPages: 0, query };
      } else if (!effectiveMallId) {
        effectiveMallId = undefined; // will use nearbyMallIds filter below
      }
    }

    try {
      if (!this.productsIndex) throw new Error('Meilisearch index not initialised');

      // Build filter array
      const filters: string[] = [];
      // Marketplace visibility: only surface stalls that opted in. Documents
      // indexed before this field was added will not match `= true` — that's
      // a safe default (hidden) until a reindex runs.
      filters.push('showOnMarketplace = true');
      if (categoryId) filters.push(`categoryId = "${categoryId}"`);
      if (nearbyMallIds && !effectiveMallId) {
        filters.push(`mallId IN [${nearbyMallIds.map((id) => `"${id}"`).join(', ')}]`);
      } else if (effectiveMallId) {
        filters.push(`mallId = "${effectiveMallId}"`);
      }
      if (city) filters.push(`city = "${city}"`);
      if (minPrice !== undefined) filters.push(`maxPrice >= ${minPrice}`);
      if (maxPrice !== undefined) filters.push(`minPrice <= ${maxPrice}`);
      if (inStock !== undefined) filters.push(`inStock = ${inStock}`);

      let sort: string[] | undefined;
      if (sortBy === 'price_asc') sort = ['minPrice:asc'];
      else if (sortBy === 'price_desc') sort = ['maxPrice:desc'];
      else if (sortBy === 'popular') sort = ['viewCount:desc'];
      else if (sortBy === 'trust') sort = ['trustScore:desc'];
      else if (sortBy === 'newest') sort = ['createdAt:desc'];

      const results = await this.productsIndex.search(query, {
        filter: filters.length > 0 ? filters : undefined,
        sort,
        offset: (page - 1) * limit,
        limit,
        attributesToHighlight: ['name', 'description'],
      });

      // If Meilisearch returns nothing, use DB (covers empty index, stale index, and typed queries)
      if (results.estimatedTotalHits === 0) {
        return this.dbFallbackSearch(query, { ...params, page, limit, minPrice, maxPrice });
      }

      return {
        data: results.hits,
        total: results.estimatedTotalHits,
        query: results.query,
        processingTimeMs: results.processingTimeMs,
        page,
        limit,
      };
    } catch {
      // Fallback to database search if Meilisearch is unavailable
      return this.dbFallbackSearch(query, { ...params, page, limit, minPrice, maxPrice });
    }
  }

  async indexProduct(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        variants: { include: { inventory: true } },
        images: { where: { isPrimary: true }, take: 1 },
        category: true,
        stall: {
          include: {
            mall: { include: { city: true } },
            shopSettings: { select: { showOnMarketplace: true } },
            merchant: { include: { user: { include: { trustScore: true } } } },
          },
        },
      },
    });

    if (!product) return;

    // Default to visible when no shopSettings row exists (matches DB fallback)
    const showOnMarketplace = product.stall.shopSettings?.showOnMarketplace ?? true;

    const doc: ProductSearchDoc = {
      id: product.id,
      name: product.name,
      description: product.description || '',
      brand: product.brand || '',
      category: product.category?.name || '',
      categoryId: product.categoryId || '',
      tags: product.tags,
      colors: [...new Set(product.variants.map(v => v.color).filter(Boolean) as string[])],
      sizes: [...new Set(product.variants.map(v => v.size).filter(Boolean) as string[])],
      minPrice: parseFloat(product.minPrice.toString()),
      maxPrice: parseFloat(product.maxPrice.toString()),
      stallId: product.stallId,
      stallName: product.stall.name,
      mallId: product.stall.mallId || '',
      mallName: product.stall.mall?.name || '',
      city: product.stall.mall?.city?.name || '',
      inStock: product.variants.some(v => v.inventory && v.inventory.quantity > 0),
      showOnMarketplace,
      trustScore: parseFloat(product.stall.merchant.user.trustScore?.overallScore?.toString() || '50'),
      viewCount: product.viewCount,
      createdAt: product.createdAt.getTime(),
      imageUrl: product.images[0]?.url || '',
      storeLogoUrl: resolveStoreLogo(product.stall, product.stall.merchant) || '',
    };

    try {
      await this.productsIndex.addDocuments([doc]);
    } catch {
      console.warn('Failed to index product to Meilisearch');
    }
  }

  async reindexAll() {
    const products = await this.prisma.product.findMany({
      where: { status: ProductStatus.ACTIVE },
      select: { id: true },
    });

    for (const product of products) {
      await this.indexProduct(product.id);
    }

    return { indexed: products.length };
  }

  /**
   * Re-index every active product belonging to a stall. Called when the stall's
   * marketplace visibility (or any other stall-level field indexed on product
   * documents) changes so the Meilisearch index stays consistent with Postgres.
   */
  async reindexStall(stallId: string): Promise<{ indexed: number }> {
    const products = await this.prisma.product.findMany({
      where: { stallId, status: ProductStatus.ACTIVE },
      select: { id: true },
    });
    for (const product of products) {
      await this.indexProduct(product.id);
    }
    return { indexed: products.length };
  }

  async removeProduct(productId: string) {
    try {
      await this.productsIndex.deleteDocument(productId);
    } catch {
      // Ignore if Meilisearch not available
    }
  }

  async getMarketPrice(categoryId: string, productName?: string) {
    const where: any = { categoryId };
    if (productName) where.productName = { contains: productName, mode: 'insensitive' };

    return this.prisma.marketPrice.findMany({
      where,
      orderBy: { calculatedAt: 'desc' },
      take: 10,
    });
  }

  async getSuggestions(query: string) {
    try {
      const results = await this.productsIndex.search(query, { limit: 5 });
      return results.hits.map((h: any) => ({ id: h.id, name: h.name, category: h.category, price: h.minPrice }));
    } catch {
      return [];
    }
  }

  private async dbFallbackSearch(query: string, params: SearchParams) {
    const { categoryId, city } = params;
    const page = Number.isFinite(params.page) ? Math.max(1, params.page!) : 1;
    const limit = Number.isFinite(params.limit) ? Math.max(1, params.limit!) : 20;
    const minPrice = Number.isFinite(params.minPrice) ? params.minPrice : undefined;
    const maxPrice = Number.isFinite(params.maxPrice) ? params.maxPrice : undefined;

    // Resolve effective mall IDs (explicit mallId or derived from geo filter)
    let effectiveMallIds: string[] | undefined;
    if (Number.isFinite(params.nearLat) && Number.isFinite(params.nearLng)) {
      const radius = Number.isFinite(params.radiusKm) ? params.radiusKm! : 10;
      const allMalls = await this.prisma.mall.findMany({
        where: { latitude: { not: null }, longitude: { not: null } },
        select: { id: true, latitude: true, longitude: true },
      });
      effectiveMallIds = allMalls
        .filter((m) => haversineKm(params.nearLat!, params.nearLng!, m.latitude!, m.longitude!) <= radius)
        .map((m) => m.id);
      if (effectiveMallIds.length === 0) {
        return { data: [], total: 0, page, limit, totalPages: 0, query };
      }
    } else if (params.mallId) {
      effectiveMallIds = [params.mallId];
    }

    const where: Prisma.ProductWhereInput = { status: ProductStatus.ACTIVE };

    // Only add OR text search when there's actually a query
    if (query.trim()) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { brand: { contains: query, mode: 'insensitive' } },
        { tags: { hasSome: query.split(' ').filter(Boolean) } },
      ];
    }

    if (categoryId) where.categoryId = categoryId;

    // Marketplace search: respect the merchant's showOnMarketplace toggle.
    const stallFilter: Prisma.StallWhereInput = {
      OR: [
        { shopSettings: null },
        { shopSettings: { showOnMarketplace: true } },
      ],
    };
    if (effectiveMallIds) stallFilter.mallId = { in: effectiveMallIds };
    if (city && typeof city === 'string' && city.trim()) {
      stallFilter.mall = { city: { name: { equals: city.trim(), mode: 'insensitive' } } };
    }
    where.stall = stallFilter;

    if (minPrice !== undefined) where.minPrice = { gte: minPrice };
    if (maxPrice !== undefined) where.maxPrice = { lte: maxPrice };

    const sortBy = params.sortBy;
    let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: 'desc' };
    if (sortBy === 'price_asc') orderBy = { minPrice: 'asc' };
    else if (sortBy === 'price_desc') orderBy = { maxPrice: 'desc' };
    else if (sortBy === 'popular') orderBy = { viewCount: 'desc' };
    else if (sortBy === 'trust') {
      orderBy = {
        stall: {
          merchant: { user: { trustScore: { overallScore: 'desc' } } },
        },
      };
    } else if (sortBy === 'newest') orderBy = { createdAt: 'desc' };

    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          images: { where: { isPrimary: true }, take: 1 },
          category: { select: { name: true } },
          stall: {
            select: {
              id: true,
              name: true,
              mallId: true,
              logoUrl: true,
              mall: { select: { id: true, name: true, city: { select: { name: true } } } },
              merchant: {
                select: {
                  logoUrl: true,
                  user: { select: { trustScore: { select: { overallScore: true } } } },
                },
              },
            },
          },
          variants: { select: { sellingPrice: true }, where: { isActive: true } },
        },
        orderBy,
      }),
      this.prisma.product.count({ where }),
    ]);

    // Normalize to the same flat shape as Meilisearch documents so the frontend
    // can consume both sources identically.
    const data = rows.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description || '',
      brand: p.brand || '',
      category: p.category?.name || '',
      categoryId: p.categoryId || '',
      tags: p.tags,
      minPrice: parseFloat(p.minPrice.toString()),
      maxPrice: parseFloat(p.maxPrice.toString()),
      stallId: p.stallId,
      stallName: p.stall.name,
      mallId: p.stall.mallId || '',
      mallName: p.stall.mall?.name || '',
      city: p.stall.mall?.city?.name || '',
      imageUrl: p.images[0]?.url || '',
      inStock: p.variants.length > 0,
      trustScore: parseFloat(p.stall.merchant?.user?.trustScore?.overallScore?.toString() ?? '50'),
      viewCount: p.viewCount,
      createdAt: p.createdAt.getTime(),
      storeLogoUrl: resolveStoreLogo(p.stall, p.stall.merchant) || '',
    }));

    return { data, total, query, processingTimeMs: 0, page, limit };
  }
}
