'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import CsvTools from '../components/CsvTools';
import { useInvoicing } from '../context';
import { api, card, input, label, money, primaryButton, secondaryButton, type Item } from '../lib';

type Form = {
  id?: string;
  kind: 'GOODS' | 'SERVICES';
  name: string;
  sku: string;
  barcode: string;
  unit: string;
  hsnSac: string;
  taxRate: string;
  salePrice: string;
  purchasePrice: string;
  trackInventory: boolean;
  reorderLevel: string;
};

const blank = (): Form => ({
  kind: 'GOODS', name: '', sku: '', barcode: '', unit: 'pcs', hsnSac: '', taxRate: '0',
  salePrice: '0', purchasePrice: '0', trackInventory: true, reorderLevel: '',
});

export default function ItemsPage() {
  const { business, meta } = useInvoicing();
  const india = business?.taxRegime === 'IN_GST';
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems((await api<{ items: Item[] }>(`/invoicing/items${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`)).items);
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), query ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, query]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    setError('');
    const numberOrNull = (value: string) => (value.trim() ? value.replace(',', '.').trim() : null);
    const body = {
      kind: form.kind, name: form.name, sku: form.sku.trim() || null, barcode: form.barcode.trim() || null, unit: form.unit,
      hsnSac: form.hsnSac.trim() || null, taxRate: numberOrNull(form.taxRate) ?? '0', salePrice: numberOrNull(form.salePrice) ?? '0',
      purchasePrice: numberOrNull(form.purchasePrice) ?? '0', trackInventory: form.kind === 'GOODS' && form.trackInventory,
      reorderLevel: numberOrNull(form.reorderLevel),
    };
    try {
      await api(form.id ? `/invoicing/items/${form.id}` : '/invoicing/items', { method: form.id ? 'PATCH' : 'POST', body: JSON.stringify(body) });
      setForm(null);
      await load();
    } catch (saveError) {
      setError((saveError as Error).message);
    }
  }

  async function archive(item: Item) {
    if (!window.confirm(`Remove ${item.name}? Existing documents keep their lines.`)) return;
    try {
      await api(`/invoicing/items/${item.id}`, { method: 'DELETE' });
      await load();
    } catch (archiveError) {
      setError((archiveError as Error).message);
    }
  }

  const field = (key: keyof Form, text: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className={label} htmlFor={`i-${key}`}>{text}</label>
      <input id={`i-${key}`} className={input} value={String(form?.[key] ?? '')} onChange={(event) => setForm((current) => (current ? { ...current, [key]: event.target.value } : current))} {...props} />
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white">Products & services</h1>
        <div className="flex flex-wrap items-start gap-2">
          <CsvTools kind="items" onImported={() => void load()} />
          <button type="button" className={primaryButton} onClick={() => setForm(blank())}><Plus className="h-4 w-4" /> Add item</button>
        </div>
      </header>

      {form && (
        <form onSubmit={save} className={`${card} grid gap-4 sm:grid-cols-4`}>
          <div className="sm:col-span-2">{field('name', 'Name', { required: true, maxLength: 200 })}</div>
          <div>
            <label className={label} htmlFor="i-kind">Type</label>
            <select id="i-kind" className={input} value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as Form['kind'] })}>
              <option value="GOODS">Goods</option><option value="SERVICES">Service</option>
            </select>
          </div>
          {field('unit', 'Unit', { maxLength: 16 })}
          {field('sku', 'SKU', { maxLength: 64 })}
          {field('barcode', 'Barcode', { maxLength: 64 })}
          {field('hsnSac', india ? 'HSN / SAC code' : 'Commodity code', { inputMode: 'numeric', maxLength: 10 })}
          {india ? (
            <div>
              <label className={label} htmlFor="i-tax">GST rate</label>
              <select id="i-tax" className={input} value={form.taxRate} onChange={(event) => setForm({ ...form, taxRate: event.target.value })}>
                {meta?.gstRates.map((rate) => <option key={rate} value={rate}>{rate}%</option>)}
              </select>
            </div>
          ) : field('taxRate', 'Tax rate %', { inputMode: 'decimal' })}
          {field('salePrice', 'Sale price', { inputMode: 'decimal' })}
          {field('purchasePrice', 'Purchase price', { inputMode: 'decimal' })}
          {form.kind === 'GOODS' && (
            <>
              <label className="flex items-end gap-2 pb-2 text-sm font-medium"><input type="checkbox" checked={form.trackInventory} onChange={(event) => setForm({ ...form, trackInventory: event.target.checked })} /> Track stock</label>
              {form.trackInventory && field('reorderLevel', 'Low-stock alert at', { inputMode: 'decimal' })}
            </>
          )}
          <div className="flex gap-2 sm:col-span-4"><button type="submit" className={primaryButton}>Save</button><button type="button" className={secondaryButton} onClick={() => setForm(null)}>Cancel</button></div>
        </form>
      )}
      {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input aria-label="Search items" placeholder="Search name, SKU, barcode or HSN" className={`${input} pl-9`} value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>

      <section className={`${card} p-0`}>
        {loading ? <p className="p-6 text-sm text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading…</p> : items.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">No products or services yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800">
                <tr><th className="px-5 py-3">Name</th><th>SKU</th><th>{india ? 'HSN/SAC' : 'Code'}</th><th className="text-right">Price</th><th className="text-right">Tax</th><th className="text-right">In stock</th><th className="px-5" /></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((item) => {
                  const low = item.trackInventory && item.reorderLevel !== null && Number(item.onHand) <= Number(item.reorderLevel);
                  return (
                    <tr key={item.id}>
                      <td className="px-5 py-3 font-semibold text-slate-900 dark:text-white">{item.name}<span className="ml-2 text-xs font-normal text-slate-500">{item.kind === 'SERVICES' ? 'Service' : item.unit}</span></td>
                      <td className="text-slate-500">{item.sku ?? '—'}</td>
                      <td className="text-slate-500">{item.hsnSac ?? '—'}</td>
                      <td className="text-right">{money(item.salePrice, business?.currency ?? 'USD')}</td>
                      <td className="text-right">{Number(item.taxRate)}%</td>
                      <td className={`text-right font-semibold ${low ? 'text-red-600' : ''}`}>{item.trackInventory ? Number(item.onHand) : '—'}{low && ' · low'}</td>
                      <td className="px-5 text-right">
                        <button type="button" aria-label={`Edit ${item.name}`} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setForm({
                          id: item.id, kind: item.kind, name: item.name, sku: item.sku ?? '', barcode: item.barcode ?? '', unit: item.unit,
                          hsnSac: item.hsnSac ?? '', taxRate: String(Number(item.taxRate)), salePrice: String(Number(item.salePrice)),
                          purchasePrice: String(Number(item.purchasePrice)), trackInventory: item.trackInventory, reorderLevel: item.reorderLevel ? String(Number(item.reorderLevel)) : '',
                        })}><Pencil className="h-4 w-4" /></button>
                        <button type="button" aria-label={`Remove ${item.name}`} className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600" onClick={() => void archive(item)}><Trash2 className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
