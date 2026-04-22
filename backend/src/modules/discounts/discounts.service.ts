import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { UpdateDiscountDto } from './dto/update-discount.dto';
import { ApplyDiscountDto } from './dto/apply-discount.dto';
import { DiscountType, DiscountReason } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class DiscountsService {
  constructor(private prisma: PrismaService) {}

  async create(stallId: string, createDiscountDto: CreateDiscountDto, userId: string) {
    // Verify the user owns this stall
    const stall = await this.prisma.stall.findUnique({
      where: { id: stallId },
      include: { merchant: { select: { userId: true } } },
    });

    if (!stall) {
      throw new NotFoundException(`Stall with ID "${stallId}" not found`);
    }

    if (stall.merchant.userId !== userId) {
      throw new ForbiddenException('You do not have permission to create discounts for this stall');
    }

    // Validate discount code uniqueness if provided
    if (createDiscountDto.code) {
      const existingDiscount = await this.prisma.discount.findFirst({
        where: { 
          code: createDiscountDto.code.toUpperCase(),
          isActive: true
        }
      });

      if (existingDiscount) {
        throw new BadRequestException(`Discount code "${createDiscountDto.code}" already exists`);
      }
    }

    // Validate discount values based on type
    this.validateDiscountValues(createDiscountDto.type, new Decimal(createDiscountDto.value));

    return this.prisma.discount.create({
      data: {
        stallId,
        code: createDiscountDto.code?.toUpperCase(),
        name: createDiscountDto.name,
        type: createDiscountDto.type,
        value: createDiscountDto.value,
        minAmount: createDiscountDto.minAmount,
        maxDiscount: createDiscountDto.maxDiscount,
        usageLimit: createDiscountDto.usageLimit,
        reason: createDiscountDto.reason,
        startsAt: createDiscountDto.startsAt,
        endsAt: createDiscountDto.endsAt,
        createdById: userId,
      },
      include: {
        stall: {
          select: {
            id: true,
            name: true,
            stallNumber: true
          }
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });
  }

  async findAll(stallId: string, includeInactive = false) {
    return this.prisma.discount.findMany({
      where: { 
        stallId,
        isActive: includeInactive ? undefined : true
      },
      include: {
        stall: {
          select: {
            id: true,
            name: true,
            stallNumber: true
          }
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        _count: {
          select: { sales: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async findOne(id: string, stallId?: string) {
    const discount = await this.prisma.discount.findUnique({
      where: { id },
      include: {
        stall: {
          select: {
            id: true,
            name: true,
            stallNumber: true,
            merchantId: true
          }
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        sales: {
          select: {
            id: true,
            totalAmount: true,
            discountAmount: true,
            createdAt: true
          },
          take: 10,
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!discount) {
      throw new NotFoundException(`Discount with ID "${id}" not found`);
    }

    // Check stall access if provided
    if (stallId && discount.stall.id !== stallId) {
      throw new ForbiddenException('You do not have permission to view this discount');
    }

    return discount;
  }

  async update(id: string, updateDiscountDto: UpdateDiscountDto, userId: string) {
    const discount = await this.prisma.discount.findUnique({
      where: { id },
      include: {
        stall: {
          include: { merchant: true }
        }
      }
    });

    if (!discount) {
      throw new NotFoundException(`Discount with ID "${id}" not found`);
    }

    if (discount.stall.merchantId !== userId) {
      throw new ForbiddenException('You do not have permission to update this discount');
    }

    // Validate discount code uniqueness if being updated
    if (updateDiscountDto.code && updateDiscountDto.code !== discount.code) {
      const existingDiscount = await this.prisma.discount.findFirst({
        where: { 
          code: updateDiscountDto.code.toUpperCase(),
          id: { not: id },
          isActive: true
        }
      });

      if (existingDiscount) {
        throw new BadRequestException(`Discount code "${updateDiscountDto.code}" already exists`);
      }
    }

    // Validate discount values if type or value is being updated
    if (updateDiscountDto.type || updateDiscountDto.value) {
      const type = updateDiscountDto.type || discount.type;
      const value = updateDiscountDto.value ? new Decimal(updateDiscountDto.value) : discount.value;
      this.validateDiscountValues(type, value);
    }

    return this.prisma.discount.update({
      where: { id },
      data: {
        ...updateDiscountDto,
        code: updateDiscountDto.code?.toUpperCase(),
      },
      include: {
        stall: {
          select: {
            id: true,
            name: true,
            stallNumber: true
          }
        }
      }
    });
  }

  async remove(id: string, userId: string) {
    const discount = await this.prisma.discount.findUnique({
      where: { id },
      include: {
        stall: {
          include: { merchant: true }
        }
      }
    });

    if (!discount) {
      throw new NotFoundException(`Discount with ID "${id}" not found`);
    }

    if (discount.stall.merchantId !== userId) {
      throw new ForbiddenException('You do not have permission to delete this discount');
    }

    // Soft delete by setting isActive to false
    return this.prisma.discount.update({
      where: { id },
      data: { isActive: false }
    });
  }

  async validateAndCalculateDiscount(stallId: string, applyDiscountDto: ApplyDiscountDto): Promise<{
    discount: any;
    discountAmount: Decimal;
    finalAmount: Decimal;
  }> {
    const discount = await this.prisma.discount.findFirst({
      where: {
        stallId,
        isActive: true,
        OR: [
          { code: applyDiscountDto.code?.toUpperCase() },
          { id: applyDiscountDto.discountId }
        ]
      }
    });

    if (!discount) {
      throw new BadRequestException('Invalid or inactive discount code');
    }

    // Check if discount is within valid date range
    const now = new Date();
    if (discount.startsAt && now < discount.startsAt) {
      throw new BadRequestException('Discount has not started yet');
    }
    if (discount.endsAt && now > discount.endsAt) {
      throw new BadRequestException('Discount has expired');
    }

    // Check usage limit
    if (discount.usageLimit && discount.usageCount >= discount.usageLimit) {
      throw new BadRequestException('Discount usage limit has been reached');
    }

    // Check minimum amount requirement
    const subtotalDecimal = new Decimal(applyDiscountDto.subtotalAmount);
    if (discount.minAmount && subtotalDecimal.lessThan(discount.minAmount)) {
      throw new BadRequestException(`Minimum amount of $${discount.minAmount} required for this discount`);
    }

    // Calculate discount amount
    let discountAmount = new Decimal(0);

    switch (discount.type) {
      case 'PERCENTAGE':
        discountAmount = subtotalDecimal.mul(discount.value.div(100));
        break;
      case 'FIXED_AMOUNT':
        discountAmount = discount.value;
        break;
      case 'BOGO':
        // For BOGO, we apply the discount to the cheapest item (simplified)
        // In a real implementation, you'd need the actual cart items
        discountAmount = subtotalDecimal.div(2);
        break;
      case 'BOGO_PERCENTAGE':
        // Apply percentage discount to half the order value
        discountAmount = subtotalDecimal.div(2).mul(discount.value.div(100));
        break;
      default:
        throw new BadRequestException('Invalid discount type');
    }

    // Apply maximum discount limit if set
    if (discount.maxDiscount && discountAmount.greaterThan(discount.maxDiscount)) {
      discountAmount = discount.maxDiscount;
    }

    // Ensure discount doesn't exceed subtotal
    if (discountAmount.greaterThan(subtotalDecimal)) {
      discountAmount = subtotalDecimal;
    }

    const finalAmount = subtotalDecimal.sub(discountAmount);

    return {
      discount,
      discountAmount,
      finalAmount
    };
  }

  async applyDiscountToSale(discountId: string, saleId: string) {
    const discount = await this.prisma.discount.findUnique({
      where: { id: discountId }
    });

    if (!discount) {
      throw new NotFoundException('Discount not found');
    }

    // Increment usage count
    return this.prisma.discount.update({
      where: { id: discountId },
      data: {
        usageCount: {
          increment: 1
        }
      }
    });
  }

  private validateDiscountValues(type: DiscountType, value: Decimal) {
    switch (type) {
      case DiscountType.PERCENTAGE:
        if (value.lessThan(0) || value.greaterThan(100)) {
          throw new BadRequestException('Percentage discount must be between 0 and 100');
        }
        break;
      case DiscountType.FIXED_AMOUNT:
        if (value.lessThan(0)) {
          throw new BadRequestException('Fixed amount discount must be positive');
        }
        break;
      case DiscountType.BOGO_PERCENTAGE:
        if (value.lessThan(0) || value.greaterThan(100)) {
          throw new BadRequestException('BOGO percentage discount must be between 0 and 100');
        }
        break;
      case DiscountType.BOGO:
        // BOGO doesn't need a value validation
        break;
      default:
        throw new BadRequestException('Invalid discount type');
    }
  }

  async getDiscountStats(stallId: string) {
    const discounts = await this.prisma.discount.findMany({
      where: { stallId },
      include: {
        sales: {
          select: {
            totalAmount: true,
            discountAmount: true,
            createdAt: true
          }
        }
      }
    });

    const totalDiscountsGiven = discounts.reduce(
      (sum, discount) => sum + discount.sales.reduce((saleSum, sale) => 
        saleSum + parseFloat(sale.discountAmount.toString()), 0), 0
    );

    const totalUsageCount = discounts.reduce(
      (sum, discount) => sum + discount.usageCount, 0
    );

    const activeDiscounts = discounts.filter(d => d.isActive).length;

    return {
      totalDiscountsGiven,
      totalUsageCount,
      activeDiscounts,
      totalDiscountsCreated: discounts.length,
      averageDiscountPerUse: totalUsageCount > 0 ? totalDiscountsGiven / totalUsageCount : 0
    };
  }
}
