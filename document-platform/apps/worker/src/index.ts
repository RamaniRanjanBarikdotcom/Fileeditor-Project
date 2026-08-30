import { Worker, Job } from 'bullmq';
import { PrismaClient, JobStatus, FileStatus } from '@prisma/client';
import { StorageClient, createStorageConfig } from '@docconv/storage';
import { workerLogger as logger } from '@docconv/logging';
import { GotenbergAdapter } from './adapters/gotenberg';
import { PandocAdapter } from './adapters/pandoc';
import { SheetJSAdapter } from './adapters/sheetjs';
import { ImagePdfAdapter } from './adapters/image-pdf';
import { PdfExtractorAdapter } from './adapters/pdf-extractor';
import { MIME_TYPES, ConversionEngine, InputFormat, OutputFormat } from '@docconv/shared-types';
import IORedis from 'ioredis';
import { Readable } from 'stream';
import { text } from 'stream/consumers';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';

// Turborepo runs this package with apps/worker as cwd. Resolve from __dirname
// so both src (ts-node) and dist builds find the repository-level .env.
loadEnv({ path: resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();
const storage = new StorageClient(
  createStorageConfig(process.env as Record<string, string | undefined>),
);

const gotenberg = new GotenbergAdapter(process.env.GOTENBERG_URL || 'http://localhost:3000');
const pandoc = new PandocAdapter();
const sheetjs = new SheetJSAdapter();
const imagePdf = new ImagePdfAdapter();
const pdfExtractor = new PdfExtractorAdapter();
const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null
});

async function streamToValidatedBuffer(
  stream: Readable,
  targetFormat: string,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  const maxBytes = Number(process.env.MAX_OUTPUT_SIZE_BYTES || 100 * 1024 * 1024);

  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) throw new Error('Generated output exceeds the configured size limit');
    chunks.push(buffer);
  }

  const output = Buffer.concat(chunks);
  if (output.length === 0) throw new Error('Conversion produced an empty output');

  const format = targetFormat.toLowerCase();
  if (format === 'pdf') {
    const header = output.subarray(0, 4).toString('ascii');
    if (header !== '%PDF') {
      // Check if Gotenberg returned an error response body instead
      const preview = output.subarray(0, 1000).toString('utf-8');
      throw new Error(
        `Generated output is not a valid PDF. Gotenberg error: ${preview}`
      );
    }
  }
  if ((format === 'docx' || format === 'xlsx') && output.subarray(0, 2).toString('ascii') !== 'PK') {
    throw new Error(`Generated output is not a valid ${format.toUpperCase()} package`);
  }

  return output;
}

logger.info('Starting conversion worker...');

import { QUEUE_NAMES } from '@docconv/shared-types';

const processJob = async (job: Job) => {
  const { conversionId: jobId } = job.data;
  logger.info({ jobId }, 'Processing job');
  
  // 1. Fetch Job from DB
  const conversionJob = await prisma.conversionJob.findUnique({
    where: { id: jobId },
    include: { sourceFile: true }
  });

  if (!conversionJob || !conversionJob.sourceFile) {
    throw new Error(`Job ${jobId} or associated file not found in DB`);
  }

  // 2. Update status to PROCESSING
  await prisma.conversionJob.update({
    where: { id: jobId },
    data: {
      status: JobStatus.PROCESSING,
      startedAt: new Date(),
      progress: 10,
      attemptCount: { increment: 1 },
    }
  });

  try {
    // 3. Download the original file stream
    const fileStream = await storage.download('inputs', conversionJob.sourceFile.storageKey);

    await prisma.conversionJob.update({
      where: { id: jobId },
      data: { progress: 30 },
    });

    // 4. Determine engine and run conversion
    let outputStream: Readable;
    const engine = conversionJob.engine as ConversionEngine;
    const sourceFmt = conversionJob.sourceFormat as InputFormat;
    const targetFmt = conversionJob.targetFormat as OutputFormat;
    
    logger.info({ jobId, engine, sourceFmt, targetFmt }, 'Routing conversion');

    // Normalize format aliases (md -> markdown, htm -> html, etc.)
    const normalizeFormat = (fmt: string): string => {
      const f = fmt.toLowerCase();
      if (f === 'md') return 'markdown';
      if (f === 'htm') return 'html';
      if (f === 'text') return 'txt';
      return f;
    };
    const sFmt = normalizeFormat(sourceFmt.toLowerCase());
    const tFmt = normalizeFormat(targetFmt.toLowerCase());

    if (engine === ConversionEngine.CHROMIUM) {
      if (sFmt === 'url') {
        // Read URL string from storage
        const rawUrl = (await text(fileStream)).trim();
        // Validate URL before passing to Gotenberg
        if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
          throw new Error(`Invalid URL for Chromium conversion: ${rawUrl}`);
        }
        logger.info({ jobId, url: rawUrl }, 'Rendering URL with Chromium');
        const renderedPdf = await gotenberg.convertUrlToPdf(rawUrl);
        if (tFmt === 'pdf') {
          outputStream = renderedPdf;
        } else {
          // For URL→DOCX/HTML/MD/TXT: render to PDF first, then extract
          outputStream = await pdfExtractor.convert(renderedPdf, tFmt);
        }
      } else if (sFmt === 'markdown' || sFmt === 'txt') {
        // Pandoc: Markdown/Text -> HTML -> Chromium (much better PDF quality)
        const pandocFmt = sFmt === 'markdown' ? 'markdown' : 'plain';
        const htmlStream = await pandoc.convert(fileStream, pandocFmt, 'html');
        outputStream = await gotenberg.convertHtmlToPdf(htmlStream, 'index.html');
      } else {
        // HTML, HTM -> Chromium PDF
        outputStream = await gotenberg.convertHtmlToPdf(fileStream, conversionJob.sourceFile.originalFilename);
      }
    } else if (engine === ConversionEngine.LIBREOFFICE) {
      outputStream = await gotenberg.convertOfficeToPdf(fileStream, conversionJob.sourceFile.originalFilename);
    } else if (
      engine === ConversionEngine.PANDOC ||
      engine === ConversionEngine.DOCX_GENERATOR ||
      engine === ConversionEngine.MAMMOTH
    ) {
      // Map format aliases for pandoc (md → markdown, txt → plain, etc.)
      const pandocSrcFmt = sFmt === 'markdown' ? 'markdown' :
                           sFmt === 'txt' ? 'plain' :
                           sFmt === 'html' ? 'html' :
                           sFmt === 'docx' ? 'docx' :
                           sFmt;
      const pandocTgtFmt = tFmt === 'markdown' ? 'markdown' :
                           tFmt === 'txt' ? 'plain' :
                           tFmt === 'html' ? 'html' :
                           tFmt === 'docx' ? 'docx' :
                           tFmt;
      outputStream = await pandoc.convert(fileStream, pandocSrcFmt, pandocTgtFmt);
    } else if (engine === ConversionEngine.SHEETJS) {
      outputStream = await sheetjs.convert(fileStream, sFmt, tFmt);
    } else if (engine === ConversionEngine.PDF_LIB && tFmt === 'pdf') {
      outputStream = await imagePdf.convert(fileStream, sFmt);
    } else if (engine === ConversionEngine.PDF_EXTRACTOR) {
      outputStream = await pdfExtractor.convert(fileStream, tFmt);
    } else {
      throw new Error(`Unsupported engine: ${engine} for ${sFmt} -> ${tFmt}`);
    }

    await prisma.conversionJob.update({
      where: { id: jobId },
      data: { status: JobStatus.OUTPUT_VALIDATION, progress: 70 },
    });

    // Buffer with a hard limit so the output can be validated before it is
    // persisted or marked successful.
    const outputBuffer = await streamToValidatedBuffer(outputStream, targetFmt);

    // 5. Upload the validated output before creating its database record.
    const outputExtension = targetFmt === 'markdown' ? 'md' : targetFmt;
    const outputFilename = conversionJob.sourceFile.originalFilename.replace(/\.[^/.]+$/, "") + '.' + outputExtension;
    const mimeType = MIME_TYPES[targetFmt] || 'application/octet-stream';
    const outputKey = storage.generateStorageKey(
      conversionJob.organizationId,
      conversionJob.userId,
      'outputs',
      outputExtension
    );

    await storage.upload('outputs', outputKey, outputBuffer, mimeType);

    let outputFile;
    try {
      outputFile = await prisma.storedFile.create({
        data: {
          organizationId: conversionJob.organizationId,
          userId: conversionJob.userId,
          originalFilename: outputFilename,
          storageKey: outputKey,
          extension: outputExtension,
          mimeType,
          sizeBytes: outputBuffer.length,
          status: FileStatus.READY,
        }
      });
    } catch (error) {
      await storage.delete('outputs', outputKey).catch(() => undefined);
      throw error;
    }

    // 7. Update DB with completion
    await prisma.conversionJob.update({
      where: { id: jobId },
      data: {
        status: JobStatus.COMPLETED,
        completedAt: new Date(),
        outputFileId: outputFile.id,
        progress: 100
      }
    });

    logger.info({ jobId }, 'Job completed successfully');
    return { success: true, outputKey };
  } catch (error: any) {
    logger.error({ jobId, err: error }, 'Job failed');
    
    await prisma.conversionJob.update({
      where: { id: jobId },
      data: {
        status: JobStatus.FAILED,
        completedAt: new Date(),
        errorMessage: error.message || 'Unknown error'
      }
    });

    throw error;
  }
};

const workers = Object.values(QUEUE_NAMES).map(queueName => {
  const worker = new Worker(queueName, processJob, { connection: redis });
  worker.on('failed', (job, err) => {
    logger.error({ queueName, jobId: job?.id, err }, 'Worker reported job failure');
  });
  return worker;
});

process.on('SIGINT', async () => {
  logger.info('Shutting down workers...');
  await Promise.all(workers.map(w => w.close()));
  await prisma.$disconnect();
  process.exit(0);
});
