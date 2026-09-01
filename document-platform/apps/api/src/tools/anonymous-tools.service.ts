import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';
import { FilesService } from '../files/files.service';
import { ConversionsService } from '../conversions/conversions.service';
import { ToolsService } from './tools.service';
import { AnonymousQuotaService } from './anonymous-quota.service';
import { OutputFormat } from '@docconv/shared-types';
import { getExtension } from '@docconv/file-validation';

const ANONYMOUS_EMAIL = 'anonymous@internal.toolsuite.local';
const ANONYMOUS_ORG_SLUG = 'internal-anonymous-tools';
const JOB_TTL_SECONDS = 60 * 60;

@Injectable()
export class AnonymousToolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly files: FilesService,
    private readonly conversions: ConversionsService,
    private readonly tools: ToolsService,
    private readonly quota: AnonymousQuotaService,
  ) {}

  async execute(params: {
    slug: string;
    anonId: string;
    ip: string;
    targetFormat?: string;
    url?: string;
    file?: Express.Multer.File;
    settings?: Record<string, unknown>;
  }) {
    const tool = await this.tools.getToolBySlug(params.slug);
    if (!tool.anonymousEnabled) {
      throw new BadRequestException('This tool requires a free AppToolkitLab account.');
    }

    const targetFormat = (params.targetFormat || tool.outputFormats[0] || '').toLowerCase();
    if (!tool.outputFormats.includes(targetFormat)) {
      throw new BadRequestException(
        `Unsupported output '${targetFormat}'. Choose: ${tool.outputFormats.join(', ')}.`,
      );
    }

    const isUrlTool = tool.acceptedFormats.includes('url');
    if (isUrlTool && !params.url) {
      throw new BadRequestException('A public http:// or https:// URL is required.');
    }
    if (!isUrlTool && !params.file) {
      throw new BadRequestException('A source file is required.');
    }

    const inputFormat = isUrlTool
      ? 'url'
      : getExtension(params.file!.originalname) || '';
    const inputSize = isUrlTool
      ? Buffer.byteLength(params.url!, 'utf8')
      : params.file!.size;
    await this.tools.validateToolExecution(params.slug, null, inputSize, inputFormat);

    let quotaConsumed = false;
    try {
      await this.quota.consumeQuota(params.ip, params.anonId);
      quotaConsumed = true;

      const principal = await this.getAnonymousPrincipal();
      const storedFile = isUrlTool
        ? await this.files.uploadPastedContent(
            principal.userId,
            principal.organizationId,
            params.url!,
            'url',
          )
        : await this.files.uploadFile(
            principal.userId,
            principal.organizationId,
            params.file!,
          );

      const conversion = await this.conversions.createConversion(
        principal.userId,
        principal.organizationId,
        {
          sourceFileId: storedFile.id,
          targetFormat: targetFormat as OutputFormat,
          settings: params.settings as any,
        },
      );

      await this.redis.set(
        this.jobOwnerKey(conversion.id),
        params.anonId,
        JOB_TTL_SECONDS,
      );

      return conversion;
    } catch (error) {
      if (quotaConsumed) {
        await this.quota.releaseQuota(params.ip, params.anonId);
      }
      throw error;
    }
  }

  async getStatus(jobId: string, anonId: string) {
    await this.assertJobOwner(jobId, anonId);
    const principal = await this.getAnonymousPrincipal();
    return this.conversions.getJobStatus(jobId, principal.organizationId);
  }

  async getDownloadUrl(jobId: string, anonId: string) {
    await this.assertJobOwner(jobId, anonId);
    const principal = await this.getAnonymousPrincipal();
    return this.conversions.getDownloadUrl(jobId, principal.organizationId);
  }

  private async assertJobOwner(jobId: string, anonId: string) {
    const owner = await this.redis.get(this.jobOwnerKey(jobId));
    if (!owner || owner !== anonId) {
      throw new NotFoundException('Anonymous conversion not found or expired.');
    }
  }

  private jobOwnerKey(jobId: string) {
    return `tools:anonymous-job:${jobId}`;
  }

  private async getAnonymousPrincipal() {
    const [user, organization] = await Promise.all([
      this.prisma.user.findUnique({ where: { email: ANONYMOUS_EMAIL } }),
      this.prisma.organization.findUnique({ where: { slug: ANONYMOUS_ORG_SLUG } }),
    ]);
    if (!user || !organization) {
      throw new NotFoundException(
        'Anonymous tools are not initialized. Run the AppToolkitLab database seed.',
      );
    }
    return { userId: user.id, organizationId: organization.id };
  }
}
