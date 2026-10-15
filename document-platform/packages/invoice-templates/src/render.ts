import { Dec, documentType, type CalculationResult, type TaxRegime } from '@docconv/invoice-engine';
import { amountInWords } from './amount-in-words';
import { createFormatter } from './format';
import { languageInfo, resolveLabels, type LabelKey, type LabelPack } from './labels';
import { epcPaymentPayload, qrDataUri, upiPaymentUri } from './payment-qr';
import { BASE_CSS, pageGeometry, template, type PageSize } from './templates';

export interface PartyBlock {
  name: string;
  /** Free-form address lines (street, city, postcode…). */
  address?: string[];
  /** Country / state as text for display. */
  region?: string;
  taxId?: string;
  /** Which label the tax id uses. */
  taxIdKind?: 'gstin' | 'vatId' | 'taxId';
  email?: string;
  phone?: string;
}

export interface RenderLine {
  description: string;
  details?: string;
  hsnSac?: string;
  quantity: string;
  unit?: string;
  unitPrice: string;
}

export interface RenderModel {
  documentType: string;
  status: 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'VOID';
  regime: TaxRegime;
  number?: string;
  issueDate: string;
  dueDate?: string;
  supplyDate?: string;
  reference?: string;
  originalDocumentNumber?: string;
  placeOfSupply?: string;
  reverseCharge?: boolean;
  currency: string;
  calculation: CalculationResult;
  seller: PartyBlock & { logoDataUri?: string; signatureDataUri?: string };
  buyer: PartyBlock;
  shipTo?: PartyBlock;
  /** Same order and length as calculation.lines. */
  lines: RenderLine[];
  notes?: string;
  terms?: string;
  bank?: {
    accountName?: string;
    accountNumber?: string;
    bankName?: string;
    ifsc?: string;
    iban?: string;
    bic?: string;
    upiId?: string;
  };
  /** Payment QR printed on the document (amount = balance due). */
  paymentQr?: 'upi' | 'sepa' | 'none';
  amountPaid?: string;
  branding?: { accent?: string; showPoweredBy?: boolean };
}

export interface RenderOptions {
  template: string;
  language: string;
  /** Bilingual documents: every label also shown in this language. */
  secondaryLanguage?: string;
  labelOverrides?: Partial<Record<string, string>>;
  secondaryLabelOverrides?: Partial<Record<string, string>>;
  digits?: 'latn' | 'native';
  /** Override the template's paper size (A4 ↔ Letter). */
  pageSize?: Extract<PageSize, 'A4' | 'Letter'>;
  /** Country used for number/date conventions. */
  country?: string;
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapes text for HTML element content and quoted attributes. */
export function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ESCAPES[character]!);
}

/** Only image data URIs may reach the document (no remote fetches, no SVG scripts via URLs). */
function safeImage(uri: string | undefined): string | null {
  if (!uri) return null;
  return /^data:image\/(png|jpeg|webp|gif|svg\+xml)(;charset=utf-8)?(;base64)?,[A-Za-z0-9+/=%._~!$&'()*,;:@-]+$/i.test(uri)
    ? uri
    : null;
}

function safeColour(value: string | undefined, fallback: string) {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function tint(hex: string, alpha: number) {
  const [r, g, b] = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export async function renderDocument(model: RenderModel, options: RenderOptions): Promise<string> {
  const definition = template(options.template);
  const language = languageInfo(options.language);
  const secondary = options.secondaryLanguage ? languageInfo(options.secondaryLanguage) : null;
  const labels = resolveLabels(language.code, options.labelOverrides);
  const secondaryLabels: LabelPack | null = secondary ? resolveLabels(secondary.code, options.secondaryLabelOverrides) : null;
  const f = createFormatter({ language: language.code, country: options.country, digits: options.digits });
  const money = (amount: string) => esc(f.money(amount, model.currency));
  const calc = model.calculation;
  const type = documentType(model.documentType);

  /** Label text (escaped), with the second language under it when bilingual. */
  const t = (key: LabelKey, vars: Record<string, string> = {}) => {
    const fill = (text: string) => text.replace(/\{(\w+)\}/g, (_m, name: string) => vars[name] ?? '');
    const primary = esc(fill(labels[key]));
    if (!secondaryLabels || secondaryLabels[key] === labels[key]) return primary;
    return `${primary}<span class="l2" lang="${esc(secondary!.code)}" dir="${secondary!.dir}">${esc(fill(secondaryLabels[key]))}</span>`;
  };
  /** Inline variant ("Primary / Secondary") for labels inside running text. */
  const ti = (key: LabelKey, vars: Record<string, string> = {}) => {
    const fill = (text: string) => text.replace(/\{(\w+)\}/g, (_m, name: string) => vars[name] ?? '');
    const primary = esc(fill(labels[key]));
    if (!secondaryLabels || secondaryLabels[key] === labels[key]) return primary;
    return `${primary} / <span lang="${esc(secondary!.code)}" dir="${secondary!.dir}">${esc(fill(secondaryLabels[key]))}</span>`;
  };
  const taxName = (code: string) => {
    const key = `tax.${code}` as LabelKey;
    return labels[key] ? t(key) : esc(code);
  };

  // Outside India a "tax invoice" is simply an invoice.
  const titleKey = (type.id === 'TAX_INVOICE' && model.regime !== 'IN_GST' ? 'doc.invoice' : type.labelKey) as LabelKey;
  const accent = safeColour(model.branding?.accent, '#3451c7');
  const page = pageGeometry(options.pageSize && !definition.singlePage ? options.pageSize : definition.page);
  const thermal = Boolean(definition.singlePage);
  const showHsn = model.regime === 'IN_GST' || model.lines.some((line) => line.hsnSac);
  const taxCodes = [...new Set(calc.lines.flatMap((line) => line.taxes.map((tax) => tax.code)))];
  const anyDiscount = calc.lines.some((line) => !Dec.of(line.discount).isZero());
  const balance = Dec.of(calc.grandTotal).sub(model.amountPaid ?? '0');
  const taxIdLabel = (party: PartyBlock) =>
    party.taxId ? `<div class="taxid">${ti(`field.${party.taxIdKind ?? 'taxId'}` as LabelKey)}: ${u(party.taxId)}</div>` : '';

  // ── Header ─────────────────────────────────────────────────
  const logo = safeImage(model.seller.logoDataUri);
  const metaRows: Array<[LabelKey, string]> = [];
  if (model.number) metaRows.push(['field.number', u(model.number)]);
  metaRows.push(['field.date', esc(f.date(model.issueDate))]);
  if (model.dueDate && type.payable) metaRows.push(['field.dueDate', esc(f.date(model.dueDate))]);
  if (model.supplyDate && model.supplyDate !== model.issueDate) metaRows.push(['field.supplyDate', esc(f.date(model.supplyDate))]);
  if (model.originalDocumentNumber) metaRows.push(['field.originalDocument', u(model.originalDocumentNumber)]);
  if (model.reference) metaRows.push(['field.reference', u(model.reference)]);
  if (model.placeOfSupply) metaRows.push(['field.placeOfSupply', u(model.placeOfSupply)]);
  if (model.regime === 'IN_GST' && type.legal && type.taxable) {
    metaRows.push(['field.reverseCharge', t(model.reverseCharge ? 'field.yes' : 'field.no')]);
  }
  const header = `
    ${definition.letterhead ? '<div class="letterhead-space"></div>' : ''}
    <header class="header">
      <div class="seller">
        ${logo ? `<img class="logo" src="${esc(logo)}" alt="">` : ''}
        <p class="seller-name">${u(model.seller.name)}</p>
        ${partyLines(model.seller)}
        ${taxIdLabel(model.seller)}
        ${contact(model.seller, ti)}
      </div>
      <div>
        <h1 class="title">${t(titleKey)}</h1>
        <table class="meta"><tbody>
          ${metaRows.map(([key, value]) => `<tr><th>${t(key)}</th><td>${value}</td></tr>`).join('')}
        </tbody></table>
      </div>
    </header>`;

  // ── Parties ────────────────────────────────────────────────
  const partyBox = (key: LabelKey, party: PartyBlock) => `
    <section class="party">
      <h3>${t(key)}</h3>
      <div class="name">${u(party.name)}</div>
      ${partyLines(party)}
      ${taxIdLabel(party)}
      ${contact(party, ti)}
    </section>`;
  const buyerKey: LabelKey = type.side === 'purchase' ? 'field.supplier' : 'field.billTo';
  const parties = `<div class="parties">${partyBox(buyerKey, model.buyer)}${model.shipTo ? partyBox('field.shipTo', model.shipTo) : ''}</div>`;

  // ── Lines ──────────────────────────────────────────────────
  const zeroReason = (reason?: string) => (reason ? `<span class="small muted">${t(reason as LabelKey)}</span>` : '');
  type Head = { html: string; num?: boolean };
  let head: Head[];
  let rows: string[];
  if (thermal) {
    head = [{ html: t('col.description') }, { html: t('col.amount'), num: true }];
    rows = model.lines.map((line, index) => {
      const result = calc.lines[index]!;
      return `<tr><td>${u(line.description)}<div class="small muted">${esc(f.number(line.quantity))} × ${money(line.unitPrice)}</div></td>
        <td class="num">${money(result.taxable)}</td></tr>`;
    });
  } else {
    head = [
      { html: t('col.index'), num: true },
      { html: t('col.description') },
      ...(showHsn ? [{ html: t('col.hsnSac') }] : []),
      { html: t('col.quantity'), num: true },
      { html: t('col.unitPrice'), num: true },
      ...(anyDiscount ? [{ html: t('col.discount'), num: true }] : []),
      ...(definition.splitTaxColumns ? [{ html: t('col.taxable'), num: true }] : []),
      ...(definition.splitTaxColumns
        ? taxCodes.map((code) => ({ html: taxName(code), num: true }))
        : type.taxable && model.regime !== 'NONE'
          ? [{ html: t('col.taxRate'), num: true }]
          : []),
      { html: t('col.amount'), num: true },
    ];
    rows = model.lines.map((line, index) => {
      const result = calc.lines[index]!;
      const taxCells = definition.splitTaxColumns
        ? taxCodes.map((code) => {
            const tax = result.taxes.find((entry) => entry.code === code);
            return tax
              ? `<td class="num">${money(tax.amount)}<div class="small muted">${esc(f.percent(tax.rate))}</div></td>`
              : `<td class="num">${zeroReason(result.zeroReason) || '–'}</td>`;
          })
        : type.taxable && model.regime !== 'NONE'
          ? [`<td class="num">${result.taxes.length
              ? esc(f.percent(result.taxes.reduce((total, tax) => total.add(tax.rate), Dec.ZERO).toString()))
              : zeroReason(result.zeroReason) || esc(f.percent('0'))}</td>`]
          : [];
      return `<tr>
        <td class="num">${index + 1}</td>
        <td>${u(line.description)}${line.details ? `<div class="details">${u(line.details)}</div>` : ''}</td>
        ${showHsn ? `<td>${u(line.hsnSac ?? '')}</td>` : ''}
        <td class="num">${esc(f.number(line.quantity))}${line.unit ? ` <span class="muted small">${esc(line.unit)}</span>` : ''}</td>
        <td class="num">${money(line.unitPrice)}</td>
        ${anyDiscount ? `<td class="num">${Dec.of(result.discount).isZero() ? '–' : money(result.discount)}</td>` : ''}
        ${definition.splitTaxColumns ? `<td class="num">${money(result.taxable)}</td>` : ''}
        ${taxCells.join('')}
        <td class="num">${money(definition.splitTaxColumns ? result.total : result.taxable)}</td>
      </tr>`;
    });
  }
  const lineTable = `<table class="lines"><thead><tr>${head.map((cell) => `<th${cell.num ? ' class="num"' : ''}>${cell.html}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`;

  // ── Totals ─────────────────────────────────────────────────
  const totals: string[] = [];
  const totalRow = (label: string, value: string, cls = '') => `<tr class="${cls}"><td>${label}</td><td class="num">${value}</td></tr>`;
  if (!Dec.of(calc.discountTotal).isZero()) {
    totals.push(totalRow(t('total.subtotal'), money(calc.subtotal)));
    totals.push(totalRow(t('total.discount'), `−${money(calc.discountTotal)}`));
  }
  totals.push(totalRow(t(calc.taxBreakdown.length ? 'total.taxable' : 'total.subtotal'), money(calc.taxableTotal)));
  if (Dec.of(calc.reverseChargeTaxTotal).isZero()) {
    for (const tax of calc.taxBreakdown) {
      if (Dec.of(tax.amount).isZero()) continue;
      totals.push(totalRow(`${taxName(tax.code)} ${esc(f.percent(tax.rate))}`, money(tax.amount)));
    }
  }
  if (!Dec.of(calc.roundOff).isZero()) totals.push(totalRow(t('total.roundOff'), money(calc.roundOff)));
  totals.push(totalRow(t('total.grandTotal'), money(calc.grandTotal), 'grand'));
  if (model.amountPaid && !Dec.of(model.amountPaid).isZero()) {
    totals.push(totalRow(t('total.amountPaid'), money(model.amountPaid)));
    totals.push(totalRow(`<strong>${t('total.balanceDue')}</strong>`, `<strong>${money(balance.toFixed(calc.scale))}</strong>`));
  }
  if (!Dec.of(calc.reverseChargeTaxTotal).isZero()) {
    const parts = calc.taxBreakdown.filter((tax) => !Dec.of(tax.amount).isZero())
      .map((tax) => `${taxName(tax.code)} ${esc(f.percent(tax.rate))}: ${money(tax.amount)}`).join(', ');
    totals.push(`<tr><td colspan="2" class="small muted">${t('total.reverseChargeTax')}: ${money(calc.reverseChargeTaxTotal)} (${parts})</td></tr>`);
  }
  const words = amountInWords(calc.grandTotal, model.currency, language.code, options.country);

  // ── Summaries ──────────────────────────────────────────────
  const blocks: string[] = [];
  if (definition.hsnSummary && model.regime === 'IN_GST' && calc.taxBreakdown.length) {
    const groups = new Map<string, { hsn: string; taxable: Dec; taxes: Map<string, Dec> }>();
    model.lines.forEach((line, index) => {
      const result = calc.lines[index]!;
      const hsn = line.hsnSac || '—';
      const group = groups.get(hsn) ?? { hsn, taxable: Dec.ZERO, taxes: new Map<string, Dec>() };
      group.taxable = group.taxable.add(result.taxable);
      for (const tax of result.taxes) group.taxes.set(tax.code, (group.taxes.get(tax.code) ?? Dec.ZERO).add(tax.amount));
      groups.set(hsn, group);
    });
    blocks.push(`<div class="box"><h4>${t('col.hsnSac')}</h4><table class="summary"><thead><tr>
      <th>${t('col.hsnSac')}</th><th class="num">${t('col.taxable')}</th>${taxCodes.map((code) => `<th class="num">${taxName(code)}</th>`).join('')}
      </tr></thead><tbody>${[...groups.values()].map((group) => `<tr><td>${esc(group.hsn)}</td><td class="num">${money(group.taxable.toFixed(calc.scale))}</td>${taxCodes
        .map((code) => `<td class="num">${money((group.taxes.get(code) ?? Dec.ZERO).toFixed(calc.scale))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
  } else if (definition.taxSummary && calc.taxBreakdown.length > 1) {
    blocks.push(`<div class="box"><h4>${t('total.taxSummary')}</h4><table class="summary"><thead><tr>
      <th>${t('col.tax')}</th><th class="num">${t('col.taxable')}</th><th class="num">${t('col.amount')}</th></tr></thead><tbody>
      ${calc.taxBreakdown.map((tax) => `<tr><td>${taxName(tax.code)} ${esc(f.percent(tax.rate))}</td><td class="num">${money(tax.taxable)}</td><td class="num">${money(tax.amount)}</td></tr>`).join('')}
      </tbody></table></div>`);
  }
  const legal = calc.notes.length
    ? `<div class="legal">${calc.notes.map((note) => `<div>${t(note as LabelKey)}</div>`).join('')}</div>`
    : '';
  if (model.notes) blocks.push(`<div class="box"><h4>${t('section.notes')}</h4><div style="white-space:pre-line">${u(model.notes)}</div></div>`);
  if (model.terms) blocks.push(`<div class="box"><h4>${t('section.terms')}</h4><div class="small" style="white-space:pre-line">${u(model.terms)}</div></div>`);

  // ── Bank and payment QR ────────────────────────────────────
  let qr: string | null = null;
  const payable = type.payable && balance.cmp(0) > 0 && model.status !== 'VOID' && model.status !== 'PAID';
  try {
    if (payable && model.paymentQr === 'upi' && model.bank?.upiId && model.currency === 'INR') {
      qr = await qrDataUri(upiPaymentUri({
        vpa: model.bank.upiId,
        payeeName: model.seller.name,
        amount: balance.toFixed(2),
        note: model.number,
        reference: model.number,
      }));
    } else if (payable && model.paymentQr === 'sepa' && model.bank?.iban && model.currency === 'EUR') {
      qr = await qrDataUri(epcPaymentPayload({
        name: model.bank.accountName || model.seller.name,
        iban: model.bank.iban,
        bic: model.bank.bic,
        amount: balance.toFixed(2),
        remittance: model.number,
      }));
    }
  } catch {
    qr = null; // Invalid payment details never block the document itself.
  }
  const bankRows: Array<[LabelKey, string | undefined]> = [
    ['bank.accountName', model.bank?.accountName],
    ['bank.bankName', model.bank?.bankName],
    ['bank.accountNumber', model.bank?.accountNumber],
    ['bank.ifsc', model.bank?.ifsc],
    ['bank.iban', model.bank?.iban],
    ['bank.bic', model.bank?.bic],
    ['bank.upi', model.bank?.upiId],
  ];
  const bankText = bankRows.filter(([, value]) => value).map(([key, value]) => `<div><span class="muted">${ti(key)}:</span> ${u(value)}</div>`).join('');
  if (bankText || qr) {
    blocks.push(`<div class="box"><h4>${t(qr ? 'section.payQr' : 'section.bank')}</h4><div class="bank-qr">
      ${qr ? `<img class="qr" src="${esc(qr)}" alt="">` : ''}<div>${bankText}</div></div></div>`);
  }

  const signature = safeImage(model.seller.signatureDataUri);
  const sign = type.legal || type.side === 'purchase'
    ? `<div class="sign"><div class="small">${t('sign.for', { name: model.seller.name })}</div>
        ${signature ? `<img src="${esc(signature)}" alt="">` : ''}<div class="line small">${t('sign.authorised')}</div></div>`
    : '';
  const stamp = model.status === 'DRAFT' || model.status === 'VOID'
    ? `<div class="stamp">${t(`status.${model.status}` as LabelKey)}</div>`
    : model.status === 'PAID' ? `<div class="stamp paid">${t('status.PAID')}</div>` : '';
  const footer = `<footer class="footer">${ti('footer.computerGenerated')}${model.branding?.showPoweredBy ? ` · ${ti('footer.poweredBy')}` : ''}</footer>`;

  const pageCss = thermal
    ? `@page { size: ${page.css}; margin: 0; } .page { width: ${page.width}; padding: 3mm; }`
    : `@page { size: ${page.css}; margin: 12mm 0; }
       .page { width: ${page.width}; padding: 0 14mm; }
       @media screen { .page { min-height: ${page.height}; padding: 12mm 14mm; } }`;

  return `<!doctype html>
<html lang="${esc(language.code)}" dir="${language.dir}">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(labels[titleKey])}${model.number ? ` ${esc(model.number)}` : ''}</title>
<style>:root { --accent: ${accent}; --accent-soft: ${tint(accent, 0.09)}; }
${BASE_CSS}
${definition.css}
${pageCss}</style>
</head>
<body>
<div class="page">
${stamp}
${header}
${parties}
${lineTable}
<div class="after">
  <div class="left">${words ? `<div class="words"><span class="muted small">${ti('total.inWords')}:</span><br>${esc(words)}</div>` : ''}${legal}${blocks.join('')}</div>
  <div class="right"><table class="totals"><tbody>${totals.join('')}</tbody></table>${sign}</div>
</div>
${footer}
</div>
</body>
</html>`;
}

/**
 * User-entered text, escaped and direction-isolated: "12 MG Road" stays in
 * that order inside an Arabic document, and Arabic names stay correct in an
 * English one.
 */
function u(value: unknown) {
  return `<bdi>${esc(value)}</bdi>`;
}

function partyLines(party: PartyBlock) {
  const lines = [...(party.address ?? []), ...(party.region ? [party.region] : [])].filter(Boolean);
  return lines.length ? `<div class="muted">${lines.map(u).join('<br>')}</div>` : '';
}

function contact(party: PartyBlock, t: (key: LabelKey) => string) {
  const parts = [
    party.phone ? `${t('field.phone')}: ${u(party.phone)}` : '',
    party.email ? `${t('field.email')}: ${u(party.email)}` : '',
  ].filter(Boolean);
  return parts.length ? `<div class="small muted">${parts.join(' · ')}</div>` : '';
}
