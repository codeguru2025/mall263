import { IsString, IsNotEmpty, IsEnum, IsOptional, IsNumber } from 'class-validator';

enum ShelfLayer {
  MIDDLE = 'MIDDLE',
  TOP = 'TOP',
  BOTTOM = 'BOTTOM'
}

export class CreateVideoDto {
  @IsString()
  @IsNotEmpty()
  aisleName: string;

  @IsEnum(ShelfLayer)
  shelfLayer: ShelfLayer;

  @IsString()
  @IsNotEmpty()
  videoUrl: string;

  @IsString()
  @IsOptional()
  thumbnailUrl?: string;

  @IsNumber()
  @IsOptional()
  duration?: number; // in seconds

  @IsNumber()
  @IsOptional()
  fileSize?: number; // in bytes
}
