import { PartialType } from '@nestjs/mapped-types';
import { CreateMallDto } from './create-mall.dto';

export class UpdateMallDto extends PartialType(CreateMallDto) {}
