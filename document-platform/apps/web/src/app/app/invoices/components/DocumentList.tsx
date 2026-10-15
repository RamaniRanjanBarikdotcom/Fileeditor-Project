'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { FilePlus2, Loader2, Search } from 'lucide-react';
import { DOCUMENT_LABELS, STATUS_STYLES, api, card, input, money, primaryButton, shortDate, statusLabel } from '../lib';

type Row = {
  id: string;
  documentType: string;
  status: string;
  number: string | null;
  issueDate: string;
  dueDate: string | null;
  currency: string;
  grandTotal: string;
  amountPaid: string;
  counterpartyName: string | null;
  overdue: boolean;
};

export type DocumentTab = { id: string; label: string; create: string | null };

export const SALES_TABS: DocumentTab[] = [
  { id: 'TAX_INVOICE,BILL_OF_SUPPLY,EXPORT_INVOICE', label: 'Invoices', create: 'TAX_INVOICE' },
  { id: 'QUOTATION', label: 'Quotations', create: 'QUOTATION' },
  { id: 'PROFORMA', label: 'Proforma', create: 'PROFORMA' },
  { id: 'CREDIT_NOTE,DEBIT_NOTE', label: 'Credit & debit notes', create: null },
  { id: 'DELIVERY_CHALLAN', label: 'Delivery challans', create: 'DELIVERY_CHALLAN' },
];

export default function DocumentList({ tabs, title }: { tabs: DocumentTab[]; title: string }) {
  const [tab, setTab] = useState(tabs[0]!);
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: tab.id, page: String(page) });
      if (status) params.set('status', status);
      if (query.trim()) params.set('q', query.trim());
      const result = await api<{ items: Row[]; total: number }>(`/invoicing/documents?${params}`);
      setRows(result.items);
      setTotal(result.total);
      setError('');
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  }, [tab, status, query, page]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), query ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, query]);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white">{title}</h1>
        {tab.create && (
          <Link href={`/app/invoices/documents/new?type=${tab.create}`} className={primaryButton}>
            <FilePlus2 className="h-4 w-4" /> New {DOCUMENT_LABELS[tab.create]?.toLowerCase()}
          </Link>
        )}
      </header>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
        {tabs.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => {
              setTab(entry);
              setPage(1);
            }}
            className={`whitespace-nowrap border-b-2 px-3 pb-2 text-sm font-semibold transition ${
              tab.id === entry.id ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input aria-label="Search" placeholder="Search number, reference or customer" className={`${input} pl-9`} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
        </div>
        <select aria-label="Status" className={`${input} sm:w-48`} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'VOID'].map((value) => (
            <option key={value} value={value}>{statusLabel(value)}</option>
          ))}
        </select>
      </div>

      {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
      <section className={`${card} p-0`}>
        {loading ? (
          <p className="p-6 text-sm text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">Nothing here yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800">
                <tr><th className="px-5 py-3">Number</th><th>Type</th><th>Party</th><th>Date</th><th>Due</th><th className="text-right">Total</th><th className="px-5 text-right">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3 font-semibold">
                      <Link href={`/app/invoices/documents/${row.id}`} className="text-indigo-600 hover:underline">{row.number ?? 'Draft'}</Link>
                    </td>
                    <td className="text-slate-600 dark:text-slate-300">{DOCUMENT_LABELS[row.documentType]}</td>
                    <td className="text-slate-600 dark:text-slate-300">{row.counterpartyName}</td>
                    <td className="text-slate-500">{shortDate(row.issueDate)}</td>
                    <td className="text-slate-500">{shortDate(row.dueDate)}</td>
                    <td className="text-right font-semibold">{money(row.grandTotal, row.currency)}</td>
                    <td className="px-5 text-right">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${row.overdue ? 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300' : STATUS_STYLES[row.status]}`}>
                        {statusLabel(row.status, row.overdue)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {total > 50 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <button type="button" className="rounded-lg px-3 py-1 font-semibold disabled:opacity-40" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="text-slate-500">Page {page} of {Math.ceil(total / 50)}</span>
          <button type="button" className="rounded-lg px-3 py-1 font-semibold disabled:opacity-40" disabled={page * 50 >= total} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
