import { Dec, minorUnits } from '@docconv/invoice-engine';

/**
 * Amount in words. Pluggable per language: add a converter to support more.
 * Indian English and Hindi use the lakh/crore system, as on Indian invoices.
 */

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function englishBelowThousand(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
    n %= 100;
  }
  if (n >= 20) {
    parts.push(n % 10 ? `${TENS[Math.floor(n / 10)]}-${ONES[n % 10]}` : TENS[Math.floor(n / 10)]!);
  } else if (n > 0) {
    parts.push(ONES[n]!);
  }
  return parts.join(' ');
}

function englishInternational(value: bigint): string {
  if (value === BigInt(0)) return 'Zero';
  const scales = ['', 'Thousand', 'Million', 'Billion', 'Trillion', 'Quadrillion'];
  const parts: string[] = [];
  let index = 0;
  while (value > BigInt(0)) {
    const chunk = Number(value % BigInt(1000));
    if (chunk) parts.unshift(`${englishBelowThousand(chunk)}${scales[index] ? ` ${scales[index]}` : ''}`);
    value /= BigInt(1000);
    index += 1;
    if (index >= scales.length && value > BigInt(0)) throw new RangeError('Amount too large to write in words.');
  }
  return parts.join(' ');
}

/** Indian grouping: crore (10^7), lakh (10^5), thousand, hundred. */
function indianGroups(value: bigint) {
  const crore = value / BigInt(10_000_000);
  let rest = Number(value % BigInt(10_000_000));
  const lakh = Math.floor(rest / 100_000);
  rest %= 100_000;
  const thousand = Math.floor(rest / 1000);
  return { crore, lakh, thousand, rest: rest % 1000 };
}

function englishIndian(value: bigint): string {
  if (value === BigInt(0)) return 'Zero';
  const { crore, lakh, thousand, rest } = indianGroups(value);
  const parts: string[] = [];
  if (crore > BigInt(0)) parts.push(`${englishIndian(crore)} Crore`);
  if (lakh) parts.push(`${englishBelowThousand(lakh)} Lakh`);
  if (thousand) parts.push(`${englishBelowThousand(thousand)} Thousand`);
  if (rest) parts.push(englishBelowThousand(rest));
  return parts.join(' ');
}

// Hindi has a distinct word for every number from 1 to 99.
const HINDI = (
  'शून्य एक दो तीन चार पाँच छह सात आठ नौ दस ग्यारह बारह तेरह चौदह पंद्रह सोलह सत्रह अठारह उन्नीस बीस ' +
  'इक्कीस बाईस तेईस चौबीस पच्चीस छब्बीस सत्ताईस अट्ठाईस उनतीस तीस इकतीस बत्तीस तैंतीस चौंतीस पैंतीस छत्तीस ' +
  'सैंतीस अड़तीस उनतालीस चालीस इकतालीस बयालीस तैंतालीस चवालीस पैंतालीस छियालीस सैंतालीस अड़तालीस उनचास ' +
  'पचास इक्यावन बावन तिरेपन चौवन पचपन छप्पन सत्तावन अट्ठावन उनसठ साठ इकसठ बासठ तिरेसठ चौंसठ पैंसठ ' +
  'छियासठ सड़सठ अड़सठ उनहत्तर सत्तर इकहत्तर बहत्तर तिहत्तर चौहत्तर पचहत्तर छिहत्तर सतहत्तर अठहत्तर ' +
  'उन्यासी अस्सी इक्यासी बयासी तिरासी चौरासी पचासी छियासी सत्तासी अट्ठासी नवासी नब्बे इक्यानवे बानवे ' +
  'तिरानवे चौरानवे पचानवे छियानवे सत्तानवे अट्ठानवे निन्यानवे'
).split(' ');

function hindiBelowThousand(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${HINDI[Math.floor(n / 100)]} सौ`);
    n %= 100;
  }
  if (n) parts.push(HINDI[n]!);
  return parts.join(' ');
}

function hindi(value: bigint): string {
  if (value === BigInt(0)) return HINDI[0]!;
  const { crore, lakh, thousand, rest } = indianGroups(value);
  const parts: string[] = [];
  if (crore > BigInt(0)) parts.push(`${hindi(crore)} करोड़`);
  if (lakh) parts.push(`${hindiBelowThousand(lakh)} लाख`);
  if (thousand) parts.push(`${hindiBelowThousand(thousand)} हज़ार`);
  if (rest) parts.push(hindiBelowThousand(rest));
  return parts.join(' ');
}

function split(amount: string, currency: string) {
  const scale = minorUnits(currency);
  const value = Dec.of(amount).round(scale);
  if (value.isNegative()) throw new RangeError('Amounts in words must not be negative.');
  const [major = '0', minor = ''] = value.toFixed(scale).split('.');
  return { major: BigInt(major), minor: minor ? Number(minor) : 0, scale, minorText: minor };
}

function currencyName(currency: string, locale: string) {
  try {
    return new Intl.DisplayNames([locale], { type: 'currency' }).of(currency) ?? currency;
  } catch {
    return currency;
  }
}

export type AmountInWords = (amount: string, currency: string) => string;

const converters: Record<string, AmountInWords> = {
  'en-IN': (amount, currency) => {
    const { major, minor } = split(amount, currency);
    if (currency === 'INR') {
      return `Rupees ${englishIndian(major)}${minor ? ` and ${englishIndian(BigInt(minor))} Paise` : ''} Only`;
    }
    return `${currencyName(currency, 'en')} ${englishIndian(major)}${minor ? ` and ${minor}/100` : ''} Only`;
  },
  en: (amount, currency) => {
    const { major, minor, scale, minorText } = split(amount, currency);
    const fraction = minor ? ` and ${minorText}/${10 ** scale}` : '';
    return `${currencyName(currency, 'en')} ${englishInternational(major)}${fraction} Only`;
  },
  hi: (amount, currency) => {
    const { major, minor } = split(amount, currency);
    if (currency === 'INR') {
      return `${hindi(major)} रुपये${minor ? ` और ${hindi(BigInt(minor))} पैसे` : ''} मात्र`;
    }
    return `${hindi(major)} ${currencyName(currency, 'hi')}${minor ? ` और ${minor}/100` : ''} मात्र`;
  },
};

/** Returns null when no converter exists for the language (the row is then omitted). */
export function amountInWords(amount: string, currency: string, language: string, country?: string): string | null {
  const base = language.split('-')[0]!;
  const key = base === 'en' && (country === 'IN' || currency === 'INR') ? 'en-IN' : converters[language] ? language : base;
  const convert = converters[key];
  return convert ? convert(amount, currency) : null;
}

export function registerAmountInWords(language: string, converter: AmountInWords) {
  converters[language] = converter;
}
