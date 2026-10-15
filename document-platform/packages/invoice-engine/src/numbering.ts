/**
 * Document numbering patterns, e.g. "INV/{FY}/{SEQ:5}" → "INV/2026-27/00042".
 *
 * Tokens: {SEQ:n} zero-padded sequence (required), {FY} "2026-27", {FY_SHORT}
 * "26-27", {YYYY}, {YY}, {MM}. The sequence restarts whenever the period the
 * pattern depends on changes (financial year, calendar year or month), which
 * is what Indian GST (unique series per financial year) and most EU countries
 * expect. Numbers are assigned only when a document is issued.
 */

const TOKEN = /\{(SEQ(?::(\d{1,2}))?|FY|FY_SHORT|YYYY|YY|MM)\}/g;
/** GST rule: at most 16 characters, letters, digits, "-" and "/" only. */
const GST_NUMBER = /^[A-Za-z0-9/-]{1,16}$/;

export interface NumberingOptions {
  /** First month of the financial year (India: 4 = April). Default 4. */
  fyStartMonth?: number;
}

function financialYear(date: Date, fyStartMonth: number) {
  const month = date.getUTCMonth() + 1;
  const start = month >= fyStartMonth ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
  return { start, end: start + 1 };
}

export function validatePattern(pattern: string): string | null {
  if (!/\{SEQ(?::\d{1,2})?\}/.test(pattern)) return 'The pattern needs a {SEQ} token, e.g. INV-{SEQ:5}.';
  const leftover = pattern.replace(TOKEN, '');
  if (/[{}]/.test(leftover)) return 'Unknown token. Use {SEQ:n}, {FY}, {FY_SHORT}, {YYYY}, {YY} or {MM}.';
  if (!/^[A-Za-z0-9/_.# -]*$/.test(leftover)) return 'Use only letters, digits, spaces and - / _ . #';
  return null;
}

/** Key of the period the sequence counts within ("" = never resets). */
export function periodKey(pattern: string, date: Date, options: NumberingOptions = {}): string {
  const fy = financialYear(date, options.fyStartMonth ?? 4);
  if (/\{(FY|FY_SHORT)\}/.test(pattern)) return `FY${fy.start}`;
  if (/\{MM\}/.test(pattern)) return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  if (/\{(YYYY|YY)\}/.test(pattern)) return String(date.getUTCFullYear());
  return '';
}

export function formatDocumentNumber(
  pattern: string,
  sequence: number,
  date: Date,
  options: NumberingOptions = {},
): string {
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new RangeError('Sequence must be a positive integer.');
  const fy = financialYear(date, options.fyStartMonth ?? 4);
  const year = date.getUTCFullYear();
  return pattern.replace(TOKEN, (_match, token: string, width?: string) => {
    if (token.startsWith('SEQ')) return String(sequence).padStart(Number(width ?? 1), '0');
    if (token === 'FY') return `${fy.start}-${String(fy.end).slice(-2)}`;
    if (token === 'FY_SHORT') return `${String(fy.start).slice(-2)}-${String(fy.end).slice(-2)}`;
    if (token === 'YYYY') return String(year);
    if (token === 'YY') return String(year).slice(-2);
    return String(date.getUTCMonth() + 1).padStart(2, '0');
  });
}

/** True when a number satisfies the Indian GST invoice-number rule. */
export function isGstCompliantNumber(number: string): boolean {
  return GST_NUMBER.test(number);
}
