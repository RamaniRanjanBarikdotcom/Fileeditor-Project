import axios from 'axios';
import { Readable } from 'stream';
import { UrlSecurityService } from '@docconv/url-security';
import { PandocAdapter } from './pandoc';

export class WebContentAdapter {
  private readonly security = new UrlSecurityService();
  private readonly pandoc = new PandocAdapter();

  async convert(url: string, targetFormat: string): Promise<Readable> {
    const html = await this.fetchHtml(url);
    const sanitized = this.sanitizeForDocument(html);
    if (targetFormat === 'html') return Readable.from(Buffer.from(sanitized, 'utf8'));
    if (targetFormat === 'txt') {
      const text = sanitized
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/\s+/g, ' ')
        .trim();
      return Readable.from(Buffer.from(text, 'utf8'));
    }
    return this.pandoc.convert(
      Readable.from(Buffer.from(sanitized, 'utf8')),
      'html',
      targetFormat === 'markdown' ? 'gfm' : targetFormat,
    );
  }

  private async fetchHtml(initialUrl: string): Promise<string> {
    let current = initialUrl;
    const maxRedirects = Math.max(0, Number(process.env.URL_MAX_REDIRECTS || 5));
    for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
      await this.security.validateUrl(current);
      const response = await axios.get(current, {
        timeout: Number(process.env.URL_FETCH_TIMEOUT_MS || 30_000),
        maxRedirects: 0,
        maxContentLength: Number(process.env.URL_MAX_DOWNLOAD_BYTES || 10 * 1024 * 1024),
        responseType: 'text',
        validateStatus: () => true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AppToolkitLab/1.0; +https://apptoolkitlab.com)',
          Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
        },
      });
      if (response.status >= 300 && response.status < 400 && response.headers.location) {
        if (redirects === maxRedirects) throw new Error('URL redirect limit exceeded');
        current = new URL(String(response.headers.location), current).toString();
        continue;
      }
      if (response.status === 401 || response.status === 403) throw new Error(`Remote page denied access (${response.status})`);
      if (response.status === 404) throw new Error('Remote page was not found (404)');
      if (response.status === 429) throw new Error('Remote page rate limited the request (429)');
      if (response.status >= 500) throw new Error(`Remote website failed (${response.status})`);
      if (response.status < 200 || response.status >= 300) throw new Error(`Remote page returned HTTP ${response.status}`);
      const contentType = String(response.headers['content-type'] || '').toLowerCase();
      if (!contentType.includes('html') && !contentType.includes('xhtml')) {
        throw new Error(`URL content type '${contentType || 'unknown'}' is not a webpage`);
      }
      return String(response.data);
    }
    throw new Error('URL redirect limit exceeded');
  }

  private sanitizeForDocument(html: string): string {
    return html
      .replace(/<(script|noscript|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '$1="#"');
  }
}
