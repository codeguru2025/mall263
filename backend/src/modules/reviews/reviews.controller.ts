import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Submit a product review' })
  async create(
    @CurrentUser('id') reviewerId: string,
    @Body() data: { productId: string; rating: number; title?: string; body?: string },
  ) {
    return this.reviewsService.createReview(reviewerId, data);
  }

  @Get('product/:productId')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get reviews for a product' })
  async getForProduct(
    @Param('productId') productId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reviewsService.getProductReviews(
      productId,
      page ? parseInt(page) : 1,
      limit ? Math.min(parseInt(limit), 50) : 20,
    );
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete your own review' })
  async delete(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.reviewsService.deleteReview(id, userId);
  }
}
