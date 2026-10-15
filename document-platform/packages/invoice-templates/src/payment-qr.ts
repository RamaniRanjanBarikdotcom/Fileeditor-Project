import QRCode from 'qrcode';
import { Dec } from '@docconv/invoice-engine';

/**
 * Payment QR codes printed on invoices. They only pre-fill the payer's app;
 * no payment account integration is needed.
 */

const VPA = /^[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}$/;

export function isUpiId(value: string) {
  return VPA.test(value);
}

/** UPI deep link (NPCI "upi://pay"), scanned by every Indian UPI app. */
export function upiPaymentUri(input: {
  vpa: string;
  payeeName: string;
  amount: string;
  note?: string;
  reference?: string;
}): string {
  if (!isUpiId(input.vpa)) throw new RangeError('That is not a valid UPI ID (e.g. shop@okbank).');
  const params = new URLSearchParams({
    pa: input.vpa,
    pn: input.payeeName.slice(0, 50),
    am: Dec.of(input.amount).toFixed(2),
    cu: 'INR',
  });
  if (input.note) params.set('tn', input.note.slice(0, 80));
  if (input.reference) params.set('tr', input.reference.slice(0, 35));
  // URLSearchParams encodes spaces as "+", which some UPI apps show literally.
  return `upi://pay?${params.toString().replace(/\+/g, '%20')}`;
}

/** EPC069-12 "SEPA credit transfer" QR (euro only), read by European banking apps. */
export function epcPaymentPayload(input: {
  name: string;
  iban: string;
  bic?: string;
  amount: string;
  remittance?: string;
}): string {
  const iban = input.iban.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) throw new RangeError('That is not a valid IBAN.');
  const amount = Dec.of(input.amount);
  if (amount.cmp('0.01') < 0 || amount.cmp('999999999.99') > 0) {
    throw new RangeError('SEPA QR amounts must be between 0.01 and 999999999.99 EUR.');
  }
  return [
    'BCD',
    '002',
    '1', // UTF-8
    'SCT',
    (input.bic ?? '').replace(/\s+/g, '').toUpperCase(),
    input.name.replace(/[\r\n]+/g, ' ').slice(0, 70),
    iban,
    `EUR${amount.toFixed(2)}`,
    '',
    '',
    (input.remittance ?? '').replace(/[\r\n]+/g, ' ').slice(0, 140),
  ].join('\n');
}

/** QR code as an SVG data URI (works under the template's strict CSP). */
export async function qrDataUri(text: string): Promise<string> {
  const svg = await QRCode.toString(text, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 });
  // URL-encoded rather than base64: runs unchanged in the browser preview and on the server.
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
