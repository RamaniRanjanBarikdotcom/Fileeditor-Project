// ═══════════════════════════════════════════════════════════════
// Conversion Router — Central routing for document conversions
// ═══════════════════════════════════════════════════════════════

import {
  InputFormat,
  OutputFormat,
  ConversionEngine,
  ConversionQuality,
  ConversionMatrixEntry,
  QUEUE_NAMES,
} from '@docconv/shared-types';

// ─── Conversion Matrix ───────────────────────────────────────
// Defines all supported conversion paths with their engines and quality ratings.

export const CONVERSION_MATRIX: ConversionMatrixEntry[] = [
  // PDF extraction. Text PDFs preserve reading order; scanned PDFs use OCR.
  { input: InputFormat.PDF, output: OutputFormat.DOCX, engine: ConversionEngine.PDF_EXTRACTOR, quality: ConversionQuality.B, description: 'PDF text/OCR extraction to editable Word document' },
  { input: InputFormat.PDF, output: OutputFormat.HTML, engine: ConversionEngine.PDF_EXTRACTOR, quality: ConversionQuality.B, description: 'PDF text/OCR extraction to semantic HTML' },
  { input: InputFormat.PDF, output: OutputFormat.MARKDOWN, engine: ConversionEngine.PDF_EXTRACTOR, quality: ConversionQuality.C, description: 'PDF text/OCR extraction to Markdown' },
  { input: InputFormat.PDF, output: OutputFormat.TXT, engine: ConversionEngine.PDF_EXTRACTOR, quality: ConversionQuality.B, description: 'PDF text/OCR extraction to plain text' },
  // Phase 1 — High reliability
  { input: InputFormat.URL, output: OutputFormat.PDF, engine: ConversionEngine.CHROMIUM, quality: ConversionQuality.A, description: 'Gotenberg Chromium rendering for web pages' },
  { input: InputFormat.URL, output: OutputFormat.DOCX, engine: ConversionEngine.CHROMIUM, quality: ConversionQuality.B, description: 'Chromium render followed by PDF extraction to Word' },
  { input: InputFormat.URL, output: OutputFormat.HTML, engine: ConversionEngine.CHROMIUM, quality: ConversionQuality.C, description: 'Chromium render followed by semantic HTML extraction' },
  { input: InputFormat.URL, output: OutputFormat.MARKDOWN, engine: ConversionEngine.CHROMIUM, quality: ConversionQuality.C, description: 'Chromium render followed by Markdown extraction' },
  { input: InputFormat.URL, output: OutputFormat.TXT, engine: ConversionEngine.CHROMIUM, quality: ConversionQuality.B, description: 'Chromium render followed by text extraction' },
  { input: InputFormat.HTML, output: OutputFormat.PDF, engine: ConversionEngine.CHROMIUM, quality: ConversionQuality.A, description: 'Gotenberg Chromium rendering' },
  { input: InputFormat.MARKDOWN, output: OutputFormat.PDF, engine: ConversionEngine.CHROMIUM, quality: ConversionQuality.A, description: 'Markdown → HTML → Chromium' },
  { input: InputFormat.DOCX, output: OutputFormat.PDF, engine: ConversionEngine.LIBREOFFICE, quality: ConversionQuality.A, description: 'LibreOffice via Gotenberg' },
  { input: InputFormat.XLSX, output: OutputFormat.PDF, engine: ConversionEngine.LIBREOFFICE, quality: ConversionQuality.A, description: 'LibreOffice via Gotenberg' },
  { input: InputFormat.CSV, output: OutputFormat.XLSX, engine: ConversionEngine.SHEETJS, quality: ConversionQuality.A, description: 'SheetJS spreadsheet generation' },

  // Phase 2 — Extensions
  { input: InputFormat.MARKDOWN, output: OutputFormat.DOCX, engine: ConversionEngine.PANDOC, quality: ConversionQuality.A, description: 'Pandoc with reference.docx' },
  { input: InputFormat.MARKDOWN, output: OutputFormat.HTML, engine: ConversionEngine.PANDOC, quality: ConversionQuality.A, description: 'Pandoc markdown→HTML' },
  { input: InputFormat.TXT, output: OutputFormat.PDF, engine: ConversionEngine.CHROMIUM, quality: ConversionQuality.A, description: 'Text → HTML template → Chromium' },
  { input: InputFormat.TXT, output: OutputFormat.DOCX, engine: ConversionEngine.PANDOC, quality: ConversionQuality.A, description: 'Pandoc text→DOCX' },
  { input: InputFormat.HTML, output: OutputFormat.DOCX, engine: ConversionEngine.PANDOC, quality: ConversionQuality.B, description: 'Pandoc HTML→DOCX (complex CSS may not map)' },

  // Phase 3 — Full matrix
  { input: InputFormat.DOCX, output: OutputFormat.HTML, engine: ConversionEngine.PANDOC, quality: ConversionQuality.B, description: 'Pandoc semantic HTML (not pixel-perfect)' },
  { input: InputFormat.DOCX, output: OutputFormat.MARKDOWN, engine: ConversionEngine.PANDOC, quality: ConversionQuality.B, description: 'Pandoc DOCX→Markdown (complex layouts simplify)' },
  { input: InputFormat.HTML, output: OutputFormat.MARKDOWN, engine: ConversionEngine.PANDOC, quality: ConversionQuality.B, description: 'Pandoc HTML→Markdown' },
  { input: InputFormat.XLSX, output: OutputFormat.CSV, engine: ConversionEngine.SHEETJS, quality: ConversionQuality.A, description: 'SheetJS spreadsheet extraction' },
  { input: InputFormat.JSON, output: OutputFormat.XLSX, engine: ConversionEngine.SHEETJS, quality: ConversionQuality.A, description: 'SheetJS JSON→spreadsheet' },
  { input: InputFormat.PNG, output: OutputFormat.PDF, engine: ConversionEngine.PDF_LIB, quality: ConversionQuality.A, description: 'pdf-lib image embedding' },
  { input: InputFormat.JPG, output: OutputFormat.PDF, engine: ConversionEngine.PDF_LIB, quality: ConversionQuality.A, description: 'pdf-lib image embedding' },
  { input: InputFormat.JPEG, output: OutputFormat.PDF, engine: ConversionEngine.PDF_LIB, quality: ConversionQuality.A, description: 'pdf-lib image embedding' },
];

// ─── Router ──────────────────────────────────────────────────

export class ConversionRouter {
  private matrix: ConversionMatrixEntry[];

  constructor(matrix: ConversionMatrixEntry[] = CONVERSION_MATRIX) {
    this.matrix = matrix;
  }

  /**
   * Normalize format alias (e.g. "md" -> "markdown").
   */
  normalizeFormat(format: string): string {
    const ext = format.toLowerCase().replace(/^\./, '');
    const detected = detectFormatFromExtension(ext);
    if (detected) return detected;
    if (ext === 'md') return InputFormat.MARKDOWN;
    return ext;
  }

  /**
   * Find the best conversion engine for a given input→output pair.
   */
  findAdapter(input: InputFormat | string, output: OutputFormat | string): ConversionMatrixEntry | undefined {
    const normIn = this.normalizeFormat(input);
    const normOut = this.normalizeFormat(output);
    return this.matrix.find(
      (entry) =>
        (entry.input === normIn || entry.input === input) &&
        (entry.output === normOut || entry.output === output),
    );
  }

  /**
   * Check if a conversion path is supported.
   */
  isSupported(input: InputFormat | string, output: OutputFormat | string): boolean {
    return this.findAdapter(input, output) !== undefined;
  }

  /**
   * Get all available output formats for a given input format.
   */
  getAvailableOutputs(input: InputFormat): OutputFormat[] {
    return this.matrix
      .filter((entry) => entry.input === input)
      .map((entry) => entry.output);
  }

  /**
   * Get all available input formats for a given output format.
   */
  getAvailableInputs(output: OutputFormat): InputFormat[] {
    return this.matrix
      .filter((entry) => entry.output === output)
      .map((entry) => entry.input);
  }

  /**
   * Get the queue name for a given engine.
   */
  getQueueName(engine: ConversionEngine): string {
    switch (engine) {
      case ConversionEngine.CHROMIUM:
        return QUEUE_NAMES.HTML;
      case ConversionEngine.LIBREOFFICE:
        return QUEUE_NAMES.OFFICE;
      case ConversionEngine.PANDOC:
        return QUEUE_NAMES.MARKDOWN;
      case ConversionEngine.SHEETJS:
        return QUEUE_NAMES.DATA;
      case ConversionEngine.MAMMOTH:
      case ConversionEngine.DOCX_GENERATOR:
        return QUEUE_NAMES.DOCUMENT;
      case ConversionEngine.PDF_LIB:
      case ConversionEngine.IMAGE_WORKER:
        return QUEUE_NAMES.IMAGE;
      case ConversionEngine.PDF_EXTRACTOR:
        return QUEUE_NAMES.PDF;
      default:
        return QUEUE_NAMES.HTML;
    }
  }

  /**
   * Get the conversion quality for a given path.
   */
  getQuality(input: InputFormat, output: OutputFormat): ConversionQuality | undefined {
    return this.findAdapter(input, output)?.quality;
  }

  /**
   * Get the full conversion matrix.
   */
  getMatrix(): ConversionMatrixEntry[] {
    return [...this.matrix];
  }

  /**
   * Get only public-facing conversions (quality A or B).
   */
  getPublicConversions(): ConversionMatrixEntry[] {
    return this.matrix.filter(
      (entry) => entry.quality === ConversionQuality.A || entry.quality === ConversionQuality.B,
    );
  }
}

// ─── Format Detection ────────────────────────────────────────

const EXTENSION_TO_FORMAT: Record<string, InputFormat> = {
  pdf: InputFormat.PDF,
  html: InputFormat.HTML,
  htm: InputFormat.HTML,
  md: InputFormat.MARKDOWN,
  markdown: InputFormat.MARKDOWN,
  txt: InputFormat.TXT,
  text: InputFormat.TXT,
  docx: InputFormat.DOCX,
  xlsx: InputFormat.XLSX,
  csv: InputFormat.CSV,
  json: InputFormat.JSON,
  png: InputFormat.PNG,
  jpg: InputFormat.JPG,
  jpeg: InputFormat.JPEG,
  url: InputFormat.URL,
};

/**
 * Detect input format from file extension.
 */
export function detectFormatFromExtension(extension: string): InputFormat | undefined {
  const normalized = extension.toLowerCase().replace(/^\./, '');
  return EXTENSION_TO_FORMAT[normalized];
}

/**
 * Detect input format from MIME type.
 */
export function detectFormatFromMimeType(mimeType: string): InputFormat | undefined {
  const normalized = mimeType.toLowerCase().trim();
  const mimeMap: Record<string, InputFormat> = {
    'application/pdf': InputFormat.PDF,
    'text/html': InputFormat.HTML,
    'text/markdown': InputFormat.MARKDOWN,
    'text/plain': InputFormat.TXT,
    'text/csv': InputFormat.CSV,
    'application/json': InputFormat.JSON,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': InputFormat.DOCX,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': InputFormat.XLSX,
    'image/png': InputFormat.PNG,
    'image/jpeg': InputFormat.JPG,
    'text/uri-list': InputFormat.URL,
  };
  return mimeMap[normalized];
}

// ─── Singleton ───────────────────────────────────────────────

export const conversionRouter = new ConversionRouter();
