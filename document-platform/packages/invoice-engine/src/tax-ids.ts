import { EU_COUNTRIES, INDIA_STATES } from './regions';

const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const BASE36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export type TaxIdCheck = { valid: true; normalized: string } | { valid: false; reason: string };

/** Indian GSTIN: format, known state code and the mod-36 check character. */
export function validateGstin(raw: string, expectedStateCode?: string): TaxIdCheck {
  const gstin = raw.replace(/\s+/g, '').toUpperCase();
  if (!GSTIN_PATTERN.test(gstin)) {
    return { valid: false, reason: 'A GSTIN has 15 characters, e.g. 27AAPFU0939F1ZV.' };
  }
  const state = gstin.slice(0, 2);
  if (!INDIA_STATES[state]) return { valid: false, reason: `State code ${state} does not exist.` };
  if (expectedStateCode && state !== expectedStateCode) {
    return { valid: false, reason: `This GSTIN belongs to state ${state}, not ${expectedStateCode}.` };
  }
  let total = 0;
  for (let index = 0; index < 14; index += 1) {
    const product = BASE36.indexOf(gstin.charAt(index)) * (index % 2 === 0 ? 1 : 2);
    total += Math.floor(product / 36) + (product % 36);
  }
  const check = BASE36[(36 - (total % 36)) % 36];
  if (gstin.charAt(14) !== check) return { valid: false, reason: 'The GSTIN check character is wrong; check for a typo.' };
  return { valid: true, normalized: gstin };
}

/**
 * EU VAT identification number: country prefix and national format. (Whether
 * the number is registered is a separate, optional online VIES check.)
 */
export function validateEuVatId(raw: string, country?: string): TaxIdCheck {
  const id = raw.replace(/[\s.-]+/g, '').toUpperCase();
  const entry = Object.entries(EU_COUNTRIES).find(([, data]) => id.startsWith(data.vatPrefix));
  if (!entry) return { valid: false, reason: 'An EU VAT ID starts with a country code, e.g. DE123456789.' };
  const [code, data] = entry;
  if (country && country.toUpperCase() !== code) {
    return { valid: false, reason: `This VAT ID is from ${data.name}, not the selected country.` };
  }
  if (!data.vatIdPattern.test(id.slice(data.vatPrefix.length))) {
    return { valid: false, reason: `This is not a valid ${data.name} VAT ID format.` };
  }
  return { valid: true, normalized: id };
}
