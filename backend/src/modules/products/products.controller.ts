import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UserRole, ProductStatus } from '@prisma/client';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STALL_OWNER, UserRole.FIELD_AGENT, UserRole.ATTENDANT)
  @ApiOperation({ summary: 'Create a product with variants' })
  async create(@Body() data: any) {
    return this.productsService.create(data.stallId, data);
  }

  @Get('browse')
  @Public()
  @ApiOperation({ summary: 'Browse products (public)' })
  async browse(
    @Query('categoryId') categoryId?: string,
    @Query('mallId') mallId?: string,
    @Query('minPrice') minPrice?: number,
    @Query('maxPrice') maxPrice?: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sortBy') sortBy?: string,
  ) {
    return this.productsService.browse({ categoryId, mallId, minPrice, maxPrice, page, limit, sortBy });
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

  @Get('stall/:stallId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get products by stall' })
  async getByStall(
    @Param('stallId') stallId: string,
    @Query('status') status?: ProductStatus,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.productsService.findByStall(stallId, { status, page, limit });
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get product by ID' })
  async getById(@Param('id') id: string) {
    return this.productsService.findById(id, 'FREE');
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STALL_OWNER, UserRole.ATTENDANT)
  @ApiOperation({ summary: 'Update product' })
  async update(@Param('id') id: string, @Body() data: any) {
    return this.productsService.updateProduct(id, data.stallId, data);
  }

  @Patch('variants/:variantId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STALL_OWNER, UserRole.ATTENDANT)
  @ApiOperation({ summary: 'Update product variant' })
  async updateVariant(@Param('variantId') variantId: string, @Body() data: any) {
    return this.productsService.updateVariant(variantId, data);
  }
}
