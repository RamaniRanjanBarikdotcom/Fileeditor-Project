import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { BlogDestination, BlogDestinationType, Prisma } from '@prisma/client';
import axios, { type AxiosRequestConfig } from 'axios';
import { randomUUID } from 'crypto';
import {
  UrlSecurityService,
  createSafeHttpAgent,
  createSafeHttpsAgent,
} from '@docconv/url-security';
import { PrismaService } from '../common/prisma.service';
import { CreateBlogDestinationDto, UpdateBlogDestinationDto } from './blog-studio.dto';
import { EncryptionService } from './encryption.service';

type Credential = {
  token?: string;
  username?: string;
  password?: string;
  applicationPassword?: string;
  headerName?: string;
  headerValue?: string;
};

@Injectable()
export class BlogPublishingService {
  private readonly logger = new Logger(BlogPublishingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly urlSecurity: UrlSecurityService,
  ) {}

  async listDestinations(organizationId: string) {
    const destinations = await this.prisma.blogDestination.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
    return destinations.map((destination) => this.sanitizeDestination(destination));
  }

  async listPublications(organizationId: string) {
    return this.prisma.blogPublication.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: {
        blog: { select: { id: true, title: true, slug: true } },
        destination: { select: { id: true, label: true, type: true, endpointUrl: true } },
      },
      take: 200,
    });
  }

  async createDestination(organizationId: string, dto: CreateBlogDestinationDto) {
    await this.urlSecurity.validateUrl(dto.endpointUrl);
    const existing = await this.prisma.blogDestination.findUnique({
      where: {
        organizationId_type_label: {
          organizationId,
          type: dto.type as BlogDestinationType,
          label: dto.label,
        },
      },
    });
    if (existing) {
      throw new BadRequestException('A destination with this type and label already exists.');
    }

    const destination = await this.prisma.blogDestination.create({
      data: {
        organizationId,
        type: dto.type as BlogDestinationType,
        label: dto.label,
        endpointUrl: dto.endpointUrl,
        encryptedCredential: dto.credential ? this.encryption.encrypt(dto.credential) : null,
        configJson: (dto.configJson || {}) as Prisma.InputJsonValue,
        isActive: true,
      },
    });
    return this.sanitizeDestination(destination);
  }

  async getDestination(organizationId: string, destinationId: string) {
    const destination = await this.prisma.blogDestination.findUnique({ where: { id: destinationId } });
    if (!destination || destination.organizationId !== organizationId) {
      throw new NotFoundException('Destination not found');
    }
    return destination;
  }

  async updateDestination(
    organizationId: string,
    destinationId: string,
    dto: UpdateBlogDestinationDto,
  ) {
    await this.getDestination(organizationId, destinationId);
    if (dto.endpointUrl) await this.urlSecurity.validateUrl(dto.endpointUrl);
    const updated = await this.prisma.blogDestination.update({
      where: { id: destinationId },
      data: {
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.endpointUrl !== undefined && { endpointUrl: dto.endpointUrl }),
        ...(dto.credential !== undefined && {
          encryptedCredential: this.encryption.encrypt(dto.credential),
        }),
        ...(dto.configJson !== undefined && {
          configJson: dto.configJson as Prisma.InputJsonValue,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.endpointUrl !== undefined && { lastTestedAt: null, lastTestSuccess: null }),
      },
    });
    return this.sanitizeDestination(updated);
  }

  async deleteDestination(organizationId: string, destinationId: string) {
    await this.getDestination(organizationId, destinationId);
    await this.prisma.blogDestination.delete({ where: { id: destinationId } });
    return { deleted: true };
  }

  async testDestination(organizationId: string, destinationId: string) {
    const destination = await this.getDestination(organizationId, destinationId);
    let success = false;
    let message = 'Connection failed.';
    try {
      const response = await this.request(this.testRequest(destination));
      success = response.status >= 200 && response.status < 400;
      message = success ? 'Connection verified.' : `Remote service returned ${response.status}.`;
    } catch (error) {
      message = this.errorMessage(error);
    }
    await this.prisma.blogDestination.update({
      where: { id: destination.id },
      data: { lastTestedAt: new Date(), lastTestSuccess: success },
    });
    return { success, message };
  }

  async publish(
    organizationId: string,
    userId: string,
    blogId: string,
    destinationId: string,
    publishedAs: 'draft' | 'live' = 'draft',
  ) {
    const [blog, destination] = await Promise.all([
      this.prisma.blogDocument.findUnique({ where: { id: blogId } }),
      this.getDestination(organizationId, destinationId),
    ]);
    if (!blog || blog.organizationId !== organizationId) {
      throw new NotFoundException('Blog document not found');
    }
    if (!destination.isActive) throw new BadRequestException('This destination is disabled.');

    const publication = await this.prisma.blogPublication.create({
      data: {
        organizationId,
        blogId,
        destinationId,
        createdByUserId: userId,
        status: 'DRAFT',
        publishedAs,
        idempotencyKey: randomUUID(),
      },
    });

    try {
      const result = await this.publishRemote(destination, {
        title: blog.title,
        slug: blog.slug,
        html: blog.html,
        metadata: (blog.metadataJson || {}) as Record<string, unknown>,
        keywords: blog.keywords,
        publishedAs,
      });
      const updated = await this.prisma.blogPublication.update({
        where: { id: publication.id },
        data: {
          status: 'PUBLISHED',
          remotePostId: result.id,
          remoteUrl: result.url,
          metadataJson: result.raw as Prisma.InputJsonValue,
          publishedAt: new Date(),
        },
      });
      await this.prisma.blogRemotePost.upsert({
        where: { destinationId_remoteId: { destinationId, remoteId: result.id } },
        update: {
          blogId,
          remoteTitle: blog.title,
          remoteUrl: result.url,
          remoteStatus: publishedAs === 'live' ? 'published' : 'draft',
          lastSyncedAt: new Date(),
          metadataJson: result.raw as Prisma.InputJsonValue,
        },
        create: {
          organizationId,
          destinationId,
          blogId,
          remoteId: result.id,
          remoteTitle: blog.title,
          remoteUrl: result.url,
          remoteStatus: publishedAs === 'live' ? 'published' : 'draft',
          lastSyncedAt: new Date(),
          metadataJson: result.raw as Prisma.InputJsonValue,
        },
      });
      return updated;
    } catch (error) {
      const message = this.errorMessage(error);
      await this.prisma.blogPublication.update({
        where: { id: publication.id },
        data: { status: 'FAILED', errorMessage: message.slice(0, 1000) },
      });
      this.logger.error({ event: 'blog_publish_failed', publicationId: publication.id, message });
      throw new BadGatewayException(`Publishing failed: ${message}`);
    }
  }

  private async publishRemote(
    destination: BlogDestination,
    article: {
      title: string;
      slug: string;
      html: string;
      metadata: Record<string, unknown>;
      keywords: string[];
      publishedAs: 'draft' | 'live';
    },
  ) {
    const credential = this.credential(destination);
    const config = (destination.configJson || {}) as Record<string, any>;
    const base = destination.endpointUrl.replace(/\/$/, '');
    if (destination.type === 'WORDPRESS') {
      const url = base.includes('/wp-json/') ? base : `${base}/wp-json/wp/v2/posts`;
      const response = await this.request({
        method: 'POST',
        url,
        headers: { 'Content-Type': 'application/json', ...this.authHeaders(credential) },
        data: {
          title: article.title,
          slug: article.slug,
          content: article.html,
          status: article.publishedAs === 'live' ? 'publish' : 'draft',
          excerpt: article.metadata.metaDescription || '',
          categories: config.categoryIds || undefined,
        },
      });
      return {
        id: String(response.data.id),
        url: String(response.data.link || `${base}/?p=${response.data.id}`),
        raw: this.safeRemoteResult(response.data),
      };
    }
    if (destination.type === 'SHOPIFY') {
      if (!config.blogId) throw new BadRequestException('Shopify destination requires configJson.blogId.');
      const apiVersion = String(config.apiVersion || '2026-07');
      const url = `${base}/admin/api/${apiVersion}/blogs/${config.blogId}/articles.json`;
      const response = await this.request({
        method: 'POST',
        url,
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': credential.token || credential.password || '',
        },
        data: {
          article: {
            title: article.title,
            body_html: article.html,
            tags: article.keywords.join(', '),
            published: article.publishedAs === 'live',
          },
        },
      });
      const remote = response.data.article;
      return {
        id: String(remote.id),
        url: String(remote.url || `${base}/blogs/${config.blogHandle || 'news'}/${remote.handle}`),
        raw: this.safeRemoteResult(remote),
      };
    }

    const response = await this.request({
      method: 'POST',
      url: base,
      headers: { 'Content-Type': 'application/json', ...this.authHeaders(credential) },
      data: {
        title: article.title,
        slug: article.slug,
        html: article.html,
        metadata: article.metadata,
        keywords: article.keywords,
        status: article.publishedAs,
      },
    });
    const remote = response.data || {};
    const id = remote.id ?? remote.postId ?? remote.uuid;
    if (!id) throw new BadGatewayException('Remote publishing response did not contain a post ID.');
    return {
      id: String(id),
      url: String(remote.url || remote.link || base),
      raw: this.safeRemoteResult(remote),
    };
  }

  private testRequest(destination: BlogDestination): AxiosRequestConfig {
    const credential = this.credential(destination);
    const config = (destination.configJson || {}) as Record<string, any>;
    const base = destination.endpointUrl.replace(/\/$/, '');
    if (destination.type === 'WORDPRESS') {
      return {
        method: 'GET',
        url: base.includes('/wp-json/') ? base : `${base}/wp-json/wp/v2/users/me?context=edit`,
        headers: this.authHeaders(credential),
      };
    }
    if (destination.type === 'SHOPIFY') {
      return {
        method: 'GET',
        url: `${base}/admin/api/${String(config.apiVersion || '2026-07')}/shop.json`,
        headers: { 'X-Shopify-Access-Token': credential.token || credential.password || '' },
      };
    }
    return { method: 'GET', url: base, headers: this.authHeaders(credential) };
  }

  private async request(request: AxiosRequestConfig) {
    await this.urlSecurity.validateUrl(String(request.url));
    return axios.request({
      ...request,
      timeout: 20_000,
      maxRedirects: 0,
      maxContentLength: 2 * 1024 * 1024,
      maxBodyLength: 5 * 1024 * 1024,
      validateStatus: (status) => status >= 200 && status < 400,
      httpAgent: createSafeHttpAgent(),
      httpsAgent: createSafeHttpsAgent(),
    });
  }

  private credential(destination: BlogDestination): Credential {
    if (!destination.encryptedCredential) return {};
    const decrypted = this.encryption.decrypt(destination.encryptedCredential);
    try {
      const parsed = JSON.parse(decrypted);
      return typeof parsed === 'object' && parsed ? parsed : { token: decrypted };
    } catch {
      return { token: decrypted };
    }
  }

  private authHeaders(credential: Credential): Record<string, string> {
    if (credential.headerName && credential.headerValue) {
      return { [credential.headerName]: credential.headerValue };
    }
    if (credential.username && (credential.applicationPassword || credential.password)) {
      const password = credential.applicationPassword || credential.password || '';
      return {
        Authorization: `Basic ${Buffer.from(`${credential.username}:${password}`).toString('base64')}`,
      };
    }
    return credential.token ? { Authorization: `Bearer ${credential.token}` } : {};
  }

  private safeRemoteResult(value: any): Record<string, unknown> {
    const json = JSON.stringify(value ?? {});
    if (json.length > 20_000) return { truncated: true };
    return JSON.parse(json);
  }

  private errorMessage(error: unknown) {
    if (axios.isAxiosError(error)) {
      const remote = error.response?.data;
      const detail = typeof remote === 'string' ? remote : remote?.message || remote?.error;
      return detail ? String(detail).slice(0, 500) : error.message;
    }
    return error instanceof Error ? error.message : 'Unknown remote publishing error.';
  }

  private sanitizeDestination(destination: BlogDestination) {
    const { encryptedCredential: _encrypted, ...safe } = destination;
    return { ...safe, hasCredential: Boolean(destination.encryptedCredential) };
  }
}
