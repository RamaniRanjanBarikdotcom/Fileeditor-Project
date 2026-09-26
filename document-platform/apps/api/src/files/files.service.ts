import { Injectable, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { MalwareScanStatus } from '@prisma/client';
import { StorageClient, createStorageConfig } from '@docconv/storage';
import { validateFile, sanitizeFilename, getExtension } from '@docconv/file-validation';
import { MIME_TYPES } from '@docconv/shared-types';
import { UrlInspectorService } from './url-inspector.service';
import { UrlSecurityService } from '@docconv/url-security';
import { ClamAvScanner } from './clamav.scanner';

@Injectable()
export class FilesService implements OnModuleInit {
  private storage: StorageClient;
  private readonly clamScanner = new ClamAvScanner();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly urlInspector: UrlInspectorService,
    private readonly urlSecurity: UrlSecurityService,
  ) {
    this.storage = new StorageClient(createStorageConfig(process.env as Record<string, string>));
  }

  async onModuleInit() {
    // Docker normally creates these through minio-init. Native Node mode has
    // no such container lifecycle, so make startup idempotently self-healing.
    await this.storage.ensureAllBuckets();
  }

  /**
   * Upload a file: validate, store in quarantine, create DB record.
   */
  async uploadFile(
    userId: string,
    orgId: string,
    file: { originalname: string; buffer: Buffer; mimetype: string; size: number },
  ) {
    const maxSize = this.config.get<number>('MAX_UPLOAD_SIZE_BYTES', 250 * 1024 * 1024);

    // Basic validation
    const sanitizedName = sanitizeFilename(file.originalname);
    const validation = validateFile(sanitizedName, file.buffer, maxSize);

    if (!validation.valid) {
      const messages = validation.errors.map((e) => e.message).join('; ');
      throw new BadRequestException(`File validation failed: ${messages}`);
    }

    let ext = getExtension(sanitizedName) ?? 'bin';
    let detectedType = validation.detectedType || ext;
    let mimeType = MIME_TYPES[ext] ?? file.mimetype;
    let finalBuffer = file.buffer;

    // Reject HTML disguises
    if (ext === 'html' || ext === 'htm') {
      const htmlText = finalBuffer.toString('utf-8');
      if (
        htmlText.includes('%PDF') ||
        htmlText.includes('PK\x03\x04') ||
        htmlText.includes('\xd0\xcf\x11\xe0')
      ) {
        throw new BadRequestException('File content does not match HTML extension.');
      }
    }

    if (ext === 'url' || file.mimetype === 'text/uri-list') {
      const rawUrl = file.buffer.toString('utf8').trim();
      try {
        const inspection = await this.urlInspector.inspect(
          rawUrl,
          (candidate) => this.urlSecurity.validateUrl(candidate),
        );
        // Store the final validated redirect target. The object itself remains
        // a URL document, not the remote page's MIME type.
        finalBuffer = Buffer.from(inspection.url, 'utf8');
        mimeType = 'text/uri-list';
        detectedType = 'url';
      } catch (error: any) {
        throw new BadRequestException(error?.message || 'This URL cannot be rendered safely.');
      }
    }
    const storageKey = this.storage.generateStorageKey(orgId, userId, 'quarantine', ext);

    // Upload to quarantine storage
    await this.storage.upload('quarantine', storageKey, finalBuffer, mimeType);

    // Scan buffer with ClamAV
    const scanResult = await this.clamScanner.scanBuffer(finalBuffer);

    if (scanResult.status === 'FAILED' && scanResult.virus) {
      await this.storage.delete('quarantine', storageKey).catch(() => undefined);
      throw new BadRequestException(`Malware detected in uploaded file: ${scanResult.virus}`);
    }

    if (scanResult.status !== 'PASSED' && process.env.NODE_ENV === 'production') {
      await this.storage.delete('quarantine', storageKey).catch(() => undefined);
      throw new BadRequestException('File security scan failed. Upload rejected.');
    }

    let malwareScanStatus: MalwareScanStatus = MalwareScanStatus.SKIPPED;
    if (scanResult.status === 'PASSED') {
      malwareScanStatus = MalwareScanStatus.CLEAN;
    } else if (scanResult.status === 'FAILED') {
      malwareScanStatus = scanResult.virus ? MalwareScanStatus.INFECTED : MalwareScanStatus.ERROR;
    }

    // Calculate expiry
    const retentionSeconds = Math.min(
      600,
      Math.max(60, this.config.get<number>('TEMP_FILE_MAX_TTL_SECONDS', 600)),
    );
    const expiresAt = new Date(Date.now() + retentionSeconds * 1000);

    // Create database record
    const storedFile = await this.prisma.storedFile.create({
      data: {
        organizationId: orgId,
        userId,
        originalFilename: sanitizedName,
        storageKey,
        extension: ext,
        mimeType,
        detectedType,
        sizeBytes: BigInt(finalBuffer.length),
        status: 'QUARANTINE',
        malwareScanStatus,
        expiresAt,
      },
    });

    // Move to inputs
    const inputKey = this.storage.generateStorageKey(orgId, userId, 'inputs', ext);
    await this.storage.move('quarantine', storageKey, 'inputs', inputKey);

    // Update record
    const updated = await this.prisma.storedFile.update({
      where: { id: storedFile.id },
      data: {
        storageKey: inputKey,
        status: 'READY',
      },
    });

    return {
      id: updated.id,
      originalFilename: updated.originalFilename,
      extension: updated.extension,
      mimeType: updated.mimeType,
      sizeBytes: Number(updated.sizeBytes),
      status: updated.status,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  /**
   * Upload content pasted by user (HTML, Markdown, text).
   */
  async uploadPastedContent(userId: string, orgId: string, content: string, format: string) {
    const buffer = Buffer.from(content, 'utf-8');

    // Determine extension and mimetype from format
    const ext =
      format === 'html' ? 'html' : format === 'markdown' ? 'md' : format === 'url' ? 'url' : 'txt';
    const mimetype =
      format === 'html'
        ? 'text/html'
        : format === 'markdown'
          ? 'text/markdown'
          : format === 'url'
            ? 'text/uri-list'
            : 'text/plain';

    const file = {
      originalname: `pasted-content.${ext}`,
      mimetype,
      buffer,
      size: buffer.length,
    } as Express.Multer.File;

    return this.uploadFile(userId, orgId, file);
  }

  /**
   * List files for a user.
   */
  async listFiles(userId: string, orgId: string, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;

    const [files, total] = await Promise.all([
      this.prisma.storedFile.findMany({
        where: { organizationId: orgId, userId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          originalFilename: true,
          extension: true,
          mimeType: true,
          sizeBytes: true,
          status: true,
          createdAt: true,
          expiresAt: true,
        },
      }),
      this.prisma.storedFile.count({
        where: { organizationId: orgId, userId, deletedAt: null },
      }),
    ]);

    return {
      data: files.map((f) => ({ ...f, sizeBytes: Number(f.sizeBytes) })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  /**
   * Get a file by ID.
   */
  async getFile(fileId: string, userId: string) {
    const file = await this.prisma.storedFile.findFirst({
      where: { id: fileId, userId, deletedAt: null },
    });

    if (!file) throw new NotFoundException('File not found.');
    return { ...file, sizeBytes: Number(file.sizeBytes) };
  }

  /**
   * Get a signed download URL for a file.
   */
  async getDownloadUrl(fileId: string, userId: string) {
    const file = await this.getFile(fileId, userId);
    const url = await this.storage.getSignedDownloadUrl(
      'inputs',
      file.storageKey,
      900,
      file.originalFilename,
    );
    return { url, filename: file.originalFilename };
  }

  /**
   * Soft-delete a file.
   */
  async deleteFile(fileId: string, userId: string) {
    const file = await this.getFile(fileId, userId);

    await this.prisma.storedFile.update({
      where: { id: file.id },
      data: { deletedAt: new Date(), status: 'DELETED' },
    });

    // Delete from storage
    try {
      await this.storage.delete('inputs', file.storageKey);
    } catch {
      // Storage deletion is best-effort
    }

    return { success: true };
  }

  /** Store an application-generated asset without pretending it is a user upload. */
  async storeGeneratedAsset(
    organizationId: string,
    userId: string,
    buffer: Buffer,
    mimeType: string,
    extension: string,
  ) {
    const storageKey = this.storage.generateStorageKey(
      organizationId,
      userId,
      'outputs',
      extension,
    );
    await this.storage.upload('outputs', storageKey, buffer, mimeType);
    return { storageKey, sizeBytes: buffer.length };
  }

  deleteGeneratedAsset(storageKey: string) {
    return this.storage.delete('outputs', storageKey);
  }

  getGeneratedAssetUrl(storageKey: string, filename?: string) {
    return this.storage.getSignedDownloadUrl('outputs', storageKey, 900, filename);
  }
}
