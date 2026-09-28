import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  UrlSecurityService,
  createSafeHttpAgent,
  createSafeHttpsAgent,
} from '@docconv/url-security';
import { PrismaService } from '../common/prisma.service';
import { FilesService } from '../files/files.service';
import { BlogImageDto } from './blog-studio.dto';
import { BlogUsageService } from './blog-usage.service';

@Injectable()
export class BlogImagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly filesService: FilesService,
    private readonly config: ConfigService,
    private readonly urlSecurity: UrlSecurityService,
    private readonly usage: BlogUsageService,
  ) {}

  async listGallery(organizationId: string, blogId?: string) {
    const images = await this.prisma.blogImage.findMany({
      where: { organizationId, ...(blogId && { blogId }) },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        blog: { select: { id: true, title: true } },
      },
    });
    return Promise.all(
      images.map(async (image) => ({
        ...image,
        url: await this.filesService.getGeneratedAssetUrl(
          image.storageKey,
          `blog-image-${image.id}.${extensionForMime(image.mimeType)}`,
        ),
      })),
    );
  }

  async setFeaturedImage(organizationId: string, blogId: string, imageId: string) {
    const image = await this.getImage(organizationId, blogId, imageId);
    return this.prisma.$transaction(async (tx) => {
      await tx.blogImage.updateMany({
        where: { organizationId, blogId, isFeatured: true },
        data: { isFeatured: false },
      });
      return tx.blogImage.update({ where: { id: image.id }, data: { isFeatured: true } });
    });
  }

  async generateImage(
    organizationId: string,
    userId: string,
    blogId: string,
    dto: BlogImageDto,
  ) {
    const blog = await this.prisma.blogDocument.findUnique({ where: { id: blogId } });
    if (!blog || blog.organizationId !== organizationId) throw new NotFoundException('Blog not found');

    const apiKey = this.config.get<string>('AI_API_KEY');
    const baseUrl = this.config
      .get<string>('AI_BASE_URL', 'https://api.openai.com/v1')
      .replace(/\/$/, '');
    const model = this.config.get<string>('BLOG_IMAGE_MODEL', 'gpt-image-2.5-flare');
    const credits = Number(this.config.get<string>('BLOG_IMAGE_CREDITS', '4'));
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Image generation is not configured. Set the managed AI_API_KEY and BLOG_IMAGE_MODEL.',
      );
    }
    await this.usage.getUsage(userId, organizationId);
    const endpoint = `${baseUrl}/images/generations`;
    await this.urlSecurity.validateUrl(endpoint);

    let buffer: Buffer;
    let mimeType = 'image/png';
    let actualWidth = 1024;
    let actualHeight = 1024;
    try {
      const size = closestImageSize(dto.width, dto.height);
      [actualWidth, actualHeight] = size.split('x').map(Number) as [number, number];
      const response = await axios.post(
        endpoint,
        buildImageGenerationRequest(model, dto.prompt, size),
        {
          timeout: 120_000,
          maxRedirects: 0,
          maxContentLength: 25 * 1024 * 1024,
          httpAgent: createSafeHttpAgent(),
          httpsAgent: createSafeHttpsAgent(),
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        },
      );
      const item = response.data?.data?.[0];
      if (item?.b64_json) {
        buffer = Buffer.from(item.b64_json, 'base64');
      } else if (item?.url) {
        await this.urlSecurity.validateUrl(item.url);
        const download = await axios.get<ArrayBuffer>(item.url, {
          responseType: 'arraybuffer',
          timeout: 30_000,
          maxRedirects: 0,
          maxContentLength: 25 * 1024 * 1024,
          httpAgent: createSafeHttpAgent(),
          httpsAgent: createSafeHttpsAgent(),
        });
        buffer = Buffer.from(download.data);
        mimeType = String(download.headers['content-type'] || 'image/png').split(';')[0] || 'image/png';
      } else {
        throw new Error('The image provider returned no image data.');
      }
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.error?.message || error.message
        : error instanceof Error
          ? error.message
          : 'Unknown provider error';
      throw new ServiceUnavailableException(`Image generation failed: ${String(message).slice(0, 500)}`);
    }

    if (!buffer.length || buffer.length > 25 * 1024 * 1024) {
      throw new ServiceUnavailableException('The image provider returned an invalid image payload.');
    }
    const extension = extensionForMime(mimeType);
    const stored = await this.filesService.storeGeneratedAsset(
      organizationId,
      userId,
      buffer,
      mimeType,
      extension,
    );
    try {
      await this.usage.consumeImageCredits(userId, organizationId, credits, model);
      const image = await this.prisma.blogImage.create({
        data: {
          organizationId,
          blogId,
          createdByUserId: userId,
          storageKey: stored.storageKey,
          mimeType,
          width: actualWidth,
          height: actualHeight,
          prompt: dto.prompt,
          altText: dto.prompt,
          credits,
        },
      });
      return {
        ...image,
        url: await this.filesService.getGeneratedAssetUrl(
          stored.storageKey,
          `blog-image-${image.id}.${extension}`,
        ),
      };
    } catch (error) {
      await this.filesService.deleteGeneratedAsset(stored.storageKey).catch(() => undefined);
      throw error;
    }
  }

  async deleteImage(organizationId: string, blogId: string, imageId: string) {
    const image = await this.getImage(organizationId, blogId, imageId);
    await this.filesService.deleteGeneratedAsset(image.storageKey).catch(() => undefined);
    await this.prisma.blogImage.delete({ where: { id: imageId } });
    return { deleted: true };
  }

  private async getImage(organizationId: string, blogId: string, imageId: string) {
    const image = await this.prisma.blogImage.findUnique({ where: { id: imageId } });
    if (!image || image.organizationId !== organizationId || image.blogId !== blogId) {
      throw new NotFoundException('Image not found for this blog');
    }
    return image;
  }
}

export function buildImageGenerationRequest(model: string, prompt: string, size: string) {
  return {
    model,
    prompt,
    size,
    ...(model.startsWith('dall-e-') ? { response_format: 'b64_json' } : {}),
  };
}

function closestImageSize(width: number, height: number) {
  if (width / height > 1.2) return '1536x1024';
  if (height / width > 1.2) return '1024x1536';
  return '1024x1024';
}

function extensionForMime(mimeType: string) {
  if (mimeType.includes('jpeg')) return 'jpg';
  if (mimeType.includes('webp')) return 'webp';
  return 'png';
}
