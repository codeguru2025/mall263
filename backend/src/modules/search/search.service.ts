import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { MeiliSearch, Index } from 'meilisearch';

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
  trustScore: number;
  viewCount: number;
  createdAt: number;
  imageUrl: string;
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
    } catch (e) {
      console.warn('Meilisearch not available, search will use DB fallback:', (e as Error).message);
    }
  }

  private async configureIndex() {
    await this.productsIndex.updateSettings({
      searchableAttributes: ['name', 'description', 'brand', 'category', 'tags', 'colors', 'sizes'],
      filterableAttributes: ['categoryId', 'mallId', 'stallId', 'city', 'inStock', 'minPrice', 'maxPrice', 'trustScore'],
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
  }) {
    const { categoryId, mallId, city, minPrice, maxPrice, inStock, sortBy, page = 1, limit = 20 } = params;

    try {
      // Build filter array
      const filters: string[] = [];
      if (categoryId) filters.push(`categoryId = "${categoryId}"`);
      if (mallId) filters.push(`mallId = "${mallId}"`);
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
      return this.dbFallbackSearch(query, params);
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
            mall: true,
            merchant: { include: { user: { include: { trustScore: true } } } },
          },
        },
      },
    });

    if (!product) return;

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
      city: product.stall.mall?.city || '',
      inStock: product.variants.some(v => v.inventory && v.inventory.quantity > 0),
      trustScore: parseFloat(product.stall.merchant.user.trustScore?.overallScore?.toString() || '50'),
      viewCount: product.viewCount,
      createdAt: product.createdAt.getTime(),
      imageUrl: product.images[0]?.url || '',
    };

    try {
      await this.productsIndex.addDocuments([doc]);
    } catch {
      console.warn('Failed to index product to Meilisearch');
    }
  }

  async reindexAll() {
    const products = await this.prisma.product.findMany({
      where: { status: 'ACTIVE' },
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

  private async dbFallbackSearch(query: string, params: any) {
    const { categoryId, mallId, minPrice, maxPrice, page = 1, limit = 20 } = params;
    const where: any = {
      status: 'ACTIVE',
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { brand: { contains: query, mode: 'insensitive' } },
        { tags: { hasSome: query.split(' ') } },
      ],
    };
    if (categoryId) where.categoryId = categoryId;
    if (mallId) where.stall = { mallId };
    if (minPrice) where.minPrice = { gte: minPrice };
    if (maxPrice) where.maxPrice = { lte: maxPrice };

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          images: { where: { isPrimary: true }, take: 1 },
          category: { select: { name: true } },
          stall: { select: { name: true, mall: { select: { name: true } } } },
          variants: { select: { sellingPrice: true }, where: { isActive: true } },
        },
        orderBy: { viewCount: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { data, total, query, processingTimeMs: 0, page, limit };
  }
}
