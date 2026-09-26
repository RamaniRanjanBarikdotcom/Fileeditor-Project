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
      const { PDFDocument, StandardFonts, degrees, rgb } = await import('pdf-lib');
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
      } else if (request.operation === 'image.toPdf') {
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
                : null;
          if (!image) throw new Error(`${source.name} is not a supported PNG or JPEG image.`);

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
          const input = await PDFDocument.load(await source.arrayBuffer());
          const pages = await merged.copyPages(input, input.getPageIndices());
          pages.forEach((page) => merged.addPage(page));
        }
        await addPdfOutput(merged, 'merged.pdf');
      } else if (request.operation === 'pdf.alternateMix') {
        if (browserRequest.browserFiles.length < 2) {
          throw new Error('Choose at least two PDF files to alternate.');
        }
        const documents = await Promise.all(
          browserRequest.browserFiles.map(async (source) =>
            PDFDocument.load(await source.arrayBuffer()),
          ),
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
        const input = await PDFDocument.load(await source.arrayBuffer());
        const baseName = source.name.replace(/\.[^.]+$/, '') || 'document';

        if (request.operation === 'pdf.split') {
          for (const [index] of input.getPages().entries()) {
            const part = await PDFDocument.create();
            const [page] = await part.copyPages(input, [index]);
            part.addPage(page);
            await addPdfOutput(part, `${baseName}-page-${index + 1}.pdf`);
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
          input.getPages().forEach((page) => {
            const current = page.getRotation().angle;
            page.setRotation(degrees((current + amount) % 360));
          });
          await addPdfOutput(input, `${baseName}-rotated.pdf`);
        } else if (request.operation === 'pdf.watermark') {
          const watermark = String(request.options.watermarkText || '').trim();
          if (!watermark) throw new Error('Enter watermark text.');
          const font = await input.embedFont(StandardFonts.HelveticaBold);
          input.getPages().forEach((page) => {
            const { width, height } = page.getSize();
            const size = Math.max(18, Math.min(72, width / Math.max(8, watermark.length * 0.7)));
            const textWidth = font.widthOfTextAtSize(watermark, size);
            page.drawText(watermark, {
              x: (width - textWidth * 0.7) / 2,
              y: height / 2,
              size,
              font,
              color: rgb(0.45, 0.45, 0.45),
              opacity: 0.3,
              rotate: degrees(35),
            });
          });
          await addPdfOutput(input, `${baseName}-watermarked.pdf`);
        } else if (request.operation === 'pdf.addPageNumbers') {
          const font = await input.embedFont(StandardFonts.Helvetica);
          input.getPages().forEach((page, index) => {
            const label = `${index + 1} / ${input.getPageCount()}`;
            const size = 10;
            const width = font.widthOfTextAtSize(label, size);
            page.drawText(label, {
              x: (page.getWidth() - width) / 2,
              y: 18,
              size,
              font,
              color: rgb(0.2, 0.2, 0.2),
            });
          });
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
          const [targetWidth, targetHeight] = targetPageSize(request.options);
          const gutter = numericOption(request.options.gutterPoints, 12, 0, 72);
          const columns = 2;
          const rows = pagesPerSheet === 4 ? 2 : 1;
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
          const render = (template: string, page: number) =>
            template.replaceAll('{page}', String(page)).replaceAll('{pages}', String(total));
          input.getPages().forEach((page, index) => {
            const size = 9;
            const drawCentered = (label: string, y: number) => {
              const textWidth = font.widthOfTextAtSize(label, size);
              page.drawText(label, {
                x: Math.max(18, (page.getWidth() - textWidth) / 2),
                y,
                size,
                font,
                color: rgb(0.2, 0.2, 0.2),
              });
            };
            if (headerTemplate)
              drawCentered(render(headerTemplate, index + 1), page.getHeight() - 22);
            if (footerTemplate) drawCentered(render(footerTemplate, index + 1), 14);
          });
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
          const font = await input.embedFont(StandardFonts.HelveticaBold);
          input.getPages().forEach((page, index) => {
            const label = `${prefix}${String(start + index).padStart(padding, '0')}${suffix}`;
            const size = 9;
            const width = font.widthOfTextAtSize(label, size);
            page.drawText(label, {
              x: Math.max(18, page.getWidth() - width - 24),
              y: 14,
              size,
              font,
              color: rgb(0.15, 0.15, 0.15),
            });
          });
          await addPdfOutput(input, `${baseName}-bates.pdf`);
        } else if (request.operation === 'pdf.flattenForms') {
          input.getForm().flatten();
          await addPdfOutput(input, `${baseName}-flattened.pdf`);
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
