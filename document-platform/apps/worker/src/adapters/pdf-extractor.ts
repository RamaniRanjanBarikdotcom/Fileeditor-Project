import { execFile } from 'child_process';
import { promisify } from 'util';
import { Readable } from 'stream';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { workerLogger } from '@docconv/logging';
import type { ConversionOptions } from '@docconv/shared-types';
import {
  Document,
  HorizontalPositionRelativeFrom,
  ImageRun,
  Packer,
  PageBreak,
  Paragraph,
  TextRun,
  VerticalPositionRelativeFrom,
} from 'docx';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require('pdf-parse');

const execFileAsync = promisify(execFile);

/**
 * Converts PDFs into editable formats.
 *
 * Strategy:
 *  1. Primary  — pure-JS `pdf-parse` (no system deps, always available)
 *  2. Optional — `pdftotext` (poppler-utils) if installed on the machine
 *  3. OCR      — Tesseract fallback for scanned/image-only PDFs
 *
 * The primary path works out-of-the-box in dev without Homebrew packages.
 */
export class PdfExtractorAdapter {
  async convert(
    inputStream: Readable,
    targetFormat: string,
    options: ConversionOptions = {},
    signal?: AbortSignal,
  ): Promise<Readable> {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'docconv-pdf-'));
    const inputPath = path.join(tmpDir, 'input.pdf');
    const timeout = Number(process.env.CONVERSION_TIMEOUT_MS || 120_000);

    try {
      // Save the stream to disk so we can use it with both pdf-parse and pdftotext
      await pipeline(inputStream, createWriteStream(inputPath));
      await this.validateSourcePdf(inputPath, timeout, signal);

      const target = targetFormat.toLowerCase();

      // This mode intentionally prioritizes appearance over editability. It is
      // handled before text extraction so scanned and vector-only PDFs work too.
      if (target === 'docx' && options.pdfFidelityMode === 'visual') {
        return Readable.from(await this.convertToVisualDocx(inputPath, tmpDir, timeout, signal));
      }
      if (target === 'docx' && options.pdfFidelityMode === 'fixed') {
        return Readable.from(
          await this.convertToFixedEditableDocx(inputPath, tmpDir, timeout, signal),
        );
      }
      if (target === 'zip') {
        return Readable.from(
          await this.convertToImageArchive(inputPath, tmpDir, timeout, options, signal),
        );
      }

      // ── Step 1: Extract text ─────────────────────────────────────────────
      let extractedText = '';
      let usedOcr = false;

      if (options.pdfFidelityMode === 'ocr') {
        const hasTesseract = await this.commandExists('tesseract');
        const hasPdftoPpm = await this.commandExists('pdftoppm');
        if (!hasTesseract || !hasPdftoPpm) {
          throw new Error(
            'OCR requires tesseract and poppler-utils (pdftoppm) to be installed on the server.',
          );
        }
        workerLogger.info({}, 'Forcing OCR mode on PDF extraction');
        extractedText = await this.ocrScannedPdf(inputPath, tmpDir, timeout, signal);
        usedOcr = true;
      } else {
        // Try fast pure-JS extraction first (always works, no system deps)
        try {
          const pdfBuffer = await fs.readFile(inputPath);
          const parser = new PDFParse({ data: pdfBuffer });
          try {
            const parsed = await parser.getText();
            extractedText = parsed.text || '';
          } finally {
            await parser.destroy();
          }
          workerLogger.debug({ chars: extractedText.length }, 'pdf-parse extracted text');
        } catch (pdfParseErr: any) {
          workerLogger.warn({ err: pdfParseErr.message }, 'pdf-parse failed, trying pdftotext');
        }
      }

      // If pdf-parse gave us nothing, try pdftotext (if installed)
      if (extractedText.replace(/\s/g, '').length < 20) {
        const hasPdfToText = await this.commandExists('pdftotext');
        if (hasPdfToText) {
          try {
            const textPath = path.join(tmpDir, 'extracted.txt');
            await execFileAsync('pdftotext', ['-layout', '-enc', 'UTF-8', inputPath, textPath], {
              timeout,
              maxBuffer: 10 * 1024 * 1024,
              signal,
            });
            extractedText = await fs.readFile(textPath, 'utf8').catch(() => '');
            workerLogger.debug({ chars: extractedText.length }, 'pdftotext extracted text');
          } catch (ptErr: any) {
            workerLogger.warn({ err: ptErr.message }, 'pdftotext also failed');
          }
        }
      }

      // If still nothing, try Tesseract OCR for scanned/image PDFs
      if (extractedText.replace(/\s/g, '').length < 20) {
        const hasTesseract = await this.commandExists('tesseract');
        const hasPdftoPpm = await this.commandExists('pdftoppm');
        if (hasTesseract && hasPdftoPpm) {
          workerLogger.info({}, 'Attempting OCR on PDF (likely scanned)');
          extractedText = await this.ocrScannedPdf(inputPath, tmpDir, timeout, signal);
          usedOcr = extractedText.replace(/\s/g, '').length >= 20;
        }
      }

      if (extractedText.trim().length === 0) {
        throw new Error(
          'No readable text could be extracted from this PDF. ' +
            'If it is a scanned document, please install poppler-utils and tesseract-ocr on the server.',
        );
      }

      // ── Step 2: Convert to target format ────────────────────────────────
      if (target === 'txt') {
        return Readable.from(Buffer.from(extractedText, 'utf8'));
      }

      const allowedFormats = ['docx', 'html', 'markdown', 'md'];
      if (!allowedFormats.includes(target)) {
        throw new Error(
          `PDF conversion to '${targetFormat}' is not supported. Supported: txt, docx, html, markdown`,
        );
      }

      if (target === 'docx') {
        // Digital PDFs contain enough geometry for pdf2docx to rebuild page size,
        // text styling, columns, images, shapes and tables. The previous implementation
        // flattened extraction into Courier paragraphs and necessarily lost that layout.
        // OCR-only PDFs still use the editable text fallback below because pdf2docx
        // cannot make text inside a scanned page image editable.
        if (!usedOcr) {
          const highFidelityDocx = await this.convertToLayoutAwareDocx(
            inputPath,
            tmpDir,
            timeout,
            signal,
          );
          if (highFidelityDocx) return Readable.from(highFidelityDocx);
        }

        const children: Paragraph[] = [];
        const pages = extractedText.split('\f');
        pages.forEach((pageText, pageIndex) => {
          if (pageIndex > 0) children.push(new Paragraph({ children: [new PageBreak()] }));
          for (const line of pageText.split(/\r?\n/)) {
            children.push(
              new Paragraph({
                children: [new TextRun({ text: line || ' ', font: 'Courier New', size: 20 })],
                spacing: { after: 40 },
              }),
            );
          }
        });
        const document = new Document({
          creator: 'AppToolkitLab',
          title: 'Extracted PDF content',
          description: 'Editable, text-focused PDF extraction',
          sections: [{ children }],
        });
        return Readable.from(await Packer.toBuffer(document));
      }

      if (target === 'html') {
        const escaped = extractedText
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        return Readable.from(
          Buffer.from(
            `<!doctype html><html><head><meta charset="utf-8"><title>Extracted PDF</title></head><body><pre>${escaped}</pre></body></html>`,
            'utf8',
          ),
        );
      }

      if (target === 'markdown' || target === 'md') {
        return Readable.from(Buffer.from(extractedTextToMarkdown(extractedText), 'utf8'));
      }

      throw new Error(`PDF conversion to '${targetFormat}' is not supported.`);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch((error) => {
        workerLogger.warn({ error, tmpDir }, 'Failed to clean up PDF conversion files');
      });
    }
  }

  /**
   * Render pages with Poppler rather than a browser canvas. Poppler consumes
   * embedded Type 1/Type 1C/CFF/TrueType/OpenType glyph programs directly and
   * uses fontconfig fallbacks for the uncommon PDFs that omit their fonts.
   */
  private async convertToImageArchive(
    inputPath: string,
    tmpDir: string,
    timeout: number,
    options: ConversionOptions,
    signal?: AbortSignal,
  ): Promise<Buffer> {
    if (!(await this.commandExists('pdftoppm'))) {
      throw new Error('High-compatibility PDF image export requires Poppler pdftoppm.');
    }

    const format = options.imageFormat === 'jpg' ? 'jpg' : 'png';
    const dpi = options.imageDpi === 96 || options.imageDpi === 300 ? options.imageDpi : 150;
    const pagePrefix = path.join(tmpDir, 'rendered-page');
    const args =
      format === 'jpg'
        ? ['-jpeg', '-jpegopt', 'quality=94', '-r', String(dpi), inputPath, pagePrefix]
        : ['-png', '-r', String(dpi), inputPath, pagePrefix];

    await execFileAsync('pdftoppm', args, {
      timeout,
      maxBuffer: 50 * 1024 * 1024,
      windowsHide: true,
      signal,
    });

    const pattern = new RegExp(`^rendered-page-?(\\d+)\\.${format}$`);
    const images = (await fs.readdir(tmpDir))
      .map((name) => ({ name, page: Number(name.match(pattern)?.[1] || 0) }))
      .filter((item) => item.page > 0)
      .sort((a, b) => a.page - b.page);
    if (!images.length) throw new Error('Poppler did not render any PDF pages.');

    const maxPages = Number(process.env.MAX_PDF_IMAGE_PAGES || 200);
    if (images.length > maxPages) {
      throw new Error(`PDF exceeds the image export limit (${maxPages} pages).`);
    }

    const padding = Math.max(3, String(images.length).length);
    const archive = new JSZip();
    for (const image of images) {
      const bytes = await fs.readFile(path.join(tmpDir, image.name));
      if (!bytes.length) throw new Error(`Poppler returned an empty image for page ${image.page}.`);
      archive.file(`page-${String(image.page).padStart(padding, '0')}.${format}`, bytes);
    }

    return archive.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
  }

  /**
   * Create a visually exact Word document by rendering every PDF page and
   * anchoring that image to a same-sized Word page. Text is intentionally not
   * editable in this mode; editable reconstruction is provided separately.
   */
  private async convertToVisualDocx(
    inputPath: string,
    tmpDir: string,
    timeout: number,
    signal?: AbortSignal,
  ): Promise<Buffer> {
    if (!(await this.commandExists('pdftoppm'))) {
      throw new Error('Exact visual Word export requires Poppler pdftoppm on the worker.');
    }

    const pdfBytes = await fs.readFile(inputPath);
    const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: false });
    const pagePrefix = path.join(tmpDir, 'visual-page');
    const dpi = 180;
    await execFileAsync('pdftoppm', ['-png', '-r', String(dpi), inputPath, pagePrefix], {
      timeout,
      maxBuffer: 50 * 1024 * 1024,
      signal,
    });
    const images = (await fs.readdir(tmpDir))
      .filter((name) => /^visual-page-?\d+\.png$/.test(name))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (!images.length || images.length !== pdf.getPageCount()) {
      throw new Error('The visual Word renderer did not produce every PDF page.');
    }

    const sections = await Promise.all(
      images.map(async (imageName, index) => {
        const page = pdf.getPage(index);
        const { width, height } = page.getSize();
        const displayWidth = Math.round((width * 96) / 72);
        const displayHeight = Math.round((height * 96) / 72);
        return {
          properties: {
            page: {
              size: { width: Math.round(width * 20), height: Math.round(height * 20) },
              margin: { top: 0, right: 0, bottom: 0, left: 0, header: 0, footer: 0, gutter: 0 },
            },
          },
          children: [
            new Paragraph({
              spacing: { before: 0, after: 0, line: 1 },
              children: [
                new ImageRun({
                  type: 'png',
                  data: await fs.readFile(path.join(tmpDir, imageName)),
                  transformation: { width: displayWidth, height: displayHeight },
                  floating: {
                    horizontalPosition: {
                      relative: HorizontalPositionRelativeFrom.PAGE,
                      offset: 0,
                    },
                    verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 0 },
                    behindDocument: false,
                    allowOverlap: true,
                    lockAnchor: true,
                    margins: { top: 0, right: 0, bottom: 0, left: 0 },
                  },
                }),
              ],
            }),
          ],
        };
      }),
    );

    const document = new Document({
      creator: 'AppToolkitLab',
      title: 'Visually preserved PDF export',
      description: 'Each PDF page is preserved as an exact full-page image.',
      sections,
    });
    return Packer.toBuffer(document);
  }

  private async convertToFixedEditableDocx(
    inputPath: string,
    tmpDir: string,
    timeout: number,
    signal?: AbortSignal,
  ): Promise<Buffer> {
    const python =
      process.env.PDF_FIXED_DOCX_PYTHON ||
      ((await this.commandExists('/opt/pdf2docx/bin/python'))
        ? '/opt/pdf2docx/bin/python'
        : 'python3');
    const script =
      process.env.PDF_FIXED_DOCX_SCRIPT ||
      path.resolve(__dirname, '../../scripts/pdf_to_fixed_docx.py');
    if (!(await this.commandExists(python))) {
      throw new Error(
        'Fixed-position editable Word export requires the pdf2docx Python environment.',
      );
    }
    await fs.access(script).catch(() => {
      throw new Error(`Fixed-position Word converter script was not found at '${script}'.`);
    });
    const outputPath = path.join(tmpDir, 'fixed-editable.docx');
    await execFileAsync(python, [script, inputPath, outputPath, '--dpi', '180'], {
      timeout,
      maxBuffer: 20 * 1024 * 1024,
      windowsHide: true,
      signal,
    });
    const output = await fs.readFile(outputPath);
    if (output.length < 1_000 || output.subarray(0, 2).toString('ascii') !== 'PK') {
      throw new Error('Fixed-position converter returned an invalid DOCX package.');
    }
    return output;
  }

  /**
   * Reconstruct a digital PDF as an editable DOCX with layout, images and tables.
   *
   * The queue worker remains Node.js: it invokes the isolated pdf2docx CLI and
   * retains control of timeouts, output validation, fallback, and cleanup.
   */
  private async convertToLayoutAwareDocx(
    inputPath: string,
    tmpDir: string,
    timeout: number,
    signal?: AbortSignal,
  ): Promise<Buffer | null> {
    const configuredEngine = (process.env.PDF_TO_DOCX_ENGINE || 'auto').toLowerCase();
    if (configuredEngine === 'text') return null;

    const executable = process.env.PDF2DOCX_BIN || 'pdf2docx';
    if (!(await this.commandExists(executable))) {
      const message =
        `The layout-aware PDF-to-Word engine was not found at '${executable}'. ` +
        'Install pdf2docx 0.5.13 or set PDF2DOCX_BIN to its executable path.';
      if (configuredEngine === 'pdf2docx') throw new Error(message);
      workerLogger.warn({ executable }, `${message} Using the text-focused fallback.`);
      return null;
    }

    try {
      const outputPath = path.join(tmpDir, 'layout-aware.docx');
      await execFileAsync(executable, ['convert', inputPath, outputPath], {
        timeout,
        maxBuffer: 10 * 1024 * 1024,
        windowsHide: true,
        signal,
      });

      const output = await fs.readFile(outputPath);
      if (output.length < 1_000 || output.subarray(0, 2).toString('ascii') !== 'PK') {
        throw new Error('pdf2docx returned an invalid or empty DOCX package');
      }
      workerLogger.info(
        { bytes: output.length, executable },
        'Created layout-aware editable DOCX with pdf2docx',
      );
      return output;
    } catch (error: any) {
      if (configuredEngine === 'pdf2docx') throw error;
      workerLogger.warn(
        { err: error?.message || String(error) },
        'Layout-aware PDF-to-DOCX failed; using the text-focused fallback',
      );
      return null;
    }
  }

  /** Check if a command-line tool is available on PATH. */
  private async commandExists(cmd: string): Promise<boolean> {
    try {
      if (path.isAbsolute(cmd)) {
        await fs.access(cmd);
      } else {
        await execFileAsync(process.platform === 'win32' ? 'where' : 'which', [cmd], {
          timeout: 3000,
        });
      }
      return true;
    } catch {
      return false;
    }
  }

  private async validateSourcePdf(
    inputPath: string,
    timeout: number,
    signal?: AbortSignal,
  ): Promise<void> {
    if (await this.commandExists('pdfinfo')) {
      try {
        await execFileAsync('pdfinfo', [inputPath], {
          timeout: Math.min(timeout, 30_000),
          maxBuffer: 2 * 1024 * 1024,
          windowsHide: true,
          signal,
        });
        return;
      } catch (error: any) {
        const details = `${error?.stderr || ''} ${error?.message || ''}`;
        if (/password|encrypted|incorrect password/i.test(details)) {
          throw new Error(
            'This PDF is encrypted or password-protected. Unlock it with the correct password before conversion.',
          );
        }
        throw new Error(
          `This PDF is corrupt or unsupported and cannot be converted safely: ${details.trim().slice(0, 300)}`,
        );
      }
    }

    try {
      const bytes = await fs.readFile(inputPath);
      const document = await PDFDocument.load(bytes, { ignoreEncryption: false });
      if (document.getPageCount() < 1) throw new Error('the document has no pages');
    } catch (error: any) {
      const message = error?.message || 'invalid PDF structure';
      if (/encrypted|password/i.test(message)) {
        throw new Error(
          'This PDF is encrypted or password-protected. Unlock it with the correct password before conversion.',
        );
      }
      throw new Error(
        `This PDF is corrupt or unsupported and cannot be converted safely: ${message}`,
      );
    }
  }

  /** OCR a scanned PDF using pdftoppm + tesseract. */
  private async ocrScannedPdf(
    inputPath: string,
    tmpDir: string,
    timeout: number,
    signal?: AbortSignal,
  ): Promise<string> {
    const pagePrefix = path.join(tmpDir, 'page');
    await execFileAsync('pdftoppm', ['-png', '-r', '180', inputPath, pagePrefix], {
      timeout,
      maxBuffer: 50 * 1024 * 1024,
      signal,
    });

    const pageImages = (await fs.readdir(tmpDir))
      .filter((name) => /^page-?\d+\.png$/.test(name))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    if (pageImages.length === 0) return '';

    const maxPages = Number(process.env.MAX_OCR_PAGES || 100);
    if (pageImages.length > maxPages) {
      throw new Error(`Scanned PDF exceeds the OCR page limit (${maxPages} pages).`);
    }

    const language = process.env.OCR_LANGUAGES || 'eng';
    const pages: string[] = [];
    for (const pageImage of pageImages) {
      const { stdout } = await execFileAsync(
        'tesseract',
        [path.join(tmpDir, pageImage), 'stdout', '-l', language, '--psm', '3'],
        { timeout, maxBuffer: 10 * 1024 * 1024, signal },
      );
      pages.push(stdout);
    }

    return pages.join('\n\n\f\n\n');
  }
}

/** Convert layout-preserving extracted text into useful, readable Markdown. */
export function extractedTextToMarkdown(source: string): string {
  const pages = source.replace(/\r\n/g, '\n').split('\f');
  const output: string[] = [];
  for (const [pageIndex, page] of pages.entries()) {
    const lines = page.split('\n').map((line) => line.trimEnd());
    const nonEmpty = lines.filter((line) => line.trim());
    if (!nonEmpty.length) continue;
    if (pages.length > 1) output.push(`## Page ${pageIndex + 1}`, '');
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        if (output.at(-1) !== '') output.push('');
        continue;
      }
      if (/^[\u2022\u25cf\u25e6*-]\s+/.test(line)) {
        output.push(`- ${line.replace(/^[\u2022\u25cf\u25e6*-]\s+/, '')}`);
      } else if (/^\d+[.)]\s+/.test(line)) {
        output.push(line.replace(/^(\d+)[)]\s+/, '$1. '));
      } else if (
        line.length <= 90 &&
        !/[.!?;:]$/.test(line) &&
        (line === line.toUpperCase() || /^[A-Z][A-Za-z0-9 '&,/()-]+$/.test(line))
      ) {
        output.push(`### ${line}`);
      } else {
        output.push(line);
      }
    }
    while (output.at(-1) === '') output.pop();
    output.push('');
  }
  return `${output.join('\n').trim()}\n`;
}
