import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InvBusiness, InvDocument, InvDocumentLine } from '@prisma/client';
import { createHash } from 'crypto';
import {
  INDIA_STATES,
  calculateDocument,
  documentType,
  isEuCountry,
  type CalculationInput,
  type CalculationResult,
  type TaxRegime,
} from '@docconv/invoice-engine';
import { pdfRenderSettings, renderDocument, type PartyBlock, type RenderModel } from '@docconv/invoice-templates';
import { htmlToPdf } from '@docconv/pdf-render';
import { FilesService } from '../files/files.service';
import { addressLines, isoDate } from './invoicing.common';

/** Party details as stored on a document (snapshot). */
export interface PartySnapshot {
  name: string;
  address?: Record<string, string>;
  country?: string;
  stateCode?: string | null;
  taxId?: string | null;
  email?: string | null;
  phone?: string | null;
  isBusiness?: boolean;
  isSez?: boolean;
}

type DocumentFields = Pick<
  InvDocument,
  | 'documentType'
  | 'placeOfSupplyCountry'
  | 'placeOfSupplyState'
  | 'currency'
  | 'pricesIncludeTax'
  | 'reverseCharge'
  | 'exportWithPayment'
  | 'euOss'
  | 'roundOffTotal'
>;

export type CalcLine = Pick<
  InvDocumentLine,
  'quantity' | 'unitPrice' | 'discountType' | 'discountValue' | 'taxRate' | 'cessRate' | 'taxCategory' | 'supplyKind'
>;

export function businessSnapshot(business: InvBusiness): PartySnapshot {
  return {
    name: business.legalName || business.name,
    address: business.addressJson as Record<string, string>,
    country: business.country,
    stateCode: business.stateCode,
    taxId: business.taxId,
    email: business.email,
    phone: business.phone,
    isBusiness: true,
  };
}

/**
 * The one place that turns a document into tax-engine input, so drafts,
 * previews and issuing always calculate the same way. For purchases the
 * supplier is the seller and our business the buyer.
 */
export function calculationFor(
  business: InvBusiness,
  document: DocumentFields,
  counterparty: PartySnapshot,
  lines: CalcLine[],
): CalculationResult {
  const purchase = documentType(document.documentType).side === 'purchase';
  const us = { country: business.country, state: business.stateCode ?? undefined, taxId: business.taxId ?? undefined, isBusiness: true };
  const them = {
    country: counterparty.country ?? business.country,
    state: counterparty.stateCode ?? undefined,
    taxId: counterparty.taxId ?? undefined,
    isBusiness: counterparty.isBusiness ?? Boolean(counterparty.taxId),
    isSez: counterparty.isSez ?? false,
  };
  let regime = business.taxRegime as TaxRegime;
  // Imports into the EU are not invoiced with EU VAT by the foreign supplier.
  if (purchase && regime === 'EU_VAT' && !isEuCountry(them.country)) regime = 'GENERIC';
  const input: CalculationInput = {
    regime,
    currency: document.currency,
    documentType: document.documentType,
    seller: purchase ? them : { ...us, gstComposition: business.gstComposition },
    buyer: purchase ? us : them,
    placeOfSupply: document.placeOfSupplyCountry
      ? { country: document.placeOfSupplyCountry, state: document.placeOfSupplyState ?? undefined }
      : undefined,
    pricesIncludeTax: document.pricesIncludeTax,
    reverseCharge: document.reverseCharge,
    exportWithPayment: document.exportWithPayment,
    euOss: document.euOss,
    roundOffTotal: document.roundOffTotal,
    lines: lines.map((line) => ({
      quantity: line.quantity.toString(),
      unitPrice: line.unitPrice.toString(),
      discount:
        line.discountType && line.discountValue
          ? { type: line.discountType as 'PERCENT' | 'AMOUNT', value: line.discountValue.toString() }
          : undefined,
      taxRate: line.taxRate.toString(),
      cessRate: line.cessRate.toString(),
      taxCategory: line.taxCategory as CalculationInput['lines'][number]['taxCategory'],
      supplyKind: line.supplyKind as 'GOODS' | 'SERVICES',
    })),
  };
  try {
    return calculateDocument(input);
  } catch (error) {
    if (error instanceof RangeError) throw new BadRequestException(error.message);
    throw error;
  }
}

@Injectable()
export class DocumentRenderService {
  private readonly logger = new Logger(DocumentRenderService.name);

  constructor(private readonly files: FilesService) {}

  private async imageDataUri(storageKey: string | null) {
    if (!storageKey) return undefined;
    try {
      const buffer = await this.files.readGeneratedAsset(storageKey);
      const mime = storageKey.endsWith('.png') ? 'image/png' : storageKey.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
      return `data:${mime};base64,${buffer.toString('base64')}`;
    } catch (error) {
      this.logger.warn(`Branding image ${storageKey} could not be loaded: ${(error as Error).message}`);
      return undefined;
    }
  }

  private party(snapshot: PartySnapshot, regime: string, language: string): PartyBlock {
    let region: string | undefined;
    if (snapshot.country === 'IN' && snapshot.stateCode && INDIA_STATES[snapshot.stateCode]) {
      region = `${INDIA_STATES[snapshot.stateCode]!.name} (${snapshot.stateCode})`;
    } else if (snapshot.country) {
      region = countryName(snapshot.country, language);
    }
    return {
      name: snapshot.name,
      address: addressLines(snapshot.address),
      region,
      taxId: snapshot.taxId ?? undefined,
      taxIdKind: snapshot.country === 'IN' && regime === 'IN_GST' ? 'gstin' : isEuCountry(snapshot.country) ? 'vatId' : 'taxId',
      email: snapshot.email ?? undefined,
      phone: snapshot.phone ?? undefined,
    };
  }

  async renderModel(
    business: InvBusiness,
    document: InvDocument & { lines: InvDocumentLine[] },
    options: { showPoweredBy: boolean; originalDocumentNumber?: string },
  ): Promise<RenderModel> {
    const calculation = document.calculationJson as unknown as CalculationResult;
    const seller = document.sellerJson as unknown as PartySnapshot;
    const buyer = document.buyerJson as unknown as PartySnapshot;
    const shipTo = document.shipToJson as unknown as PartySnapshot | null;
    const purchase = documentType(document.documentType).side === 'purchase';
    const placeCountry = document.placeOfSupplyCountry ?? buyer.country;
    const placeState = document.placeOfSupplyState ?? buyer.stateCode;
    const placeOfSupply =
      business.taxRegime === 'IN_GST' && !purchase
        ? placeCountry === 'IN' && placeState && INDIA_STATES[placeState]
          ? `${INDIA_STATES[placeState]!.name} (${placeState})`
          : placeCountry && placeCountry !== 'IN'
            ? countryName(placeCountry, document.language)
            : undefined
        : undefined;
    const [logo, signature] = await Promise.all([
      this.imageDataUri(business.logoStorageKey),
      this.imageDataUri(business.signatureStorageKey),
    ]);
    return {
      documentType: document.documentType,
      status: document.status as RenderModel['status'],
      regime: business.taxRegime as TaxRegime,
      number: document.number ?? undefined,
      issueDate: isoDate(document.issueDate)!,
      dueDate: isoDate(document.dueDate),
      supplyDate: isoDate(document.supplyDate),
      reference: document.reference ?? undefined,
      originalDocumentNumber: options.originalDocumentNumber,
      placeOfSupply,
      reverseCharge: document.reverseCharge,
      currency: document.currency,
      calculation,
      seller: { ...this.party(seller, business.taxRegime, document.language), logoDataUri: logo, signatureDataUri: signature },
      buyer: this.party(buyer, business.taxRegime, document.language),
      shipTo: shipTo ? this.party(shipTo, business.taxRegime, document.language) : undefined,
      lines: document.lines
        .sort((a, b) => a.position - b.position)
        .map((line) => ({
          description: line.description,
          details: line.details ?? undefined,
          hsnSac: line.hsnSac ?? undefined,
          quantity: line.quantity.toString(),
          unit: line.unit ?? undefined,
          unitPrice: line.unitPrice.toString(),
        })),
      notes: document.notes ?? undefined,
      terms: document.terms ?? undefined,
      bank: business.bankJson as RenderModel['bank'],
      paymentQr: business.paymentQr as RenderModel['paymentQr'],
      amountPaid: document.amountPaid.toString(),
      branding: { accent: business.accentColor ?? undefined, showPoweredBy: options.showPoweredBy },
    };
  }

  html(business: InvBusiness, document: InvDocument, model: RenderModel) {
    const overrides = business.labelOverridesJson as Record<string, string>;
    const forLanguage = (language: string) =>
      Object.fromEntries(
        Object.entries(overrides).flatMap(([key, value]) => {
          if (!key.includes(':')) return language === business.language ? [[key, value]] : [];
          const [lang, label] = key.split(':');
          return lang === language ? [[label!, value]] : [];
        }),
      );
    return renderDocument(model, {
      template: document.template,
      language: document.language,
      secondaryLanguage: document.secondaryLanguage ?? undefined,
      labelOverrides: forLanguage(document.language),
      secondaryLabelOverrides: document.secondaryLanguage ? forLanguage(document.secondaryLanguage) : undefined,
      country: business.country,
    });
  }

  pdf(document: InvDocument, html: string) {
    return htmlToPdf(html, { ...pdfRenderSettings(document.template), timeoutMs: 60_000 });
  }

  /** Stores the legal copy of an issued document. */
  async archive(organizationId: string, userId: string, pdf: Buffer) {
    const stored = await this.files.storeGeneratedAsset(organizationId, userId, pdf, 'application/pdf', 'pdf');
    return { storageKey: stored.storageKey, sha256: createHash('sha256').update(pdf).digest('hex') };
  }

  discard(storageKey: string) {
    return this.files.deleteGeneratedAsset(storageKey).catch(() => undefined);
  }

  signedPdfUrl(storageKey: string, filename: string) {
    return this.files.getGeneratedAssetUrl(storageKey, filename);
  }
}

export function countryName(country: string, language: string) {
  try {
    return new Intl.DisplayNames([language, 'en'], { type: 'region' }).of(country) ?? country;
  } catch {
    return country;
  }
}

export function pdfFilename(document: Pick<InvDocument, 'number' | 'documentType' | 'id'>) {
  const base = (document.number ?? `${document.documentType.toLowerCase()}-draft-${document.id.slice(0, 8)}`)
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${base || 'document'}.pdf`;
}
