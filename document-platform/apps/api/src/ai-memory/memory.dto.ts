import {
  AiConversationStatus,
  AiProjectStatus,
  MemoryDomain,
  MemoryStatus,
  MemoryType,
  MemoryVisibility,
} from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateAiProjectDto {
  @IsString()
  @Length(1, 120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  description?: string;
}

export class UpdateAiProjectDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  description?: string;

  @IsOptional()
  @IsEnum(AiProjectStatus)
  status?: AiProjectStatus;

  @IsOptional()
  @IsBoolean()
  memoryEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  autoExtractionEnabled?: boolean;
}

export class CreateConversationDto {
  @IsOptional()
  @IsString()
  @Length(1, 160)
  title?: string;

  @IsOptional()
  @IsBoolean()
  autoMemoryEnabled?: boolean;
}

export class UpdateConversationDto {
  @IsOptional()
  @IsString()
  @Length(1, 160)
  title?: string;

  @IsOptional()
  @IsEnum(AiConversationStatus)
  status?: AiConversationStatus;

  @IsOptional()
  @IsBoolean()
  autoMemoryEnabled?: boolean;
}

export class SendMessageDto {
  @IsString()
  @Length(1, 32_000)
  content!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  codeContext?: string;
}

export class CreateMemoryDto {
  @IsUUID()
  projectId!: string;

  @IsEnum(MemoryType)
  type!: MemoryType;

  @IsString()
  @Length(1, 160)
  title!: string;

  @IsString()
  @Length(1, 8_000)
  content!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  conceptKey?: string;

  @IsOptional()
  @IsEnum(MemoryVisibility)
  visibility?: MemoryVisibility;

  @IsOptional()
  @IsEnum(MemoryDomain)
  domain?: MemoryDomain;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  importance?: number;

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateMemoryDto {
  @IsOptional()
  @IsEnum(MemoryType)
  type?: MemoryType;

  @IsOptional()
  @IsString()
  @Length(1, 160)
  title?: string;

  @IsOptional()
  @IsString()
  @Length(1, 8_000)
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  conceptKey?: string;

  @IsOptional()
  @IsEnum(MemoryVisibility)
  visibility?: MemoryVisibility;

  @IsOptional()
  @IsEnum(MemoryDomain)
  domain?: MemoryDomain;

  @IsOptional()
  @IsEnum(MemoryStatus)
  status?: MemoryStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  importance?: number;

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class MemoryQueryDto {
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsEnum(MemoryType)
  type?: MemoryType;

  @IsOptional()
  @IsEnum(MemoryStatus)
  status?: MemoryStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  query?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;
}

export class SearchMemoryDto {
  @IsUUID()
  projectId!: string;

  @IsString()
  @Length(1, 2_000)
  query!: string;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(8_000)
  tokenBudget?: number;
}
