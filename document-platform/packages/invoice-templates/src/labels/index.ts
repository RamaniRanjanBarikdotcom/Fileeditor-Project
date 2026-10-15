import { en, type LabelKey, type LabelPack } from './en';
import { de, es, fr, it, nl, pt } from './european';
import { bn, hi, ta } from './indian';
import { ar, ja, zh } from './asian';

export type { LabelKey, LabelPack };

export interface LanguageInfo {
  code: string;
  /** Name in its own language, for pickers. */
  name: string;
  englishName: string;
  dir: 'ltr' | 'rtl';
  pack?: LabelPack;
}

/** Shipped label packs. Any other BCP 47 language works with custom labels. */
export const LANGUAGES: Record<string, LanguageInfo> = {
  en: { code: 'en', name: 'English', englishName: 'English', dir: 'ltr', pack: en },
  hi: { code: 'hi', name: 'हिन्दी', englishName: 'Hindi', dir: 'ltr', pack: hi },
  bn: { code: 'bn', name: 'বাংলা', englishName: 'Bengali', dir: 'ltr', pack: bn },
  ta: { code: 'ta', name: 'தமிழ்', englishName: 'Tamil', dir: 'ltr', pack: ta },
  de: { code: 'de', name: 'Deutsch', englishName: 'German', dir: 'ltr', pack: de },
  fr: { code: 'fr', name: 'Français', englishName: 'French', dir: 'ltr', pack: fr },
  es: { code: 'es', name: 'Español', englishName: 'Spanish', dir: 'ltr', pack: es },
  it: { code: 'it', name: 'Italiano', englishName: 'Italian', dir: 'ltr', pack: it },
  nl: { code: 'nl', name: 'Nederlands', englishName: 'Dutch', dir: 'ltr', pack: nl },
  pt: { code: 'pt', name: 'Português', englishName: 'Portuguese', dir: 'ltr', pack: pt },
  ar: { code: 'ar', name: 'العربية', englishName: 'Arabic', dir: 'rtl', pack: ar },
  zh: { code: 'zh', name: '中文', englishName: 'Chinese (Simplified)', dir: 'ltr', pack: zh },
  ja: { code: 'ja', name: '日本語', englishName: 'Japanese', dir: 'ltr', pack: ja },
};

const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'ug', 'yi', 'dv', 'ku']);

export const LABEL_KEYS = Object.keys(en) as LabelKey[];

/** Normalises a BCP 47 tag ("pt-BR" → "pt-BR"); throws on garbage. */
export function canonicalLanguage(tag: string): string {
  const [canonical] = Intl.getCanonicalLocales(tag);
  if (!canonical) throw new RangeError(`"${tag}" is not a language tag.`);
  return canonical;
}

export function languageInfo(tag: string): LanguageInfo {
  const canonical = canonicalLanguage(tag);
  const base = canonical.split('-')[0]!;
  const known = LANGUAGES[canonical] ?? LANGUAGES[base];
  if (known) return { ...known, code: canonical };
  let englishName = canonical;
  try {
    englishName = new Intl.DisplayNames(['en'], { type: 'language' }).of(canonical) ?? canonical;
  } catch {
    // Display names are a convenience only.
  }
  return { code: canonical, name: englishName, englishName, dir: RTL_LANGUAGES.has(base) ? 'rtl' : 'ltr' };
}

/**
 * Labels for a language: the shipped pack (or English for languages without
 * one), with the business's own overrides on top. Overrides are how a user
 * prints in any language we do not ship, or changes wording ("Bill to" →
 * "Customer").
 */
export function resolveLabels(language: string, overrides: Partial<Record<string, string>> = {}): LabelPack {
  const pack = languageInfo(language).pack ?? en;
  const merged: Record<string, string> = { ...pack };
  for (const key of LABEL_KEYS) {
    const value = overrides[key];
    if (typeof value === 'string' && value.trim()) merged[key] = value.trim().slice(0, 300);
  }
  return merged as LabelPack;
}
