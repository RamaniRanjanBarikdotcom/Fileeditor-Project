import { fetchApi, fetchWithAuth } from '../../../lib/api';

export type Address = { line1?: string; line2?: string; city?: string; postalCode?: string; region?: string };

export type Business = {
  id: string;
  name: string;
  legalName: string | null;
  country: string;
  stateCode: string | null;
  addressJson: Address;
  email: string | null;
  phone: string | null;
  website: string | null;
  taxRegime: 'IN_GST' | 'EU_VAT' | 'GENERIC' | 'NONE';
  taxId: string | null;
  gstComposition: boolean;
  currency: string;
  language: string;
  secondaryLanguage: string | null;
  template: string;
  accentColor: string | null;
  logoStorageKey: string | null;
  signatureStorageKey: string | null;
  bankJson: Record<string, string>;
  paymentQr: 'none' | 'upi' | 'sepa';
  pricesIncludeTax: boolean;
  roundOffTotal: boolean;
  negativeStockPolicy: 'BLOCK' | 'WARN' | 'ALLOW';
  fyStartMonth: number;
  numberingJson: Record<string, string>;
  labelOverridesJson: Record<string, string>;
  defaultNotes: string | null;
  defaultTerms: string | null;
  defaultDueDays: number;
  reminderDaysJson: number[];
  lowStockAlerts: boolean;
};

export type Contact = {
  id: string;
  isCustomer: boolean;
  isSupplier: boolean;
  name: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  country: string;
  stateCode: string | null;
  billingAddressJson: Address;
  taxId: string | null;
  isBusiness: boolean;
  isSez: boolean;
  currency: string | null;
  language: string | null;
  paymentTermsDays: number | null;
  notes: string | null;
};

export type Item = {
  id: string;
  kind: 'GOODS' | 'SERVICES';
  name: string;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  unit: string;
  hsnSac: string | null;
  taxRate: string;
  cessRate: string;
  taxCategory: string;
  salePrice: string;
  purchasePrice: string;
  trackInventory: boolean;
  reorderLevel: string | null;
  averageCost: string;
  onHand?: string;
};

export type Warehouse = { id: string; name: string; code: string | null; isDefault: boolean; businessId: string | null };

export type DocumentTypeDefinition = {
  id: string;
  labelKey: string;
  side: 'sales' | 'purchase';
  taxable: boolean;
  stockEffect: 'out' | 'in' | 'none';
  payable: boolean;
  legal: boolean;
  referenceTypes?: string[];
  convertsTo: string[];
};

export type Meta = {
  documentTypes: DocumentTypeDefinition[];
  templates: Array<{ id: string; name: string; description: string; page: string }>;
  languages: Array<{ code: string; name: string; englishName: string; dir: string }>;
  indiaStates: Array<{ code: string; name: string }>;
  euCountries: Array<{ code: string; name: string; standardRate: string }>;
  gstRates: string[];
};

export type Line = {
  itemId?: string;
  description: string;
  details?: string;
  hsnSac?: string;
  quantity: string;
  unit?: string;
  unitPrice: string;
  discountType?: 'PERCENT' | 'AMOUNT';
  discountValue?: string;
  taxRate?: string;
  cessRate?: string;
  taxCategory?: string;
  supplyKind?: 'GOODS' | 'SERVICES';
  warehouseId?: string;
};

export type DocumentRecord = {
  id: string;
  businessId: string;
  documentType: string;
  status: string;
  number: string | null;
  issueDate: string;
  dueDate: string | null;
  supplyDate: string | null;
  contactId: string | null;
  buyerJson: { name: string; country?: string; stateCode?: string | null; taxId?: string | null; address?: Address };
  placeOfSupplyCountry: string | null;
  placeOfSupplyState: string | null;
  currency: string;
  language: string;
  secondaryLanguage: string | null;
  template: string;
  pricesIncludeTax: boolean;
  reverseCharge: boolean;
  exportWithPayment: boolean;
  euOss: boolean;
  roundOffTotal: boolean;
  reference: string | null;
  notes: string | null;
  terms: string | null;
  referenceDocumentId: string | null;
  returnToStock: boolean;
  warehouseId: string | null;
  grandTotal: string;
  taxTotal: string;
  amountPaid: string;
  stockPosted: boolean;
  version: number;
  voidReason: string | null;
  calculationJson: { grandTotal: string; taxTotal: string; warnings?: string[]; notes?: string[] };
  lines: Array<Line & { id: string; position: number; receivedQuantity: string; taxable: string; total: string; quantity: string; unitPrice: string; taxRate: string; cessRate: string; discountValue: string | null }>;
  payments: Array<{ id: string; paidOn: string; amount: string; method: string; reference: string | null }>;
  referenceDocument: { id: string; number: string | null; documentType: string } | null;
  referencedBy: Array<{ id: string; number: string | null; documentType: string; status: string }>;
};

export const DOCUMENT_LABELS: Record<string, string> = {
  TAX_INVOICE: 'Invoice',
  BILL_OF_SUPPLY: 'Bill of supply',
  EXPORT_INVOICE: 'Export invoice',
  PROFORMA: 'Proforma invoice',
  QUOTATION: 'Quotation',
  CREDIT_NOTE: 'Credit note',
  DEBIT_NOTE: 'Debit note',
  DELIVERY_CHALLAN: 'Delivery challan',
  PAYMENT_RECEIPT: 'Payment receipt',
  PURCHASE_ORDER: 'Purchase order',
  PURCHASE_BILL: 'Purchase bill',
};

export const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  ISSUED: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  PARTIALLY_PAID: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  PAID: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  VOID: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  PARTIALLY_RECEIVED: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  RECEIVED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  CLOSED: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

export function statusLabel(status: string, overdue = false) {
  if (overdue) return 'Overdue';
  return status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ');
}

/** Nest errors are { message: string | string[] }; fetchApi errors are { error: { message } }. */
export function errorMessage(response: unknown, fallback = 'Something went wrong. Please try again.') {
  const body = response as { message?: string | string[]; error?: { message?: string } | string };
  if (Array.isArray(body?.message)) return body.message.join(' ');
  if (typeof body?.message === 'string') return body.message;
  if (body?.error && typeof body.error === 'object' && body.error.message) return body.error.message;
  return fallback;
}

/** fetchApi wrapper that returns data or throws a readable Error. */
export async function api<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetchApi<T>(endpoint, options);
  if (!response?.success) throw new Error(errorMessage(response));
  return response.data as T;
}

export function money(amount: string | number, currency: string, locale?: string) {
  try {
    return new Intl.NumberFormat(locale ?? (currency === 'INR' ? 'en-IN' : undefined), { style: 'currency', currency }).format(
      amount as unknown as number,
    );
  } catch {
    return `${amount} ${currency}`;
  }
}

export function shortDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value));
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/** Downloads a PDF from an authenticated endpoint. */
export function downloadPdf(endpoint: string, fallbackName: string) {
  return downloadFile(endpoint, fallbackName);
}

/** Downloads any file (PDF, Excel, CSV) from an authenticated endpoint. */
export async function downloadFile(endpoint: string, fallbackName: string) {
  const response = await fetchWithAuth(`/api/v1${endpoint}`);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(errorMessage(body, 'The file could not be created.'));
  }
  const name = /filename="([^"]+)"/.exec(response.headers.get('content-disposition') ?? '')?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const COUNTRIES: Array<{ code: string; name: string }> = (() => {
  const codes =
    'AE AR AT AU BD BE BG BR CA CH CL CN CO CY CZ DE DK EE EG ES FI FR GB GR HK HR HU ID IE IL IN IT JP KE KR KW LK LT LU LV MA MT MX MY NG NL NO NP NZ OM PE PH PK PL PT QA RO RU SA SE SG SI SK TH TR TW UA US VN ZA'.split(' ');
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames(['en'], { type: 'region' });
  } catch {
    names = null;
  }
  return codes.map((code) => ({ code, name: names?.of(code) ?? code })).sort((a, b) => a.name.localeCompare(b.name));
})();

export const input =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white';
export const label = 'mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400';
export const primaryButton =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50';
export const secondaryButton =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800';
export const card = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900';
