import axios, { AxiosResponse } from 'axios';
import FormData from 'form-data';
import { Readable } from 'stream';

// Gotenberg returns 409 when Chromium is busy processing another job.
// We back off and retry a few times before failing.
const GOTENBERG_MAX_RETRIES = 5;
const GOTENBERG_RETRY_DELAY_MS = 3000;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postWithRetry(
  url: string,
  form: FormData,
  timeout: number,
): Promise<AxiosResponse> {
  let lastError: any;
  for (let attempt = 1; attempt <= GOTENBERG_MAX_RETRIES; attempt++) {
    try {
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
        console.warn(`Gotenberg busy (409), retrying in ${delay}ms (attempt ${attempt}/${GOTENBERG_MAX_RETRIES})...`);
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
    this.urlTimeout = Number(process.env.URL_CONVERSION_TIMEOUT_MS || process.env.CONVERSION_TIMEOUT_MS || 240_000);
  }

  /**
   * Convert Office documents (DOCX, XLSX) to PDF using LibreOffice engine
   */
  async convertOfficeToPdf(fileStream: Readable, filename: string): Promise<Readable> {
    const form = new FormData();
    form.append('files', fileStream, filename);

    const response = await postWithRetry(`${this.apiUrl}/forms/libreoffice/convert`, form, this.timeout);
    this.assertValidPdf(response.data, 'LibreOffice');
    return Readable.from(Buffer.from(response.data));
  }

  /**
   * Convert HTML/Markdown to PDF using Chromium engine.
   */
  async convertHtmlToPdf(fileStream: Readable, _filename: string = 'index.html'): Promise<Readable> {
    const form = new FormData();
    form.append('files', fileStream, { filename: 'index.html' });
    form.append('emulatedMediaType', 'print');
    form.append('printBackground', 'true');
    form.append('paperWidth', '8.27');
    form.append('paperHeight', '11.69');
    form.append('marginTop', '0.5');
    form.append('marginBottom', '0.5');
    form.append('marginLeft', '0.5');
    form.append('marginRight', '0.5');

    const response = await postWithRetry(`${this.apiUrl}/forms/chromium/convert/html`, form, this.timeout);
    this.assertValidPdf(response.data, 'Chromium HTML');
    return Readable.from(Buffer.from(response.data));
  }

  /**
   * Convert any public URL to PDF using Chromium engine.
   * Full JS execution, network idle wait, and retry on 409.
   */
  async convertUrlToPdf(url: string): Promise<Readable> {
    const form = new FormData();
    form.append('url', url);
    form.append('emulatedMediaType', 'screen');
    form.append('printBackground', 'true');
    form.append('waitDelay', process.env.CHROMIUM_WAIT_DELAY || '5s');
    form.append('waitNetworkIdleFor', '2s');
    form.append('paperWidth', '8.27');
    form.append('paperHeight', '11.69');
    form.append('marginTop', '0.5');
    form.append('marginBottom', '0.5');
    form.append('marginLeft', '0.5');
    form.append('marginRight', '0.5');
    form.append('scale', '0.9');
    form.append('landscape', 'false');

    const response = await postWithRetry(`${this.apiUrl}/forms/chromium/convert/url`, form, this.urlTimeout);
    this.assertValidPdf(response.data, `Chromium URL (${url})`);
    return Readable.from(Buffer.from(response.data));
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
