import { Transform } from 'class-transformer';
import {
  IsArray,
  ArrayMaxSize,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateBlogGenerationDto {
  @IsString()
  @MaxLength(300)
  topic!: string;

  @IsArray()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  keywords: string[] = [];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  focusKeyword?: string;

  @IsString()
  @MaxLength(80)
  language = 'English';

  @IsString()
  @MaxLength(80)
  writingStyle = 'Educational';

  @IsString()
  @MaxLength(80)
  tone = 'Professional';

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(300)
  @Max(10_000)
  targetLength = 1200;

  @IsOptional()
  @IsString()
  @MaxLength(4_000)
  brandContext?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(2_000)
  brandWebsiteUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  promptTemplateVersion?: number;

  @IsOptional()
  @IsString()
  providerCredentialId?: string;

  @IsOptional()
  @IsObject()
  productContext?: Record<string, unknown>;
}

export class UpdateBlogDto {
  @IsInt()
  @Min(1)
  version!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  html?: string;

  @IsOptional()
  @IsObject()
  editorJson?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];
}

export class BlogExportDto {
  @IsIn(['markdown', 'html', 'docx', 'pdf'])
  format!: 'markdown' | 'html' | 'docx' | 'pdf';
}

export class BlogImageDto {
  @IsString()
  @MaxLength(1_000)
  prompt!: string;

  @IsOptional()
  @IsInt()
  @Min(256)
  @Max(2048)
  width = 1200;

  @IsOptional()
  @IsInt()
  @Min(256)
  @Max(2048)
  height = 630;
}

// ─── Blog Studio Providers ───────────────────────────────────

export class CreateBlogProviderDto {
  @IsString()
  @IsIn([
    'OPENAI',
    'GOOGLE',
    'ANTHROPIC',
    'OPENROUTER',
    'GROQ',
    'XAI',
    'HUGGINGFACE',
    'MISTRAL',
    'TOGETHER',
    'FIREWORKS',
    'PERPLEXITY',
    'SARVAM',
    'TAVILY',
    'CUSTOM',
  ])
  providerType!: any; // typed as any for validation, mapped to enum in service

  @IsString()
  @MaxLength(100)
  label!: string;

  @IsString()
  @MaxLength(1000)
  apiKey!: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(2000)
  customEndpoint?: string;
}

export class UpdateBlogProviderDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  apiKey?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(2000)
  customEndpoint?: string;

  @IsOptional()
  isActive?: boolean;
}

// ─── Blog Studio Settings ────────────────────────────────────

export class UpdateBlogStudioSettingsDto {
  @IsOptional()
  @IsString()
  defaultTextModel?: string;

  @IsOptional()
  @IsString()
  defaultImageModel?: string;

  @IsOptional()
  @IsString()
  defaultSearchProvider?: string;

  @IsOptional()
  @IsString()
  deepResearchProvider?: string;

  @IsOptional()
  enableModelDiscovery?: boolean;

  @IsOptional()
  @IsObject()
  settingsJson?: Record<string, unknown>;
}

// ─── Blog Studio Prompts ─────────────────────────────────────

export class CreatePromptTemplateDto {
  @IsString()
  @IsIn(['research', 'sources', 'takeaways', 'outline', 'draft', 'repair', 'humanize', 'quality', 'expand', 'finalize'])
  stage!: string;

  @IsString()
  @MaxLength(100)
  name!: string;

  @IsString()
  @MaxLength(10000)
  systemPrompt!: string;

  @IsString()
  @MaxLength(10000)
  userPrompt!: string;

  @IsOptional()
  isDefault?: boolean;
}

// ─── Blog Studio Destinations ────────────────────────────────

export class CreateBlogDestinationDto {
  @IsString()
  @IsIn(['WORDPRESS', 'SHOPIFY', 'CUSTOM', 'JTL'])
  type!: any; // typed as any for validation, mapped to enum in service

  @IsString()
  @MaxLength(100)
  label!: string;

  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(2000)
  endpointUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  credential?: string; // Will be encrypted

  @IsOptional()
  @IsObject()
  configJson?: Record<string, unknown>;
}

export class UpdateBlogDestinationDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(2000)
  endpointUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  credential?: string;

  @IsOptional()
  @IsObject()
  configJson?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateBlogCategoryDto {
  @IsString()
  @MaxLength(120)
  name!: string;
}

export class UpsertBlogCategoryMappingDto {
  @IsString()
  @MaxLength(120)
  localCategory!: string;

  @IsString()
  @MaxLength(120)
  remoteId!: string;

  @IsString()
  @MaxLength(120)
  remoteName!: string;
}

export class UpdateRemoteBlogPostDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsString()
  html?: string;

  @IsOptional()
  @IsString()
  @IsIn(['draft', 'published', 'publish', 'pending', 'private'])
  status?: string;
}

// ─── Blog Studio Scheduler & CSV ────────────────────────────

export class CreateBlogScheduleDto {
  @IsString()
  @IsIn(['generate', 'publish', 'generate_and_publish'])
  jobType!: string;

  @IsString()
  scheduledAt!: string; // ISO string

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  blogId?: string;

  @IsOptional()
  @IsString()
  destinationId?: string;

  @IsOptional()
  @IsObject()
  inputJson?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsBoolean()
  generateImages?: boolean;

  @IsOptional()
  @IsBoolean()
  autoPublish?: boolean;
}

export class ImportBlogSchedulesDto {
  @IsArray()
  @ArrayMaxSize(500)
  @IsObject({ each: true })
  rows!: Array<Record<string, unknown>>;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  filename?: string;
}

export class UpdateBlogScheduleDto {
  @IsOptional()
  @IsString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsObject()
  inputJson?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  destinationId?: string;

  @IsOptional()
  @IsBoolean()
  generateImages?: boolean;

  @IsOptional()
  @IsBoolean()
  autoPublish?: boolean;
}

// ─── Blog Studio Products ───────────────────────────────────

export class CreateBlogProductCollectionDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(2000)
  sourceUrl?: string;

  @IsOptional()
  @IsString()
  sourceType?: string;
}

export class CreateBlogProductDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  externalId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  price?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsUrl()
  productUrl?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsObject()
  fieldsJson?: Record<string, unknown>;
}
