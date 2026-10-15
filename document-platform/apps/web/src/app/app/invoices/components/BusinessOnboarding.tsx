'use client';

import { useState } from 'react';
import { Building2, Loader2 } from 'lucide-react';
import { validateEuVatId, validateGstin, isEuCountry } from '@docconv/invoice-engine';
import { useInvoicing } from '../context';
import { COUNTRIES, api, card, input, label, primaryButton } from '../lib';

/** First-run setup: one form, everything else is pre-filled from the country. */
export default function BusinessOnboarding() {
  const { meta, reload } = useInvoicing();
  const [form, setForm] = useState({
    name: '',
    country: 'IN',
    stateCode: '',
    taxId: '',
    line1: '',
    city: '',
    postalCode: '',
    email: '',
    phone: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const india = form.country === 'IN';
  const eu = isEuCountry(form.country);
  const taxCheck = form.taxId.trim()
    ? india
      ? validateGstin(form.taxId, form.stateCode || undefined)
      : eu
        ? validateEuVatId(form.taxId, form.country)
        : { valid: true as const }
    : null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api('/invoicing/businesses', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          country: form.country,
          stateCode: india ? form.stateCode : undefined,
          taxId: form.taxId.trim() || undefined,
          address: { line1: form.line1 || undefined, city: form.city || undefined, postalCode: form.postalCode || undefined },
          email: form.email || undefined,
          phone: form.phone || undefined,
        }),
      });
      await reload();
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-indigo-500">
          <Building2 className="h-4 w-4" /> Welcome to Invoice Studio
        </span>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white">Set up your business</h1>
        <p className="mt-2 text-sm text-slate-500">
          We use your country to pre-fill tax rules, currency, numbering and the invoice layout. You can change
          everything later in Settings.
        </p>
      </div>
      <form onSubmit={submit} className={`${card} space-y-4`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label} htmlFor="biz-name">Business name</label>
            <input id="biz-name" required maxLength={160} className={input} value={form.name} onChange={set('name')} />
          </div>
          <div>
            <label className={label} htmlFor="biz-country">Country</label>
            <select id="biz-country" className={input} value={form.country} onChange={set('country')}>
              {COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>{country.name}</option>
              ))}
            </select>
          </div>
          {india && (
            <div>
              <label className={label} htmlFor="biz-state">GST state</label>
              <select id="biz-state" required className={input} value={form.stateCode} onChange={set('stateCode')}>
                <option value="">Choose…</option>
                {meta?.indiaStates.map((state) => (
                  <option key={state.code} value={state.code}>{state.code} · {state.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className={india ? 'sm:col-span-2' : ''}>
            <label className={label} htmlFor="biz-tax">{india ? 'GSTIN (optional)' : eu ? 'VAT ID (optional)' : 'Tax ID (optional)'}</label>
            <input id="biz-tax" className={input} value={form.taxId} onChange={set('taxId')} placeholder={india ? '27AAPFU0939F1ZV' : eu ? `${form.country}123456789` : ''} />
            {taxCheck && !taxCheck.valid && <p className="mt-1 text-xs font-semibold text-red-600">{'reason' in taxCheck ? taxCheck.reason : ''}</p>}
          </div>
          <div className="sm:col-span-2">
            <label className={label} htmlFor="biz-line1">Address</label>
            <input id="biz-line1" className={input} value={form.line1} onChange={set('line1')} placeholder="Street and number" />
          </div>
          <div>
            <label className={label} htmlFor="biz-city">City</label>
            <input id="biz-city" className={input} value={form.city} onChange={set('city')} />
          </div>
          <div>
            <label className={label} htmlFor="biz-postal">Postal code</label>
            <input id="biz-postal" className={input} value={form.postalCode} onChange={set('postalCode')} />
          </div>
          <div>
            <label className={label} htmlFor="biz-email">Email</label>
            <input id="biz-email" type="email" className={input} value={form.email} onChange={set('email')} />
          </div>
          <div>
            <label className={label} htmlFor="biz-phone">Phone</label>
            <input id="biz-phone" className={input} value={form.phone} onChange={set('phone')} />
          </div>
        </div>
        {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
        <button type="submit" disabled={saving || Boolean(taxCheck && !taxCheck.valid)} className={`${primaryButton} w-full`}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Create business
        </button>
      </form>
    </div>
  );
}
