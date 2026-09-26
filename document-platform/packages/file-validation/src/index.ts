// ═══════════════════════════════════════════════════════════════
// File Validation — Magic bytes, MIME, extension, size checks
// ═══════════════════════════════════════════════════════════════

import { ALLOWED_EXTENSIONS, MAX_FILENAME_LENGTH, ErrorCode } from '@docconv/shared-types';

// ─── Magic Bytes Signatures ──────────────────────────────────

interface FileSignature {
  extension: string;
  mimeType: string;
  magic: number[];
  offset?: number;
}

const FILE_SIGNATURES: FileSignature[] = [
  // PDF
  { extension: 'pdf', mimeType: 'application/pdf', magic: [0x25, 0x50, 0x44, 0x46] },
  // PNG
  {
    extension: 'png',
    mimeType: 'image/png',
    magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  // JPEG
  { extension: 'jpg', mimeType: 'image/jpeg', magic: [0xff, 0xd8, 0xff] },
  // ZIP-based (DOCX, XLSX, etc.)
  { extension: 'zip', mimeType: 'application/zip', magic: [0x50, 0x4b, 0x03, 0x04] },
  // HTML (BOM + <)
  { extension: 'html', mimeType: 'text/html', magic: [0x3c] },
];

// ─── Validation Result ───────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  detectedType?: string;
  detectedMimeType?: string;
}

export interface ValidationError {
  code: ErrorCode;
  message: string;
  field?: string;
}

// ─── Validate File Extension ─────────────────────────────────

export function validateExtension(filename: string): ValidationResult {
  const errors: ValidationError[] = [];
  const ext = getExtension(filename);

  if (!ext) {
    errors.push({
      code: ErrorCode.UNSUPPORTED_FORMAT,
      message: 'File has no extension.',
      field: 'filename',
    });
    return { valid: false, errors };
  }

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    errors.push({
      code: ErrorCode.UNSUPPORTED_FORMAT,
      message: `File extension ".${ext}" is not supported.`,
      field: 'extension',
    });
    return { valid: false, errors, detectedType: ext };
  }

  return { valid: true, errors: [], detectedType: ext };
}

// ─── Validate Filename ───────────────────────────────────────

export function validateFilename(filename: string): ValidationResult {
  const errors: ValidationError[] = [];

  if (!filename || filename.trim().length === 0) {
    errors.push({
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Filename is required.',
      field: 'filename',
    });
    return { valid: false, errors };
  }

  if (filename.length > MAX_FILENAME_LENGTH) {
    errors.push({
      code: ErrorCode.VALIDATION_ERROR,
      message: `Filename exceeds maximum length of ${MAX_FILENAME_LENGTH} characters.`,
      field: 'filename',
    });
  }

  // Check for dangerous path characters
  const dangerousPatterns = ['../', '..\\', '\x00', '/', '\\'];
  for (const pattern of dangerousPatterns) {
    if (filename.includes(pattern)) {
      errors.push({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Filename contains forbidden characters.',
        field: 'filename',
      });
      break;
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── Validate File Size ──────────────────────────────────────

export function validateFileSize(
  sizeBytes: number,
  maxSizeBytes: number = 26_214_400, // 25 MB default
): ValidationResult {
  const errors: ValidationError[] = [];

  if (sizeBytes <= 0) {
    errors.push({
      code: ErrorCode.VALIDATION_ERROR,
      message: 'File is empty.',
      field: 'size',
    });
  }

  if (sizeBytes > maxSizeBytes) {
    const maxMb = Math.round(maxSizeBytes / (1024 * 1024));
    errors.push({
      code: ErrorCode.FILE_TOO_LARGE,
      message: `File exceeds the maximum size of ${maxMb} MB.`,
      field: 'size',
    });
  }

  return { valid: errors.length === 0, errors };
}

// ─── Detect File Type from Magic Bytes ───────────────────────

export function detectFileType(buffer: Buffer): {
  extension: string | null;
  mimeType: string | null;
} {
  for (const sig of FILE_SIGNATURES) {
    const offset = sig.offset ?? 0;
    let matches = true;

    for (let i = 0; i < sig.magic.length; i++) {
      if (buffer.length <= offset + i || buffer[offset + i] !== sig.magic[i]) {
        matches = false;
        break;
      }
    }

    if (matches) {
      // ZIP-based files need further inspection for DOCX/XLSX
      if (sig.extension === 'zip') {
        const zipSubType = detectZipSubType(buffer);
        if (zipSubType) {
          return zipSubType;
        }
      }
      return { extension: sig.extension, mimeType: sig.mimeType };
    }
  }

  // Text-based formats (check for common patterns)
  const textContent = buffer.subarray(0, Math.min(buffer.length, 4096)).toString('utf-8');

  if (textContent.trimStart().startsWith('{') || textContent.trimStart().startsWith('[')) {
    try {
      JSON.parse(textContent);
      return { extension: 'json', mimeType: 'application/json' };
    } catch {
      // Not valid JSON
    }
  }

  if (textContent.includes('<!DOCTYPE html') || textContent.includes('<html')) {
    return { extension: 'html', mimeType: 'text/html' };
  }

  // Default to text/plain for readable content
  if (isLikelyText(buffer)) {
    return { extension: 'txt', mimeType: 'text/plain' };
  }

  return { extension: null, mimeType: null };
}

// ─── Validate File Signature ─────────────────────────────────

export function validateFileSignature(buffer: Buffer, declaredExtension: string): ValidationResult {
  const errors: ValidationError[] = [];
  const detected = detectFileType(buffer);

  // For text-based formats (HTML, Markdown, TXT, CSV, JSON), magic bytes
  // are unreliable — skip signature validation.
  const textFormats = new Set([
    'html',
    'htm',
    'md',
    'markdown',
    'txt',
    'text',
    'csv',
    'json',
    'url',
  ]);
  if (textFormats.has(declaredExtension.toLowerCase())) {
    return { valid: true, errors: [], detectedType: declaredExtension };
  }

  if (!detected.extension) {
    errors.push({
      code: ErrorCode.INVALID_FILE_SIGNATURE,
      message: 'Unable to verify file type from content.',
      field: 'content',
    });
    return { valid: false, errors };
  }

  // For ZIP-based formats, check DOCX vs XLSX
  const declared = declaredExtension.toLowerCase();
  const strictFormats = new Set(['pdf', 'docx', 'xlsx', 'png', 'jpg', 'jpeg']);
  if (strictFormats.has(declared)) {
    const detectedExtension = detected.extension === 'jpeg' ? 'jpg' : detected.extension;
    const declaredEquivalent = declared === 'jpeg' ? 'jpg' : declared;
    if (detectedExtension !== declaredEquivalent) {
      errors.push({
        code: ErrorCode.INVALID_FILE_SIGNATURE,
        message: `File content does not match declared extension ".${declared}".`,
        field: 'content',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    detectedType: detected.extension,
    detectedMimeType: detected.mimeType ?? undefined,
  };
}

// ─── Zip Bomb and Archive Safety ─────────────────────────────

export function validateZipSafety(
  buffer: Buffer,
  maxUncompressedBytes: number = 300 * 1024 * 1024,
  maxEntries: number = 5000,
): ValidationResult {
  const errors: ValidationError[] = [];
  if (
    buffer.length < 4 ||
    buffer[0] !== 0x50 ||
    buffer[1] !== 0x4b ||
    buffer[2] !== 0x03 ||
    buffer[3] !== 0x04
  ) {
    return { valid: true, errors: [] }; // Not a ZIP file
  }

  let totalUncompressed = 0;
  let entryCount = 0;
  let offset = 0;

  while (offset + 30 <= buffer.length) {
    // Check for local file header signature PK\x03\x04
    if (
      buffer[offset] === 0x50 &&
      buffer[offset + 1] === 0x4b &&
      buffer[offset + 2] === 0x03 &&
      buffer[offset + 3] === 0x04
    ) {
      entryCount++;
      if (entryCount > maxEntries) {
        errors.push({
          code: ErrorCode.VALIDATION_ERROR,
          message: `Archive exceeds maximum allowed entries limit (${maxEntries}). Potential zip bomb.`,
          field: 'archive',
        });
        return { valid: false, errors };
      }

      const compressedSize = buffer.readUInt32LE(offset + 18);
      const uncompressedSize = buffer.readUInt32LE(offset + 22);
      const filenameLen = buffer.readUInt16LE(offset + 26);
      const extraLen = buffer.readUInt16LE(offset + 28);

      totalUncompressed += uncompressedSize;
      if (totalUncompressed > maxUncompressedBytes) {
        errors.push({
          code: ErrorCode.FILE_TOO_LARGE,
          message: `Archive uncompressed size (${Math.round(totalUncompressed / (1024 * 1024))}MB) exceeds maximum safe limit. Potential zip bomb.`,
          field: 'archive',
        });
        return { valid: false, errors };
      }

      // Check compression ratio per file
      if (compressedSize > 0 && uncompressedSize / compressedSize > 100) {
        errors.push({
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Abnormal compression ratio detected in archive entry. Potential zip bomb.',
          field: 'archive',
        });
        return { valid: false, errors };
      }

      // Check filename for path traversal
      if (offset + 30 + filenameLen <= buffer.length) {
        const filename = buffer.toString('utf8', offset + 30, offset + 30 + filenameLen);
        if (filename.includes('../') || filename.includes('..\\')) {
          errors.push({
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Directory traversal detected in archive entry filename.',
            field: 'archive',
          });
          return { valid: false, errors };
        }
      }

      const nextOffset = offset + 30 + filenameLen + extraLen + compressedSize;
      const flags = buffer.readUInt16LE(offset + 6);
      if ((flags & 0x08) !== 0 && compressedSize === 0) {
        let found = false;
        for (let i = offset + 30 + filenameLen + extraLen; i + 4 <= buffer.length; i++) {
          if (
            buffer[i] === 0x50 &&
            buffer[i + 1] === 0x4b &&
            (buffer[i + 2] === 0x03 || buffer[i + 2] === 0x01 || buffer[i + 2] === 0x05)
          ) {
            offset = i;
            found = true;
            break;
          }
        }
        if (!found) break;
      } else {
        offset = nextOffset;
      }
    } else {
      break;
    }
  }

  // Check overall ratio against buffer length
  if (
    buffer.length > 0 &&
    totalUncompressed / buffer.length > 50 &&
    totalUncompressed > 20 * 1024 * 1024
  ) {
    errors.push({
      code: ErrorCode.VALIDATION_ERROR,
      message: 'Abnormal aggregate compression ratio detected. Potential zip bomb.',
      field: 'archive',
    });
    return { valid: false, errors };
  }

  return { valid: errors.length === 0, errors };
}

// ─── Full Validation ─────────────────────────────────────────

export function validateFile(
  filename: string,
  buffer: Buffer,
  maxSizeBytes?: number,
): ValidationResult {
  const allErrors: ValidationError[] = [];

  const nameResult = validateFilename(filename);
  allErrors.push(...nameResult.errors);

  const extResult = validateExtension(filename);
  allErrors.push(...extResult.errors);

  const sizeResult = validateFileSize(buffer.length, maxSizeBytes);
  allErrors.push(...sizeResult.errors);

  // Only check signature if extension is valid
  if (extResult.valid) {
    const ext = getExtension(filename) ?? '';
    const sigResult = validateFileSignature(buffer, ext);
    allErrors.push(...sigResult.errors);

    // Zip bomb and structural check for zip-based formats
    const zipResult = validateZipSafety(buffer);
    allErrors.push(...zipResult.errors);
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    detectedType: extResult.detectedType,
  };
}

// ─── Sanitize Filename ───────────────────────────────────────

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^\w\s.\-()]/g, '_') // Replace dangerous chars
    .replace(/\.{2,}/g, '.') // Remove consecutive dots
    .replace(/\s+/g, '_') // Replace spaces
    .substring(0, MAX_FILENAME_LENGTH);
}

// ─── Helpers ─────────────────────────────────────────────────

export function getExtension(filename: string): string | undefined {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1 || lastDot === filename.length - 1) return undefined;
  return filename.substring(lastDot + 1).toLowerCase();
}

function detectZipSubType(buffer: Buffer): { extension: string; mimeType: string } | null {
  const content = buffer.toString('binary');

  if (content.includes('word/document.xml')) {
    return {
      extension: 'docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
  }
  if (content.includes('xl/workbook.xml') || content.includes('xl/worksheets')) {
    return {
      extension: 'xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  return null;
}

function isLikelyText(buffer: Buffer): boolean {
  // Check first 512 bytes for non-text characters
  const checkLength = Math.min(buffer.length, 512);
  let nonTextCount = 0;

  for (let i = 0; i < checkLength; i++) {
    const byte = buffer[i]!;
    if (byte === 0) return false; // Null byte = binary
    if (byte < 7 || (byte > 14 && byte < 32 && byte !== 27)) {
      nonTextCount++;
    }
  }

  return nonTextCount / checkLength < 0.1;
}
