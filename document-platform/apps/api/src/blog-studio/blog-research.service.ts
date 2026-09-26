import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { BlogSourceResult } from '@docconv/blog-engine';
import {
  UrlSecurityService,
  createSafeHttpAgent,
  createSafeHttpsAgent,
} from '@docconv/url-security';
import { PrismaService } from '../common/prisma.service';
import { EncryptionService } from './encryption.service';

@Injectable()
export class BlogResearchService {
  private readonly logger = new Logger(BlogResearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly config: ConfigService,
    private readonly urlSecurity: UrlSecurityService,
  ) {}

  async search(
    organizationId: string,
    query: string,
    signal?: AbortSignal,
  ): Promise<BlogSourceResult[]> {
    const organizationCredential = await this.prisma.blogProviderCredential.findFirst({
      where: { organizationId, providerType: 'TAVILY', isActive: true },
      orderBy: { updatedAt: 'desc' },
    });
    const apiKey = organizationCredential
      ? this.encryption.decrypt(organizationCredential.encryptedCredential)
      : this.config.get<string>('TAVILY_API_KEY');
    if (!apiKey) {
      this.logger.debug({ event: 'blog_web_research_skipped', reason: 'provider_not_configured' });
      return [];
    }

    const endpoint = organizationCredential?.customEndpoint || 'https://api.tavily.com/search';
    await this.urlSecurity.validateUrl(endpoint);
    try {
      const response = await axios.post(
        endpoint,
        {
          api_key: apiKey,
          query,
          search_depth: 'advanced',
          include_answer: false,
          include_raw_content: false,
          max_results: 8,
        },
        {
          signal,
          timeout: 25_000,
          maxRedirects: 0,
          maxContentLength: 3 * 1024 * 1024,
          httpAgent: createSafeHttpAgent(),
          httpsAgent: createSafeHttpsAgent(),
          headers: { 'Content-Type': 'application/json' },
        },
      );
      const results = Array.isArray(response.data?.results) ? response.data.results : [];
      const sources: BlogSourceResult[] = [];
      for (const result of results.slice(0, 8)) {
        const url = String(result?.url || '');
        if (!url) continue;
        try {
          await this.urlSecurity.validateUrl(url);
          sources.push({
            url,
            title: String(result?.title || url).slice(0, 500),
            excerpt: String(result?.content || '').slice(0, 2_000) || undefined,
            retrievedAt: new Date().toISOString(),
          });
        } catch {
          this.logger.warn({ event: 'blog_research_result_rejected', url: url.slice(0, 300) });
        }
      }
      return sources;
    } catch (error) {
      if (signal?.aborted) throw error;
      this.logger.warn({
        event: 'blog_web_research_failed',
        error: axios.isAxiosError(error) ? error.message : String(error),
      });
      return [];
    }
  }
}
