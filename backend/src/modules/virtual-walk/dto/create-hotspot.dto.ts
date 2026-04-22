import { IsString, IsNotEmpty, IsNumber, Min, Max } from 'class-validator';

export class CreateHotspotDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsNumber()
  @Min(0)
  timestamp: number; // in seconds from video start

  @IsNumber()
  @Min(0)
  @Max(1)
  xCoord: number; // normalized 0-1

  @IsNumber()
  @Min(0)
  @Max(1)
  yCoord: number; // normalized 0-1
}
