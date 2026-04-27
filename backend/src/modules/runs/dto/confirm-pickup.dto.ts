import { IsNumber, IsOptional, IsString, Length } from 'class-validator';

export class ConfirmPickupDto {
  @IsString() @Length(4, 4) pin: string;
  @IsOptional() @IsNumber() gpsLat?: number;
  @IsOptional() @IsNumber() gpsLng?: number;
}
