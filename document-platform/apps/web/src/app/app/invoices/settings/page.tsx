'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Check, Loader2, Upload } from 'lucide-react';
// Labels only (the full templates package would also bundle the QR encoder).
import { LABEL_KEYS, resolveLabels, type LabelKey } from '@docconv/invoice-templates/dist/labels';
import { useInvoicing } from '../context';
import { DOCUMENT_LABELS, api, card, input, label, money, primaryButton, secondaryButton, type Business } from '../lib';
import { fetchWithAuth } from '../../../../lib/api';

const TABS = [
  ['business', 'Business'],
  ['documents', 'Documents'],
  ['labels', 'Custom labels'],
  ['branding', 'Logo & signature'],
  ['plan', 'Plan'],
] as const;
type Tab = (typeof TABS)[number][0];

function SettingsContent() {
  const params = useSearchParams();
  const { business, reload } = useInvoicing();
  const [tab, setTab] = useState<Tab>((TABS.find(([id]) => id === params.get('tab'))?.[0] ?? 'business') as Tab);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  if (!business) return null;

  async function patch(body: Record<string, unknown>) {
    setError('');
    setNotice('');
    try {
      await api(`/invoicing/businesses/${business!.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      await reload();
      setNotice('Saved.');
    } catch (saveError) {
      setError((saveError as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white">Settings</h1>
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
        {TABS.map(([id, text]) => (
          <button key={id} type="button" onClick={() => { setTab(id); setNotice(''); setError(''); }}
            className={`whitespace-nowrap border-b-2 px-3 pb-2 text-sm font-semibold transition ${tab === id ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            {text}
          </button>
        ))}
      </div>
      {notice && <p className="flex items-center gap-2 text-sm font-semibold text-emerald-600"><Check className="h-4 w-4" />{notice}</p>}
      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
      {tab === 'business' && <BusinessTab key={business.id} business={business} onSave={patch} />}
      {tab === 'documents' && <DocumentsTab key={business.id} business={business} onSave={patch} />}
      {tab === 'labels' && <LabelsTab key={business.id} business={business} onSave={patch} />}
      {tab === 'branding' && <BrandingTab business={business} onDone={async (message, failed) => { await reload(); if (failed) setError(message); else setNotice(message); }} />}
      {tab === 'plan' && <PlanTab />}
    </div>
  );
}

export default function InvoiceSettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsContent />
    </Suspense>
  );
}

function BusinessTab({ business, onSave }: { business: Business; onSave: (body: Record<string, unknown>) => Promise<void> }) {
  const { meta } = useInvoicing();
  const [form, setForm] = useState({
    name: business.name,
    legalName: business.legalName ?? '',
    stateCode: business.stateCode ?? '',
    taxId: business.taxId ?? '',
    gstComposition: business.gstComposition,
    line1: business.addressJson.line1 ?? '',
    line2: business.addressJson.line2 ?? '',
    city: business.addressJson.city ?? '',
    postalCode: business.addressJson.postalCode ?? '',
    email: business.email ?? '',
    phone: business.phone ?? '',
    website: business.website ?? '',
    currency: business.currency,
    accountName: business.bankJson.accountName ?? '',
    accountNumber: business.bankJson.accountNumber ?? '',
    bankName: business.bankJson.bankName ?? '',
    ifsc: business.bankJson.ifsc ?? '',
    iban: business.bankJson.iban ?? '',
    bic: business.bankJson.bic ?? '',
    upiId: business.bankJson.upiId ?? '',
    paymentQr: business.paymentQr,
  });
  const india = business.taxRegime === 'IN_GST';
  const text = (key: keyof typeof form, title: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className={label} htmlFor={`b-${key}`}>{title}</label>
      <input id={`b-${key}`} className={input} value={String(form[key])} onChange={(event) => setForm({ ...form, [key]: event.target.value })} {...props} />
    </div>
  );
  const optional = (value: string) => value.trim() || undefined;
  return (
    <form className="space-y-5" onSubmit={(event) => {
      event.preventDefault();
      void onSave({
        name: form.name, legalName: optional(form.legalName), stateCode: india ? form.stateCode : undefined, taxId: optional(form.taxId),
        gstComposition: form.gstComposition, email: optional(form.email), phone: optional(form.phone), website: optional(form.website),
        currency: form.currency.toUpperCase(),
        address: { line1: optional(form.line1), line2: optional(form.line2), city: optional(form.city), postalCode: optional(form.postalCode) },
        bank: {
          accountName: optional(form.accountName), accountNumber: optional(form.accountNumber), bankName: optional(form.bankName),
          ifsc: optional(form.ifsc.toUpperCase()), iban: optional(form.iban.toUpperCase()), bic: optional(form.bic.toUpperCase()), upiId: optional(form.upiId),
        },
        paymentQr: form.paymentQr,
      });
    }}>
      <section className={`${card} grid gap-4 sm:grid-cols-2`}>
        {text('name', 'Trading name', { required: true })}
        {text('legalName', 'Legal name (printed on documents)')}
        {india && (
          <div>
            <label className={label} htmlFor="b-state">GST state</label>
            <select id="b-state" className={input} value={form.stateCode} onChange={(event) => setForm({ ...form, stateCode: event.target.value })}>
              {meta?.indiaStates.map((state) => <option key={state.code} value={state.code}>{state.code} · {state.name}</option>)}
            </select>
          </div>
        )}
        {text('taxId', india ? 'GSTIN' : business.taxRegime === 'EU_VAT' ? 'VAT ID' : 'Tax ID')}
        {india && (
          <label className="inline-flex items-center gap-2 text-sm font-medium sm:col-span-2">
            <input type="checkbox" checked={form.gstComposition} onChange={(event) => setForm({ ...form, gstComposition: event.target.checked })} />
            Composition scheme (issue bills of supply, no GST charged)
          </label>
        )}
        {text('line1', 'Address line 1')}
        {text('line2', 'Address line 2')}
        {text('city', 'City')}
        {text('postalCode', 'Postal code')}
        {text('email', 'Email', { type: 'email' })}
        {text('phone', 'Phone')}
        {text('website', 'Website')}
        {text('currency', 'Default currency (ISO code)', { maxLength: 3 })}
      </section>
      <section className={`${card} grid gap-4 sm:grid-cols-2`}>
        <h2 className="text-sm font-black sm:col-span-2">Bank and payment</h2>
        {text('accountName', 'Account name')}
        {text('bankName', 'Bank')}
        {india ? <>{text('accountNumber', 'Account number')}{text('ifsc', 'IFSC')}{text('upiId', 'UPI ID (for the UPI QR code)')}</> : <>{text('iban', 'IBAN')}{text('bic', 'BIC / SWIFT')}{text('accountNumber', 'Account number (if no IBAN)')}</>}
        <div>
          <label className={label} htmlFor="b-qr">Payment QR on invoices</label>
          <select id="b-qr" className={input} value={form.paymentQr} onChange={(event) => setForm({ ...form, paymentQr: event.target.value as Business['paymentQr'] })}>
            <option value="none">None</option>
            <option value="upi">UPI (India, INR)</option>
            <option value="sepa">SEPA / EPC (euro)</option>
          </select>
        </div>
      </section>
      <button type="submit" className={primaryButton}>Save business</button>
    </form>
  );
}

function DocumentsTab({ business, onSave }: { business: Business; onSave: (body: Record<string, unknown>) => Promise<void> }) {
  const { meta } = useInvoicing();
  const [form, setForm] = useState({
    template: business.template,
    accentColor: business.accentColor ?? '#3451c7',
    language: business.language,
    secondaryLanguage: business.secondaryLanguage ?? '',
    defaultDueDays: String(business.defaultDueDays),
    roundOffTotal: business.roundOffTotal,
    pricesIncludeTax: business.pricesIncludeTax,
    negativeStockPolicy: business.negativeStockPolicy,
    fyStartMonth: String(business.fyStartMonth),
    defaultNotes: business.defaultNotes ?? '',
    defaultTerms: business.defaultTerms ?? '',
    numbering: { ...business.numberingJson } as Record<string, string>,
    reminderDays: (business.reminderDaysJson ?? []).join(', '),
    lowStockAlerts: business.lowStockAlerts,
  });
  const numbered = ['TAX_INVOICE', 'QUOTATION', 'CREDIT_NOTE', 'PURCHASE_ORDER'];
  return (
    <form className="space-y-5" onSubmit={(event) => {
      event.preventDefault();
      void onSave({
        template: form.template, accentColor: form.accentColor, language: form.language, secondaryLanguage: form.secondaryLanguage || null,
        defaultDueDays: Number(form.defaultDueDays) || 0, roundOffTotal: form.roundOffTotal, pricesIncludeTax: form.pricesIncludeTax,
        negativeStockPolicy: form.negativeStockPolicy, fyStartMonth: Number(form.fyStartMonth),
        defaultNotes: form.defaultNotes || undefined, defaultTerms: form.defaultTerms || undefined,
        numbering: Object.fromEntries(Object.entries(form.numbering).filter(([, pattern]) => pattern.trim())),
        reminderDays: form.reminderDays.split(/[,\s]+/).map(Number).filter((days) => Number.isInteger(days) && days > 0).slice(0, 5),
        lowStockAlerts: form.lowStockAlerts,
      });
    }}>
      <section className={`${card} grid gap-4 sm:grid-cols-3`}>
        <div>
          <label className={label} htmlFor="d-template">Default layout</label>
          <select id="d-template" className={input} value={form.template} onChange={(event) => setForm({ ...form, template: event.target.value })}>
            {meta?.templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
          </select>
          <p className="mt-1 text-xs text-slate-500">{meta?.templates.find((template) => template.id === form.template)?.description}</p>
        </div>
        <div>
          <label className={label} htmlFor="d-accent">Accent colour</label>
          <input id="d-accent" type="color" className="h-10 w-full cursor-pointer rounded-xl border border-slate-200 dark:border-slate-700" value={form.accentColor} onChange={(event) => setForm({ ...form, accentColor: event.target.value })} />
        </div>
        <div>
          <label className={label} htmlFor="d-due">Payment due after (days)</label>
          <input id="d-due" inputMode="numeric" className={input} value={form.defaultDueDays} onChange={(event) => setForm({ ...form, defaultDueDays: event.target.value.replace(/\D/g, '') })} />
        </div>
        <div>
          <label className={label} htmlFor="d-lang">Document language</label>
          <select id="d-lang" className={input} value={form.language} onChange={(event) => setForm({ ...form, language: event.target.value })}>
            {meta?.languages.map((language) => <option key={language.code} value={language.code}>{language.name} · {language.englishName}</option>)}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="d-lang2">Second language</label>
          <select id="d-lang2" className={input} value={form.secondaryLanguage} onChange={(event) => setForm({ ...form, secondaryLanguage: event.target.value })}>
            <option value="">None</option>
            {meta?.languages.filter((language) => language.code !== form.language).map((language) => <option key={language.code} value={language.code}>{language.name}</option>)}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="d-fy">Financial year starts</label>
          <select id="d-fy" className={input} value={form.fyStartMonth} onChange={(event) => setForm({ ...form, fyStartMonth: event.target.value })}>
            {Array.from({ length: 12 }, (_, index) => <option key={index} value={index + 1}>{new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(2026, index, 1))}</option>)}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="d-stock">When stock runs out</label>
          <select id="d-stock" className={input} value={form.negativeStockPolicy} onChange={(event) => setForm({ ...form, negativeStockPolicy: event.target.value as Business['negativeStockPolicy'] })}>
            <option value="BLOCK">Block the sale</option>
            <option value="WARN">Allow, with a warning</option>
            <option value="ALLOW">Allow</option>
          </select>
        </div>
        <label className="inline-flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.roundOffTotal} onChange={(event) => setForm({ ...form, roundOffTotal: event.target.checked })} /> Round totals to whole units</label>
        <label className="inline-flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.pricesIncludeTax} onChange={(event) => setForm({ ...form, pricesIncludeTax: event.target.checked })} /> Prices include tax by default</label>
        <div>
          <label className={label} htmlFor="d-reminders">Payment reminders (days overdue)</label>
          <input id="d-reminders" className={input} placeholder="e.g. 3, 10" value={form.reminderDays} onChange={(event) => setForm({ ...form, reminderDays: event.target.value })} />
          <p className="mt-1 text-xs text-slate-500">Emailed to the customer when an invoice is this many days overdue. Leave empty for none.</p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.lowStockAlerts} onChange={(event) => setForm({ ...form, lowStockAlerts: event.target.checked })} /> Daily low-stock email</label>
      </section>
      <section className={card}>
        <h2 className="text-sm font-black">Numbering</h2>
        <p className="mt-1 text-xs text-slate-500">Tokens: {'{SEQ:4}'} sequence, {'{FY}'} 2026-27, {'{FY_SHORT}'} 26-27, {'{YYYY}'}, {'{YY}'}, {'{MM}'}. The sequence restarts each period the pattern uses. Leave empty for the default.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {numbered.map((type) => (
            <div key={type}>
              <label className={label} htmlFor={`n-${type}`}>{DOCUMENT_LABELS[type]}</label>
              <input id={`n-${type}`} maxLength={40} placeholder={business.taxRegime === 'IN_GST' ? 'e.g. INV/{FY_SHORT}/{SEQ:4}' : 'e.g. INV-{YYYY}-{SEQ:4}'} className={input}
                value={form.numbering[type] ?? ''} onChange={(event) => setForm({ ...form, numbering: { ...form.numbering, [type]: event.target.value } })} />
            </div>
          ))}
        </div>
      </section>
      <section className={`${card} grid gap-4 sm:grid-cols-2`}>
        <div><label className={label} htmlFor="d-notes">Default notes</label><textarea id="d-notes" rows={3} maxLength={4000} className={input} value={form.defaultNotes} onChange={(event) => setForm({ ...form, defaultNotes: event.target.value })} /></div>
        <div><label className={label} htmlFor="d-terms">Default terms</label><textarea id="d-terms" rows={3} maxLength={8000} className={input} value={form.defaultTerms} onChange={(event) => setForm({ ...form, defaultTerms: event.target.value })} /></div>
      </section>
      <button type="submit" className={primaryButton}>Save document settings</button>
    </form>
  );
}

/** Edit any printed label in any language: this is how unsupported languages become fully usable. */
function LabelsTab({ business, onSave }: { business: Business; onSave: (body: Record<string, unknown>) => Promise<void> }) {
  const { meta } = useInvoicing();
  const [language, setLanguage] = useState(business.language);
  const [custom, setCustom] = useState('');
  const [overrides, setOverrides] = useState<Record<string, string>>({ ...business.labelOverridesJson });
  const active = custom.trim() || language;
  let defaults: Record<string, string> = {};
  try {
    defaults = resolveLabels(active);
  } catch {
    defaults = resolveLabels('en');
  }
  const groups = ['doc.', 'field.', 'col.', 'total.', 'tax.', 'section.', 'bank.', 'sign.', 'footer.', 'status.', 'reason.', 'note.'];
  return (
    <div className="space-y-4">
      <section className={`${card} grid gap-4 sm:grid-cols-2`}>
        <div>
          <label className={label} htmlFor="l-lang">Language</label>
          <select id="l-lang" className={input} value={language} onChange={(event) => { setLanguage(event.target.value); setCustom(''); }}>
            {meta?.languages.map((entry) => <option key={entry.code} value={entry.code}>{entry.name} · {entry.englishName}</option>)}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="l-custom">…or any other language code</label>
          <input id="l-custom" placeholder="e.g. sw, mr, te, vi, pt-BR" maxLength={35} className={input} value={custom} onChange={(event) => setCustom(event.target.value)} />
        </div>
        <p className="text-xs text-slate-500 sm:col-span-2">Leave a field empty to use the default shown. Labels apply to every document printed in this language.</p>
      </section>
      <section className={`${card} max-h-[60vh] space-y-4 overflow-y-auto`}>
        {groups.map((group) => (
          <div key={group} className="grid gap-2 sm:grid-cols-2">
            {LABEL_KEYS.filter((key: LabelKey) => key.startsWith(group)).map((key: LabelKey) => {
              const storageKey = `${active}:${key}`;
              return (
                <div key={key}>
                  <label className="mb-0.5 block font-mono text-[10px] text-slate-400" htmlFor={`lbl-${key}`}>{key}</label>
                  <input id={`lbl-${key}`} className={input} placeholder={defaults[key]} value={overrides[storageKey] ?? ''} maxLength={300}
                    onChange={(event) => setOverrides({ ...overrides, [storageKey]: event.target.value })} />
                </div>
              );
            })}
          </div>
        ))}
      </section>
      <button type="button" className={primaryButton} onClick={() => void onSave({ labelOverrides: Object.fromEntries(Object.entries(overrides).filter(([, value]) => value.trim())) })}>
        Save labels
      </button>
    </div>
  );
}

function BrandingTab({ business, onDone }: { business: Business; onDone: (message: string, failed?: boolean) => Promise<void> }) {
  const [busy, setBusy] = useState<'logo' | 'signature' | null>(null);
  async function upload(kind: 'logo' | 'signature', file: File | undefined) {
    if (!file) return;
    setBusy(kind);
    const body = new FormData();
    body.append('file', file);
    const response = await fetchWithAuth(`/api/v1/invoicing/businesses/${business.id}/${kind}`, { method: 'POST', body });
    const payload = await response.json().catch(() => null);
    setBusy(null);
    if (!response.ok) await onDone(payload?.message ?? 'Upload failed.', true);
    else await onDone(kind === 'logo' ? 'Logo updated.' : 'Signature updated.');
  }
  return (
    <section className={`${card} grid gap-6 sm:grid-cols-2`}>
      {(['logo', 'signature'] as const).map((kind) => (
        <div key={kind}>
          <h2 className="text-sm font-black">{kind === 'logo' ? 'Logo' : 'Signature'}</h2>
          <p className="mt-1 text-xs text-slate-500">PNG, JPEG or WebP, up to 1 MB. {kind === 'signature' ? 'Printed above “Authorised signatory”.' : 'Printed at the top of every document.'}</p>
          <p className="mt-2 text-xs font-semibold text-slate-600">{(kind === 'logo' ? business.logoStorageKey : business.signatureStorageKey) ? 'Uploaded' : 'Not uploaded yet'}</p>
          <label className={`${secondaryButton} mt-3 cursor-pointer`}>
            {busy === kind ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Choose image
            <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => void upload(kind, event.target.files?.[0])} />
          </label>
        </div>
      ))}
    </section>
  );
}

type Plan = { key: string; name: string; description: string | null; isFree: boolean; limits: Record<string, number>; features: string[]; prices: Array<{ currency: 'USD' | 'INR'; interval: 'MONTH' | 'YEAR'; amountMinorUnits: number }> };

function PlanTab() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [current, setCurrent] = useState<{ plan: { key: string; name: string }; usageThisMonth: Record<string, number> } | null>(null);
  const [currency, setCurrency] = useState<'USD' | 'INR'>('USD');
  const [interval, setBillingInterval] = useState<'MONTH' | 'YEAR'>('MONTH');
  const [message, setMessage] = useState('');
  useEffect(() => {
    Promise.all([api<Plan[]>('/saas/invoice-studio/plans'), api<{ plan: { key: string; name: string }; usageThisMonth: Record<string, number> }>('/invoicing/usage')])
      .then(([planList, usage]) => { setPlans(planList); setCurrent(usage); })
      .catch((loadError) => setMessage((loadError as Error).message));
  }, []);
  const limit = (value: number | undefined) => (value === -1 ? 'Unlimited' : value === undefined || value === 0 ? '—' : value.toLocaleString());
  async function checkout(planKey: string) {
    setMessage('');
    try {
      const origin = window.location.origin;
      const result = await api<{ checkoutUrl?: string }>('/saas/invoice-studio/checkout', {
        method: 'POST',
        body: JSON.stringify({ planKey, interval, currency, successUrl: `${origin}/app/invoices/settings?tab=plan&checkout=success`, cancelUrl: `${origin}/app/invoices/settings?tab=plan` }),
      });
      if (result.checkoutUrl) window.location.assign(result.checkoutUrl);
    } catch (checkoutError) {
      setMessage((checkoutError as Error).message);
    }
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">Current plan: <strong>{current?.plan.name ?? '…'}</strong> · {current?.usageThisMonth.invoicesPerMonth ?? 0} invoices this month</p>
        <div className="flex gap-2">
          <select aria-label="Currency" className={`${input} w-24`} value={currency} onChange={(event) => setCurrency(event.target.value as 'USD' | 'INR')}><option>USD</option><option>INR</option></select>
          <select aria-label="Billing period" className={`${input} w-32`} value={interval} onChange={(event) => setBillingInterval(event.target.value as 'MONTH' | 'YEAR')}><option value="MONTH">Monthly</option><option value="YEAR">Yearly</option></select>
        </div>
      </div>
      {message && <p role="alert" className="text-sm font-semibold text-amber-700">{message}</p>}
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const price = plan.prices.find((entry) => entry.currency === currency && entry.interval === interval);
          const isCurrent = current?.plan.key === plan.key;
          return (
            <section key={plan.key} className={`${card} ${isCurrent ? 'ring-2 ring-indigo-500' : ''}`}>
              <h2 className="text-lg font-black">{plan.name}</h2>
              <p className="mt-1 text-xs text-slate-500">{plan.description}</p>
              <p className="mt-3 text-2xl font-black">{plan.isFree ? 'Free' : price ? money((price.amountMinorUnits / 100).toFixed(2), currency) : '—'}<span className="text-sm font-medium text-slate-500">{plan.isFree ? '' : interval === 'YEAR' ? ' / year' : ' / month'}</span></p>
              <ul className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                <li>Invoices / month: <strong>{limit(plan.limits.invoicesPerMonth)}</strong></li>
                <li>Businesses: <strong>{limit(plan.limits.businesses)}</strong></li>
                <li>Products: <strong>{limit(plan.limits.items)}</strong></li>
                <li>Warehouses: <strong>{limit(plan.limits.warehouses)}</strong></li>
                <li>Purchasing: <strong>{plan.features.includes('purchasing') ? 'Yes' : 'No'}</strong></li>
                <li>Without AppToolkitLab footer: <strong>{plan.features.includes('remove_branding') ? 'Yes' : 'No'}</strong></li>
              </ul>
              {isCurrent ? (
                <p className="mt-4 text-sm font-bold text-indigo-600">Your plan</p>
              ) : !plan.isFree && price ? (
                <button type="button" className={`${primaryButton} mt-4 w-full`} onClick={() => void checkout(plan.key)}>Choose {plan.name}</button>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
