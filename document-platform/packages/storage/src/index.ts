// ═══════════════════════════════════════════════════════════════
// Storage Client — S3-compatible object storage
// Works with MinIO (dev), Cloudflare R2, AWS S3
// ═══════════════════════════════════════════════════════════════

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';
import { Upload } from '@aws-sdk/lib-storage';

// ─── Configuration ───────────────────────────────────────────

export interface StorageConfig {
  endpoint: string;
  publicEndpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  forcePathStyle: boolean;
  buckets: {
    quarantine: string;
    inputs: string;
    outputs: string;
    previews: string;
    templates: string;
  };
}

export function createStorageConfig(env: Record<string, string | undefined>): StorageConfig {
  return {
    endpoint: env['STORAGE_ENDPOINT'] || 'http://localhost:9000',
    publicEndpoint: env['STORAGE_PUBLIC_ENDPOINT'],
    accessKeyId: env['STORAGE_ACCESS_KEY'] || 'minioadmin',
    secretAccessKey: env['STORAGE_SECRET_KEY'] || 'minioadmin',
    region: env['STORAGE_REGION'] || 'us-east-1',
    forcePathStyle: env['STORAGE_FORCE_PATH_STYLE'] === 'true',
    buckets: {
      quarantine: env['STORAGE_BUCKET_QUARANTINE'] || 'docconv-quarantine',
      inputs: env['STORAGE_BUCKET_INPUTS'] || 'docconv-inputs',
      outputs: env['STORAGE_BUCKET_OUTPUTS'] || 'docconv-outputs',
      previews: env['STORAGE_BUCKET_PREVIEWS'] || 'docconv-previews',
      templates: env['STORAGE_BUCKET_TEMPLATES'] || 'docconv-templates',
    },
  };
}

// ─── Storage Bucket Type ─────────────────────────────────────

export type BucketType = 'quarantine' | 'inputs' | 'outputs' | 'previews' | 'templates';

// ─── Storage Client ──────────────────────────────────────────

export class StorageClient {
  private client: S3Client;
  private signingClient: S3Client;
  private config: StorageConfig;

  constructor(config: StorageConfig) {
    this.config = config;
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: config.forcePathStyle,
    });
    this.signingClient = config.publicEndpoint
      ? new S3Client({
          endpoint: config.publicEndpoint,
          region: config.region,
          credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          },
          forcePathStyle: config.forcePathStyle,
        })
      : this.client;
  }

  /**
   * Generate a UUID-based storage key for a file.
   * Format: organizations/{orgId}/users/{userId}/{bucket}/{uuid}.{ext}
   */
  generateStorageKey(orgId: string, userId: string, bucket: BucketType, extension: string): string {
    const uuid = randomUUID();
    const ext = extension.replace(/^\./, '');
    return `organizations/${orgId}/users/${userId}/${bucket}/${uuid}.${ext}`;
  }

  /**
   * Get the bucket name for a given bucket type.
   */
  getBucketName(type: BucketType): string {
    return this.config.buckets[type];
  }

  /**
   * Upload a file to object storage.
   */
  async upload(
    bucket: BucketType,
    key: string,
    body: Buffer | Readable | string,
    contentType: string,
    metadata?: Record<string, string>,
  ): Promise<void> {
    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.getBucketName(bucket),
        Key: key,
        Body: body,
        ContentType: contentType,
        Metadata: metadata,
      },
    });
    await upload.done();
  }

  /**
   * Download a file from object storage as a readable stream.
   */
  async download(bucket: BucketType, key: string): Promise<Readable> {
    const command = new GetObjectCommand({
      Bucket: this.getBucketName(bucket),
      Key: key,
    });
    const response = await this.client.send(command);
    return response.Body as Readable;
  }

  /**
   * Download a file as a Buffer.
   */
  async downloadBuffer(bucket: BucketType, key: string): Promise<Buffer> {
    const stream = await this.download(bucket, key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  /**
   * Delete a file from object storage.
   */
  async delete(bucket: BucketType, key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.getBucketName(bucket),
      Key: key,
    });
    await this.client.send(command);
  }

  /**
   * Check if a file exists and get its metadata.
   */
  async head(
    bucket: BucketType,
    key: string,
  ): Promise<{
    contentLength: number;
    contentType: string;
    lastModified: Date;
    metadata: Record<string, string>;
  } | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.getBucketName(bucket),
        Key: key,
      });
      const response = await this.client.send(command);
      return {
        contentLength: response.ContentLength ?? 0,
        contentType: response.ContentType ?? 'application/octet-stream',
        lastModified: response.LastModified ?? new Date(),
        metadata: response.Metadata ?? {},
      };
    } catch {
      return null;
    }
  }

  /**
   * Generate a temporary signed URL for downloading.
   */
  async getSignedDownloadUrl(
    bucket: BucketType,
    key: string,
    expiresInSeconds: number = 900, // 15 minutes
    filename?: string,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.getBucketName(bucket),
      Key: key,
      ...(filename && {
        ResponseContentDisposition: `attachment; filename="${filename}"`,
      }),
    });
    return getSignedUrl(this.signingClient, command, { expiresIn: expiresInSeconds });
  }

  /**
   * Generate a temporary signed URL for uploading.
   */
  async getSignedUploadUrl(
    bucket: BucketType,
    key: string,
    contentType: string,
    expiresInSeconds: number = 300, // 5 minutes
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.getBucketName(bucket),
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.signingClient, command, { expiresIn: expiresInSeconds });
  }

  /**
   * Move a file between buckets (copy + delete).
   */
  async move(
    sourceBucket: BucketType,
    sourceKey: string,
    destBucket: BucketType,
    destKey: string,
  ): Promise<void> {
    // Download from source
    const buffer = await this.downloadBuffer(sourceBucket, sourceKey);
    const head = await this.head(sourceBucket, sourceKey);
    const contentType = head?.contentType ?? 'application/octet-stream';

    // Upload to destination
    await this.upload(destBucket, destKey, buffer, contentType);

    // Delete from source
    await this.delete(sourceBucket, sourceKey);
  }

  /**
   * List objects in a bucket with optional prefix.
   */
  async list(
    bucket: BucketType,
    prefix?: string,
    maxKeys: number = 1000,
  ): Promise<Array<{ key: string; size: number; lastModified: Date }>> {
    const command = new ListObjectsV2Command({
      Bucket: this.getBucketName(bucket),
      Prefix: prefix,
      MaxKeys: maxKeys,
    });
    const response = await this.client.send(command);
    return (response.Contents ?? []).map((item) => ({
      key: item.Key ?? '',
      size: item.Size ?? 0,
      lastModified: item.LastModified ?? new Date(),
    }));
  }

  /**
   * Ensure a bucket exists (create if not).
   */
  async ensureBucket(bucket: BucketType): Promise<void> {
    const bucketName = this.getBucketName(bucket);
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: bucketName }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: bucketName }));
    }
  }

  /**
   * Ensure all buckets exist.
   */
  async ensureAllBuckets(): Promise<void> {
    const bucketTypes: BucketType[] = ['quarantine', 'inputs', 'outputs', 'previews', 'templates'];
    await Promise.all(bucketTypes.map((type) => this.ensureBucket(type)));
  }
}
