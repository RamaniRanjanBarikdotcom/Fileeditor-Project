import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as XLSX from 'sheetjs-style';
import { Dec, INDIA_STATES, type CalculationResult, type TaxAmount } from '@docconv/invoice-engine';
import { PrismaService } from '../common/prisma.service';
import { dateOnly, isoDate } from './invoicing.common';
import type { PartySnapshot } from './document-render.service';

/** B2C inter-state invoices above this value are reported individually (B2CL), since August 2024. */
const B2CL_THRESHOLD = Dec.of('100000');

/** GST unit quantity codes (UQC) for common units; anything else is "OTH-OTHERS". */
const UQC: Record<string, string> = {
  pcs: 'PCS-PIECES', pc: 'PCS-PIECES', piece: 'PCS-PIECES', nos: 'NOS-NUMBERS', no: 'NOS-NUMBERS', kg: 'KGS-KILOGRAMS',
  kgs: 'KGS-KILOGRAMS', g: 'GMS-GAMMES', gm: 'GMS-GAMMES', l: 'LTR-LITRES', ltr: 'LTR-LITRES', ml: 'MLT-MILILITRE',
  m: 'MTR-METERS', mtr: 'MTR-METERS', box: 'BOX-BOX', set: 'SET-SETS', pair: 'PRS-PAIRS', dozen: 'DOZ-DOZENS',
  bag: 'BAG-BAGS', btl: 'BTL-BOTTLES', can: 'CAN-CANS', ton: 'TON-TONNES', sqm: 'SQM-SQUARE METERS', unit: 'UNT-UNITS',
};

type Row = Record<string, string | number>;

function gstDate(value: Date) {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(value)
    .replace(/ /g, '-');
}

function placeOfSupply(code?: string | null) {
  return code && INDIA_STATES[code] ? `${code}-${INDIA_STATES[code]!.name}` : '';
}

const num = (value: Dec) => Number(value.toFixed(2));

/** Sum of the GST rate for a line (CGST + SGST, or IGST), cess excluded. */
function gstRate(taxes: TaxAmount[]) {
  return taxes.filter((tax) => tax.code !== 'CESS').reduce((total, tax) => total.add(tax.rate), Dec.ZERO);
}

function cess(taxes: TaxAmount[]) {
  return taxes.filter((tax) => tax.code === 'CESS').reduce((total, tax) => total.add(tax.amount), Dec.ZERO);
}

function workbook(sheets: Record<string, Row[]>) {
  const book = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: 'No data for this period' }]), name.slice(0, 31));
  }
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private async period(organizationId: string, businessId: string, from: string, to: string, regime: string) {
    const business = await this.prisma.invBusiness.findFirst({ where: { id: businessId, organizationId } });
    if (!business) throw new NotFoundException('Business not found.');
    if (business.taxRegime !== regime) throw new BadRequestException(`This report is for ${regime === 'IN_GST' ? 'GST' : 'EU VAT'} businesses.`);
    const start = dateOnly(from);
    const end = dateOnly(to);
    if (end < start) throw new BadRequestException('The period end is before its start.');
    if (end.getTime() - start.getTime() > 400 * 86_400_000) throw new BadRequestException('Choose a period of at most one year.');
    const documents = await this.prisma.invDocument.findMany({
      where: {
        organizationId,
        businessId,
        issueDate: { gte: start, lte: end },
        status: { notIn: ['DRAFT', 'VOID'] },
        documentType: { in: ['TAX_INVOICE', 'EXPORT_INVOICE', 'BILL_OF_SUPPLY', 'CREDIT_NOTE', 'DEBIT_NOTE'] },
      },
      include: { lines: true, referenceDocument: { select: { number: true, issueDate: true } } },
      orderBy: [{ issueDate: 'asc' }, { number: 'asc' }],
    });
    return { business, documents };
  }

  /**
   * GSTR-1 data, one sheet per section with the column headings of the GST
   * portal's offline tool. Review against the current template before filing.
   */
  async gstr1(organizationId: string, businessId: string, from: string, to: string) {
    const { documents } = await this.period(organizationId, businessId, from, to, 'IN_GST');
    const b2b: Row[] = [];
    const b2cl: Row[] = [];
    const exp: Row[] = [];
    const cdnr: Row[] = [];
    const b2cs = new Map<string, { pos: string; rate: Dec; taxable: Dec; cess: Dec }>();
    const hsn = new Map<string, { hsn: string; description: string; uqc: string; quantity: Dec; value: Dec; taxable: Dec; igst: Dec; cgst: Dec; sgst: Dec; cess: Dec; rate: Dec }>();

    for (const document of documents) {
      if (document.documentType === 'BILL_OF_SUPPLY') continue; // reported as nil/exempt, not in these sections
      const calc = document.calculationJson as unknown as CalculationResult;
      const buyer = document.buyerJson as unknown as PartySnapshot;
      const pos = placeOfSupply(document.placeOfSupplyState ?? buyer.stateCode);
      const registered = Boolean(buyer.taxId);
      const note = document.documentType === 'CREDIT_NOTE' || document.documentType === 'DEBIT_NOTE';
      const sign = document.documentType === 'CREDIT_NOTE' ? -1 : 1;

      // Per-rate groups for this document.
      const groups = new Map<string, { rate: Dec; taxable: Dec; cess: Dec }>();
      for (const line of document.lines) {
        const taxes = line.taxesJson as unknown as TaxAmount[];
        const rate = gstRate(taxes);
        const key = rate.toString();
        const group = groups.get(key) ?? { rate, taxable: Dec.ZERO, cess: Dec.ZERO };
        group.taxable = group.taxable.add(line.taxable.toString());
        group.cess = group.cess.add(cess(taxes));
        groups.set(key, group);

        if (line.hsnSac) {
          const hsnKey = `${line.hsnSac}|${rate.toString()}`;
          const entry = hsn.get(hsnKey) ?? {
            hsn: line.hsnSac, description: line.description.slice(0, 30), uqc: line.supplyKind === 'SERVICES' ? 'NA' : (UQC[(line.unit ?? '').toLowerCase()] ?? 'OTH-OTHERS'),
            quantity: Dec.ZERO, value: Dec.ZERO, taxable: Dec.ZERO, igst: Dec.ZERO, cgst: Dec.ZERO, sgst: Dec.ZERO, cess: Dec.ZERO, rate,
          };
          const amount = (code: string) => taxes.filter((tax) => tax.code === code).reduce((total, tax) => total.add(tax.amount), Dec.ZERO).mul(sign);
          entry.quantity = entry.quantity.add(Dec.of(line.quantity.toString()).mul(sign));
          entry.value = entry.value.add(Dec.of(line.total.toString()).mul(sign));
          entry.taxable = entry.taxable.add(Dec.of(line.taxable.toString()).mul(sign));
          entry.igst = entry.igst.add(amount('IGST'));
          entry.cgst = entry.cgst.add(amount('CGST'));
          entry.sgst = entry.sgst.add(amount('SGST')).add(amount('UTGST'));
          entry.cess = entry.cess.add(amount('CESS'));
          hsn.set(hsnKey, entry);
        }
      }

      const value = Dec.of(calc.grandTotal);
      for (const group of groups.values()) {
        if (note) {
          if (!registered) continue; // unregistered notes (CDNUR) are not produced in this version
          cdnr.push({
            'GSTIN/UIN of Recipient': buyer.taxId!, 'Receiver Name': buyer.name, 'Note Number': document.number ?? '',
            'Note Date': gstDate(document.issueDate), 'Note Type': document.documentType === 'CREDIT_NOTE' ? 'C' : 'D',
            'Place Of Supply': pos, 'Reverse Charge': document.reverseCharge ? 'Y' : 'N', 'Note Supply Type': 'Regular B2B',
            'Note Value': num(value), 'Applicable % of Tax Rate': '', Rate: num(group.rate), 'Taxable Value': num(group.taxable), 'Cess Amount': num(group.cess),
          });
        } else if (calc.treatment === 'EXPORT') {
          exp.push({
            'Export Type': document.exportWithPayment ? 'WPAY' : 'WOPAY', 'Invoice Number': document.number ?? '', 'Invoice date': gstDate(document.issueDate),
            'Invoice Value': num(value), 'Port Code': '', 'Shipping Bill Number': '', 'Shipping Bill Date': '',
            Rate: num(group.rate), 'Taxable Value': num(group.taxable), 'Cess Amount': num(group.cess),
          });
        } else if (registered || calc.treatment === 'SEZ') {
          b2b.push({
            'GSTIN/UIN of Recipient': buyer.taxId ?? '', 'Receiver Name': buyer.name, 'Invoice Number': document.number ?? '',
            'Invoice date': gstDate(document.issueDate), 'Invoice Value': num(value), 'Place Of Supply': pos,
            'Reverse Charge': document.reverseCharge ? 'Y' : 'N', 'Applicable % of Tax Rate': '',
            'Invoice Type': calc.treatment === 'SEZ' ? (document.exportWithPayment ? 'SEZ supplies with payment' : 'SEZ supplies without payment') : 'Regular B2B',
            'E-Commerce GSTIN': '', Rate: num(group.rate), 'Taxable Value': num(group.taxable), 'Cess Amount': num(group.cess),
          });
        } else if (calc.treatment === 'INTER_STATE' && value.cmp(B2CL_THRESHOLD) > 0) {
          b2cl.push({
            'Invoice Number': document.number ?? '', 'Invoice date': gstDate(document.issueDate), 'Invoice Value': num(value),
            'Place Of Supply': pos, 'Applicable % of Tax Rate': '', Rate: num(group.rate), 'Taxable Value': num(group.taxable),
            'Cess Amount': num(group.cess), 'E-Commerce GSTIN': '',
          });
        } else {
          const key = `${pos}|${group.rate.toString()}`;
          const entry = b2cs.get(key) ?? { pos, rate: group.rate, taxable: Dec.ZERO, cess: Dec.ZERO };
          entry.taxable = entry.taxable.add(group.taxable);
          entry.cess = entry.cess.add(group.cess);
          b2cs.set(key, entry);
        }
      }
    }

    return workbook({
      b2b,
      b2cl,
      b2cs: [...b2cs.values()].map((entry) => ({
        Type: 'OE', 'Place Of Supply': entry.pos, 'Applicable % of Tax Rate': '', Rate: num(entry.rate),
        'Taxable Value': num(entry.taxable), 'Cess Amount': num(entry.cess), 'E-Commerce GSTIN': '',
      })),
      exp,
      cdnr,
      hsn: [...hsn.values()].map((entry) => ({
        HSN: entry.hsn, Description: entry.description, UQC: entry.uqc, 'Total Quantity': Number(entry.quantity.toFixed(2)),
        'Total Value': num(entry.value), Rate: num(entry.rate), 'Taxable Value': num(entry.taxable), 'Integrated Tax Amount': num(entry.igst),
        'Central Tax Amount': num(entry.cgst), 'State/UT Tax Amount': num(entry.sgst), 'Cess Amount': num(entry.cess),
      })),
    });
  }

  /** EU VAT: totals by treatment and rate, EC Sales List data and OSS sales by country. */
  async vat(organizationId: string, businessId: string, from: string, to: string) {
    const { documents } = await this.period(organizationId, businessId, from, to, 'EU_VAT');
    const summary = new Map<string, { treatment: string; rate: string; taxable: Dec; vat: Dec; currency: string }>();
    const ecSales = new Map<string, { vatId: string; country: string; goods: Dec; services: Dec; currency: string }>();
    const oss = new Map<string, { country: string; rate: string; taxable: Dec; vat: Dec; currency: string }>();
    for (const document of documents) {
      const calc = document.calculationJson as unknown as CalculationResult;
      const buyer = document.buyerJson as unknown as PartySnapshot;
      const sign = document.documentType === 'CREDIT_NOTE' ? -1 : 1;
      for (const tax of calc.taxBreakdown) {
        const key = `${calc.treatment}|${tax.rate}|${document.currency}`;
        const entry = summary.get(key) ?? { treatment: calc.treatment, rate: tax.rate, taxable: Dec.ZERO, vat: Dec.ZERO, currency: document.currency };
        entry.taxable = entry.taxable.add(Dec.of(tax.taxable).mul(sign));
        entry.vat = entry.vat.add(Dec.of(tax.amount).mul(sign));
        summary.set(key, entry);
        if (calc.treatment === 'EU_OSS') {
          const ossKey = `${buyer.country}|${tax.rate}|${document.currency}`;
          const row = oss.get(ossKey) ?? { country: buyer.country ?? '', rate: tax.rate, taxable: Dec.ZERO, vat: Dec.ZERO, currency: document.currency };
          row.taxable = row.taxable.add(Dec.of(tax.taxable).mul(sign));
          row.vat = row.vat.add(Dec.of(tax.amount).mul(sign));
          oss.set(ossKey, row);
        }
      }
      if (calc.treatment === 'INTRA_EU_B2B' && buyer.taxId) {
        const key = `${buyer.taxId}|${document.currency}`;
        const entry = ecSales.get(key) ?? { vatId: buyer.taxId, country: buyer.country ?? '', goods: Dec.ZERO, services: Dec.ZERO, currency: document.currency };
        for (const line of document.lines) {
          const amount = Dec.of(line.taxable.toString()).mul(sign);
          if (line.supplyKind === 'SERVICES') entry.services = entry.services.add(amount);
          else entry.goods = entry.goods.add(amount);
        }
        ecSales.set(key, entry);
      }
    }
    return workbook({
      'VAT summary': [...summary.values()].map((row) => ({ Treatment: row.treatment, 'Rate %': Number(row.rate), Currency: row.currency, 'Taxable amount': num(row.taxable), VAT: num(row.vat) })),
      'EC Sales List': [...ecSales.values()].map((row) => ({ 'Customer VAT ID': row.vatId, Country: row.country, Currency: row.currency, Goods: num(row.goods), Services: num(row.services) })),
      OSS: [...oss.values()].map((row) => ({ Country: row.country, 'Rate %': Number(row.rate), Currency: row.currency, 'Taxable amount': num(row.taxable), VAT: num(row.vat) })),
    });
  }

  /** Unpaid sales documents by customer and age past their due date. */
  async receivables(organizationId: string) {
    const open = await this.prisma.invDocument.findMany({
      where: { organizationId, status: { in: ['ISSUED', 'PARTIALLY_PAID'] }, documentType: { in: ['TAX_INVOICE', 'BILL_OF_SUPPLY', 'EXPORT_INVOICE', 'DEBIT_NOTE'] } },
      select: { id: true, number: true, contactId: true, buyerJson: true, currency: true, grandTotal: true, amountPaid: true, dueDate: true, issueDate: true },
    });
    const today = dateOnly(new Date().toISOString());
    const buckets = ['current', '1-30', '31-60', '61-90', '90+'] as const;
    const rows = new Map<string, { contactId: string | null; name: string; currency: string } & Record<(typeof buckets)[number] | 'total', Dec>>();
    for (const document of open) {
      const due = document.dueDate ?? document.issueDate;
      const days = Math.floor((today.getTime() - due.getTime()) / 86_400_000);
      const bucket = days <= 0 ? 'current' : days <= 30 ? '1-30' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : '90+';
      const name = (document.buyerJson as unknown as PartySnapshot).name;
      const key = `${document.contactId ?? name}|${document.currency}`;
      const row = rows.get(key) ?? {
        contactId: document.contactId, name, currency: document.currency, current: Dec.ZERO, '1-30': Dec.ZERO, '31-60': Dec.ZERO, '61-90': Dec.ZERO, '90+': Dec.ZERO, total: Dec.ZERO,
      };
      const balance = Dec.of(document.grandTotal.toString()).sub(document.amountPaid.toString());
      row[bucket] = row[bucket].add(balance);
      row.total = row.total.add(balance);
      rows.set(key, row);
    }
    return [...rows.values()]
      .sort((a, b) => b.total.cmp(a.total))
      .map((row) => ({
        contactId: row.contactId, name: row.name, currency: row.currency,
        ...Object.fromEntries([...buckets, 'total'].map((bucket) => [bucket, row[bucket as 'total'].toFixed(2)])),
      }));
  }

  /** "2026-10" style helper for default periods. */
  static monthRange(month?: string) {
    const match = /^(\d{4})-(\d{2})$/.exec(month ?? '');
    const now = new Date();
    const year = match ? Number(match[1]) : now.getUTCFullYear();
    const index = match ? Number(match[2]) - 1 : now.getUTCMonth();
    return {
      from: isoDate(new Date(Date.UTC(year, index, 1)))!,
      to: isoDate(new Date(Date.UTC(year, index + 1, 0)))!,
    };
  }
}
