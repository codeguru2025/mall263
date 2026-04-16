import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class MerchantsOnboardDto {
  @IsUUID()
  userId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  businessName: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  businessPhone?: string;
}
