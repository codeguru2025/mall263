import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class MerchantSelfSetupDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  businessName: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  businessPhone?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  stallName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  stallNumber: string;

  @IsOptional()
  @IsUUID()
  mallId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;
}
