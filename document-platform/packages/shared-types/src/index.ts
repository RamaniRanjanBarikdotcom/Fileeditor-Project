// ═══════════════════════════════════════════════════════════════
// Document Conversion Platform — Shared Types
// ═══════════════════════════════════════════════════════════════

// ─── File Formats ─────────────────────────────────────────────

export enum InputFormat {
  PDF = 'pdf',
  HTML = 'html',
  MARKDOWN = 'markdown',
  TXT = 'txt',
  DOCX = 'docx',
  XLSX = 'xlsx',
  CSV = 'csv',
  JSON = 'json',
  PNG = 'png',
  JPG = 'jpg',
  JPEG = 'jpeg',
  URL = 'url',
}
export enum OutputFormat {
  PDF = 'pdf',
  DOCX = 'docx',
  HTML = 'html',
  MARKDOWN = 'markdown',
  TXT = 'txt',
  XLSX = 'xlsx',
  CSV = 'csv',
}

// ─── Conversion Engine ───────────────────────────────────────

export enum ConversionEngine {
  CHROMIUM = 'chromium',
  LIBREOFFICE = 'libreoffice',
  PANDOC = 'pandoc',
  MAMMOTH = 'mammoth',
  SHEETJS = 'sheetjs',
  DOCX_GENERATOR = 'docx-generator',
  PDF_LIB = 'pdf-lib',
  IMAGE_WORKER = 'image-worker',
  PDF_EXTRACTOR = 'pdf-extractor',
}

// ─── Job Status ──────────────────────────────────────────────

export enum JobStatus {
  CREATED = 'CREATED',
  UPLOADING = 'UPLOADING',
  UPLOADED = 'UPLOADED',
  SCANNING = 'SCANNING',
  VALIDATING = 'VALIDATING',
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  OUTPUT_VALIDATION = 'OUTPUT_VALIDATION',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export type ProcessingLocation = 'BROWSER' | 'NODE' | 'NATIVE' | 'AUTO';

export type ResolvedProcessingLocation = Exclude<ProcessingLocation, 'AUTO'>;

export interface FileDescriptor {
  id?: string;
  name: string;
  sizeBytes: number;
  mimeType?: string;
  extension: string;
}

export interface ProcessingContext {
  deploymentMode: 'HOSTINGER' | 'DOCKER_NATIVE';
  browserEnabled: boolean;
  nodeEnabled: boolean;
  nativeEnabled: boolean;
}

export interface ProcessingRequest {
  operation: string;
  files: FileDescriptor[];
  options: Record<string, unknown>;
  requestedLocation?: ProcessingLocation;
}

export interface OutputDescriptor extends FileDescriptor {
  downloadUrl?: string;
}

export interface ProcessingWarning {
  code: string;
  message: string;
}

export interface ProcessingResult {
  success: boolean;
  output?: OutputDescriptor[];
  warnings?: ProcessingWarning[];
  engine: string;
  engineVersion?: string;
  processingLocation: ResolvedProcessingLocation;
  durationMs: number;
  error?: { code: ErrorCode; message: string };
}

export interface ProcessingEngine {
  id: string;
  location: ResolvedProcessingLocation;
  canProcess(request: ProcessingRequest, context: ProcessingContext): Promise<boolean>;
  process(request: ProcessingRequest, context: ProcessingContext): Promise<ProcessingResult>;
}

export interface LocationCapability {
  supported: boolean;
  maxBytes?: number;
  maxFiles?: number;
}

export interface ToolCapability {
  operation: string;
  browser: LocationCapability;
  node: LocationCapability;
  native: LocationCapability;
  preferred: ProcessingLocation;
}

export type ToolAvailability =
  | 'AVAILABLE_LOCAL'
  | 'AVAILABLE_SERVER'
  | 'AVAILABLE_BOTH'
  | 'BETA'
  | 'COMING_SOON';

export interface CanonicalToolDefinition {
  id: string;
  slug: string;
  operation: string;
  category: string;
  title: string;
  description: string;
  inputTypes: string[];
  outputTypes: string[];
  capability: ToolCapability;
  availability: ToolAvailability;
  privacy: {
    browserPreferred: boolean;
    serverRetentionSeconds: number;
  };
  featureFlag?: string;
}

// ─── File Status ─────────────────────────────────────────────

export enum FileStatus {
  UPLOADING = 'UPLOADING',
  QUARANTINE = 'QUARANTINE',
  SCANNING = 'SCANNING',
  CLEAN = 'CLEAN',
  INFECTED = 'INFECTED',
  READY = 'READY',
  EXPIRED = 'EXPIRED',
  DELETED = 'DELETED',
}

export enum MalwareScanStatus {
  PENDING = 'PENDING',
  SCANNING = 'SCANNING',
  CLEAN = 'CLEAN',
  INFECTED = 'INFECTED',
  SKIPPED = 'SKIPPED',
  ERROR = 'ERROR',
}

// ─── User Roles ──────────────────────────────────────────────

export enum OrgRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER',
}

// ─── Conversion Quality ──────────────────────────────────────

export enum ConversionQuality {
  A = 'A', // Very reliable
  B = 'B', // Reliable with possible visual differences
  C = 'C', // Best effort
  D = 'D', // Experimental
}

// ─── Page Settings ───────────────────────────────────────────

export enum PageSize {
  A4 = 'A4',
  A3 = 'A3',
  A5 = 'A5',
  LETTER = 'Letter',
  LEGAL = 'Legal',
}

export enum Orientation {
  PORTRAIT = 'portrait',
  LANDSCAPE = 'landscape',
}

export interface PageMargins {
  top: number; // mm
  right: number; // mm
  bottom: number; // mm
  left: number; // mm
}

export const DEFAULT_MARGINS: PageMargins = {
  top: 15,
  right: 15,
  bottom: 15,
  left: 15,
};

// ─── Conversion Options ──────────────────────────────────────

export interface ConversionOptions {
  pageSize?: PageSize;
  orientation?: Orientation;
  margins?: PageMargins;
  printBackground?: boolean;
  scale?: number;
  headerHtml?: string;
  footerHtml?: string;
  templateId?: string;
}

const PAGE_SIZES = new Set<string>(Object.values(PageSize));
const ORIENTATIONS = new Set<string>(Object.values(Orientation));

export function normalizeConversionOptions(value: unknown): ConversionOptions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  const options: ConversionOptions = {};
  if (typeof input.pageSize === 'string' && PAGE_SIZES.has(input.pageSize)) {
    options.pageSize = input.pageSize as PageSize;
  }
  if (typeof input.orientation === 'string' && ORIENTATIONS.has(input.orientation)) {
    options.orientation = input.orientation as Orientation;
  }
  if (typeof input.printBackground === 'boolean') options.printBackground = input.printBackground;
  if (typeof input.scale === 'number' && Number.isFinite(input.scale)) {
    options.scale = Math.min(2, Math.max(0.1, input.scale));
  }
  if (input.margins && typeof input.margins === 'object' && !Array.isArray(input.margins)) {
    const raw = input.margins as Record<string, unknown>;
    const margin = (key: string) => {
      const number = Number(raw[key]);
      return Number.isFinite(number) ? Math.min(100, Math.max(0, number)) : DEFAULT_MARGINS[key as keyof PageMargins];
    };
    options.margins = { top: margin('top'), right: margin('right'), bottom: margin('bottom'), left: margin('left') };
  }
  if (typeof input.headerHtml === 'string') options.headerHtml = input.headerHtml.slice(0, 100_000);
  if (typeof input.footerHtml === 'string') options.footerHtml = input.footerHtml.slice(0, 100_000);
  if (typeof input.templateId === 'string') options.templateId = input.templateId.slice(0, 100);
  return options;
}

// ─── Conversion Job Data (sent to queue) ─────────────────────

export interface ConversionJobData {
  conversionId: string;
  sourceFileId: string;
  sourceStorageKey: string;
  sourceFormat: InputFormat;
  targetFormat: OutputFormat;
  engine: ConversionEngine;
  options: ConversionOptions;
  attemptNumber: number;
}

// ─── Conversion Result (returned by worker) ──────────────────

export interface ConversionResult {
  success: boolean;
  outputStorageKey?: string;
  outputFormat?: OutputFormat;
  mimeType?: string;
  sizeBytes?: number;
  pageCount?: number;
  warnings?: string[];
  metadata?: Record<string, unknown>;
  error?: {
    code: ErrorCode;
    message: string;
    details?: string;
  };
  durationMs?: number;
}

// ─── Conversion Matrix Entry ─────────────────────────────────

export interface ConversionMatrixEntry {
  input: InputFormat;
  output: OutputFormat;
  engine: ConversionEngine;
  quality: ConversionQuality;
  description?: string;
}

// ─── Queue Names ─────────────────────────────────────────────

export const QUEUE_NAMES = {
  HTML: 'conversion-html',
  OFFICE: 'conversion-office',
  MARKDOWN: 'conversion-markdown',
  DATA: 'conversion-data',
  DOCUMENT: 'conversion-document',
  IMAGE: 'conversion-image',
  PDF: 'conversion-pdf',
} as const;

// ─── Error Codes ─────────────────────────────────────────────

export enum ErrorCode {
  // File errors
  UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT',
  UNSUPPORTED_CONVERSION = 'UNSUPPORTED_CONVERSION',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FILE_SIGNATURE = 'INVALID_FILE_SIGNATURE',
  MALWARE_DETECTED = 'MALWARE_DETECTED',
  PASSWORD_PROTECTED_FILE = 'PASSWORD_PROTECTED_FILE',
  CORRUPT_FILE = 'CORRUPT_FILE',

  // Conversion errors
  CONVERSION_TIMEOUT = 'CONVERSION_TIMEOUT',
  CONVERSION_ENGINE_FAILURE = 'CONVERSION_ENGINE_FAILURE',
  OUTPUT_VALIDATION_FAILED = 'OUTPUT_VALIDATION_FAILED',
  ENGINE_UNAVAILABLE = 'ENGINE_UNAVAILABLE',
  NATIVE_ENGINE_UNAVAILABLE = 'NATIVE_ENGINE_UNAVAILABLE',
  TOOL_UNAVAILABLE_IN_CURRENT_DEPLOYMENT = 'TOOL_UNAVAILABLE_IN_CURRENT_DEPLOYMENT',
  FILE_TOO_LARGE_FOR_LOCAL_PROCESSING = 'FILE_TOO_LARGE_FOR_LOCAL_PROCESSING',
  TOO_MANY_FILES = 'TOO_MANY_FILES',
  OUTPUT_INVALID = 'OUTPUT_INVALID',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',

  // System errors
  STORAGE_FAILURE = 'STORAGE_FAILURE',
  INSUFFICIENT_STORAGE = 'INSUFFICIENT_STORAGE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',

  // Auth errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',

  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
}

// ─── User-Friendly Error Messages ────────────────────────────

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.UNSUPPORTED_FORMAT]: 'This file format is not supported.',
  [ErrorCode.UNSUPPORTED_CONVERSION]: 'This conversion is not available.',
  [ErrorCode.FILE_TOO_LARGE]: 'The file exceeds the maximum allowed size.',
  [ErrorCode.INVALID_FILE_SIGNATURE]:
    'The file appears to be corrupted or has an incorrect extension.',
  [ErrorCode.MALWARE_DETECTED]: 'This file has been flagged as potentially unsafe.',
  [ErrorCode.PASSWORD_PROTECTED_FILE]: 'Password-protected files are not yet supported.',
  [ErrorCode.CORRUPT_FILE]: 'The file appears to be corrupted and cannot be processed.',
  [ErrorCode.CONVERSION_TIMEOUT]:
    'The conversion took too long and was cancelled. Try a smaller file.',
  [ErrorCode.CONVERSION_ENGINE_FAILURE]:
    "We couldn't convert this document. The file may contain unsupported content.",
  [ErrorCode.OUTPUT_VALIDATION_FAILED]: 'The converted file failed validation. Please try again.',
  [ErrorCode.ENGINE_UNAVAILABLE]:
    'The conversion service is temporarily unavailable. Please try again later.',
  [ErrorCode.NATIVE_ENGINE_UNAVAILABLE]:
    'This conversion requires a native processing worker that is not available.',
  [ErrorCode.TOOL_UNAVAILABLE_IN_CURRENT_DEPLOYMENT]:
    'This tool is not available in the current deployment.',
  [ErrorCode.FILE_TOO_LARGE_FOR_LOCAL_PROCESSING]:
    'This file is too large to process safely in your browser.',
  [ErrorCode.TOO_MANY_FILES]: 'Too many files were selected for this operation.',
  [ErrorCode.OUTPUT_INVALID]: 'The generated file could not be validated.',
  [ErrorCode.CANCELLED]: 'The conversion was cancelled.',
  [ErrorCode.EXPIRED]: 'The conversion and its temporary files have expired.',
  [ErrorCode.STORAGE_FAILURE]: 'A storage error occurred. Please try again.',
  [ErrorCode.INSUFFICIENT_STORAGE]: 'Storage quota exceeded.',
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please wait a moment and try again.',
  [ErrorCode.INTERNAL_ERROR]: 'An unexpected error occurred. Please try again.',
  [ErrorCode.UNAUTHORIZED]: 'Please sign in to continue.',
  [ErrorCode.FORBIDDEN]: 'You do not have permission to perform this action.',
  [ErrorCode.INVALID_CREDENTIALS]: 'Invalid email or password.',
  [ErrorCode.TOKEN_EXPIRED]: 'Your session has expired. Please sign in again.',
  [ErrorCode.VALIDATION_ERROR]: 'Please check your input and try again.',
  [ErrorCode.NOT_FOUND]: 'The requested resource was not found.',
};

// ─── MIME Types ──────────────────────────────────────────────

export const MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  html: 'text/html',
  markdown: 'text/markdown',
  txt: 'text/plain',
  json: 'application/json',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  url: 'text/uri-list',
};

// ─── File Extensions ─────────────────────────────────────────

export const ALLOWED_EXTENSIONS = new Set([
  'html',
  'htm',
  'md',
  'markdown',
  'txt',
  'text',
  'docx',
  'xlsx',
  'csv',
  'json',
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'url',
]);

export const MAX_FILENAME_LENGTH = 255;

// ─── API Types ───────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: ErrorCode;
    message: string;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// ─── Platform Roles ──────────────────────────────────────────

export enum PlatformRole {
  CUSTOMER = 'CUSTOMER',
  SUPPORT = 'SUPPORT',
  ADMIN = 'ADMIN',
}

// ─── Subscription & Plans ────────────────────────────────────

export enum SubscriptionPlanTier {
  FREE = 'FREE',
  PRO = 'PRO',
  BUSINESS = 'BUSINESS',
}

export enum SubscriptionStatus {
  INCOMPLETE = 'INCOMPLETE',
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  CANCELED = 'CANCELED',
  UNPAID = 'UNPAID',
}

export interface SubscriptionPlanDto {
  id: string;
  tier: SubscriptionPlanTier;
  name: string;
  monthlyOpsLimit: number;
  maxFileSizeBytes: number;
  retentionDays: number;
  hasApiAccess: boolean;
  maxTeamSeats: number;
}

export interface SubscriptionDto {
  id: string;
  organizationId: string;
  planId: string;
  provider: PaymentProvider;
  providerSubId: string;
  status: SubscriptionStatus;
  currency: CurrencyCode;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  plan?: SubscriptionPlanDto;
}

// ─── Tools Registry ──────────────────────────────────────────

export interface ToolDto {
  id: string;
  slug: string;
  name: string;
  category: string;
  engine: string;
  acceptedFormats: string[];
  outputFormats: string[];
  minimumPlan: SubscriptionPlanTier;
  anonymousEnabled: boolean;
  costUnits: number;
  maxFileSizeBytes: number;
  isPublished: boolean;
  isFeatured: boolean;
  sortOrder: number;
  seoMetadata?: {
    title?: string;
    description?: string;
    keywords?: string[];
    canonical?: string;
  };
  configJson?: Record<string, unknown>;
  operation?: string;
  availability?: ToolAvailability;
  capability?: ToolCapability;
  privacy?: CanonicalToolDefinition['privacy'];
}

// ─── Quota & Reservations ────────────────────────────────────

export enum ReservationStatus {
  RESERVED = 'RESERVED',
  SETTLED = 'SETTLED',
  RELEASED = 'RELEASED',
  EXPIRED = 'EXPIRED',
}

export interface QuotaReservationDto {
  id: string;
  idempotencyKey: string;
  userId?: string;
  anonymousId?: string;
  toolId: string;
  conversionJobId?: string;
  unitsReserved: number;
  status: ReservationStatus;
  expiresAt: string;
  createdAt: string;
  settledAt?: string;
}

// ─── Commerce & Catalog ──────────────────────────────────────

export enum ProductType {
  FREE_TOOL = 'FREE_TOOL',
  SOFTWARE = 'SOFTWARE',
  AUTOMATION = 'AUTOMATION',
  SAAS = 'SAAS',
}

export enum CurrencyCode {
  USD = 'USD',
  INR = 'INR',
}

export enum PaymentProvider {
  STRIPE = 'STRIPE',
  RAZORPAY = 'RAZORPAY',
}

export interface PriceDto {
  id: string;
  productId: string;
  currency: CurrencyCode;
  amountMinorUnits: number; // e.g. cents (USD) or paise (INR)
  provider: PaymentProvider;
  providerPriceId?: string;
  isActive: boolean;
}

export interface ProductReleaseDto {
  id: string;
  productId: string;
  version: string;
  changelog?: string;
  fileSizeBytes: number;
  fileSha256: string;
  isCurrent: boolean;
  createdAt: string;
}

export interface ProductDto {
  id: string;
  slug: string;
  name: string;
  tagline?: string;
  description: string;
  type: ProductType;
  isPublished: boolean;
  isFeatured: boolean;
  sortOrder: number;
  metadataJson?: Record<string, unknown>;
  prices?: PriceDto[];
  currentRelease?: ProductReleaseDto;
  createdAt: string;
  updatedAt: string;
}

// ─── Cart & Orders ───────────────────────────────────────────

export interface CartItemDto {
  id: string;
  productId: string;
  priceId: string;
  product?: ProductDto;
  price?: PriceDto;
}

export interface CartDto {
  id: string;
  userId: string;
  items: CartItemDto[];
  totalMinorUnits: number;
  currency?: CurrencyCode;
}

export enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export interface OrderItemDto {
  id: string;
  productId: string;
  priceId: string;
  amountMinorUnits: number;
  productName?: string;
}

export interface OrderDto {
  id: string;
  orderNumber: string;
  userId: string;
  status: OrderStatus;
  currency: CurrencyCode;
  totalAmountMinor: number;
  paymentProvider: PaymentProvider;
  providerOrderId?: string;
  providerPaymentId?: string;
  providerInvoiceUrl?: string;
  items: OrderItemDto[];
  createdAt: string;
}

// ─── Entitlements, Licenses & Downloads ───────────────────────

export enum EntitlementType {
  LIFETIME_DOWNLOAD = 'LIFETIME_DOWNLOAD',
  LICENSE_KEY = 'LICENSE_KEY',
  SUBSCRIPTION = 'SUBSCRIPTION',
}

export interface EntitlementDto {
  id: string;
  userId: string;
  productId: string;
  orderId?: string;
  type: EntitlementType;
  isActive: boolean;
  product?: ProductDto;
  createdAt: string;
}

export enum LicenseStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
}

export interface LicenseActivationDto {
  id: string;
  licenseKeyId: string;
  machineHash: string;
  deviceInfo?: string;
  lastPingAt: string;
  createdAt: string;
}

export interface LicenseKeyDto {
  id: string;
  keyMasked: string; // e.g. TOOL-****-****-XXXX
  productId: string;
  userId: string;
  orderId?: string;
  status: LicenseStatus;
  maxActivations: number;
  activationsCount: number;
  expiresAt?: string;
  product?: ProductDto;
  activations?: LicenseActivationDto[];
  createdAt: string;
}

export interface DownloadUrlDto {
  downloadUrl: string;
  expiresAt: string;
  filename: string;
  fileSizeBytes: number;
  fileSha256: string;
}

// ─── Auth & Sessions ─────────────────────────────────────────

export interface AuthUserDto {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  platformRole: PlatformRole;
  emailVerified: boolean;
  defaultOrganizationId?: string;
}

export interface LoginResponseDto {
  accessToken: string;
  user: AuthUserDto;
}

// ─── Conversion Request / Response DTOs ──────────────────────
export interface CreateConversionRequest {
  sourceFileId: string;
  targetFormat: OutputFormat;
  settings?: ConversionOptions;
}

export interface ConversionResponse {
  id: string;
  status: JobStatus;
  progress: number;
  sourceFormat: InputFormat;
  targetFormat: OutputFormat;
  sourceFileName: string;
  outputFileName?: string;
  engine?: string;
  warnings?: string[];
  errorCode?: ErrorCode;
  errorMessage?: string;
  downloadUrl?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

// ─── File Upload DTOs ────────────────────────────────────────

export interface UploadResponse {
  id: string;
  originalFilename: string;
  extension: string;
  mimeType: string;
  sizeBytes: number;
  status: FileStatus;
  createdAt: string;
}

// ─── SSE Event Types ─────────────────────────────────────────

export enum SSEEventType {
  JOB_STATUS = 'job:status',
  JOB_PROGRESS = 'job:progress',
  JOB_COMPLETED = 'job:completed',
  JOB_FAILED = 'job:failed',
  JOB_WARNING = 'job:warning',
}

export interface SSEJobEvent {
  type: SSEEventType;
  jobId: string;
  data: {
    status?: JobStatus;
    progress?: number;
    warnings?: string[];
    errorCode?: ErrorCode;
    errorMessage?: string;
    downloadUrl?: string;
  };
}

// ─── Conversion Event Types ──────────────────────────────────

export enum ConversionEventType {
  CREATED = 'created',
  QUEUED = 'queued',
  STARTED = 'started',
  PROGRESS = 'progress',
  ENGINE_SELECTED = 'engine_selected',
  CONVERSION_STARTED = 'conversion_started',
  CONVERSION_COMPLETED = 'conversion_completed',
  OUTPUT_VALIDATED = 'output_validated',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
  CANCELLED = 'cancelled',
  WARNING = 'warning',
}
