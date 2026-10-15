'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import CsvTools from '../components/CsvTools';
import { useInvoicing } from '../context';
import { COUNTRIES, api, card, input, label, primaryButton, secondaryButton, type Contact } from '../lib';

type Form = {
  id?: string;
  name: string;
  isCustomer: boolean;
  isSupplier: boolean;
  country: string;
  stateCode: string;
  taxId: string;
  email: string;
  phone: string;
  line1: string;
  city: string;
  postalCode: string;
  paymentTermsDays: string;
  isSez: boolean;
};

export default function ContactsPage() {
  const { business, meta } = useInvoicing();
  const [type, setType] = useState<'' | 'customer' | 'supplier'>('');
  const [query, setQuery] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (type) params.set('type', type);
      if (query.trim()) params.set('q', query.trim());
      setContacts((await api<{ items: Contact[] }>(`/invoicing/contacts?${params}`)).items);
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  }, [type, query]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), query ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, query]);

  const blank = (): Form => ({
    name: '', isCustomer: type !== 'supplier', isSupplier: type === 'supplier', country: business?.country ?? 'IN',
    stateCode: '', taxId: '', email: '', phone: '', line1: '', city: '', postalCode: '', paymentTermsDays: '', isSez: false,
  });
  const edit = (contact: Contact): Form => ({
    id: contact.id, name: contact.name, isCustomer: contact.isCustomer, isSupplier: contact.isSupplier, country: contact.country,
    stateCode: contact.stateCode ?? '', taxId: contact.taxId ?? '', email: contact.email ?? '', phone: contact.phone ?? '',
    line1: contact.billingAddressJson.line1 ?? '', city: contact.billingAddressJson.city ?? '', postalCode: contact.billingAddressJson.postalCode ?? '',
    paymentTermsDays: contact.paymentTermsDays?.toString() ?? '', isSez: contact.isSez,
  });

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    setError('');
    const body = {
      name: form.name, isCustomer: form.isCustomer, isSupplier: form.isSupplier, country: form.country,
      stateCode: form.country === 'IN' ? form.stateCode || null : null, taxId: form.taxId || null,
      email: form.email || undefined, phone: form.phone || undefined, isSez: form.isSez,
      billingAddress: { line1: form.line1 || undefined, city: form.city || undefined, postalCode: form.postalCode || undefined },
      paymentTermsDays: form.paymentTermsDays ? Number(form.paymentTermsDays) : null,
    };
    try {
      await api(form.id ? `/invoicing/contacts/${form.id}` : '/invoicing/contacts', { method: form.id ? 'PATCH' : 'POST', body: JSON.stringify(body) });
      setForm(null);
      await load();
    } catch (saveError) {
      setError((saveError as Error).message);
    }
  }

  async function archive(contact: Contact) {
    if (!window.confirm(`Remove ${contact.name}? Existing documents keep their details.`)) return;
    try {
      await api(`/invoicing/contacts/${contact.id}`, { method: 'DELETE' });
      await load();
    } catch (archiveError) {
      setError((archiveError as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white">Customers & suppliers</h1>
        <div className="flex flex-wrap items-start gap-2">
          <CsvTools kind="contacts" onImported={() => void load()} />
          <button type="button" className={primaryButton} onClick={() => setForm(blank())}><Plus className="h-4 w-4" /> Add contact</button>
        </div>
      </header>

      {form && (
        <form onSubmit={save} className={`${card} grid gap-4 sm:grid-cols-3`}>
          <div className="sm:col-span-2"><label className={label} htmlFor="c-name">Name</label><input id="c-name" required maxLength={200} className={input} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
          <div className="flex items-end gap-4 text-sm font-medium">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.isCustomer} onChange={(event) => setForm({ ...form, isCustomer: event.target.checked })} /> Customer</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.isSupplier} onChange={(event) => setForm({ ...form, isSupplier: event.target.checked })} /> Supplier</label>
          </div>
          <div><label className={label} htmlFor="c-country">Country</label>
            <select id="c-country" className={input} value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })}>
              {COUNTRIES.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
            </select>
          </div>
          {form.country === 'IN' && (
            <div><label className={label} htmlFor="c-state">State</label>
              <select id="c-state" className={input} value={form.stateCode} onChange={(event) => setForm({ ...form, stateCode: event.target.value })}>
                <option value="">Choose…</option>
                {meta?.indiaStates.map((state) => <option key={state.code} value={state.code}>{state.code} · {state.name}</option>)}
              </select>
            </div>
          )}
          <div><label className={label} htmlFor="c-tax">{form.country === 'IN' ? 'GSTIN' : 'VAT / tax ID'}</label><input id="c-tax" className={input} value={form.taxId} onChange={(event) => setForm({ ...form, taxId: event.target.value })} /></div>
          <div><label className={label} htmlFor="c-email">Email</label><input id="c-email" type="email" className={input} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div>
          <div><label className={label} htmlFor="c-phone">Phone</label><input id="c-phone" className={input} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></div>
          <div><label className={label} htmlFor="c-terms">Payment terms (days)</label><input id="c-terms" inputMode="numeric" className={input} value={form.paymentTermsDays} onChange={(event) => setForm({ ...form, paymentTermsDays: event.target.value.replace(/\D/g, '') })} /></div>
          <div className="sm:col-span-3 grid gap-4 sm:grid-cols-3">
            <div><label className={label} htmlFor="c-line1">Address</label><input id="c-line1" className={input} value={form.line1} onChange={(event) => setForm({ ...form, line1: event.target.value })} /></div>
            <div><label className={label} htmlFor="c-city">City</label><input id="c-city" className={input} value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></div>
            <div><label className={label} htmlFor="c-postal">Postal code</label><input id="c-postal" className={input} value={form.postalCode} onChange={(event) => setForm({ ...form, postalCode: event.target.value })} /></div>
          </div>
          {form.country === 'IN' && (
            <label className="inline-flex items-center gap-2 text-sm font-medium sm:col-span-3"><input type="checkbox" checked={form.isSez} onChange={(event) => setForm({ ...form, isSez: event.target.checked })} /> Special Economic Zone (SEZ) unit</label>
          )}
          <div className="flex gap-2 sm:col-span-3"><button type="submit" className={primaryButton}>Save</button><button type="button" className={secondaryButton} onClick={() => setForm(null)}>Cancel</button></div>
        </form>
      )}
      {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input aria-label="Search contacts" placeholder="Search name, email, GSTIN / VAT ID" className={`${input} pl-9`} value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        <select aria-label="Type" className={`${input} sm:w-44`} value={type} onChange={(event) => setType(event.target.value as typeof type)}>
          <option value="">Everyone</option><option value="customer">Customers</option><option value="supplier">Suppliers</option>
        </select>
      </div>

      <section className={`${card} p-0`}>
        {loading ? <p className="p-6 text-sm text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading…</p> : contacts.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">No contacts yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {contacts.map((contact) => (
              <li key={contact.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900 dark:text-white">{contact.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {[contact.isCustomer && 'Customer', contact.isSupplier && 'Supplier'].filter(Boolean).join(' & ')} · {contact.country}
                    {contact.taxId ? ` · ${contact.taxId}` : ''}{contact.email ? ` · ${contact.email}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" aria-label={`Edit ${contact.name}`} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setForm(edit(contact))}><Pencil className="h-4 w-4" /></button>
                  <button type="button" aria-label={`Remove ${contact.name}`} className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600" onClick={() => void archive(contact)}><Trash2 className="h-4 w-4" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
