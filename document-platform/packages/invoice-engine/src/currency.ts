/** ISO 4217 minor units. Every currency not listed here uses 2 decimals. */
const MINOR_UNITS: Record<string, number> = {
  // 0 decimals
  BIF: 0, CLP: 0, DJF: 0, GNF: 0, ISK: 0, JPY: 0, KMF: 0, KRW: 0, PYG: 0, RWF: 0,
  UGX: 0, UYI: 0, VND: 0, VUV: 0, XAF: 0, XOF: 0, XPF: 0,
  // 3 decimals
  BHD: 3, IQD: 3, JOD: 3, KWD: 3, LYD: 3, OMR: 3, TND: 3,
  // 4 decimals
  CLF: 4, UYW: 4,
};

let knownCurrencies: Set<string> | null = null;

/** True for ISO 4217 currencies known to the runtime (any 3 letters is not enough). */
export function isCurrencyCode(code: unknown): code is string {
  if (typeof code !== 'string' || !/^[A-Z]{3}$/.test(code)) return false;
  knownCurrencies ??= new Set(Intl.supportedValuesOf('currency'));
  return knownCurrencies.has(code);
}

export function minorUnits(currency: string): number {
  return MINOR_UNITS[currency.toUpperCase()] ?? 2;
}
