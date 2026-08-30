import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { StorageClient, createStorageConfig } from '@docconv/storage';
import { validateFile, sanitizeFilename, getExtension } from '@docconv/file-validation';
import { MIME_TYPES } from '@docconv/shared-types';
import { UrlInspectorService } from './url-inspector.service';
import { UrlSecurityService } from '@docconv/url-security';

@Injectable()
export class FilesService {
  private storage: StorageClient;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly urlInspector: UrlInspectorService,
    private readonly urlSecurity: UrlSecurityService,
  ) {
    this.storage = new StorageClient(createStorageConfig(process.env as Record<string, string>));
  }

  /**
   * Upload a file: validate, store in quarantine, create DB record.
   */
  async uploadFile(
    userId: string,
    orgId: string,
    file: { originalname: string; buffer: Buffer; mimetype: string; size: number },
  ) {
    const maxSize = this.config.get<number>('MAX_UPLOAD_SIZE_BYTES', 26_214_400);

    // Validate
    const sanitizedName = sanitizeFilename(file.originalname);
    const validation = validateFile(sanitizedName, file.buffer, maxSize);
    if (!validation.valid) {
      const messages = validation.errors.map((e) => e.message).join('; ');
      throw new BadRequestException(messages);
    }

    let ext = getExtension(sanitizedName) ?? 'bin';
    let mimeType = MIME_TYPES[ext] ?? file.mimetype;
    let detectedType = validation.detectedType;
    let finalBuffer = file.buffer;

    // Phase 1 URL Logic: Verify SSRF and Inspect URL before storing
    if (ext === 'url') {
      const urlString = finalBuffer.toString('utf-8').trim();
      // Security Check (SSRF protection)
      try {
        await this.urlSecurity.validateUrl(urlString);
        const inspection = await this.urlInspector.inspect(
          urlString,
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

    // Calculate expiry
    const retentionHours = this.config.get<number>('FILE_RETENTION_HOURS', 24);
    const expiresAt = new Date(Date.now() + retentionHours * 60 * 60 * 1000);

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
        malwareScanStatus: 'SKIPPED', // ClamAV disabled in dev
        expiresAt,
      },
    });

    // Move to inputs (since malware scanning is skipped in dev)
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
  async uploadPastedContent(
    userId: string,
    orgId: string,
    content: string,
    format: string,
  ) {
    const buffer = Buffer.from(content, 'utf-8');
    
    // Determine extension and mimetype from format
    const ext = format === 'html' ? 'html' : format === 'markdown' ? 'md' : format === 'url' ? 'url' : 'txt';
    const mimetype = format === 'html' ? 'text/html' : format === 'markdown' ? 'text/markdown' : format === 'url' ? 'text/uri-list' : 'text/plain';
    
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
          id: true, originalFilename: true, extension: true, mimeType: true,
          sizeBytes: true, status: true, createdAt: true, expiresAt: true,
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
}
