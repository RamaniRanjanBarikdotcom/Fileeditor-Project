import axios, { AxiosResponse } from 'axios';
import FormData from 'form-data';
import { Readable } from 'stream';
import { ConversionOptions, DEFAULT_MARGINS, Orientation, PageSize } from '@docconv/shared-types';

// Gotenberg returns 409 when Chromium is busy processing another job.
// We back off and retry a few times before failing.
const GOTENBERG_MAX_RETRIES = 5;
const GOTENBERG_RETRY_DELAY_MS = 3000;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postWithRetry(
  url: string,
  createForm: () => FormData,
  timeout: number,
): Promise<AxiosResponse> {
  let lastError: any;
  for (let attempt = 1; attempt <= GOTENBERG_MAX_RETRIES; attempt++) {
    try {
      const form = createForm();
      const response = await axios.post(url, form, {
        headers: { ...form.getHeaders() },
        responseType: 'arraybuffer',
        timeout,
      });
      return response;
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 409 && attempt < GOTENBERG_MAX_RETRIES) {
        const delay = GOTENBERG_RETRY_DELAY_MS * attempt;
        console.warn(
          `Gotenberg busy (409), retrying in ${delay}ms (attempt ${attempt}/${GOTENBERG_MAX_RETRIES})...`,
        );
        await sleep(delay);
        lastError = err;
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

export class GotenbergAdapter {
  private apiUrl: string;
  private timeout: number;
  private urlTimeout: number;

  constructor(apiUrl: string = process.env.GOTENBERG_URL || 'http://localhost:3000') {
    this.apiUrl = apiUrl;
    this.timeout = Number(process.env.CONVERSION_TIMEOUT_MS || 180_000);
    this.urlTimeout = Number(
      process.env.URL_CONVERSION_TIMEOUT_MS || process.env.CONVERSION_TIMEOUT_MS || 240_000,
    );
  }

  /**
   * Convert Office documents (DOCX, XLSX) to PDF using LibreOffice engine
   */
  async convertOfficeToPdf(fileStream: Readable, filename: string): Promise<Readable> {
    const input = await this.toBuffer(fileStream);

    const response = await postWithRetry(
      `${this.apiUrl}/forms/libreoffice/convert`,
      () => {
        const form = new FormData();
        form.append('files', input, { filename });
        return form;
      },
      this.timeout,
    );
    this.assertValidPdf(response.data, 'LibreOffice');
    return Readable.from(Buffer.from(response.data));
  }

  /**
   * Convert HTML/Markdown to PDF using Chromium engine.
   */
  async convertHtmlToPdf(
    fileStream: Readable,
    _filename: string = 'index.html',
    options: ConversionOptions = {},
  ): Promise<Readable> {
    const input = await this.toBuffer(fileStream);

    const response = await postWithRetry(
      `${this.apiUrl}/forms/chromium/convert/html`,
      () => {
        const form = new FormData();
        form.append('files', input, { filename: 'index.html' });
        if (options.headerHtml) {
          form.append('files', Buffer.from(this.sanitizeAuxiliaryHtml(options.headerHtml)), {
            filename: 'header.html',
          });
        }
        if (options.footerHtml) {
          form.append('files', Buffer.from(this.sanitizeAuxiliaryHtml(options.footerHtml)), {
            filename: 'footer.html',
          });
        }
        this.appendPageOptions(form, options, 'print');
        return form;
      },
      this.timeout,
    );
    this.assertValidPdf(response.data, 'Chromium HTML');
    return Readable.from(Buffer.from(response.data));
  }

  /**
   * Convert any public URL to PDF using Chromium engine.
   * Full JS execution, network idle wait, and retry on 409.
   */
  async convertUrlToPdf(url: string, options: ConversionOptions = {}): Promise<Readable> {
    const response = await postWithRetry(
      `${this.apiUrl}/forms/chromium/convert/url`,
      () => {
        const form = new FormData();
        form.append('url', url);
        form.append('waitDelay', process.env.CHROMIUM_WAIT_DELAY || '2s');
        form.append('waitNetworkIdleFor', process.env.CHROMIUM_NETWORK_IDLE || '2s');
        this.appendPageOptions(form, { scale: 0.9, ...options }, 'screen');
        return form;
      },
      this.urlTimeout,
    );
    this.assertValidPdf(response.data, `Chromium URL (${url})`);
    return Readable.from(Buffer.from(response.data));
  }

  private appendPageOptions(
    form: FormData,
    options: ConversionOptions,
    mediaType: 'print' | 'screen',
  ): void {
    const sizes: Record<PageSize, [number, number]> = {
      [PageSize.A4]: [8.27, 11.69],
      [PageSize.A3]: [11.69, 16.54],
      [PageSize.A5]: [5.83, 8.27],
      [PageSize.LETTER]: [8.5, 11],
      [PageSize.LEGAL]: [8.5, 14],
    };
    const [width, height] = sizes[options.pageSize || PageSize.A4];
    const margins = options.margins || DEFAULT_MARGINS;
    form.append('emulatedMediaType', mediaType);
    form.append('printBackground', String(options.printBackground ?? true));
    form.append('paperWidth', String(width));
    form.append('paperHeight', String(height));
    form.append('marginTop', String(margins.top / 25.4));
    form.append('marginBottom', String(margins.bottom / 25.4));
    form.append('marginLeft', String(margins.left / 25.4));
    form.append('marginRight', String(margins.right / 25.4));
    form.append('scale', String(options.scale ?? 1));
    form.append('landscape', String(options.orientation === Orientation.LANDSCAPE));
  }

  private async toBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return Buffer.concat(chunks);
  }

  private sanitizeAuxiliaryHtml(html: string): string {
    return html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  }

  /**
   * Validates that the response buffer contains a valid PDF.
   * If Gotenberg returned an error body instead, throws with the error details.
   */
  private assertValidPdf(data: Buffer | ArrayBuffer, context: string): void {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const header = buf.subarray(0, 4).toString('ascii');
    if (header !== '%PDF') {
      const errBody = buf.subarray(0, 1000).toString('utf-8');
      throw new Error(`${context} conversion failed — Gotenberg error: ${errBody}`);
    }
  }
}
