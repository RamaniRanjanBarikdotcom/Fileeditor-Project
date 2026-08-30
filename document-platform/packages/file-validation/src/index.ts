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
  { extension: 'png', mimeType: 'image/png', magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
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

export function validateFileSignature(
  buffer: Buffer,
  declaredExtension: string,
): ValidationResult {
  const errors: ValidationError[] = [];
  const detected = detectFileType(buffer);

  // For text-based formats (HTML, Markdown, TXT, CSV, JSON), magic bytes
  // are unreliable — skip signature validation.
  const textFormats = new Set(['html', 'htm', 'md', 'markdown', 'txt', 'text', 'csv', 'json', 'url']);
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
    .replace(/[^\w\s.\-()]/g, '_')  // Replace dangerous chars
    .replace(/\.{2,}/g, '.')         // Remove consecutive dots
    .replace(/\s+/g, '_')            // Replace spaces
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
