import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class AdjustStockDto {
  @IsUUID()
  variantId: string;

  @IsInt()
  changeQty: number;

  @IsString()
  @MaxLength(500)
  reason: string;
}

export class BulkAdjustItemDto {
  @IsUUID()
  variantId: string;

  @IsInt()
  quantity: number;
}

export class BulkAdjustStockDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkAdjustItemDto)
  adjustments: BulkAdjustItemDto[];
}

export class SetThresholdDto {
  @IsNumber()
  @Min(0)
  threshold: number;
}
