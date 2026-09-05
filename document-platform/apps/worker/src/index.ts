import { Worker, Job } from 'bullmq';
import { PrismaClient, JobStatus, FileStatus } from '@prisma/client';
import { StorageClient, createStorageConfig } from '@docconv/storage';
import { workerLogger as logger } from '@docconv/logging';
import { GotenbergAdapter } from './adapters/gotenberg';
import { PandocAdapter } from './adapters/pandoc';
import { SheetJSAdapter } from './adapters/sheetjs';
import { ImagePdfAdapter } from './adapters/image-pdf';
import { PdfExtractorAdapter } from './adapters/pdf-extractor';
import { WebContentAdapter } from './adapters/web-content';
import { styleMarkdownHtml } from './markdown-document';
import {
  MIME_TYPES,
  ConversionEngine,
  InputFormat,
  OutputFormat,
  ErrorCode,
  normalizeConversionOptions,
} from '@docconv/shared-types';
import { streamToValidatedBuffer } from './output-validator';
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
const webContent = new WebContentAdapter();
const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

logger.info('Starting conversion worker...');

import { QUEUE_NAMES } from '@docconv/shared-types';

const processJob = async (job: Job) => {
  const { conversionId: jobId } = job.data;
  logger.info({ jobId }, 'Processing job');

  // 1. Fetch Job from DB
  const conversionJob = await prisma.conversionJob.findUnique({
    where: { id: jobId },
    include: { sourceFile: true },
  });

  if (!conversionJob || !conversionJob.sourceFile) {
    throw new Error(`Job ${jobId} or associated file not found in DB`);
  }

  if (conversionJob.status === JobStatus.CANCELLED) {
    logger.info({ jobId }, 'Skipping cancelled job');
    return { success: false, cancelled: true };
  }

  // 2. Update status to PROCESSING
  await prisma.conversionJob.update({
    where: { id: jobId },
    data: {
      status: JobStatus.PROCESSING,
      startedAt: new Date(),
      progress: 10,
      attemptCount: { increment: 1 },
    },
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
    const options = normalizeConversionOptions(conversionJob.settingsJson);

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
        if (tFmt === 'pdf') {
          outputStream = await gotenberg.convertUrlToPdf(rawUrl, options);
        } else {
          // Preserve semantic HTML structure for editable webpage exports.
          outputStream = await webContent.convert(rawUrl, tFmt);
        }
      } else if (sFmt === 'markdown' || sFmt === 'txt') {
        // Pandoc: Markdown/Text -> HTML -> Chromium (much better PDF quality)
        const pandocFmt = sFmt === 'markdown' ? 'markdown' : 'plain';
        const htmlStream = await pandoc.convert(fileStream, pandocFmt, 'html');
        const html = await text(htmlStream);
        outputStream = await gotenberg.convertHtmlToPdf(
          Readable.from(Buffer.from(styleMarkdownHtml(html), 'utf8')),
          'index.html',
          options,
        );
      } else {
        // HTML, HTM -> Chromium PDF
        outputStream = await gotenberg.convertHtmlToPdf(
          fileStream,
          conversionJob.sourceFile.originalFilename,
          options,
        );
      }
    } else if (engine === ConversionEngine.LIBREOFFICE) {
      outputStream = await gotenberg.convertOfficeToPdf(
        fileStream,
        conversionJob.sourceFile.originalFilename,
      );
    } else if (
      engine === ConversionEngine.PANDOC ||
      engine === ConversionEngine.DOCX_GENERATOR ||
      engine === ConversionEngine.MAMMOTH
    ) {
      // Map format aliases for pandoc (md → markdown, txt → plain, etc.)
      const pandocSrcFmt =
        sFmt === 'markdown'
          ? 'markdown'
          : sFmt === 'txt'
            ? 'plain'
            : sFmt === 'html'
              ? 'html'
              : sFmt === 'docx'
                ? 'docx'
                : sFmt;
      const pandocTgtFmt =
        tFmt === 'markdown'
          ? 'markdown'
          : tFmt === 'txt'
            ? 'plain'
            : tFmt === 'html'
              ? 'html'
              : tFmt === 'docx'
                ? 'docx'
                : tFmt;
      outputStream = await pandoc.convert(fileStream, pandocSrcFmt, pandocTgtFmt);
    } else if (engine === ConversionEngine.SHEETJS) {
      outputStream = await sheetjs.convert(fileStream, sFmt, tFmt);
    } else if (engine === ConversionEngine.PDF_LIB && tFmt === 'pdf') {
      outputStream = await imagePdf.convert(fileStream, sFmt, options);
    } else if (engine === ConversionEngine.PDF_EXTRACTOR) {
      outputStream = await pdfExtractor.convert(fileStream, tFmt);
    } else {
      throw new Error(`Unsupported engine: ${engine} for ${sFmt} -> ${tFmt}`);
    }

    const latest = await prisma.conversionJob.findUnique({ where: { id: jobId }, select: { status: true } });
    if (latest?.status === JobStatus.CANCELLED) {
      logger.info({ jobId }, 'Discarding output for cancelled job');
      return { success: false, cancelled: true };
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
    const outputFilename =
      conversionJob.sourceFile.originalFilename.replace(/\.[^/.]+$/, '') + '.' + outputExtension;
    const mimeType = MIME_TYPES[targetFmt] || 'application/octet-stream';
    const outputKey = storage.generateStorageKey(
      conversionJob.organizationId,
      conversionJob.userId,
      'outputs',
      outputExtension,
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
          expiresAt: new Date(
            Date.now() + Math.min(600, Math.max(60, Number(process.env.TEMP_FILE_MAX_TTL_SECONDS || 600))) * 1000,
          ),
        },
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
        progress: 100,
      },
    });

    logger.info({ jobId }, 'Job completed successfully');
    return { success: true, outputKey };
  } catch (error: any) {
    logger.error({ jobId, err: error }, 'Job failed');

    const current = await prisma.conversionJob.findUnique({ where: { id: jobId }, select: { status: true } });
    if (current?.status === JobStatus.CANCELLED) return { success: false, cancelled: true };
    const errorCode = classifyError(error);
    await prisma.conversionJob.update({
      where: { id: jobId },
      data: {
        status: JobStatus.FAILED,
        completedAt: new Date(),
        errorCode,
        errorMessage: safeErrorMessage(errorCode, error),
      },
    });

    throw error;
  }
};

function classifyError(error: unknown): ErrorCode {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('timeout') || message.includes('timed out')) return ErrorCode.CONVERSION_TIMEOUT;
  if (message.includes('password') || message.includes('encrypted')) return ErrorCode.PASSWORD_PROTECTED_FILE;
  if (message.includes('valid pdf') || message.includes('cannot be parsed') || message.includes('valid docx') || message.includes('valid xlsx')) return ErrorCode.OUTPUT_VALIDATION_FAILED;
  if (message.includes('connect') || message.includes('econnrefused') || message.includes('not found')) return ErrorCode.ENGINE_UNAVAILABLE;
  if (message.includes('unsupported')) return ErrorCode.UNSUPPORTED_CONVERSION;
  return ErrorCode.CONVERSION_ENGINE_FAILURE;
}

function safeErrorMessage(code: ErrorCode, error: unknown): string {
  const messages: Record<string, string> = {
    [ErrorCode.CONVERSION_TIMEOUT]: 'The conversion took too long. Try a smaller file or simpler page.',
    [ErrorCode.PASSWORD_PROTECTED_FILE]: 'Password-protected PDFs are not supported by this tool.',
    [ErrorCode.OUTPUT_VALIDATION_FAILED]: 'The converter created an unusable file, so it was rejected.',
    [ErrorCode.ENGINE_UNAVAILABLE]: 'The required conversion engine is currently unavailable.',
    [ErrorCode.UNSUPPORTED_CONVERSION]: 'This input and output combination is not supported.',
    [ErrorCode.CONVERSION_ENGINE_FAILURE]: 'The conversion engine could not process this file.',
  };
  logger.debug({ code, originalError: error instanceof Error ? error.message : String(error) }, 'Mapped worker error');
  return messages[code] || 'The conversion could not be completed.';
}

const workers = Object.values(QUEUE_NAMES).map((queueName) => {
  const worker = new Worker(queueName, processJob, { connection: redis });
  worker.on('failed', (job, err) => {
    logger.error({ queueName, jobId: job?.id, err }, 'Worker reported job failure');
  });
  return worker;
});

process.on('SIGINT', async () => {
  logger.info('Shutting down workers...');
  await Promise.all(workers.map((w) => w.close()));
  await prisma.$disconnect();
  process.exit(0);
});
