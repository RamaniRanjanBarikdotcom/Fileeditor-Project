import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** Plain decimal strings (never floats): up to 14 integer and 4 fraction digits. */
const DECIMAL = /^\d{1,14}(\.\d{1,4})?$/;
const SIGNED_DECIMAL = /^-?\d{1,14}(\.\d{1,4})?$/;
const RATE = /^\d{1,3}(\.\d{1,4})?$/;
const COUNTRY = /^[A-Z]{2}$/;
const STATE = /^\d{2}$/;

export const TAX_REGIMES = ['IN_GST', 'EU_VAT', 'GENERIC', 'NONE'] as const;
export const TAX_CATEGORIES = ['STANDARD', 'ZERO', 'EXEMPT', 'NON_TAXABLE'] as const;
export const SUPPLY_KINDS = ['GOODS', 'SERVICES'] as const;
export const PAYMENT_METHODS = ['CASH', 'BANK', 'UPI', 'CARD', 'CHEQUE', 'OTHER'] as const;

export class AddressDto {
  @IsOptional() @IsString() @MaxLength(200) line1?: string;
  @IsOptional() @IsString() @MaxLength(200) line2?: string;
  @IsOptional() @IsString() @MaxLength(100) city?: string;
  @IsOptional() @IsString() @MaxLength(20) postalCode?: string;
  @IsOptional() @IsString() @MaxLength(100) region?: string;
}

export class BankDto {
  @IsOptional() @IsString() @MaxLength(120) accountName?: string;
  @IsOptional() @IsString() @MaxLength(40) accountNumber?: string;
  @IsOptional() @IsString() @MaxLength(120) bankName?: string;
  @IsOptional() @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, { message: 'IFSC looks like HDFC0001234.' }) ifsc?: string;
  @IsOptional() @Matches(/^[A-Z]{2}\d{2}[A-Z0-9 ]{11,40}$/, { message: 'That is not a valid IBAN.' }) iban?: string;
  @IsOptional() @Matches(/^[A-Z0-9]{8}([A-Z0-9]{3})?$/, { message: 'BIC has 8 or 11 characters.' }) bic?: string;
  @IsOptional() @Matches(/^[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}$/, { message: 'UPI ID looks like shop@okbank.' }) upiId?: string;
}

/** Create and update share this DTO; required fields are enforced on create. */
export class BusinessDto {
  @IsOptional() @IsString() @MaxLength(160) name?: string;
  @IsOptional() @IsString() @MaxLength(200) legalName?: string;
  @IsOptional() @Matches(COUNTRY) country?: string;
  @IsOptional() @Matches(STATE) stateCode?: string;
  @IsOptional() @ValidateNested() @Type(() => AddressDto) address?: AddressDto;
  @IsOptional() @IsEmail() @MaxLength(200) email?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(200) website?: string;
  @IsOptional() @IsIn(TAX_REGIMES) taxRegime?: (typeof TAX_REGIMES)[number];
  @IsOptional() @IsString() @MaxLength(30) taxId?: string;
  @IsOptional() @IsBoolean() gstComposition?: boolean;
  @IsOptional() @Matches(/^[A-Z]{3}$/) currency?: string;
  @IsOptional() @IsString() @MaxLength(35) language?: string;
  @IsOptional() @IsString() @MaxLength(35) secondaryLanguage?: string | null;
  @IsOptional() @IsString() @MaxLength(40) template?: string;
  @IsOptional() @Matches(/^#[0-9a-fA-F]{6}$/) accentColor?: string;
  @IsOptional() @IsUUID() logoFileId?: string | null;
  @IsOptional() @IsUUID() signatureFileId?: string | null;
  @IsOptional() @ValidateNested() @Type(() => BankDto) bank?: BankDto;
  @IsOptional() @IsIn(['none', 'upi', 'sepa']) paymentQr?: 'none' | 'upi' | 'sepa';
  @IsOptional() @IsBoolean() pricesIncludeTax?: boolean;
  @IsOptional() @IsBoolean() roundOffTotal?: boolean;
  @IsOptional() @IsIn(['BLOCK', 'WARN', 'ALLOW']) negativeStockPolicy?: 'BLOCK' | 'WARN' | 'ALLOW';
  @IsOptional() @IsInt() @Min(1) @Max(12) fyStartMonth?: number;
  @IsOptional() @IsObject() numbering?: Record<string, string>;
  @IsOptional() @IsObject() labelOverrides?: Record<string, string>;
  @IsOptional() @IsString() @MaxLength(4000) defaultNotes?: string;
  @IsOptional() @IsString() @MaxLength(8000) defaultTerms?: string;
  @IsOptional() @IsInt() @Min(0) @Max(365) defaultDueDays?: number;
  /** Days after the due date on which reminders are emailed (empty = none). */
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsInt({ each: true }) @Min(1, { each: true }) @Max(365, { each: true })
  reminderDays?: number[];
  @IsOptional() @IsBoolean() lowStockAlerts?: boolean;
}

export class ContactDto {
  @IsOptional() @IsBoolean() isCustomer?: boolean;
  @IsOptional() @IsBoolean() isSupplier?: boolean;
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(200) legalName?: string;
  @IsOptional() @IsEmail() @MaxLength(200) email?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @Matches(COUNTRY) country?: string;
  @IsOptional() @Matches(STATE) stateCode?: string | null;
  @IsOptional() @ValidateNested() @Type(() => AddressDto) billingAddress?: AddressDto;
  @IsOptional() @ValidateNested() @Type(() => AddressDto) shippingAddress?: AddressDto | null;
  @IsOptional() @IsString() @MaxLength(30) taxId?: string | null;
  @IsOptional() @IsBoolean() isBusiness?: boolean;
  @IsOptional() @IsBoolean() isSez?: boolean;
  @IsOptional() @Matches(/^[A-Z]{3}$/) currency?: string | null;
  @IsOptional() @IsString() @MaxLength(35) language?: string | null;
  @IsOptional() @IsInt() @Min(0) @Max(365) paymentTermsDays?: number | null;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string | null;
}

export class ItemDto {
  @IsOptional() @IsIn(SUPPLY_KINDS) kind?: (typeof SUPPLY_KINDS)[number];
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string | null;
  @IsOptional() @IsString() @MaxLength(64) sku?: string | null;
  @IsOptional() @IsString() @MaxLength(64) barcode?: string | null;
  @IsOptional() @IsString() @MaxLength(16) unit?: string;
  @IsOptional() @Matches(/^\d{2,10}$/, { message: 'HSN/SAC codes are 2 to 10 digits.' }) hsnSac?: string | null;
  @IsOptional() @Matches(RATE) taxRate?: string;
  @IsOptional() @Matches(RATE) cessRate?: string;
  @IsOptional() @IsIn(TAX_CATEGORIES) taxCategory?: (typeof TAX_CATEGORIES)[number];
  @IsOptional() @Matches(DECIMAL) salePrice?: string;
  @IsOptional() @Matches(DECIMAL) purchasePrice?: string;
  @IsOptional() @IsBoolean() trackInventory?: boolean;
  @IsOptional() @Matches(DECIMAL) reorderLevel?: string | null;
}

export class PartyDto {
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @ValidateNested() @Type(() => AddressDto) address?: AddressDto;
  @IsOptional() @Matches(COUNTRY) country?: string;
  @IsOptional() @Matches(STATE) stateCode?: string;
  @IsOptional() @IsString() @MaxLength(30) taxId?: string;
  @IsOptional() @IsEmail() @MaxLength(200) email?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsBoolean() isBusiness?: boolean;
  @IsOptional() @IsBoolean() isSez?: boolean;
}

export class DocumentLineDto {
  @IsOptional() @IsUUID() itemId?: string;
  @IsString() @MaxLength(500) description!: string;
  @IsOptional() @IsString() @MaxLength(2000) details?: string;
  @IsOptional() @Matches(/^\d{2,10}$/) hsnSac?: string;
  @Matches(DECIMAL) quantity!: string;
  @IsOptional() @IsString() @MaxLength(16) unit?: string;
  @Matches(DECIMAL) unitPrice!: string;
  @IsOptional() @IsIn(['PERCENT', 'AMOUNT']) discountType?: 'PERCENT' | 'AMOUNT';
  @IsOptional() @Matches(DECIMAL) discountValue?: string;
  @IsOptional() @Matches(RATE) taxRate?: string;
  @IsOptional() @Matches(RATE) cessRate?: string;
  @IsOptional() @IsIn(TAX_CATEGORIES) taxCategory?: (typeof TAX_CATEGORIES)[number];
  @IsOptional() @IsIn(SUPPLY_KINDS) supplyKind?: (typeof SUPPLY_KINDS)[number];
  @IsOptional() @IsUUID() warehouseId?: string;
}

export class SaveDocumentDto {
  @IsUUID() businessId!: string;
  @IsString() @MaxLength(40) documentType!: string;
  @IsISO8601({ strict: true }) issueDate!: string;
  @IsOptional() @IsISO8601({ strict: true }) dueDate?: string | null;
  @IsOptional() @IsISO8601({ strict: true }) supplyDate?: string | null;
  @IsOptional() @IsUUID() contactId?: string | null;
  /** One-off customer details, or overrides for the selected contact. */
  @IsOptional() @ValidateNested() @Type(() => PartyDto) buyer?: PartyDto;
  @IsOptional() @ValidateNested() @Type(() => PartyDto) shipTo?: PartyDto | null;
  @IsOptional() @Matches(COUNTRY) placeOfSupplyCountry?: string;
  @IsOptional() @Matches(STATE) placeOfSupplyState?: string;
  @IsOptional() @Matches(/^[A-Z]{3}$/) currency?: string;
  @IsOptional() @IsString() @MaxLength(35) language?: string;
  @IsOptional() @IsString() @MaxLength(35) secondaryLanguage?: string | null;
  @IsOptional() @IsString() @MaxLength(40) template?: string;
  @IsOptional() @IsBoolean() pricesIncludeTax?: boolean;
  @IsOptional() @IsBoolean() reverseCharge?: boolean;
  @IsOptional() @IsBoolean() exportWithPayment?: boolean;
  @IsOptional() @IsBoolean() euOss?: boolean;
  @IsOptional() @IsBoolean() roundOffTotal?: boolean;
  @IsOptional() @IsString() @MaxLength(80) reference?: string | null;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string | null;
  @IsOptional() @IsString() @MaxLength(8000) terms?: string | null;
  @IsOptional() @IsUUID() referenceDocumentId?: string | null;
  @IsOptional() @IsBoolean() returnToStock?: boolean;
  @IsOptional() @IsUUID() warehouseId?: string | null;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => DocumentLineDto)
  lines!: DocumentLineDto[];
  /** Optimistic concurrency: the version the editor loaded. */
  @IsOptional() @IsInt() @Min(1) version?: number;
}

export class IssueDocumentDto {
  @IsOptional() @Matches(/^[A-Za-z0-9_-]{8,80}$/) idempotencyKey?: string;
}

export class VoidDocumentDto {
  @IsString() @MaxLength(500) reason!: string;
}

export class ConvertDocumentDto {
  @IsString() @MaxLength(40) targetType!: string;
}

export class PaymentDto {
  @IsISO8601({ strict: true }) paidOn!: string;
  @Matches(DECIMAL) amount!: string;
  @IsIn(PAYMENT_METHODS) method!: (typeof PAYMENT_METHODS)[number];
  @IsOptional() @IsString() @MaxLength(80) reference?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class ShareLinkDto {
  @IsOptional() @IsInt() @Min(1) @Max(365) expiresInDays?: number;
}

export class EmailDocumentDto {
  @IsEmail() @MaxLength(200) to!: string;
  @IsOptional() @IsString() @MaxLength(2000) message?: string;
}

export class WarehouseDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(20) code?: string | null;
  @IsOptional() @IsUUID() businessId?: string | null;
  @IsOptional() @ValidateNested() @Type(() => AddressDto) address?: AddressDto;
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class StockAdjustmentDto {
  @IsUUID() itemId!: string;
  @IsUUID() warehouseId!: string;
  /** Signed change, e.g. "-2" for breakage or "10" for found stock. */
  @Matches(SIGNED_DECIMAL) quantity!: string;
  @IsOptional() @Matches(DECIMAL) unitCost?: string;
  @IsIn(['OPENING', 'ADJUSTMENT']) type!: 'OPENING' | 'ADJUSTMENT';
  @IsString() @MaxLength(300) reason!: string;
}

export class StockTransferDto {
  @IsUUID() itemId!: string;
  @IsUUID() fromWarehouseId!: string;
  @IsUUID() toWarehouseId!: string;
  @Matches(DECIMAL) quantity!: string;
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

export class GoodsReceiptLineDto {
  @IsUUID() itemId!: string;
  @IsOptional() @IsUUID() purchaseOrderLineId?: string;
  @Matches(DECIMAL) quantity!: string;
  @Matches(DECIMAL) unitCost!: string;
}

export class GoodsReceiptDto {
  @IsOptional() @IsUUID() purchaseOrderId?: string;
  @IsUUID() warehouseId!: string;
  @IsISO8601({ strict: true }) receivedOn!: string;
  @IsOptional() @IsString() @MaxLength(80) supplierRef?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => GoodsReceiptLineDto)
  lines!: GoodsReceiptLineDto[];
}

export const RECURRING_FREQUENCIES = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'] as const;

export class RecurringProfileDto {
  @IsOptional() @IsUUID() sourceDocumentId?: string;
  @IsOptional() @IsIn(RECURRING_FREQUENCIES) frequency?: (typeof RECURRING_FREQUENCIES)[number];
  @IsOptional() @IsISO8601({ strict: true }) startOn?: string;
  @IsOptional() @IsISO8601({ strict: true }) endOn?: string | null;
  @IsOptional() @IsBoolean() autoIssue?: boolean;
  @IsOptional() @IsEmail() @MaxLength(200) emailTo?: string | null;
  @IsOptional() @IsBoolean() active?: boolean;
}
