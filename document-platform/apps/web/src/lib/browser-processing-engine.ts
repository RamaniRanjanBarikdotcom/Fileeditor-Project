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

interface BrowserProcessingRequest extends ProcessingRequest {
  browserFiles: File[];
}

export interface BrowserProcessingOutput extends ProcessingResult {
  blobs?: Array<{ blob: Blob; name: string; mimeType: string }>;
}

const MEBIBYTE = 1024 * 1024;

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
  const multiplier = operation === 'image.toPdf' ? 8 : operation === 'pdf.split' ? 6 : 5;
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

      if (request.operation === 'image.toPdf') {
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
