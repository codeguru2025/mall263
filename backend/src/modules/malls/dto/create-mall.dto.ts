import { IsString, IsOptional, IsNotEmpty, IsNumber, IsBoolean, MaxLength, Min, Max } from 'class-validator';

export class CreateMallDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  cityId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address: string;

  @IsNumber()
  @IsOptional()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsNumber()
  @IsOptional()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  imageUrl?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
