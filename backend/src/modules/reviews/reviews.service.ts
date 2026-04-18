import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async createReview(reviewerId: string, data: {
    productId: string;
    rating: number;
    title?: string;
    body?: string;
  }) {
    if (data.rating < 1 || data.rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }
    const product = await this.prisma.product.findUnique({ where: { id: data.productId } });
    if (!product) throw new NotFoundException('Product not found');

    try {
      return await this.prisma.productReview.create({
        data: {
          productId: data.productId,
          reviewerId,
          rating: data.rating,
          title: data.title?.trim() || null,
          body: data.body?.trim() || null,
        },
        include: {
          reviewer: { select: { id: true, firstName: true, lastName: true } },
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new BadRequestException('You have already reviewed this product');
      }
      throw err;
    }
  }

  async getProductReviews(productId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.productReview.findMany({
        where: { productId },
        include: {
          reviewer: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.productReview.count({ where: { productId } }),
    ]);

    const avgRating = total > 0
      ? await this.prisma.productReview.aggregate({
          where: { productId },
          _avg: { rating: true },
        }).then((r) => r._avg.rating)
      : null;

    return { data, total, page, limit, avgRating };
  }

  async deleteReview(reviewId: string, requesterId: string) {
    const review = await this.prisma.productReview.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Review not found');
    if (review.reviewerId !== requesterId) throw new ForbiddenException('Not your review');
    await this.prisma.productReview.delete({ where: { id: reviewId } });
    return { ok: true };
  }
}
