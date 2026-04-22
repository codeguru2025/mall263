import { IsString, IsEnum, IsNumber, IsOptional, IsNotEmpty, IsBoolean, Min, Max, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

enum DiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED_AMOUNT = 'FIXED_AMOUNT',
  BOGO = 'BOGO',
  BOGO_PERCENTAGE = 'BOGO_PERCENTAGE'
}

enum DiscountReason {
  PROMOTION = 'PROMOTION',
  LOYALTY = 'LOYALTY',
  BULK_PURCHASE = 'BULK_PURCHASE',
  SEASONAL = 'SEASONAL',
  CLEARANCE = 'CLEARANCE',
  EMPLOYEE = 'EMPLOYEE',
  CUSTOMER_REQUEST = 'CUSTOMER_REQUEST',
  DAMAGED_GOODS = 'DAMAGED_GOODS',
  COMPETITOR_MATCH = 'COMPETITOR_MATCH'
}

export class CreateDiscountDto {
  @IsString()
  @IsNotEmpty()
  stallId: string;

  @IsString()
  @IsOptional()
  @IsNotEmpty()
  code?: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(DiscountType)
  type: DiscountType;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  value: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  @Min(0)
  minAmount?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  @Min(0)
  maxDiscount?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  usageLimit?: number;

  @IsEnum(DiscountReason)
  reason: DiscountReason;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsDateString()
  @IsOptional()
  startsAt?: string;

  @IsDateString()
  @IsOptional()
  endsAt?: string;
}
