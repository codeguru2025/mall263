import { IsArray, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { DeliveryMode } from '@prisma/client';

export class RunStopItemDto {
  @IsUUID() variantId: string;
  @IsNumber() @Min(1) quantity: number;
}

export class RunStopDto {
  @IsUUID() stallId: string;
  @IsNumber() @Min(1) stopOrder: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => RunStopItemDto) @ArrayMinSize(1)
  items: RunStopItemDto[];
}

export class CreateRunDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => RunStopDto) @ArrayMinSize(2)
  stops: RunStopDto[];

  @IsEnum(DeliveryMode) mode: DeliveryMode;

  /** Required when pickupPointId is not set */
  @IsOptional() @IsString() dropZone?: string;
  @IsOptional() @IsString() dropAddress?: string;
  @IsOptional() @IsNumber() dropLat?: number;
  @IsOptional() @IsNumber() dropLng?: number;
  @IsOptional() @IsNumber() @Min(0) maxBudget?: number;

  /** When set, run uses a named pickup point instead of a home address */
  @IsOptional() @IsUUID() pickupPointId?: string;
}
