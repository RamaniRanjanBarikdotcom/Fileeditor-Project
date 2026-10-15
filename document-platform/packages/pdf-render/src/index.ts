/**
 * Minimal Gotenberg client used where a PDF is needed synchronously (for
 * example an invoice), without the conversion queue. Dependency-free: Node's
 * global fetch, FormData and Blob.
 */

export interface PdfRenderOptions {
  /** Gotenberg base URL (default: GOTENBERG_URL or http://localhost:3000). */
  gotenbergUrl?: string;
  /** Per-request timeout in milliseconds (default 60 s). */
  timeoutMs?: number;
  /**
   * Use the page size and margins declared by CSS `@page` (default true), so
   * a template decides between A4, Letter or an 80 mm thermal roll.
   */
  preferCssPageSize?: boolean;
  /** Print everything on one page as tall as the content (thermal receipt rolls). */
  singlePage?: boolean;
  /** Paper size and margins with units ("80mm", "8.5in"); used when CSS page size is not preferred. */
  paperWidth?: string;
  paperHeight?: string;
  margins?: { top?: string; bottom?: string; left?: string; right?: string };
  /** Retries while Chromium is busy (HTTP 409). Default 4. */
  busyRetries?: number;
  signal?: AbortSignal;
}

export class PdfRenderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

const PDF_MAGIC = Buffer.from('%PDF-');

function baseUrl(options: PdfRenderOptions) {
  return (options.gotenbergUrl || process.env.GOTENBERG_URL || 'http://localhost:3000').replace(/\/$/, '');
}

async function post(path: string, buildForm: () => FormData, options: PdfRenderOptions): Promise<Buffer> {
  const retries = options.busyRetries ?? 4;
  for (let attempt = 0; ; attempt += 1) {
    const timeout = AbortSignal.timeout(options.timeoutMs ?? 60_000);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
    const response = await fetch(`${baseUrl(options)}${path}`, {
      method: 'POST',
      body: buildForm(),
      redirect: 'error',
      signal,
    });
    if (response.status === 409 && attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
      continue;
    }
    if (!response.ok) {
      throw new PdfRenderError(`PDF rendering failed (${response.status}).`, response.status);
    }
    const pdf = Buffer.from(await response.arrayBuffer());
    if (!pdf.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
      throw new PdfRenderError('PDF rendering returned an invalid document.');
    }
    return pdf;
  }
}

/** Renders a self-contained HTML document to PDF with Chromium. */
export function htmlToPdf(html: string, options: PdfRenderOptions = {}): Promise<Buffer> {
  return post(
    '/forms/chromium/convert/html',
    () => {
      const form = new FormData();
      form.append('files', new Blob([html], { type: 'text/html' }), 'index.html');
      form.append('printBackground', 'true');
      form.append('preferCssPageSize', String(options.preferCssPageSize ?? true));
      if (options.singlePage) form.append('singlePage', 'true');
      if (options.paperWidth) form.append('paperWidth', options.paperWidth);
      if (options.paperHeight) form.append('paperHeight', options.paperHeight);
      for (const [side, value] of Object.entries(options.margins ?? {})) {
        if (value) form.append(`margin${side[0]!.toUpperCase()}${side.slice(1)}`, value);
      }
      return form;
    },
    options,
  );
}

/** Converts a PDF to PDF/A (archival; Factur-X/ZUGFeRD needs PDF/A-3). */
export function pdfToPdfA(
  pdf: Buffer,
  level: 'PDF/A-1b' | 'PDF/A-2b' | 'PDF/A-3b',
  options: PdfRenderOptions = {},
): Promise<Buffer> {
  return post(
    '/forms/pdfengines/convert',
    () => {
      const form = new FormData();
      form.append('files', new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }), 'document.pdf');
      form.append('pdfa', level);
      return form;
    },
    options,
  );
}
