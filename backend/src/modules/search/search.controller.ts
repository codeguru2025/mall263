import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SearchService } from './search.service';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private searchService: SearchService) {}

  @Get()
  @Public()
  @Throttle({ global: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Search products (fuzzy, typo-tolerant)' })
  async search(
    @Query('q') query: string,
    @Query('categoryId') categoryId?: string,
    @Query('mallId') mallId?: string,
    @Query('mall') mallLegacy?: string,
    @Query('city') city?: string,
    @Query('minPrice') minPriceStr?: string,
    @Query('maxPrice') maxPriceStr?: string,
    @Query('inStock') inStock?: boolean,
    @Query('sortBy') sortBy?: string,
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
    @Query('nearLat') nearLatStr?: string,
    @Query('nearLng') nearLngStr?: string,
    @Query('radiusKm') radiusKmStr?: string,
  ) {
    const resolvedMall = mallId || mallLegacy;
    const minPrice = minPriceStr !== undefined ? Math.max(0, parseFloat(minPriceStr) || 0) : undefined;
    const maxPrice = maxPriceStr !== undefined ? Math.min(1_000_000, parseFloat(maxPriceStr) || 1_000_000) : undefined;
    const page = pageStr !== undefined ? Math.max(1, Math.min(1000, parseInt(pageStr, 10) || 1)) : undefined;
    const limit = limitStr !== undefined ? Math.max(1, Math.min(100, parseInt(limitStr, 10) || 20)) : undefined;
    const nearLat = nearLatStr !== undefined ? parseFloat(nearLatStr) : undefined;
    const nearLng = nearLngStr !== undefined ? parseFloat(nearLngStr) : undefined;
    const radiusKm = radiusKmStr !== undefined ? Math.max(0.1, Math.min(500, parseFloat(radiusKmStr) || 10)) : undefined;
    return this.searchService.search(query || '', { categoryId, mallId: resolvedMall, city, minPrice, maxPrice, inStock, sortBy, page, limit, nearLat, nearLng, radiusKm });
  }

  @Get('suggestions')
  @Public()
  @ApiOperation({ summary: 'Get search suggestions (autocomplete)' })
  async suggestions(@Query('q') query: string) {
    return this.searchService.getSuggestions(query || '');
  }

  @Get('market-price')
  @Public()
  @ApiOperation({ summary: 'Get market average price' })
  async marketPrice(@Query('categoryId') categoryId: string, @Query('name') name?: string) {
    return this.searchService.getMarketPrice(categoryId, name);
  }

  @Post('reindex')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Reindex all products (admin)' })
  async reindex() {
    return this.searchService.reindexAll();
  }
}
