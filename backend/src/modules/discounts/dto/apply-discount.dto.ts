import { IsString, IsOptional, IsNumber, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class ApplyDiscountDto {
  @IsString()
  @IsNotEmpty()
  stallId: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  discountId?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Type(() => Number)
  subtotalAmount: number;
}
