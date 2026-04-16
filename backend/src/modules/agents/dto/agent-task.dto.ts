import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { AgentTaskType } from '@prisma/client';

export class CreateAgentTaskDto {
  @IsEnum(AgentTaskType)
  type: AgentTaskType;

  @IsObject()
  data: Record<string, unknown>;

  @IsOptional()
  @IsString()
  offlineId?: string;
}

export class AgentOfflineTaskDto {
  @IsEnum(AgentTaskType)
  type: AgentTaskType;

  @IsObject()
  data: Record<string, unknown>;

  @IsString()
  offlineId: string;
}

export class SyncOfflineTasksDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgentOfflineTaskDto)
  tasks: AgentOfflineTaskDto[];
}
