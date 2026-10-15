/**
 * Template registry. A template is data: page geometry, which optional
 * blocks it shows and its CSS. All templates share one HTML structure (see
 * render.ts), so a new layout is a new entry here, not new rendering code.
 */

export type PageSize = 'A4' | 'Letter' | '80mm' | '58mm';

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  page: PageSize;
  /** Thermal rolls: one continuous page as tall as the content. */
  singlePage?: boolean;
  /** Per-line CGST/SGST/IGST columns instead of a single tax column. */
  splitTaxColumns?: boolean;
  /** HSN/SAC summary table (Indian GST). */
  hsnSummary?: boolean;
  /** Tax breakdown by rate under the totals. */
  taxSummary?: boolean;
  /** Leave the top of the first page blank for pre-printed letterhead paper. */
  letterhead?: boolean;
  compact?: boolean;
  css: string;
}

const PAGE_SIZE: Record<PageSize, { css: string; width: string; height?: string }> = {
  A4: { css: 'A4', width: '210mm', height: '297mm' },
  Letter: { css: 'letter', width: '8.5in', height: '11in' },
  '80mm': { css: '80mm 297mm', width: '80mm' },
  '58mm': { css: '58mm 297mm', width: '58mm' },
};

export function pageGeometry(page: PageSize) {
  return PAGE_SIZE[page];
}

const FONT_STACK = [
  "'Noto Sans'",
  "'Noto Sans Devanagari'",
  "'Noto Sans Bengali'",
  "'Noto Sans Tamil'",
  "'Noto Sans Telugu'",
  "'Noto Sans Gujarati'",
  "'Noto Sans Kannada'",
  "'Noto Sans Malayalam'",
  "'Noto Sans Gurmukhi'",
  "'Noto Naskh Arabic'",
  "'Noto Sans Arabic'",
  "'Noto Sans Hebrew'",
  "'Noto Sans Thai'",
  "'Noto Sans CJK SC'",
  "'Noto Sans CJK JP'",
  "'Noto Sans CJK TC'",
  "'Noto Sans CJK KR'",
  'system-ui',
  "'Segoe UI'",
  'sans-serif',
].join(', ');

/** Structure shared by every template; templates only restyle it. */
export const BASE_CSS = `
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: ${FONT_STACK}; font-size: 9.5pt; line-height: 1.45; color: #1f2937; }
:lang(ja) body, body:lang(ja) { font-family: 'Noto Sans CJK JP', ${FONT_STACK}; }
:lang(zh-TW) body, body:lang(zh-TW) { font-family: 'Noto Sans CJK TC', ${FONT_STACK}; }
:lang(ko) body, body:lang(ko) { font-family: 'Noto Sans CJK KR', ${FONT_STACK}; }
table { border-collapse: collapse; width: 100%; }
th, td { padding: 5px 6px; vertical-align: top; text-align: start; }
.num { text-align: end; white-space: nowrap; font-variant-numeric: tabular-nums; }
.muted { color: #6b7280; }
.small { font-size: 8pt; }
.l2 { display: block; font-size: 0.82em; font-weight: 400; opacity: 0.75; }
.header { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; }
.seller-name { font-size: 14pt; font-weight: 700; margin: 0 0 2px; }
.logo { max-height: 60px; max-width: 180px; object-fit: contain; display: block; margin-bottom: 8px; }
.title { font-size: 18pt; font-weight: 800; letter-spacing: 0.02em; margin: 0; color: var(--accent); text-align: end; }
.meta { margin-top: 6px; border-spacing: 0; width: auto; margin-inline-start: auto; }
.meta th { color: #6b7280; font-weight: 600; padding: 1px 0; padding-inline-end: 12px; white-space: nowrap; }
.meta td { padding: 1px 0; font-weight: 600; }
.parties { display: flex; gap: 14px; margin: 16px 0 12px; }
.party { flex: 1; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 10px; }
.party h3 { margin: 0 0 4px; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.06em; color: var(--accent); }
.party .name { font-weight: 700; }
.lines th { background: var(--accent-soft); color: #111827; font-size: 8pt; font-weight: 700; border-bottom: 1.5px solid var(--accent); }
.lines td { border-bottom: 1px solid #eef0f3; }
.lines tr { page-break-inside: avoid; }
.lines .details { color: #6b7280; font-size: 8pt; white-space: pre-line; }
.after { display: flex; gap: 18px; margin-top: 10px; align-items: flex-start; }
.after .left { flex: 1.2; }
.after .right { flex: 1; }
.totals td { padding: 3px 6px; }
.totals .grand td { font-size: 12pt; font-weight: 800; border-top: 2px solid var(--accent); padding-top: 6px; }
.words { margin-top: 6px; font-weight: 600; }
.box { border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 10px; margin-top: 10px; page-break-inside: avoid; }
.box h4 { margin: 0 0 4px; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; }
.legal { border-inline-start: 3px solid var(--accent); background: #f9fafb; padding: 6px 10px; margin-top: 10px; font-size: 8.5pt; }
.summary th { font-size: 7.5pt; background: #f3f4f6; }
.summary td, .summary th { border: 1px solid #e5e7eb; }
.bank-qr { display: flex; gap: 12px; align-items: flex-start; }
.qr { width: 92px; height: 92px; }
.sign { text-align: center; margin-top: 18px; margin-inline-start: auto; width: 220px; page-break-inside: avoid; }
.sign img { max-height: 54px; max-width: 200px; display: block; margin: 6px auto; }
.sign .line { border-top: 1px solid #9ca3af; margin-top: 40px; padding-top: 3px; }
.sign img + .line { margin-top: 4px; }
.footer { margin-top: 18px; text-align: center; color: #9ca3af; font-size: 7.5pt; }
.stamp { position: fixed; top: 38%; left: 0; right: 0; text-align: center; font-size: 76pt; font-weight: 900;
  color: rgba(220, 38, 38, 0.13); transform: rotate(-24deg); letter-spacing: 0.08em; pointer-events: none; z-index: 0; }
.stamp.paid { color: rgba(5, 150, 105, 0.14); }
@media screen {
  html { background: #e5e7eb; }
  .page { background: #fff; margin: 16px auto; box-shadow: 0 6px 24px rgba(15, 23, 42, 0.12); position: relative; }
}
`;

const classic = `
.header { border-bottom: 2px solid var(--accent); padding-bottom: 10px; }
.lines td, .lines th { border: 1px solid #e5e7eb; }
`;

const modern = `
.header { background: var(--accent); color: #fff; margin: 0 -14mm; padding: 9mm 14mm; }
.header .title, .header .meta th, .header .meta td, .header .muted { color: #fff; }
.header .meta th { opacity: 0.8; }
.party { border: none; background: var(--accent-soft); }
.lines th { background: transparent; border-bottom: 2px solid var(--accent); }
.lines tbody tr:nth-child(even) td { background: #f9fafb; }
`;

const minimal = `
.title { color: #111827; font-weight: 300; font-size: 22pt; }
.party { border: none; padding: 0; }
.lines th { background: none; border-bottom: 1px solid #111827; text-transform: uppercase; letter-spacing: 0.05em; font-size: 7.5pt; }
.totals .grand td { border-top: 1px solid #111827; }
.box, .legal { border: none; background: none; padding-inline: 0; }
`;

const gstDetailed = `
body { font-size: 8.8pt; }
.header { border: 1px solid #9ca3af; padding: 8px 10px; }
.title { text-align: center; font-size: 13pt; }
.parties { margin-top: 0; gap: 0; }
.party { border-radius: 0; border-color: #9ca3af; border-top: none; }
.party + .party { border-inline-start: none; }
.lines th, .lines td { border: 1px solid #9ca3af; padding: 3px 4px; }
.lines th { background: #f3f4f6; border-bottom: 1px solid #9ca3af; text-align: center; }
.box, .legal { border-radius: 0; }
`;

const euVat = `
.header { border-bottom: 1px solid #d1d5db; padding-bottom: 10px; }
.party .taxid { font-weight: 700; }
.summary th { background: var(--accent-soft); }
.legal { font-weight: 600; }
`;

const letterhead = `
.letterhead-space { height: 42mm; }
.header .logo, .header .seller { display: none; }
`;

const thermal = (width: string) => `
body { font-size: ${width === '58mm' ? '7.5pt' : '8.5pt'}; color: #000; }
.page { padding: 3mm !important; }
.header { display: block; text-align: center; }
.logo { margin: 0 auto 4px; max-height: 40px; }
.title { text-align: center; font-size: 11pt; color: #000; margin-top: 4px; }
.meta { margin: 4px auto 0; }
.parties { display: block; margin: 6px 0; }
.party { border: none; border-top: 1px dashed #000; border-radius: 0; padding: 4px 0; }
.lines th { background: none; border-bottom: 1px dashed #000; color: #000; }
.lines td { border-bottom: none; padding: 2px 3px; }
.after { display: block; }
.totals .grand td { border-top: 1px dashed #000; }
.box, .legal { border: none; border-top: 1px dashed #000; border-radius: 0; padding: 4px 0; background: none; }
.sign { display: none; }
.qr { width: 120px; height: 120px; display: block; margin: 4px auto; }
.bank-qr { display: block; text-align: center; }
`;

export const TEMPLATES: Record<string, TemplateDefinition> = {
  classic: { id: 'classic', name: 'Classic', description: 'Clean bordered table; suits most businesses.', page: 'A4', taxSummary: true, css: classic },
  modern: { id: 'modern', name: 'Modern', description: 'Coloured header band and soft panels.', page: 'A4', taxSummary: true, css: modern },
  minimal: { id: 'minimal', name: 'Minimal', description: 'Lots of white space, no boxes.', page: 'A4', css: minimal },
  'gst-detailed': {
    id: 'gst-detailed', name: 'GST detailed', description: 'Indian GST format: per-line CGST/SGST/IGST and HSN summary.',
    page: 'A4', splitTaxColumns: true, hsnSummary: true, compact: true, css: gstDetailed,
  },
  'eu-vat': { id: 'eu-vat', name: 'EU VAT', description: 'VAT breakdown by rate and prominent VAT IDs.', page: 'A4', taxSummary: true, css: euVat },
  letterhead: { id: 'letterhead', name: 'Letterhead', description: 'Blank top for pre-printed letterhead paper.', page: 'A4', letterhead: true, taxSummary: true, css: classic + letterhead },
  'thermal-80': { id: 'thermal-80', name: 'Thermal 80 mm', description: 'Receipt printers, 80 mm rolls.', page: '80mm', singlePage: true, compact: true, css: thermal('80mm') },
  'thermal-58': { id: 'thermal-58', name: 'Thermal 58 mm', description: 'Receipt printers, 58 mm rolls.', page: '58mm', singlePage: true, compact: true, css: thermal('58mm') },
};

/**
 * Settings for the server PDF renderer. Thermal rolls use a fixed paper
 * width and one page as tall as the receipt; other templates follow CSS @page.
 */
export function pdfRenderSettings(id: string) {
  const definition = template(id);
  if (!definition.singlePage) return { preferCssPageSize: true };
  return {
    preferCssPageSize: false,
    singlePage: true,
    paperWidth: pageGeometry(definition.page).width,
    margins: { top: '0', bottom: '0', left: '0', right: '0' },
  };
}

export function template(id: string): TemplateDefinition {
  const definition = TEMPLATES[id];
  if (!definition) throw new RangeError(`Unknown template "${id}".`);
  return definition;
}
