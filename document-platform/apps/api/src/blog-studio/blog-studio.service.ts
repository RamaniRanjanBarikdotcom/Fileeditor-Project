import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { BlogDocumentStatus, BlogGenerationStatus, Prisma } from '@prisma/client';
import { sanitizeGeneratedHtml, type BlogGenerationInput } from '@docconv/blog-engine';
import { StorageClient, createStorageConfig } from '@docconv/storage';
import { PrismaService } from '../common/prisma.service';
import { FilesService } from '../files/files.service';
import { ConversionsService } from '../conversions/conversions.service';
import { BlogAiAdapter } from './blog-ai.adapter';
import { BlogUsageService } from './blog-usage.service';
import { BlogExportDto, CreateBlogGenerationDto, UpdateBlogDto } from './blog-studio.dto';
import { BlogWebsiteContextService } from './blog-website-context.service';

@Injectable()
export class BlogStudioService {
  private readonly storage = new StorageClient(
    createStorageConfig(process.env as Record<string, string | undefined>),
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly usage: BlogUsageService,
    private readonly ai: BlogAiAdapter,
    private readonly files: FilesService,
    private readonly conversions: ConversionsService,
    private readonly websiteContext: BlogWebsiteContextService,
  ) {}

  async createGeneration(
    userId: string,
    organizationId: string,
    dto: CreateBlogGenerationDto,
    internalMetadata?: Record<string, unknown>,
  ) {
    await this.assertMembership(userId, organizationId);
    if (!dto.providerCredentialId && !this.ai.isConfigured()) {
      throw new ServiceUnavailableException('Blog Studio AI is not configured on this server.');
    }
    const websiteContext = dto.brandWebsiteUrl
      ? await this.websiteContext.fetch(dto.brandWebsiteUrl)
      : '';
    const input: BlogGenerationInput = {
      topic: dto.topic.trim(),
      keywords: dto.keywords
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 20),
      focusKeyword: dto.focusKeyword?.trim(),
      language: dto.language.trim(),
      writingStyle: dto.writingStyle.trim(),
      tone: dto.tone.trim(),
      targetLength: dto.targetLength,
      brandContext:
        [
          dto.brandContext?.trim(),
          websiteContext
            ? `Untrusted website reference (${dto.brandWebsiteUrl}): ${websiteContext}`
            : '',
        ]
          .filter(Boolean)
          .join('\n\n') || undefined,
      brandWebsiteUrl: dto.brandWebsiteUrl?.trim(),
      promptTemplateVersion: dto.promptTemplateVersion,
      providerCredentialId: dto.providerCredentialId,
      productContext: dto.productContext as BlogGenerationInput['productContext'],
    };
    const result = await this.usage.reserve(userId, organizationId, input, internalMetadata);
    return {
      id: result.job.id,
      status: result.job.status,
      estimatedCredits: result.estimatedCredits,
      usage: result.usage,
    };
  }

  async getGeneration(userId: string, organizationId: string, id: string) {
    await this.assertMembership(userId, organizationId);
    const job = await this.prisma.blogGenerationJob.findFirst({
      where: { id, organizationId },
      include: { blog: { select: { id: true, title: true, slug: true } }, reservation: true },
    });
    if (!job) throw new NotFoundException('Blog generation was not found.');
    return job;
  }

  async cancelGeneration(userId: string, organizationId: string, id: string) {
    await this.getGeneration(userId, organizationId, id);
    const updated = await this.prisma.blogGenerationJob.updateMany({
      where: {
        id,
        organizationId,
        status: { in: [BlogGenerationStatus.QUEUED, BlogGenerationStatus.PROCESSING] },
      },
      data: { cancelRequestedAt: new Date() },
    });
    if (updated.count !== 1)
      throw new ConflictException('This generation can no longer be cancelled.');
    return { id, cancelRequested: true };
  }

  async listBlogs(userId: string, organizationId: string, query?: string, language?: string) {
    await this.assertMembership(userId, organizationId);
    return this.prisma.blogDocument.findMany({
      where: {
        organizationId,
        status: { not: BlogDocumentStatus.DELETED },
        ...(language ? { language } : {}),
        ...(query
          ? {
              OR: [
                { title: { contains: query, mode: 'insensitive' } },
                { topic: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        slug: true,
        topic: true,
        language: true,
        status: true,
        seoScore: true,
        wordCount: true,
        version: true,
        createdAt: true,
        updatedAt: true,
      },
      take: 100,
    });
  }

  async getBlog(userId: string, organizationId: string, id: string) {
    await this.assertMembership(userId, organizationId);
    const blog = await this.prisma.blogDocument.findFirst({
      where: { id, organizationId, status: { not: BlogDocumentStatus.DELETED } },
      include: {
        sources: true,
        images: true,
        exports: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!blog) throw new NotFoundException('Blog was not found.');
    return blog;
  }

  async updateBlog(userId: string, organizationId: string, id: string, dto: UpdateBlogDto) {
    await this.assertMembership(userId, organizationId);
    const html = dto.html === undefined ? undefined : sanitizeGeneratedHtml(dto.html);
    const result = await this.prisma.blogDocument.updateMany({
      where: {
        id,
        organizationId,
        version: dto.version,
        status: { not: BlogDocumentStatus.DELETED },
      },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(html !== undefined ? { html, wordCount: countWords(html) } : {}),
        ...(dto.editorJson !== undefined
          ? { editorJson: dto.editorJson as Prisma.InputJsonValue }
          : {}),
        ...(dto.metadata !== undefined
          ? { metadataJson: dto.metadata as Prisma.InputJsonValue }
          : {}),
        ...(dto.keywords !== undefined
          ? {
              keywords: dto.keywords
                .map((value) => value.trim())
                .filter(Boolean)
                .slice(0, 30),
            }
          : {}),
        version: { increment: 1 },
      },
    });
    if (result.count !== 1)
      throw new ConflictException(
        'This blog changed in another session. Refresh before saving again.',
      );
    await this.audit(organizationId, userId, 'BLOG_UPDATED', id);
    return this.getBlog(userId, organizationId, id);
  }

  async deleteBlog(userId: string, organizationId: string, id: string) {
    await this.getBlog(userId, organizationId, id);
    await this.prisma.blogDocument.update({
      where: { id },
      data: { status: BlogDocumentStatus.DELETED, deletedAt: new Date() },
    });
    await this.audit(organizationId, userId, 'BLOG_DELETED', id);
    return { id, deleted: true };
  }

  async regenerate(userId: string, organizationId: string, id: string) {
    const blog = await this.getBlog(userId, organizationId, id);
    const metadata = blog.metadataJson as Record<string, unknown>;
    return this.createGeneration(userId, organizationId, {
      topic: blog.topic,
      keywords: blog.keywords,
      focusKeyword: typeof metadata.focusKeyword === 'string' ? metadata.focusKeyword : undefined,
      language: blog.language,
      writingStyle:
        typeof metadata.writingStyle === 'string' ? metadata.writingStyle : 'Educational',
      tone: typeof metadata.tone === 'string' ? metadata.tone : 'Professional',
      targetLength: Math.max(300, blog.wordCount),
    });
  }

  async exportBlog(userId: string, organizationId: string, id: string, dto: BlogExportDto) {
    const blog = await this.getBlog(userId, organizationId, id);
    const exportRecord = await this.prisma.blogExport.create({
      data: {
        organizationId,
        blogId: id,
        createdByUserId: userId,
        format: dto.format,
        status: 'PROCESSING',
      },
    });
    try {
      if (dto.format === 'docx' || dto.format === 'pdf') {
        const source = await this.files.uploadPastedContent(
          userId,
          organizationId,
          fullHtml(blog.title, blog.html),
          'html',
        );
        const conversion = await this.conversions.createConversion(userId, organizationId, {
          sourceFileId: source.id,
          targetFormat: dto.format,
          settings: {},
        } as any);
        await this.prisma.blogExport.update({
          where: { id: exportRecord.id },
          data: { status: 'QUEUED', storageKey: `conversion:${conversion.id}` },
        });
        await this.audit(organizationId, userId, 'BLOG_EXPORT_QUEUED', id, {
          format: dto.format,
          conversionId: conversion.id,
        });
        return {
          id: exportRecord.id,
          format: dto.format,
          status: 'QUEUED',
          conversionId: conversion.id,
        };
      }
      const extension = dto.format === 'markdown' ? 'md' : 'html';
      const mimeType = dto.format === 'markdown' ? 'text/markdown' : 'text/html';
      const body =
        dto.format === 'markdown' ? htmlToMarkdown(blog.html) : fullHtml(blog.title, blog.html);
      const key = this.storage.generateStorageKey(organizationId, userId, 'outputs', extension);
      await this.storage.upload('outputs', key, body, mimeType);
      await this.prisma.blogExport.update({
        where: { id: exportRecord.id },
        data: { status: 'COMPLETED', storageKey: key, mimeType, completedAt: new Date() },
      });
      const url = await this.storage.getSignedDownloadUrl(
        'outputs',
        key,
        900,
        `${blog.slug}.${extension}`,
      );
      await this.audit(organizationId, userId, 'BLOG_EXPORTED', id, { format: dto.format });
      return {
        id: exportRecord.id,
        format: dto.format,
        status: 'COMPLETED',
        url,
        expiresInSeconds: 900,
      };
    } catch (error) {
      await this.prisma.blogExport.update({
        where: { id: exportRecord.id },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message.slice(0, 1_000) : 'Export failed.',
        },
      });
      throw error;
    }
  }

  getUsage(userId: string, organizationId: string) {
    return this.assertMembership(userId, organizationId).then(() =>
      this.usage.getUsage(userId, organizationId),
    );
  }

  private async assertMembership(userId: string, organizationId?: string) {
    if (!organizationId) throw new BadRequestException('An active organization is required.');
    const membership = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    if (!membership) throw new NotFoundException('The requested workspace was not found.');
  }

  private audit(
    organizationId: string,
    userId: string,
    action: string,
    resourceId: string,
    metadataJson?: Record<string, unknown>,
  ) {
    return this.prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action,
        resourceType: 'BlogDocument',
        resourceId,
        ...(metadataJson ? { metadataJson: metadataJson as Prisma.InputJsonValue } : {}),
      },
    });
  }
}

function countWords(html: string) {
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text ? text.split(/\s+/u).length : 0;
}

function fullHtml(title: string, body: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font:16px/1.7 system-ui;max-width:780px;margin:48px auto;padding:0 32px}img{max-width:100%;height:auto}h1,h2,h3{line-height:1.2}</style></head><body>${body}</body></html>`;
}

function htmlToMarkdown(html: string) {
  return html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gis, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gis, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gis, '### $1\n\n')
    .replace(/<li[^>]*>(.*?)<\/li>/gis, '- $1\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gis, '$1\n\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gis, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gis, '*$1*')
    .replace(/<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis, '[$2]($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]!,
  );
}
