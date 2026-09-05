import { Injectable, BadRequestException } from '@nestjs/common';
import axios from 'axios';

export interface UrlInspectionResult {
  url: string;
  mimeType: string;
  sizeBytes?: number;
  detectedType: string; // 'url', 'html', 'pdf', 'csv', 'image', etc.
}

@Injectable()
export class UrlInspectorService {
  /**
   * Performs a safe HEAD request to inspect the URL.
   * Returns information about the content type and size.
   */
  async inspect(
    url: string,
    validateUrl?: (candidate: string) => Promise<void>,
  ): Promise<UrlInspectionResult> {
    let currentUrl = url;

    try {
      const maxRedirects = Math.max(0, Number(process.env.URL_MAX_REDIRECTS || 5));
      for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
        await validateUrl?.(currentUrl);

        let response;
        try {
          response = await axios.head(currentUrl, {
            timeout: 10_000,
            maxRedirects: 0,
            validateStatus: () => true,
            headers: {
              'User-Agent':
                'Mozilla/5.0 (compatible; AppToolkitLab/1.0; +https://apptoolkitlab.com)',
              Accept: 'text/html,application/xhtml+xml,application/pdf,*/*;q=0.8',
            },
          });
        } catch {
          // Many sites block HEAD requests even though Chromium can load them.
          // The URL has passed SSRF validation, so allow the renderer to try.
          return { url: currentUrl, mimeType: 'text/uri-list', detectedType: 'url' };
        }

        if (response.status >= 300 && response.status < 400 && response.headers.location) {
          if (redirectCount === maxRedirects) {
            throw new BadRequestException('URL has too many redirects.');
          }
          currentUrl = new URL(String(response.headers.location), currentUrl).toString();
          continue;
        }

        const contentType = String(response.headers['content-type'] || '').toLowerCase();
        const contentLength = response.headers['content-length'];

        // Extract base MIME without charset
        const mimeType = (contentType.split(';')[0] || '').trim() || 'text/html';
        const sizeBytes = contentLength ? parseInt(String(contentLength), 10) : undefined;

        // Determine the detectedType for our platform
        let detectedType = 'url';
        if (mimeType.includes('pdf')) detectedType = 'pdf';
        else if (mimeType.includes('csv')) detectedType = 'csv';
        else if (mimeType.includes('json')) detectedType = 'json';
        else if (mimeType.includes('image')) detectedType = 'image';
        else if (mimeType.includes('wordprocessingml') || mimeType.includes('msword'))
          detectedType = 'docx';
        else if (mimeType.includes('spreadsheetml') || mimeType.includes('ms-excel'))
          detectedType = 'xlsx';
        else if (mimeType.includes('html')) detectedType = 'html';

        return { url: currentUrl, mimeType, sizeBytes, detectedType };
      }

      throw new BadRequestException('Unable to resolve URL.');
    } catch (e: any) {
      if (e instanceof BadRequestException) throw e;
      throw e;
    }
  }
}
