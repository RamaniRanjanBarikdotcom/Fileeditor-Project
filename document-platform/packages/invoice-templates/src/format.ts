import { minorUnits } from '@docconv/invoice-engine';

export interface FormatOptions {
  /** Document language, e.g. "hi", "de", "pt-BR". */
  language: string;
  /** Seller/buyer country for regional conventions (e.g. Indian lakh grouping). */
  country?: string;
  /** Latin digits (default; clearest for business documents) or the script's native digits. */
  digits?: 'latn' | 'native';
}

/** Locale used for numbers and dates: language + region (+ numbering system). */
export function documentLocale({ language, country, digits = 'latn' }: FormatOptions): string {
  let locale = language;
  if (!language.includes('-') && country && /^[A-Z]{2}$/.test(country)) {
    try {
      [locale = language] = Intl.getCanonicalLocales(`${language}-${country}`);
    } catch {
      locale = language;
    }
  }
  const base = language.split('-')[0]!;
  const numbering = digits === 'latn' ? 'latn' : NATIVE_DIGITS[base];
  return numbering ? `${locale}-u-nu-${numbering}` : locale;
}

/** Numbering systems used for "native digits", by language. */
const NATIVE_DIGITS: Record<string, string> = {
  ar: 'arab', fa: 'arabext', ur: 'arabext', ps: 'arabext',
  hi: 'deva', mr: 'deva', ne: 'deva', bn: 'beng', as: 'beng', ta: 'tamldec', te: 'telu',
  kn: 'knda', ml: 'mlym', gu: 'gujr', pa: 'guru', or: 'orya', th: 'thai', lo: 'laoo',
  my: 'mymr', km: 'khmr', bo: 'tibt',
};

export interface Formatter {
  locale: string;
  money(amount: string, currency: string): string;
  number(value: string, maxFractionDigits?: number): string;
  percent(rate: string): string;
  date(isoDate: string): string;
}

export function createFormatter(options: FormatOptions): Formatter {
  const locale = documentLocale(options);
  const moneyFormats = new Map<string, Intl.NumberFormat>();
  return {
    locale,
    money(amount, currency) {
      let format = moneyFormats.get(currency);
      if (!format) {
        const scale = minorUnits(currency);
        format = new Intl.NumberFormat(locale, {
          style: 'currency',
          currency,
          minimumFractionDigits: scale,
          maximumFractionDigits: scale,
        });
        moneyFormats.set(currency, format);
      }
      // Decimal strings keep exact amounts (Intl accepts numeric strings).
      return format.format(amount as unknown as number);
    },
    number(value, maxFractionDigits = 4) {
      return new Intl.NumberFormat(locale, { maximumFractionDigits: maxFractionDigits }).format(
        value as unknown as number,
      );
    },
    percent(rate) {
      return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(rate as unknown as number)}%`;
    },
    date(isoDate) {
      const date = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
      if (Number.isNaN(date.getTime())) return isoDate;
      return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
    },
  };
}
