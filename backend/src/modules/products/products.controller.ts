import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole, ProductStatus } from '@prisma/client';
import { CreateProductDto, UpdateProductDto, UpdateVariantDto } from './dto/product.dto';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STALL_OWNER, UserRole.FIELD_AGENT, UserRole.ATTENDANT)
  @ApiOperation({ summary: 'Create a product with variants' })
  async create(@Body() data: CreateProductDto, @CurrentUser('id') userId: string) {
    return this.productsService.create(data.stallId, data, userId);
  }

  @Get('browse')
  @Public()
  @Throttle({ global: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Browse products (public). Supports nearLat/nearLng/radiusKm for geo-proximity filtering.' })
  async browse(
    @Query('categoryId') categoryId?: string,
    @Query('mallId') mallId?: string,
    @Query('stallId') stallId?: string,
    @Query('minPrice') minPrice?: number,
    @Query('maxPrice') maxPrice?: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sortBy') sortBy?: string,
    @Query('nearLat') nearLat?: number,
    @Query('nearLng') nearLng?: number,
    @Query('radiusKm') radiusKm?: number,
  ) {
    return this.productsService.browse({ categoryId, mallId, stallId, minPrice, maxPrice, page, limit, sortBy, nearLat, nearLng, radiusKm });
  }

  @Get('for-you')
  @Public()
  @ApiOperation({ summary: 'Ranked feed blending popularity, trust, and client interest signals' })
  async forYou(
    @Query('categoryIds') categoryIds?: string,
    @Query('mallId') mallId?: string,
    @Query('excludeIds') excludeIds?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.productsService.forYou({
      categoryIds: categoryIds?.split(',').map((s) => s.trim()).filter(Boolean),
      mallId,
      excludeProductIds: excludeIds?.split(',').map((s) => s.trim()).filter(Boolean),
      page,
      limit,
    });
  }

  @Get('categories')
  @Public()
  @ApiOperation({ summary: 'Get all categories' })
  async getCategories() {
    return this.productsService.getCategories();
  }

  @Get('boost/pricing')
  @Public()
  @ApiOperation({ summary: 'Get listing boost pricing tiers' })
  async getBoostPricing() {
    return this.productsService.getBoostPricing();
  }

  @Get('stall/:stallId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get products by stall' })
  async getByStall(
    @Param('stallId') stallId: string,
    @Query('status') status?: ProductStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.productsService.findByStall(stallId, { status, page, limit, search });
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get product by ID (trial/funded users see full seller details)' })
  async getById(@Param('id') id: string, @CurrentUser('id') userId?: string) {
    return this.productsService.findById(id, userId);
  }

  @Patch('variants/:variantId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STALL_OWNER, UserRole.ATTENDANT)
  @ApiOperation({ summary: 'Update product variant' })
  async updateVariant(@Param('variantId') variantId: string, @Body() data: UpdateVariantDto) {
    return this.productsService.updateVariant(variantId, data);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STALL_OWNER, UserRole.ATTENDANT)
  @ApiOperation({ summary: 'Update product' })
  async update(@Param('id') id: string, @Body() data: UpdateProductDto) {
    return this.productsService.updateProduct(id, data.stallId, data);
  }

  @Post(':id/boost')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STALL_OWNER)
  @ApiOperation({ summary: 'Boost a product listing (deducts from wallet)' })
  async boostProduct(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body('days') days: 7 | 14 | 30,
  ) {
    return this.productsService.boostProduct(userId, id, days);
  }
}
