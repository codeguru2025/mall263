import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Search products (fuzzy, typo-tolerant)' })
  async search(
    @Query('q') query: string,
    @Query('categoryId') categoryId?: string,
    @Query('mallId') mallId?: string,
    @Query('city') city?: string,
    @Query('minPrice') minPrice?: number,
    @Query('maxPrice') maxPrice?: number,
    @Query('inStock') inStock?: boolean,
    @Query('sortBy') sortBy?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.searchService.search(query || '', { categoryId, mallId, city, minPrice, maxPrice, inStock, sortBy, page, limit });
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
