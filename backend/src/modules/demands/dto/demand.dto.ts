import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { DemandUrgency, PaymentMethod } from '@prisma/client';

export class CreateDemandDto {
  @IsString()
  @MaxLength(500)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsUUID()
  stallId?: string;

  @IsOptional()
  @IsString()
  preferredSize?: string;

  @IsOptional()
  @IsString()
  preferredColor?: string;

  @IsOptional()
  @IsString()
  preferredBrand?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minBudget?: number;

  @IsNumber()
  @Min(0.01)
  maxBudget: number;

  @IsOptional()
  @IsEnum(DemandUrgency)
  urgency?: DemandUrgency;

  @IsOptional()
  @IsUUID()
  mallId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(168 * 4)
  expiresInHours?: number;
}

export class OfferItemDto {
  @IsUUID()
  variantId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0.01)
  price: number;
}

export class SubmitOfferDto {
  @IsUUID()
  stallId: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @IsNumber()
  @Min(0.01)
  totalPrice: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OfferItemDto)
  items: OfferItemDto[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(168)
  expiresInHours?: number;
}

export class RequestDeliveryDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  buyerLat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  buyerLng: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  buyerAddress?: string;
}

export class CompleteDemandSaleDto {
  @IsUUID()
  stallId: string;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;
}
