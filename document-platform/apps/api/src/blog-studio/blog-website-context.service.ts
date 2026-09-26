import { BadRequestException, Injectable } from '@nestjs/common';
import axios from 'axios';
import {
  UrlSecurityService,
  createSafeHttpAgent,
  createSafeHttpsAgent,
} from '@docconv/url-security';

@Injectable()
export class BlogWebsiteContextService {
  private readonly httpAgent = createSafeHttpAgent();
  private readonly httpsAgent = createSafeHttpsAgent();

  constructor(private readonly urlSecurity: UrlSecurityService) {}

  async fetch(url: string): Promise<string> {
    let currentUrl = url.trim();
    for (let redirects = 0; redirects <= 3; redirects += 1) {
      try {
        await this.urlSecurity.validateUrl(currentUrl);
      } catch {
        throw new BadRequestException(
          'Brand website URL is invalid or resolves to a restricted network.',
        );
      }
      let response;
      try {
        response = await axios.get<string>(currentUrl, {
          timeout: 12_000,
          maxRedirects: 0,
          responseType: 'text',
          maxContentLength: 1_000_000,
          maxBodyLength: 1_000_000,
          validateStatus: () => true,
          httpAgent: this.httpAgent,
          httpsAgent: this.httpsAgent,
          headers: {
            'User-Agent': 'AppToolkitLab-BlogStudio/1.0 (+https://apptoolkitlab.com)',
            Accept: 'text/html,text/plain;q=0.9',
          },
        });
      } catch {
        throw new BadRequestException('Brand website could not be retrieved safely.');
      }
      if (response.status >= 300 && response.status < 400 && response.headers.location) {
        if (redirects === 3) throw new BadRequestException('Brand website has too many redirects.');
        currentUrl = new URL(String(response.headers.location), currentUrl).toString();
        continue;
      }
      if (response.status < 200 || response.status >= 300) {
        throw new BadRequestException(`Brand website returned status ${response.status}.`);
      }
      const contentType = String(response.headers['content-type'] || '').toLowerCase();
      if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
        throw new BadRequestException('Brand website must return HTML or plain text.');
      }
      return normalizeWebsiteText(String(response.data)).slice(0, 8_000);
    }
    throw new BadRequestException('Brand website could not be resolved.');
  }
}

function normalizeWebsiteText(value: string): string {
  return value
    .replace(/<(script|style|template|noscript|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}
