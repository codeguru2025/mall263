import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class PlaceBidDto {
  @IsNumber() @Min(0.01) fee: number;
  @IsOptional() @IsString() @MaxLength(280) message?: string;
}
