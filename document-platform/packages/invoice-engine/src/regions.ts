/**
 * Region data used by the tax engine. Rates here are seed defaults for new
 * businesses; the application stores rates as editable, effective-dated data,
 * so a rate change never needs a code release.
 */

/** GST state / union-territory codes (first two digits of a GSTIN). */
export const INDIA_STATES: Record<string, { name: string; unionTerritory?: boolean }> = {
  '01': { name: 'Jammu and Kashmir', unionTerritory: true },
  '02': { name: 'Himachal Pradesh' },
  '03': { name: 'Punjab' },
  '04': { name: 'Chandigarh', unionTerritory: true },
  '05': { name: 'Uttarakhand' },
  '06': { name: 'Haryana' },
  '07': { name: 'Delhi', unionTerritory: true },
  '08': { name: 'Rajasthan' },
  '09': { name: 'Uttar Pradesh' },
  '10': { name: 'Bihar' },
  '11': { name: 'Sikkim' },
  '12': { name: 'Arunachal Pradesh' },
  '13': { name: 'Nagaland' },
  '14': { name: 'Manipur' },
  '15': { name: 'Mizoram' },
  '16': { name: 'Tripura' },
  '17': { name: 'Meghalaya' },
  '18': { name: 'Assam' },
  '19': { name: 'West Bengal' },
  '20': { name: 'Jharkhand' },
  '21': { name: 'Odisha' },
  '22': { name: 'Chhattisgarh' },
  '23': { name: 'Madhya Pradesh' },
  '24': { name: 'Gujarat' },
  '26': { name: 'Dadra and Nagar Haveli and Daman and Diu', unionTerritory: true },
  '27': { name: 'Maharashtra' },
  '29': { name: 'Karnataka' },
  '30': { name: 'Goa' },
  '31': { name: 'Lakshadweep', unionTerritory: true },
  '32': { name: 'Kerala' },
  '33': { name: 'Tamil Nadu' },
  '34': { name: 'Puducherry', unionTerritory: true },
  '35': { name: 'Andaman and Nicobar Islands', unionTerritory: true },
  '36': { name: 'Telangana' },
  '37': { name: 'Andhra Pradesh' },
  '38': { name: 'Ladakh', unionTerritory: true },
  '97': { name: 'Other Territory', unionTerritory: true },
};

/**
 * Union territories without their own legislature levy UTGST instead of SGST.
 * Delhi, Puducherry and Jammu & Kashmir have legislatures, so they use SGST.
 */
const UTGST_CODES = new Set(['04', '26', '31', '35', '38', '97']);

export function intraStateTaxCode(stateCode: string): 'SGST' | 'UTGST' {
  return UTGST_CODES.has(stateCode) ? 'UTGST' : 'SGST';
}

/**
 * GST rates offered when creating items (percent). 0.25 and 3 cover specific
 * goods; 12 and 28 are retained for corrections to invoices issued before the
 * September 2025 rate rationalisation. Users can add any rate.
 */
export const INDIA_GST_RATES = ['0', '0.25', '3', '5', '12', '18', '28', '40'];

export interface EuCountry {
  name: string;
  /** Prefix used in VAT IDs (Greece uses EL). */
  vatPrefix: string;
  /** Standard rate (percent) as of the seed date; stored as editable data. */
  standardRate: string;
  vatIdPattern: RegExp;
}

export const EU_COUNTRIES: Record<string, EuCountry> = {
  AT: { name: 'Austria', vatPrefix: 'AT', standardRate: '20', vatIdPattern: /^U\d{8}$/ },
  BE: { name: 'Belgium', vatPrefix: 'BE', standardRate: '21', vatIdPattern: /^[01]\d{9}$/ },
  BG: { name: 'Bulgaria', vatPrefix: 'BG', standardRate: '20', vatIdPattern: /^\d{9,10}$/ },
  HR: { name: 'Croatia', vatPrefix: 'HR', standardRate: '25', vatIdPattern: /^\d{11}$/ },
  CY: { name: 'Cyprus', vatPrefix: 'CY', standardRate: '19', vatIdPattern: /^\d{8}[A-Z]$/ },
  CZ: { name: 'Czechia', vatPrefix: 'CZ', standardRate: '21', vatIdPattern: /^\d{8,10}$/ },
  DK: { name: 'Denmark', vatPrefix: 'DK', standardRate: '25', vatIdPattern: /^\d{8}$/ },
  EE: { name: 'Estonia', vatPrefix: 'EE', standardRate: '24', vatIdPattern: /^\d{9}$/ },
  FI: { name: 'Finland', vatPrefix: 'FI', standardRate: '25.5', vatIdPattern: /^\d{8}$/ },
  FR: { name: 'France', vatPrefix: 'FR', standardRate: '20', vatIdPattern: /^[0-9A-HJ-NP-Z]{2}\d{9}$/ },
  DE: { name: 'Germany', vatPrefix: 'DE', standardRate: '19', vatIdPattern: /^\d{9}$/ },
  GR: { name: 'Greece', vatPrefix: 'EL', standardRate: '24', vatIdPattern: /^\d{9}$/ },
  HU: { name: 'Hungary', vatPrefix: 'HU', standardRate: '27', vatIdPattern: /^\d{8}$/ },
  IE: { name: 'Ireland', vatPrefix: 'IE', standardRate: '23', vatIdPattern: /^(\d{7}[A-W][A-I]?|\d[A-Z+*]\d{5}[A-W])$/ },
  IT: { name: 'Italy', vatPrefix: 'IT', standardRate: '22', vatIdPattern: /^\d{11}$/ },
  LV: { name: 'Latvia', vatPrefix: 'LV', standardRate: '21', vatIdPattern: /^\d{11}$/ },
  LT: { name: 'Lithuania', vatPrefix: 'LT', standardRate: '21', vatIdPattern: /^(\d{9}|\d{12})$/ },
  LU: { name: 'Luxembourg', vatPrefix: 'LU', standardRate: '17', vatIdPattern: /^\d{8}$/ },
  MT: { name: 'Malta', vatPrefix: 'MT', standardRate: '18', vatIdPattern: /^\d{8}$/ },
  NL: { name: 'Netherlands', vatPrefix: 'NL', standardRate: '21', vatIdPattern: /^\d{9}B\d{2}$/ },
  PL: { name: 'Poland', vatPrefix: 'PL', standardRate: '23', vatIdPattern: /^\d{10}$/ },
  PT: { name: 'Portugal', vatPrefix: 'PT', standardRate: '23', vatIdPattern: /^\d{9}$/ },
  RO: { name: 'Romania', vatPrefix: 'RO', standardRate: '21', vatIdPattern: /^\d{2,10}$/ },
  SK: { name: 'Slovakia', vatPrefix: 'SK', standardRate: '23', vatIdPattern: /^\d{10}$/ },
  SI: { name: 'Slovenia', vatPrefix: 'SI', standardRate: '22', vatIdPattern: /^\d{8}$/ },
  ES: { name: 'Spain', vatPrefix: 'ES', standardRate: '21', vatIdPattern: /^[0-9A-Z]\d{7}[0-9A-Z]$/ },
  SE: { name: 'Sweden', vatPrefix: 'SE', standardRate: '25', vatIdPattern: /^\d{10}01$/ },
};

export function isEuCountry(country: string | undefined): boolean {
  return Boolean(country && Object.hasOwn(EU_COUNTRIES, country.toUpperCase()));
}
