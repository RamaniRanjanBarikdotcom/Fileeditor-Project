import { execFile } from 'child_process';
import { promisify } from 'util';
import { Readable } from 'stream';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { workerLogger } from '@docconv/logging';
import { Document, Packer, PageBreak, Paragraph, TextRun } from 'docx';
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
  async convert(inputStream: Readable, targetFormat: string): Promise<Readable> {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'docconv-pdf-'));
    const inputPath = path.join(tmpDir, 'input.pdf');
    const timeout = Number(process.env.CONVERSION_TIMEOUT_MS || 120_000);

    try {
      // Save the stream to disk so we can use it with both pdf-parse and pdftotext
      await pipeline(inputStream, createWriteStream(inputPath));

      // ── Step 1: Extract text ─────────────────────────────────────────────
      let extractedText = '';

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

      // If pdf-parse gave us nothing, try pdftotext (if installed)
      if (extractedText.replace(/\s/g, '').length < 20) {
        const hasPdfToText = await this.commandExists('pdftotext');
        if (hasPdfToText) {
          try {
            const textPath = path.join(tmpDir, 'extracted.txt');
            await execFileAsync('pdftotext', ['-layout', '-enc', 'UTF-8', inputPath, textPath], {
              timeout,
              maxBuffer: 10 * 1024 * 1024,
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
          extractedText = await this.ocrScannedPdf(inputPath, tmpDir, timeout);
        }
      }

      if (extractedText.trim().length === 0) {
        throw new Error(
          'No readable text could be extracted from this PDF. ' +
            'If it is a scanned document, please install poppler-utils and tesseract-ocr on the server.',
        );
      }

      // ── Step 2: Convert to target format ────────────────────────────────
      const target = targetFormat.toLowerCase();
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
        const children: Paragraph[] = [];
        const pages = extractedText.split('\f');
        pages.forEach((pageText, pageIndex) => {
          if (pageIndex > 0) children.push(new Paragraph({ children: [new PageBreak()] }));
          for (const line of pageText.split(/\r?\n/)) {
            children.push(new Paragraph({
              children: [new TextRun({ text: line || ' ', font: 'Courier New', size: 20 })],
              spacing: { after: 40 },
            }));
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
        return Readable.from(Buffer.from(
          `<!doctype html><html><head><meta charset="utf-8"><title>Extracted PDF</title></head><body><pre>${escaped}</pre></body></html>`,
          'utf8',
        ));
      }

      if (target === 'markdown' || target === 'md') {
        return Readable.from(Buffer.from(extractedText, 'utf8'));
      }

      throw new Error(`PDF conversion to '${targetFormat}' is not supported.`);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch((error) => {
        workerLogger.warn({ error, tmpDir }, 'Failed to clean up PDF conversion files');
      });
    }
  }

  /** Check if a command-line tool is available on PATH. */
  private async commandExists(cmd: string): Promise<boolean> {
    try {
      await execFileAsync('which', [cmd], { timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  /** OCR a scanned PDF using pdftoppm + tesseract. */
  private async ocrScannedPdf(inputPath: string, tmpDir: string, timeout: number): Promise<string> {
    const pagePrefix = path.join(tmpDir, 'page');
    await execFileAsync('pdftoppm', ['-png', '-r', '180', inputPath, pagePrefix], {
      timeout,
      maxBuffer: 50 * 1024 * 1024,
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
        { timeout, maxBuffer: 10 * 1024 * 1024 },
      );
      pages.push(stdout);
    }

    return pages.join('\n\n\f\n\n');
  }
}
