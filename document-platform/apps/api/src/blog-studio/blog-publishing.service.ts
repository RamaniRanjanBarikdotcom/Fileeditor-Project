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
import {
  CreateBlogCategoryDto,
  CreateBlogDestinationDto,
  UpdateBlogDestinationDto,
  UpdateRemoteBlogPostDto,
  UpsertBlogCategoryMappingDto,
} from './blog-studio.dto';
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

  async listPublications(organizationId: string, destinationId?: string) {
    return this.prisma.blogPublication.findMany({
      where: { organizationId, ...(destinationId ? { destinationId } : {}) },
      orderBy: { createdAt: 'desc' },
      include: {
        blog: { select: { id: true, title: true, slug: true } },
        destination: { select: { id: true, label: true, type: true, endpointUrl: true } },
      },
      take: 200,
    });
  }

  async listRemotePosts(organizationId: string, destinationId?: string) {
    if (destinationId) await this.getDestination(organizationId, destinationId);
    const posts = await this.prisma.blogRemotePost.findMany({
      where: { organizationId, ...(destinationId ? { destinationId } : {}) },
      orderBy: { lastSyncedAt: 'desc' },
      include: {
        blog: { select: { id: true, title: true } },
      },
      take: 500,
    });
    const destinations = await this.prisma.blogDestination.findMany({
      where: { organizationId, ...(destinationId ? { id: destinationId } : {}) },
      select: { id: true, label: true, type: true },
    });
    const byId = new Map(destinations.map((destination) => [destination.id, destination]));
    return posts.map((post) => ({
      ...post,
      title: post.remoteTitle,
      syncedAt: post.lastSyncedAt,
      destination: byId.get(post.destinationId),
    }));
  }

  async getRemotePost(organizationId: string, postId: string) {
    const post = await this.prisma.blogRemotePost.findFirst({
      where: { id: postId, organizationId },
      include: {
        blog: {
          select: {
            id: true,
            title: true,
            html: true,
            images: {
              select: { id: true, storageKey: true, mimeType: true, prompt: true, isFeatured: true },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        destination: { select: { id: true, label: true, type: true, endpointUrl: true } },
      },
    });
    if (!post) throw new NotFoundException('Remote post not found');
    return { ...post, title: post.remoteTitle, syncedAt: post.lastSyncedAt };
  }

  async updateRemotePost(
    organizationId: string,
    postId: string,
    dto: UpdateRemoteBlogPostDto,
  ) {
    const post = await this.getRemotePost(organizationId, postId);
    const destination = await this.getDestination(organizationId, post.destinationId);
    const response = await this.updateRemote(destination, post.remoteId, dto);
    const remote = response.data?.article || response.data || {};
    return this.prisma.blogRemotePost.update({
      where: { id: postId },
      data: {
        ...(dto.title !== undefined ? { remoteTitle: dto.title.trim() } : {}),
        ...(dto.status !== undefined
          ? { remoteStatus: dto.status === 'publish' ? 'published' : dto.status }
          : {}),
        ...(remote.link || remote.url ? { remoteUrl: String(remote.link || remote.url) } : {}),
        metadataJson: this.safeRemoteResult(remote) as Prisma.InputJsonValue,
        lastSyncedAt: new Date(),
      },
    });
  }

  async deleteRemotePost(organizationId: string, postId: string) {
    const post = await this.getRemotePost(organizationId, postId);
    const destination = await this.getDestination(organizationId, post.destinationId);
    await this.deleteRemote(destination, post.remoteId);
    await this.prisma.blogRemotePost.delete({ where: { id: postId } });
    return { deleted: true };
  }

  async listCategories(organizationId: string, destinationId: string) {
    const destination = await this.getDestination(organizationId, destinationId);
    if (destination.type !== 'WORDPRESS') {
      return { categories: [], mappings: await this.listCategoryMappings(organizationId, destinationId) };
    }
    const base = this.wordpressApiBase(destination);
    const response = await this.request({
      method: 'GET',
      url: `${base}/categories`,
      params: { per_page: 100, hide_empty: false },
      headers: this.authHeaders(this.credential(destination)),
    });
    const categories = (Array.isArray(response.data) ? response.data : []).map((category: any) => ({
      id: String(category.id),
      name: String(category.name || 'Untitled category'),
      slug: String(category.slug || ''),
      count: Number(category.count || 0),
    }));
    return { categories, mappings: await this.listCategoryMappings(organizationId, destinationId) };
  }

  async createCategory(
    organizationId: string,
    destinationId: string,
    dto: CreateBlogCategoryDto,
  ) {
    const destination = await this.getDestination(organizationId, destinationId);
    if (destination.type !== 'WORDPRESS') {
      throw new BadRequestException('Remote category creation is currently supported for WordPress.');
    }
    const response = await this.request({
      method: 'POST',
      url: `${this.wordpressApiBase(destination)}/categories`,
      headers: { 'Content-Type': 'application/json', ...this.authHeaders(this.credential(destination)) },
      data: { name: dto.name.trim() },
    });
    return {
      id: String(response.data.id),
      name: String(response.data.name || dto.name),
      slug: String(response.data.slug || ''),
      count: Number(response.data.count || 0),
    };
  }

  async listCategoryMappings(organizationId: string, destinationId: string) {
    await this.getDestination(organizationId, destinationId);
    return this.prisma.blogCategoryMapping.findMany({
      where: { destinationId },
      orderBy: { localCategory: 'asc' },
    });
  }

  async upsertCategoryMapping(
    organizationId: string,
    destinationId: string,
    dto: UpsertBlogCategoryMappingDto,
  ) {
    await this.getDestination(organizationId, destinationId);
    const localCategory = dto.localCategory.trim();
    if (!localCategory) throw new BadRequestException('A local category is required.');
    return this.prisma.blogCategoryMapping.upsert({
      where: { destinationId_localCategory: { destinationId, localCategory } },
      update: { remoteId: dto.remoteId.trim(), remoteName: dto.remoteName.trim() },
      create: {
        destinationId,
        localCategory,
        remoteId: dto.remoteId.trim(),
        remoteName: dto.remoteName.trim(),
      },
    });
  }

  async deleteCategoryMapping(organizationId: string, destinationId: string, mappingId: string) {
    await this.getDestination(organizationId, destinationId);
    const deleted = await this.prisma.blogCategoryMapping.deleteMany({
      where: { id: mappingId, destinationId },
    });
    if (deleted.count !== 1) throw new NotFoundException('Category mapping not found');
    return { deleted: true };
  }

  async syncDestination(organizationId: string, destinationId: string) {
    const destination = await this.getDestination(organizationId, destinationId);
    if (!destination.isActive) throw new BadRequestException('This destination is disabled.');
    const remotePosts = await this.fetchRemotePosts(destination);
    for (const post of remotePosts) {
      await this.prisma.blogRemotePost.upsert({
        where: { destinationId_remoteId: { destinationId, remoteId: post.id } },
        update: {
          remoteTitle: post.title,
          remoteUrl: post.url,
          remoteStatus: post.status,
          lastSyncedAt: new Date(),
          metadataJson: post.raw as Prisma.InputJsonValue,
        },
        create: {
          organizationId,
          destinationId,
          remoteId: post.id,
          remoteTitle: post.title,
          remoteUrl: post.url,
          remoteStatus: post.status,
          lastSyncedAt: new Date(),
          metadataJson: post.raw as Prisma.InputJsonValue,
        },
      });
    }
    return { count: remotePosts.length };
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
      const categoryMappings = await this.prisma.blogCategoryMapping.findMany({
        where: {
          destinationId,
          localCategory: { in: blog.keywords },
        },
        select: { remoteId: true },
      });
      const result = await this.publishRemote(destination, {
        title: blog.title,
        slug: blog.slug,
        html: blog.html,
        metadata: {
          ...((blog.metadataJson || {}) as Record<string, unknown>),
          mappedCategoryIds: categoryMappings.map((mapping) => Number(mapping.remoteId)).filter(Number.isFinite),
        },
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
          categories:
            (article.metadata.mappedCategoryIds as number[] | undefined) ||
            config.categoryIds ||
            undefined,
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

  private async fetchRemotePosts(destination: BlogDestination) {
    const credential = this.credential(destination);
    const config = (destination.configJson || {}) as Record<string, any>;
    const base = destination.endpointUrl.replace(/\/$/, '');
    if (destination.type === 'WORDPRESS') {
      const postsUrl = base.includes('/wp-json/wp/v2/posts')
        ? base
        : base.includes('/wp-json/')
          ? `${base.replace(/\/$/, '')}/wp/v2/posts`
          : `${base}/wp-json/wp/v2/posts`;
      const response = await this.request({
        method: 'GET',
        url: postsUrl,
        params: { per_page: 100, status: 'any', context: 'edit' },
        headers: this.authHeaders(credential),
      });
      const posts = Array.isArray(response.data) ? response.data : [];
      return posts.map((post: any) => ({
        id: String(post.id),
        title: String(post.title?.rendered || post.title || 'Untitled post'),
        url: post.link ? String(post.link) : null,
        status: String(post.status || 'unknown'),
        raw: this.safeRemoteResult(post),
      }));
    }
    if (destination.type === 'SHOPIFY') {
      if (!config.blogId) throw new BadRequestException('Shopify destination requires configJson.blogId.');
      const apiVersion = String(config.apiVersion || '2026-07');
      const response = await this.request({
        method: 'GET',
        url: `${base}/admin/api/${apiVersion}/blogs/${config.blogId}/articles.json`,
        params: { limit: 250 },
        headers: { 'X-Shopify-Access-Token': credential.token || credential.password || '' },
      });
      const posts = Array.isArray(response.data?.articles) ? response.data.articles : [];
      return posts.map((post: any) => ({
        id: String(post.id),
        title: String(post.title || 'Untitled article'),
        url: post.url ? String(post.url) : null,
        status: post.published_at ? 'published' : 'draft',
        raw: this.safeRemoteResult(post),
      }));
    }
    throw new BadRequestException(
      'Remote synchronization is currently supported for WordPress and Shopify destinations.',
    );
  }

  private async updateRemote(
    destination: BlogDestination,
    remoteId: string,
    dto: UpdateRemoteBlogPostDto,
  ) {
    const credential = this.credential(destination);
    const config = (destination.configJson || {}) as Record<string, any>;
    const base = destination.endpointUrl.replace(/\/$/, '');
    if (destination.type === 'WORDPRESS') {
      return this.request({
        method: 'POST',
        url: `${this.wordpressApiBase(destination)}/posts/${encodeURIComponent(remoteId)}`,
        headers: { 'Content-Type': 'application/json', ...this.authHeaders(credential) },
        data: {
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.html !== undefined ? { content: dto.html } : {}),
          ...(dto.status !== undefined
            ? { status: dto.status === 'published' ? 'publish' : dto.status }
            : {}),
        },
      });
    }
    if (destination.type === 'SHOPIFY') {
      if (!config.blogId) throw new BadRequestException('Shopify destination requires configJson.blogId.');
      const apiVersion = String(config.apiVersion || '2026-07');
      return this.request({
        method: 'PUT',
        url: `${base}/admin/api/${apiVersion}/blogs/${config.blogId}/articles/${encodeURIComponent(remoteId)}.json`,
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': credential.token || credential.password || '',
        },
        data: {
          article: {
            id: remoteId,
            ...(dto.title !== undefined ? { title: dto.title } : {}),
            ...(dto.html !== undefined ? { body_html: dto.html } : {}),
            ...(dto.status !== undefined
              ? { published: ['publish', 'published'].includes(dto.status) }
              : {}),
          },
        },
      });
    }
    throw new BadRequestException('Remote editing is supported for WordPress and Shopify destinations.');
  }

  private async deleteRemote(destination: BlogDestination, remoteId: string) {
    const credential = this.credential(destination);
    const config = (destination.configJson || {}) as Record<string, any>;
    const base = destination.endpointUrl.replace(/\/$/, '');
    if (destination.type === 'WORDPRESS') {
      await this.request({
        method: 'DELETE',
        url: `${this.wordpressApiBase(destination)}/posts/${encodeURIComponent(remoteId)}`,
        params: { force: true },
        headers: this.authHeaders(credential),
      });
      return;
    }
    if (destination.type === 'SHOPIFY') {
      if (!config.blogId) throw new BadRequestException('Shopify destination requires configJson.blogId.');
      await this.request({
        method: 'DELETE',
        url: `${base}/admin/api/${String(config.apiVersion || '2026-07')}/blogs/${config.blogId}/articles/${encodeURIComponent(remoteId)}.json`,
        headers: { 'X-Shopify-Access-Token': credential.token || credential.password || '' },
      });
      return;
    }
    throw new BadRequestException('Remote deletion is supported for WordPress and Shopify destinations.');
  }

  private wordpressApiBase(destination: BlogDestination) {
    const base = destination.endpointUrl.replace(/\/$/, '');
    const marker = '/wp-json/wp/v2';
    const markerIndex = base.indexOf(marker);
    return markerIndex >= 0 ? base.slice(0, markerIndex + marker.length) : `${base}/wp-json/wp/v2`;
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
