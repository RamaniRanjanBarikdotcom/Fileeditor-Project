import { ErrorCode } from '@docconv/shared-types';
import type {
  ProcessingContext,
  ProcessingEngine,
  ProcessingRequest,
  ProcessingResult,
  OutputDescriptor,
} from '@docconv/shared-types';
import { ProcessingRouter } from '@docconv/processing-core';
import type { PDFDocument as PDFDocumentType } from 'pdf-lib';
import { PDFJS_DOCUMENT_OPTIONS } from './pdfjs-config.mjs';
import type { StampPosition } from './pdf-stamp.ts';
import {
  centredRotatedOrigin,
  drawAtVisual,
  hexToRgb,
  positionOrigin,
  prepareText,
  visualFrame,
} from './pdf-stamp.ts';

interface BrowserProcessingRequest extends ProcessingRequest {
  browserFiles: File[];
}

export interface BrowserProcessingOutput extends ProcessingResult {
  blobs?: Array<{ blob: Blob; name: string; mimeType: string }>;
}

const MEBIBYTE = 1024 * 1024;
export const SERVER_POPPLER_REQUIRED = 'SERVER_POPPLER_REQUIRED';

export function containsMissingGlyphIndicators(text: string): boolean {
  return (
    text.includes('\uFFFD') ||
    /[\u25A1\u25A0\u25AF\u2B1A]{2,}/u.test(text) ||
    /(?:\[missing glyph\]|\.notdef)/iu.test(text)
  );
}

/**
 * Browser conversions hold the source bytes, parsed document objects and the
 * generated output at the same time. This deliberately estimates the working
 * set conservatively so a large merge fails before the tab becomes unstable.
 */
export function estimateLocalProcessingBytes(
  operation: string,
  files: Array<Pick<File, 'size'>>,
): number {
  const inputBytes = files.reduce((total, file) => total + file.size, 0);
  const multiplier =
    operation === 'pdf.toImages'
      ? 10
      : operation === 'image.toPdf'
        ? 8
        : operation === 'pdf.split'
          ? 6
          : 5;
  return inputBytes * multiplier + 32 * MEBIBYTE;
}

export function localProcessingMemoryBudgetBytes(): number {
  const deviceMemoryGiB =
    typeof navigator !== 'undefined' && 'deviceMemory' in navigator
      ? Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory)
      : 4;
  const safeDeviceMemoryGiB = Number.isFinite(deviceMemoryGiB) ? deviceMemoryGiB : 4;
  return Math.min(
    512 * MEBIBYTE,
    Math.max(128 * MEBIBYTE, safeDeviceMemoryGiB * 0.125 * 1024 ** 3),
  );
}

const pageSizes: Record<string, [number, number]> = {
  A3: [841.89, 1190.55],
  A4: [595.28, 841.89],
  A5: [419.53, 595.28],
  Letter: [612, 792],
  Legal: [612, 1008],
};

function fileExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() || '';
}

function parsePageSelection(value: unknown, pageCount: number): number[] {
  const text = String(value || '').trim();
  if (!text) return Array.from({ length: pageCount }, (_, index) => index);
  const selected = new Set<number>();
  for (const token of text.split(',')) {
    const match = token.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!match) throw new Error('Use page numbers like 1-3,5,8.');
    const start = Number(match[1]);
    const end = Number(match[2] || match[1]);
    if (start < 1 || end < start || end > pageCount) {
      throw new Error(`Page selection must stay between 1 and ${pageCount}.`);
    }
    for (let page = start; page <= end; page += 1) selected.add(page - 1);
  }
  return [...selected].sort((a, b) => a - b);
}

function parsePageOrder(value: unknown, pageCount: number): number[] {
  const text = String(value || '').trim();
  if (!text) throw new Error('Enter the new page order, for example 3,1,2,2.');
  const ordered: number[] = [];
  for (const token of text.split(',')) {
    const match = token.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!match) throw new Error('Use page numbers like 3,1,2 or ranges like 4-6.');
    const start = Number(match[1]);
    const end = Number(match[2] || match[1]);
    if (start < 1 || end < start || end > pageCount) {
      throw new Error(`Page order must stay between 1 and ${pageCount}.`);
    }
    for (let page = start; page <= end; page += 1) ordered.push(page - 1);
  }
  return ordered;
}

function numericOption(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function targetPageSize(options: Record<string, unknown>): [number, number] {
  const selected = pageSizes[String(options.pageSize || 'A4')] || pageSizes.A4;
  return String(options.orientation || 'portrait') === 'landscape'
    ? [selected[1], selected[0]]
    : selected;
}

/** Opens a PDF with PDF.js for reading text and the outline (no rendering). */
async function openWithPdfJs(bytes: ArrayBuffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  if (typeof window !== 'undefined' || typeof WorkerGlobalScope !== 'undefined') {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString();
  }
  return pdfjs.getDocument({ ...PDFJS_DOCUMENT_OPTIONS, data: new Uint8Array(bytes) }).promise;
}

/** Text of each page, with lines rebuilt from PDF.js text item positions. */
async function extractPageTexts(bytes: ArrayBuffer): Promise<string[]> {
  const document = await openWithPdfJs(bytes);
  try {
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const lines: string[] = [];
      let current = '';
      let lastY: number | null = null;
      for (const item of content.items) {
        if (!('str' in item)) continue;
        const y = Math.round(item.transform[5]);
        if (lastY !== null && Math.abs(y - lastY) > 2) {
          lines.push(current.trimEnd());
          current = '';
        }
        current += item.str;
        lastY = y;
        if (item.hasEOL) {
          lines.push(current.trimEnd());
          current = '';
          lastY = null;
        }
      }
      if (current.trim()) lines.push(current.trimEnd());
      pages.push(lines.join('\n'));
      page.cleanup();
    }
    return pages;
  } finally {
    await document.destroy();
  }
}

/** Loads a PDF, turning encryption into a clear, actionable message. */
async function loadPdf(source: File) {
  const { PDFDocument } = await import('pdf-lib');
  try {
    return await PDFDocument.load(await source.arrayBuffer(), { updateMetadata: false });
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error);
    if (/encrypt/i.test(message)) {
      throw new Error(
        `"${source.name}" is password-protected. Remove the password with Unlock PDF, then try again.`,
      );
    }
    if (/No PDF header|Failed to parse|Invalid object|Expected/i.test(message)) {
      throw new Error(`"${source.name}" is damaged or is not a PDF. Try Repair PDF first.`);
    }
    throw error;
  }
}

/** Splits "1-3,4,7-9" into separate ranges (each becomes one output file). */
function parseRanges(value: unknown, pageCount: number): number[][] {
  const text = String(value || '').trim();
  if (!text) throw new Error('Enter page ranges such as 1-3,4-6.');
  return text.split(',').map((token) => {
    const match = token.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!match) throw new Error('Use ranges like 1-3,4-6,7.');
    const start = Number(match[1]);
    const end = Number(match[2] || match[1]);
    if (start < 1 || end < start || end > pageCount) {
      throw new Error(`Ranges must stay between 1 and ${pageCount}.`);
    }
    return Array.from({ length: end - start + 1 }, (_, index) => start - 1 + index);
  });
}

/** Converts WebP/GIF/BMP (or any browser-decodable image) to PNG bytes. */
async function imageToPngBytes(source: File): Promise<Uint8Array> {
  if (typeof createImageBitmap === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    throw new Error(`${source.name} needs a modern browser to convert. Use PNG or JPEG instead.`);
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(source);
  } catch {
    throw new Error(`${source.name} could not be read as an image.`);
  }
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('The browser image canvas could not be initialized.');
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return new Uint8Array(await blob.arrayBuffer());
}

export class BrowserProcessingEngine implements ProcessingEngine {
  readonly id = 'browser-pdf-lib';
  readonly location = 'BROWSER' as const;

  async canProcess(request: ProcessingRequest): Promise<boolean> {
    return (
      [
        'image.toPdf',
        'pdf.merge',
        'pdf.split',
        'pdf.extractPages',
        'pdf.deletePages',
        'pdf.rotate',
        'pdf.watermark',
        'pdf.addPageNumbers',
        'pdf.editMetadata',
        'pdf.organize',
        'pdf.alternateMix',
        'pdf.crop',
        'pdf.resize',
        'pdf.nUp',
        'pdf.headerFooter',
        'pdf.batesNumbering',
        'pdf.flattenForms',
        'pdf.toImages',
        'image.scanToPdf',
        'pdf.splitByBookmarks',
        'pdf.splitHalf',
        'pdf.splitBySize',
        'pdf.splitByText',
        'pdf.removeAnnotations',
        'pdf.flip',
        'pdf.addBookmarks',
        'pdf.toText',
      ].includes(request.operation) && 'browserFiles' in request
    );
  }

  async process(
    request: ProcessingRequest,
    _context: ProcessingContext,
  ): Promise<BrowserProcessingOutput> {
    const startedAt = performance.now();
    const browserRequest = request as BrowserProcessingRequest;

    try {
      const { PDFDocument, StandardFonts, degrees } = await import('pdf-lib');
      const outputBlobs: Array<{ blob: Blob; name: string; mimeType: string }> = [];
      const outputDescriptors: OutputDescriptor[] = [];
      const addPdfOutput = async (document: PDFDocumentType, name: string) => {
        const bytes = await document.save();
        const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
        outputBlobs.push({ blob, name, mimeType: 'application/pdf' });
        outputDescriptors.push({
          name,
          extension: 'pdf',
          mimeType: 'application/pdf',
          sizeBytes: blob.size,
        });
      };

      if (request.operation === 'pdf.toImages') {
        const source = browserRequest.browserFiles[0];
        if (!source) throw new Error('Choose a PDF file.');
        const format = String(request.options.outputFormat || 'png').toLowerCase();
        if (!['png', 'jpg', 'jpeg'].includes(format)) {
          throw new Error('Choose PNG or JPG as the image format.');
        }
        const dpi = numericOption(request.options.imageDpi, 150, 72, 300);
        const scale = dpi / 72;
        const baseName = source.name.replace(/\.[^.]+$/, '') || 'document';
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString();
        const loadingTask = pdfjs.getDocument({
          ...PDFJS_DOCUMENT_OPTIONS,
          data: new Uint8Array(await source.arrayBuffer()),
        });
        const document = await loadingTask.promise;
        try {
          for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
            const page = await document.getPage(pageNumber);
            const textContent = await page.getTextContent();
            const extractedPageText = textContent.items
              .map((item) => ('str' in item ? item.str : ''))
              .join('');
            if (containsMissingGlyphIndicators(extractedPageText)) {
              throw new Error(
                `${SERVER_POPPLER_REQUIRED}: Browser font rendering is incomplete on page ${pageNumber}. Retrying with the server Poppler renderer.`,
              );
            }
            const viewport = page.getViewport({ scale });
            if (typeof OffscreenCanvas === 'undefined') {
              throw new Error(
                'This browser cannot render PDF pages to images. Update your browser.',
              );
            }
            const canvas = new OffscreenCanvas(
              Math.max(1, Math.ceil(viewport.width)),
              Math.max(1, Math.ceil(viewport.height)),
            );
            const context = canvas.getContext('2d', { alpha: false });
            if (!context) throw new Error('The browser image canvas could not be initialized.');
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({
              // PDF.js supports OffscreenCanvas at runtime; its public types still
              // describe the older HTMLCanvasElement-only surface.
              canvas: canvas as unknown as HTMLCanvasElement,
              canvasContext: context as unknown as CanvasRenderingContext2D,
              viewport,
            }).promise;
            const isJpeg = format === 'jpg' || format === 'jpeg';
            const mimeType = isJpeg ? 'image/jpeg' : 'image/png';
            const extension = isJpeg ? 'jpg' : 'png';
            const blob = await canvas.convertToBlob({ type: mimeType, quality: 0.94 });
            const name = `${baseName}-page-${pageNumber}.${extension}`;
            outputBlobs.push({ blob, name, mimeType });
            outputDescriptors.push({ name, extension, mimeType, sizeBytes: blob.size });
            page.cleanup();
          }
        } finally {
          await document.destroy();
        }
      } else if (request.operation === 'image.toPdf' || request.operation === 'image.scanToPdf') {
        const pdf = await PDFDocument.create();
        const requestedPageSize = String(request.options.pageSize || 'A4');
        const requestedOrientation = String(request.options.orientation || 'portrait');
        const [portraitWidth, portraitHeight] = pageSizes[requestedPageSize] || pageSizes.A4;
        const pageWidth = requestedOrientation === 'landscape' ? portraitHeight : portraitWidth;
        const pageHeight = requestedOrientation === 'landscape' ? portraitWidth : portraitHeight;
        const margin = Math.max(0, Math.min(144, Number(request.options.marginPoints ?? 36)));

        for (const source of browserRequest.browserFiles) {
          const bytes = new Uint8Array(await source.arrayBuffer());
          const extension = fileExtension(source.name);
          const image =
            source.type === 'image/png' || extension === 'png'
              ? await pdf.embedPng(bytes)
              : source.type === 'image/jpeg' || ['jpg', 'jpeg'].includes(extension)
                ? await pdf.embedJpg(bytes)
                : await pdf.embedPng(await imageToPngBytes(source));

          const availableWidth = Math.max(1, pageWidth - margin * 2);
          const availableHeight = Math.max(1, pageHeight - margin * 2);
          const scale = Math.min(availableWidth / image.width, availableHeight / image.height, 1);
          const drawWidth = image.width * scale;
          const drawHeight = image.height * scale;
          pdf.addPage([pageWidth, pageHeight]).drawImage(image, {
            x: (pageWidth - drawWidth) / 2,
            y: (pageHeight - drawHeight) / 2,
            width: drawWidth,
            height: drawHeight,
          });
        }
        await addPdfOutput(
          pdf,
          `${browserRequest.browserFiles[0]?.name.replace(/\.[^.]+$/, '') || 'images'}.pdf`,
        );
      } else if (request.operation === 'pdf.merge') {
        const merged = await PDFDocument.create();
        for (const source of browserRequest.browserFiles) {
          const input = await loadPdf(source);
          const pages = await merged.copyPages(input, input.getPageIndices());
          pages.forEach((page) => merged.addPage(page));
        }
        await addPdfOutput(merged, 'merged.pdf');
      } else if (request.operation === 'pdf.alternateMix') {
        if (browserRequest.browserFiles.length < 2) {
          throw new Error('Choose at least two PDF files to alternate.');
        }
        const documents = await Promise.all(
          browserRequest.browserFiles.map((source) => loadPdf(source)),
        );
        const result = await PDFDocument.create();
        const maximumPages = Math.max(...documents.map((document) => document.getPageCount()));
        for (let pageIndex = 0; pageIndex < maximumPages; pageIndex += 1) {
          for (const document of documents) {
            if (pageIndex >= document.getPageCount()) continue;
            const [page] = await result.copyPages(document, [pageIndex]);
            result.addPage(page);
          }
        }
        await addPdfOutput(result, 'alternated-and-mixed.pdf');
      } else {
        const source = browserRequest.browserFiles[0];
        if (!source) throw new Error('Choose a PDF file.');
        const input = await loadPdf(source);
        const baseName = source.name.replace(/\.[^.]+$/, '') || 'document';

        if (request.operation === 'pdf.split') {
          const mode = String(request.options.splitMode || 'every');
          const pageCount = input.getPageCount();
          const groups =
            mode === 'ranges'
              ? parseRanges(request.options.ranges, pageCount)
              : Array.from(
                  {
                    length: Math.ceil(
                      pageCount /
                        (mode === 'everyN'
                          ? Math.floor(numericOption(request.options.everyN, 2, 1, pageCount))
                          : 1),
                    ),
                  },
                  (_, index) => {
                    const size =
                      mode === 'everyN'
                        ? Math.floor(numericOption(request.options.everyN, 2, 1, pageCount))
                        : 1;
                    return input.getPageIndices().slice(index * size, index * size + size);
                  },
                );
          for (const group of groups) {
            const part = await PDFDocument.create();
            (await part.copyPages(input, group)).forEach((page) => part.addPage(page));
            const first = group[0]! + 1;
            const last = group[group.length - 1]! + 1;
            await addPdfOutput(
              part,
              `${baseName}-${first === last ? `page-${first}` : `pages-${first}-${last}`}.pdf`,
            );
          }
        } else if (request.operation === 'pdf.extractPages') {
          const selected = parsePageSelection(request.options.pages, input.getPageCount());
          const extracted = await PDFDocument.create();
          (await extracted.copyPages(input, selected)).forEach((page) => extracted.addPage(page));
          await addPdfOutput(extracted, `${baseName}-extracted.pdf`);
        } else if (request.operation === 'pdf.deletePages') {
          const removed = new Set(parsePageSelection(request.options.pages, input.getPageCount()));
          const kept = input.getPageIndices().filter((index) => !removed.has(index));
          if (!kept.length) throw new Error('At least one page must remain in the PDF.');
          const result = await PDFDocument.create();
          (await result.copyPages(input, kept)).forEach((page) => result.addPage(page));
          await addPdfOutput(result, `${baseName}-pages-removed.pdf`);
        } else if (request.operation === 'pdf.rotate') {
          const amount = Number(request.options.rotation || 90);
          if (![90, 180, 270].includes(amount))
            throw new Error('Choose a 90°, 180°, or 270° rotation.');
          const selected = new Set(parsePageSelection(request.options.pages, input.getPageCount()));
          input.getPages().forEach((page, index) => {
            if (!selected.has(index)) return;
            const current = page.getRotation().angle;
            page.setRotation(degrees((current + amount) % 360));
          });
          await addPdfOutput(input, `${baseName}-rotated.pdf`);
        } else if (request.operation === 'pdf.watermark') {
          const watermark = String(request.options.watermarkText || '')
            .trim()
            .slice(0, 120);
          if (!watermark) throw new Error('Enter watermark text.');
          const font = await input.embedFont(StandardFonts.HelveticaBold);
          const color = hexToRgb(request.options.watermarkColor, { r: 0.45, g: 0.45, b: 0.45 });
          const opacity = numericOption(request.options.watermarkOpacity, 30, 5, 100) / 100;
          const angle = numericOption(request.options.watermarkAngle, 45, -90, 90);
          const requestedSize = numericOption(request.options.watermarkSize, 0, 0, 200);
          const position = String(request.options.watermarkPosition || 'center');
          const selected = new Set(parsePageSelection(request.options.pages, input.getPageCount()));
          for (const [index, page] of input.getPages().entries()) {
            if (!selected.has(index)) continue;
            const frame = visualFrame(page);
            if (position === 'center') {
              // Start large (or at the requested size) and shrink until the
              // rotated text fits inside the page.
              const nominal = requestedSize || Math.min(frame.width, frame.height) / 5;
              let text = await prepareText(input, font, watermark, nominal, color);
              const fit = centredRotatedOrigin(page, text, angle);
              if (fit.fitScale < 1) {
                text = await prepareText(input, font, watermark, nominal * fit.fitScale, color);
              }
              const { vx, vy } = centredRotatedOrigin(page, text, angle);
              drawAtVisual(page, text, vx, vy, { visualAngle: angle, color, opacity });
            } else {
              const size = requestedSize || 28;
              const text = await prepareText(input, font, watermark, size, color);
              const { vx, vy } = positionOrigin(page, text, position as StampPosition, 28);
              drawAtVisual(page, text, vx, vy, { color, opacity });
            }
          }
          await addPdfOutput(input, `${baseName}-watermarked.pdf`);
        } else if (request.operation === 'pdf.addPageNumbers') {
          const font = await input.embedFont(StandardFonts.Helvetica);
          const total = input.getPageCount();
          const position = (String(request.options.numberPosition || 'bottom-center') ||
            'bottom-center') as StampPosition;
          const format = String(request.options.numberFormat || '{n}');
          const start = Math.floor(numericOption(request.options.startNumber, 1, 0, 1_000_000));
          const size = numericOption(request.options.fontSize, 10, 6, 48);
          const color = hexToRgb(request.options.textColor);
          const selected = new Set(parsePageSelection(request.options.pages, total));
          const numbered = [...selected].sort((a, b) => a - b);
          for (const [index, page] of input.getPages().entries()) {
            if (!selected.has(index)) continue;
            const number = start + numbered.indexOf(index);
            const label = format
              .replaceAll('{n}', String(number))
              .replaceAll('{total}', String(start + numbered.length - 1));
            const text = await prepareText(input, font, label, size, color);
            const { vx, vy } = positionOrigin(page, text, position, 24);
            drawAtVisual(page, text, vx, vy, { color });
          }
          await addPdfOutput(input, `${baseName}-numbered.pdf`);
        } else if (request.operation === 'pdf.editMetadata') {
          const title = String(request.options.title || '').trim();
          const author = String(request.options.author || '').trim();
          const subject = String(request.options.subject || '').trim();
          const keywords = String(request.options.keywords || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
          if (title) input.setTitle(title);
          if (author) input.setAuthor(author);
          if (subject) input.setSubject(subject);
          if (keywords.length) input.setKeywords(keywords);
          input.setModificationDate(new Date());
          await addPdfOutput(input, `${baseName}-metadata.pdf`);
        } else if (request.operation === 'pdf.organize') {
          const order = parsePageOrder(request.options.pageOrder, input.getPageCount());
          const result = await PDFDocument.create();
          for (const pageIndex of order) {
            const [page] = await result.copyPages(input, [pageIndex]);
            result.addPage(page);
          }
          await addPdfOutput(result, `${baseName}-organized.pdf`);
        } else if (request.operation === 'pdf.crop') {
          const top = numericOption(request.options.cropTop, 0, 0, 720);
          const right = numericOption(request.options.cropRight, 0, 0, 720);
          const bottom = numericOption(request.options.cropBottom, 0, 0, 720);
          const left = numericOption(request.options.cropLeft, 0, 0, 720);
          if (top + right + bottom + left === 0) {
            throw new Error('Enter at least one crop margin greater than zero.');
          }
          input.getPages().forEach((page) => {
            const box = page.getCropBox();
            const width = box.width - left - right;
            const height = box.height - top - bottom;
            if (width < 36 || height < 36) {
              throw new Error('Crop margins leave less than 0.5 inch of usable page area.');
            }
            page.setCropBox(box.x + left, box.y + bottom, width, height);
          });
          await addPdfOutput(input, `${baseName}-cropped.pdf`);
        } else if (request.operation === 'pdf.resize') {
          const [targetWidth, targetHeight] = targetPageSize(request.options);
          const margin = numericOption(request.options.marginPoints, 18, 0, 144);
          const result = await PDFDocument.create();
          for (const sourcePage of input.getPages()) {
            const outputPage = result.addPage([targetWidth, targetHeight]);
            if (!sourcePage.node.Contents()) continue;
            let embedded;
            try {
              embedded = await result.embedPage(sourcePage);
            } catch (error) {
              if (String(error).includes('missing Contents')) continue;
              throw error;
            }
            const availableWidth = targetWidth - margin * 2;
            const availableHeight = targetHeight - margin * 2;
            const scale = Math.min(
              availableWidth / embedded.width,
              availableHeight / embedded.height,
            );
            const width = embedded.width * scale;
            const height = embedded.height * scale;
            outputPage.drawPage(embedded, {
              x: (targetWidth - width) / 2,
              y: (targetHeight - height) / 2,
              width,
              height,
            });
          }
          await addPdfOutput(result, `${baseName}-resized.pdf`);
        } else if (request.operation === 'pdf.nUp') {
          const pagesPerSheet = Number(request.options.pagesPerSheet) === 4 ? 4 : 2;
          // 2-up follows print conventions: portrait pages sit side by side on a
          // landscape sheet (and landscape pages stack on a portrait sheet), so
          // each page keeps about 70% of its size instead of shrinking to half.
          const firstPage = input.getPage(0);
          const sourceIsPortrait = visualFrame(firstPage).height >= visualFrame(firstPage).width;
          const [sheetA, sheetB] = targetPageSize({ ...request.options, orientation: 'portrait' });
          const [targetWidth, targetHeight] =
            pagesPerSheet === 2
              ? sourceIsPortrait
                ? [sheetB, sheetA]
                : [sheetA, sheetB]
              : targetPageSize(request.options);
          const gutter = numericOption(request.options.gutterPoints, 12, 0, 72);
          const landscapeSheet = targetWidth > targetHeight;
          const columns = pagesPerSheet === 4 ? 2 : landscapeSheet ? 2 : 1;
          const rows = pagesPerSheet === 4 ? 2 : landscapeSheet ? 1 : 2;
          const cellWidth = (targetWidth - gutter * (columns + 1)) / columns;
          const cellHeight = (targetHeight - gutter * (rows + 1)) / rows;
          const result = await PDFDocument.create();
          const pages = input.getPages();
          for (let start = 0; start < pages.length; start += pagesPerSheet) {
            const sheet = result.addPage([targetWidth, targetHeight]);
            for (
              let offset = 0;
              offset < pagesPerSheet && start + offset < pages.length;
              offset += 1
            ) {
              if (!pages[start + offset].node.Contents()) continue;
              let embedded;
              try {
                embedded = await result.embedPage(pages[start + offset]);
              } catch (error) {
                if (String(error).includes('missing Contents')) continue;
                throw error;
              }
              const scale = Math.min(cellWidth / embedded.width, cellHeight / embedded.height);
              const width = embedded.width * scale;
              const height = embedded.height * scale;
              const column = offset % columns;
              const row = Math.floor(offset / columns);
              const cellX = gutter + column * (cellWidth + gutter);
              const cellY = targetHeight - gutter - (row + 1) * cellHeight - row * gutter;
              sheet.drawPage(embedded, {
                x: cellX + (cellWidth - width) / 2,
                y: cellY + (cellHeight - height) / 2,
                width,
                height,
              });
            }
          }
          await addPdfOutput(result, `${baseName}-${pagesPerSheet}-up.pdf`);
        } else if (request.operation === 'pdf.headerFooter') {
          const headerTemplate = String(request.options.headerText || '')
            .trim()
            .slice(0, 120);
          const footerTemplate = String(request.options.footerText || '')
            .trim()
            .slice(0, 120);
          if (!headerTemplate && !footerTemplate) {
            throw new Error('Enter header text, footer text, or both.');
          }
          const font = await input.embedFont(StandardFonts.Helvetica);
          const total = input.getPageCount();
          const size = numericOption(request.options.fontSize, 9, 6, 36);
          const color = hexToRgb(request.options.textColor);
          const align = String(request.options.textAlign || 'center');
          const render = (template: string, page: number) =>
            template.replaceAll('{page}', String(page)).replaceAll('{pages}', String(total));
          for (const [index, page] of input.getPages().entries()) {
            for (const [template, edge] of [
              [headerTemplate, 'top'],
              [footerTemplate, 'bottom'],
            ] as const) {
              if (!template) continue;
              const text = await prepareText(input, font, render(template, index + 1), size, color);
              const { vx, vy } = positionOrigin(
                page,
                text,
                `${edge}-${align}` as StampPosition,
                20,
              );
              drawAtVisual(page, text, vx, vy, { color });
            }
          }
          await addPdfOutput(input, `${baseName}-header-footer.pdf`);
        } else if (request.operation === 'pdf.batesNumbering') {
          const prefix = String(request.options.batesPrefix || '')
            .trim()
            .slice(0, 24);
          const suffix = String(request.options.batesSuffix || '')
            .trim()
            .slice(0, 24);
          const start = Math.floor(numericOption(request.options.batesStart, 1, 0, 999_999_999));
          const padding = Math.floor(numericOption(request.options.batesPadding, 6, 1, 12));
          const position = String(request.options.batesPosition || 'bottom-right') as StampPosition;
          const font = await input.embedFont(StandardFonts.HelveticaBold);
          const color = { r: 0.15, g: 0.15, b: 0.15 };
          for (const [index, page] of input.getPages().entries()) {
            const label = `${prefix}${String(start + index).padStart(padding, '0')}${suffix}`;
            const text = await prepareText(input, font, label, 9, color);
            const { vx, vy } = positionOrigin(page, text, position, 20);
            drawAtVisual(page, text, vx, vy, { color });
          }
          await addPdfOutput(input, `${baseName}-bates.pdf`);
        } else if (request.operation === 'pdf.flattenForms') {
          input.getForm().flatten();
          await addPdfOutput(input, `${baseName}-flattened.pdf`);
        } else if (request.operation === 'pdf.splitByBookmarks') {
          const bytes = await source.arrayBuffer();
          const document = await openWithPdfJs(bytes);
          let starts: Array<{ title: string; page: number }> = [];
          try {
            const outline = (await document.getOutline()) || [];
            for (const item of outline) {
              const dest =
                typeof item.dest === 'string'
                  ? await document.getDestination(item.dest)
                  : item.dest;
              if (!Array.isArray(dest) || !dest[0]) continue;
              const page = await document.getPageIndex(dest[0]);
              starts.push({ title: item.title || `Section ${starts.length + 1}`, page });
            }
          } finally {
            await document.destroy();
          }
          starts = starts
            .sort((a, b) => a.page - b.page)
            .filter((entry, index, all) => index === 0 || entry.page !== all[index - 1]!.page);
          if (!starts.length) {
            throw new Error('This PDF has no bookmarks. Use Split PDF with page ranges instead.');
          }
          if (starts[0]!.page > 0) starts.unshift({ title: 'Front matter', page: 0 });
          for (const [index, entry] of starts.entries()) {
            const end = starts[index + 1]?.page ?? input.getPageCount();
            const part = await PDFDocument.create();
            const indices = Array.from(
              { length: end - entry.page },
              (_, offset) => entry.page + offset,
            );
            (await part.copyPages(input, indices)).forEach((page) => part.addPage(page));
            const safeTitle =
              entry.title
                .replace(/[^\p{L}\p{N} _-]+/gu, '')
                .trim()
                .slice(0, 60) || `part-${index + 1}`;
            await addPdfOutput(part, `${String(index + 1).padStart(2, '0')}-${safeTitle}.pdf`);
          }
        } else if (request.operation === 'pdf.splitHalf') {
          const direction = String(request.options.splitDirection || 'vertical');
          const result = await PDFDocument.create();
          for (const sourcePage of input.getPages()) {
            const box = sourcePage.getCropBox();
            const rotation = visualFrame(sourcePage).rotation;
            // A displayed left/right split is a top/bottom split of rotated content.
            const cutVertically =
              (direction === 'vertical') !== (rotation === 90 || rotation === 270);
            const halves = cutVertically
              ? [
                  {
                    left: box.x,
                    bottom: box.y,
                    right: box.x + box.width / 2,
                    top: box.y + box.height,
                  },
                  {
                    left: box.x + box.width / 2,
                    bottom: box.y,
                    right: box.x + box.width,
                    top: box.y + box.height,
                  },
                ]
              : [
                  {
                    left: box.x,
                    bottom: box.y + box.height / 2,
                    right: box.x + box.width,
                    top: box.y + box.height,
                  },
                  {
                    left: box.x,
                    bottom: box.y,
                    right: box.x + box.width,
                    top: box.y + box.height / 2,
                  },
                ];
            // Reading order on the displayed page: rotated pages reverse it.
            if (rotation === 180 || rotation === 270) halves.reverse();
            for (const half of halves) {
              if (!sourcePage.node.Contents()) {
                result.addPage([half.right - half.left, half.top - half.bottom]);
                continue;
              }
              const embedded = await result.embedPage(sourcePage, half);
              const page = result.addPage([embedded.width, embedded.height]);
              page.drawPage(embedded, { x: 0, y: 0 });
              page.setRotation(degrees(rotation));
            }
          }
          await addPdfOutput(result, `${baseName}-split-in-half.pdf`);
        } else if (request.operation === 'pdf.splitBySize') {
          const limitBytes = numericOption(request.options.maxSizeMb, 10, 0.5, 500) * 1024 * 1024;
          const build = async (indices: number[]) => {
            const part = await PDFDocument.create();
            (await part.copyPages(input, indices)).forEach((page) => part.addPage(page));
            return part;
          };
          // Grow each part page by page; when a page pushes it over the limit,
          // the part is rebuilt without that page (removing a page would leave
          // its copied objects in the file) and the page starts the next part.
          let current: number[] = [];
          let partNumber = 1;
          for (const index of input.getPageIndices()) {
            const candidate = [...current, index];
            const size = (await (await build(candidate)).save()).byteLength;
            if (size > limitBytes && current.length) {
              await addPdfOutput(await build(current), `${baseName}-part-${partNumber}.pdf`);
              partNumber += 1;
              current = [index];
            } else {
              current = candidate;
            }
          }
          if (current.length) {
            await addPdfOutput(await build(current), `${baseName}-part-${partNumber}.pdf`);
          }
        } else if (request.operation === 'pdf.splitByText') {
          const query = String(request.options.splitText || '').trim();
          if (!query) throw new Error('Enter the text that marks the start of each new PDF.');
          const caseSensitive = request.options.caseSensitive === 'yes';
          const texts = await extractPageTexts(await source.arrayBuffer());
          const needle = caseSensitive ? query : query.toLowerCase();
          const starts = texts
            .map((text, index) =>
              (caseSensitive ? text : text.toLowerCase()).includes(needle) ? index : -1,
            )
            .filter((index) => index >= 0);
          if (!starts.length) throw new Error(`"${query}" was not found on any page.`);
          if (starts[0] !== 0) starts.unshift(0);
          for (const [index, start] of starts.entries()) {
            const end = starts[index + 1] ?? input.getPageCount();
            const part = await PDFDocument.create();
            const indices = Array.from({ length: end - start }, (_, offset) => start + offset);
            (await part.copyPages(input, indices)).forEach((page) => part.addPage(page));
            await addPdfOutput(part, `${baseName}-part-${index + 1}.pdf`);
          }
        } else if (request.operation === 'pdf.removeAnnotations') {
          const { PDFName, PDFArray, PDFDict } = await import('pdf-lib');
          const keepLinks = request.options.keepLinks !== 'no';
          let removed = 0;
          for (const page of input.getPages()) {
            const annots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
            if (!annots) continue;
            const kept = PDFArray.withContext(input.context);
            for (let index = 0; index < annots.size(); index += 1) {
              const annotation = annots.lookupMaybe(index, PDFDict);
              const subtype = annotation?.get(PDFName.of('Subtype'))?.toString();
              // Form widgets are fields, not annotations; links are kept on request.
              if (subtype === '/Widget' || (keepLinks && subtype === '/Link')) {
                kept.push(annots.get(index));
              } else {
                removed += 1;
              }
            }
            if (kept.size()) page.node.set(PDFName.of('Annots'), kept);
            else page.node.delete(PDFName.of('Annots'));
          }
          if (!removed) throw new Error('This PDF has no annotations to remove.');
          await addPdfOutput(input, `${baseName}-no-annotations.pdf`);
        } else if (request.operation === 'pdf.flip') {
          const direction = String(request.options.flipDirection || 'horizontal');
          const selected = new Set(parsePageSelection(request.options.pages, input.getPageCount()));
          const result = await PDFDocument.create();
          for (const [index, sourcePage] of input.getPages().entries()) {
            if (!selected.has(index) || !sourcePage.node.Contents()) {
              const [copy] = await result.copyPages(input, [index]);
              result.addPage(copy);
              continue;
            }
            const rotation = visualFrame(sourcePage).rotation;
            const embedded = await result.embedPage(sourcePage);
            const page = result.addPage([embedded.width, embedded.height]);
            // Mirror what the reader sees: for 90°/270° pages the displayed
            // horizontal axis is the content's vertical axis.
            const mirrorX = (direction === 'horizontal') !== (rotation === 90 || rotation === 270);
            page.drawPage(embedded, {
              x: mirrorX ? embedded.width : 0,
              y: mirrorX ? 0 : embedded.height,
              xScale: mirrorX ? -1 : 1,
              yScale: mirrorX ? 1 : -1,
            });
            page.setRotation(degrees(rotation));
          }
          await addPdfOutput(result, `${baseName}-flipped.pdf`);
        } else if (request.operation === 'pdf.addBookmarks') {
          const entries = String(request.options.bookmarks || '')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => {
              const match = line.match(/^(.*?)[\s,;|:-]+(\d+)$/);
              if (!match || !match[1]!.trim()) {
                throw new Error(`Write each bookmark as "Title, page" — could not read "${line}".`);
              }
              const page = Number(match[2]);
              if (page < 1 || page > input.getPageCount()) {
                throw new Error(
                  `"${match[1]!.trim()}" points to page ${page}, but the PDF has ${input.getPageCount()} pages.`,
                );
              }
              return { title: match[1]!.trim().slice(0, 200), page: page - 1 };
            });
          if (!entries.length)
            throw new Error('Add at least one bookmark, one per line: "Title, page".');
          const { PDFName, PDFNumber, PDFHexString, PDFNull } = await import('pdf-lib');
          const context = input.context;
          const outlinesRef = context.nextRef();
          const itemRefs = entries.map(() => context.nextRef());
          entries.forEach((entry, index) => {
            const item = context.obj({});
            item.set(PDFName.of('Title'), PDFHexString.fromText(entry.title));
            item.set(PDFName.of('Parent'), outlinesRef);
            if (index > 0) item.set(PDFName.of('Prev'), itemRefs[index - 1]!);
            if (index < entries.length - 1) item.set(PDFName.of('Next'), itemRefs[index + 1]!);
            const pageRef = input.getPage(entry.page).ref;
            item.set(
              PDFName.of('Dest'),
              context.obj([pageRef, PDFName.of('XYZ'), PDFNull, PDFNull, PDFNull]),
            );
            context.assign(itemRefs[index]!, item);
          });
          const outlines = context.obj({});
          outlines.set(PDFName.of('Type'), PDFName.of('Outlines'));
          outlines.set(PDFName.of('First'), itemRefs[0]!);
          outlines.set(PDFName.of('Last'), itemRefs[itemRefs.length - 1]!);
          outlines.set(PDFName.of('Count'), PDFNumber.of(entries.length));
          context.assign(outlinesRef, outlines);
          input.catalog.set(PDFName.of('Outlines'), outlinesRef);
          input.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'));
          await addPdfOutput(input, `${baseName}-bookmarked.pdf`);
        } else if (request.operation === 'pdf.toText') {
          const texts = await extractPageTexts(await source.arrayBuffer());
          if (!texts.some((text) => text.trim())) {
            throw new Error('This PDF has no selectable text. Use OCR PDF for scanned documents.');
          }
          const body = texts
            .map((text, index) => `--- Page ${index + 1} ---\n${text}`)
            .join('\n\n');
          const blob = new Blob([body], { type: 'text/plain;charset=utf-8' });
          const name = `${baseName}.txt`;
          outputBlobs.push({ blob, name, mimeType: 'text/plain' });
          outputDescriptors.push({
            name,
            extension: 'txt',
            mimeType: 'text/plain',
            sizeBytes: blob.size,
          });
        } else {
          throw new Error(`Unsupported browser operation: ${request.operation}`);
        }
      }
      return {
        success: true,
        engine: this.id,
        processingLocation: 'BROWSER',
        durationMs: performance.now() - startedAt,
        output: outputDescriptors,
        blobs: outputBlobs,
      };
    } catch (error) {
      return {
        success: false,
        engine: this.id,
        processingLocation: 'BROWSER',
        durationMs: performance.now() - startedAt,
        error: {
          code: ErrorCode.CONVERSION_ENGINE_FAILURE,
          message: error instanceof Error ? error.message : 'Browser processing failed.',
        },
      };
    }
  }
}

const browserContext: ProcessingContext = {
  deploymentMode: 'HOSTINGER',
  browserEnabled: true,
  nodeEnabled: false,
  nativeEnabled: false,
};

const browserRouter = new ProcessingRouter([new BrowserProcessingEngine()]);

export async function processInBrowser(
  operation: string,
  files: File[],
  options: Record<string, unknown>,
): Promise<BrowserProcessingOutput> {
  const estimatedBytes = estimateLocalProcessingBytes(operation, files);
  const memoryBudget = localProcessingMemoryBudgetBytes();
  if (estimatedBytes > memoryBudget) {
    return {
      success: false,
      engine: 'browser-memory-guard',
      processingLocation: 'BROWSER',
      durationMs: 0,
      error: {
        code: ErrorCode.FILE_TOO_LARGE_FOR_LOCAL_PROCESSING,
        message: `These files need about ${Math.ceil(estimatedBytes / MEBIBYTE)}MB of browser memory. Use a smaller batch (safe budget: ${Math.floor(memoryBudget / MEBIBYTE)}MB).`,
      },
    };
  }
  return browserRouter.process(
    {
      operation,
      files: files.map((file) => ({
        name: file.name,
        sizeBytes: file.size,
        mimeType: file.type,
        extension: fileExtension(file.name),
      })),
      options,
      requestedLocation: 'BROWSER',
      browserFiles: files,
    } as BrowserProcessingRequest,
    browserContext,
  ) as Promise<BrowserProcessingOutput>;
}
