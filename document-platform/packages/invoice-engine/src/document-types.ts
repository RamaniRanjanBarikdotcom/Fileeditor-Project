/**
 * Document-type registry. Every behaviour that differs between invoice kinds
 * is declared here, so a new kind is a registry entry (plus labels and a
 * template), never a schema change. The database stores the id as a string
 * validated against this registry.
 */

export type StockEffect = 'out' | 'in' | 'none';
export type DocumentSide = 'sales' | 'purchase';

export interface DocumentTypeDefinition {
  id: string;
  /** Label key in the template label packs (e.g. "doc.taxInvoice"). */
  labelKey: string;
  side: DocumentSide;
  /** Default numbering prefix; each business can change its series. */
  defaultPrefix: string;
  /** Charges tax (false: bill of supply, delivery challan, quotation without tax…). */
  taxable: boolean;
  /** Stock movement when issued. Credit notes move stock only when marked as a return. */
  stockEffect: StockEffect;
  /** Customer payments can be recorded against it. */
  payable: boolean;
  /** Legal tax document: immutable once issued, corrected only by credit/debit notes. */
  legal: boolean;
  /** Counts toward the "invoices per month" plan limit. */
  meteredAsInvoice: boolean;
  /** Must reference an earlier document of one of these types. */
  referenceTypes?: string[];
  /** Types this document can be converted into (quote → invoice, …). */
  convertsTo: string[];
  defaultTemplate: string;
}

const T = (definition: DocumentTypeDefinition) => definition;

export const DOCUMENT_TYPES: Record<string, DocumentTypeDefinition> = {
  TAX_INVOICE: T({
    id: 'TAX_INVOICE', labelKey: 'doc.taxInvoice', side: 'sales', defaultPrefix: 'INV',
    taxable: true, stockEffect: 'out', payable: true, legal: true, meteredAsInvoice: true,
    convertsTo: ['CREDIT_NOTE', 'DEBIT_NOTE'], defaultTemplate: 'classic',
  }),
  BILL_OF_SUPPLY: T({
    id: 'BILL_OF_SUPPLY', labelKey: 'doc.billOfSupply', side: 'sales', defaultPrefix: 'BOS',
    taxable: false, stockEffect: 'out', payable: true, legal: true, meteredAsInvoice: true,
    convertsTo: ['CREDIT_NOTE'], defaultTemplate: 'gst-detailed',
  }),
  EXPORT_INVOICE: T({
    id: 'EXPORT_INVOICE', labelKey: 'doc.exportInvoice', side: 'sales', defaultPrefix: 'EXP',
    taxable: true, stockEffect: 'out', payable: true, legal: true, meteredAsInvoice: true,
    convertsTo: ['CREDIT_NOTE', 'DEBIT_NOTE'], defaultTemplate: 'classic',
  }),
  PROFORMA: T({
    id: 'PROFORMA', labelKey: 'doc.proforma', side: 'sales', defaultPrefix: 'PRO',
    taxable: true, stockEffect: 'none', payable: false, legal: false, meteredAsInvoice: false,
    convertsTo: ['TAX_INVOICE', 'EXPORT_INVOICE'], defaultTemplate: 'modern',
  }),
  QUOTATION: T({
    id: 'QUOTATION', labelKey: 'doc.quotation', side: 'sales', defaultPrefix: 'QT',
    taxable: true, stockEffect: 'none', payable: false, legal: false, meteredAsInvoice: false,
    convertsTo: ['PROFORMA', 'TAX_INVOICE', 'EXPORT_INVOICE', 'DELIVERY_CHALLAN'], defaultTemplate: 'modern',
  }),
  CREDIT_NOTE: T({
    id: 'CREDIT_NOTE', labelKey: 'doc.creditNote', side: 'sales', defaultPrefix: 'CN',
    taxable: true, stockEffect: 'in', payable: false, legal: true, meteredAsInvoice: false,
    referenceTypes: ['TAX_INVOICE', 'BILL_OF_SUPPLY', 'EXPORT_INVOICE'], convertsTo: [], defaultTemplate: 'classic',
  }),
  DEBIT_NOTE: T({
    id: 'DEBIT_NOTE', labelKey: 'doc.debitNote', side: 'sales', defaultPrefix: 'DN',
    taxable: true, stockEffect: 'none', payable: true, legal: true, meteredAsInvoice: false,
    referenceTypes: ['TAX_INVOICE', 'EXPORT_INVOICE'], convertsTo: [], defaultTemplate: 'classic',
  }),
  DELIVERY_CHALLAN: T({
    id: 'DELIVERY_CHALLAN', labelKey: 'doc.deliveryChallan', side: 'sales', defaultPrefix: 'DC',
    taxable: false, stockEffect: 'out', payable: false, legal: false, meteredAsInvoice: false,
    convertsTo: ['TAX_INVOICE'], defaultTemplate: 'minimal',
  }),
  PAYMENT_RECEIPT: T({
    id: 'PAYMENT_RECEIPT', labelKey: 'doc.paymentReceipt', side: 'sales', defaultPrefix: 'RCT',
    taxable: false, stockEffect: 'none', payable: false, legal: false, meteredAsInvoice: false,
    convertsTo: [], defaultTemplate: 'minimal',
  }),
  PURCHASE_ORDER: T({
    id: 'PURCHASE_ORDER', labelKey: 'doc.purchaseOrder', side: 'purchase', defaultPrefix: 'PO',
    taxable: true, stockEffect: 'none', payable: false, legal: false, meteredAsInvoice: false,
    convertsTo: ['PURCHASE_BILL'], defaultTemplate: 'modern',
  }),
  PURCHASE_BILL: T({
    id: 'PURCHASE_BILL', labelKey: 'doc.purchaseBill', side: 'purchase', defaultPrefix: 'BILL',
    // Stock comes in through goods receipts (or the bill itself when there is no PO).
    taxable: true, stockEffect: 'in', payable: true, legal: false, meteredAsInvoice: false,
    convertsTo: [], defaultTemplate: 'minimal',
  }),
};

export function documentType(id: string): DocumentTypeDefinition {
  const definition = DOCUMENT_TYPES[id];
  if (!definition) throw new RangeError(`Unknown document type "${id}".`);
  return definition;
}

export function isDocumentType(id: unknown): id is string {
  return typeof id === 'string' && Object.hasOwn(DOCUMENT_TYPES, id);
}

export const DOCUMENT_STATUSES = ['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];
