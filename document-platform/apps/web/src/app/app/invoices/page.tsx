'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, FilePlus2, FileText, Gauge, Receipt, ShoppingCart, Wallet } from 'lucide-react';
import { useInvoicing } from './context';
import { DOCUMENT_LABELS, STATUS_STYLES, api, card, money, primaryButton, secondaryButton, shortDate, statusLabel } from './lib';

type Summary = {
  outstanding: Array<{ currency: string; amount: string; documents: number }>;
  overdueCount: number;
  salesThisMonth: Array<{ currency: string; amount: string; documents: number }>;
  draftCount: number;
};
type Usage = {
  plan: { key: string; name: string; isFree: boolean };
  limits: Record<string, number>;
  usageThisMonth: Record<string, number>;
};
type Recent = { items: Array<{ id: string; documentType: string; status: string; number: string | null; issueDate: string; currency: string; grandTotal: string; counterpartyName: string | null; overdue: boolean }> };

export default function InvoicesOverviewPage() {
  const { business } = useInvoicing();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [recent, setRecent] = useState<Recent['items']>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api<Summary>('/invoicing/documents/summary'),
      api<Usage>('/invoicing/usage'),
      api<Recent>('/invoicing/documents?side=sales'),
    ])
      .then(([summaryData, usageData, recentData]) => {
        setSummary(summaryData);
        setUsage(usageData);
        setRecent(recentData.items.slice(0, 8));
      })
      .catch((loadError) => setError((loadError as Error).message));
  }, []);

  const invoiceLimit = usage?.limits.invoicesPerMonth;
  const used = usage?.usageThisMonth.invoicesPerMonth ?? 0;
  const amounts = (rows?: Array<{ currency: string; amount: string }>) =>
    rows?.length ? rows.map((row) => money(row.amount, row.currency)).join(' · ') : money(0, business?.currency ?? 'USD');

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <span className="text-xs font-bold uppercase tracking-[.16em] text-indigo-500">Invoice Studio</span>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950 dark:text-white">{business?.name}</h1>
          <p className="mt-1 text-sm text-slate-500">Invoices, quotations, purchases and stock in one place.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/invoices/documents/new?type=TAX_INVOICE" className={primaryButton}>
            <FilePlus2 className="h-4 w-4" /> New invoice
          </Link>
          <Link href="/app/invoices/documents/new?type=QUOTATION" className={secondaryButton}>
            <FileText className="h-4 w-4" /> Quotation
          </Link>
          <Link href="/app/invoices/purchases" className={secondaryButton}>
            <ShoppingCart className="h-4 w-4" /> Purchase
          </Link>
        </div>
      </header>

      {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={card}>
          <Wallet className="h-5 w-5 text-indigo-600" />
          <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-500">Outstanding</p>
          <p className="mt-1 text-xl font-black text-slate-950 dark:text-white">{summary ? amounts(summary.outstanding) : '…'}</p>
        </div>
        <div className={card}>
          <AlertTriangle className={`h-5 w-5 ${summary?.overdueCount ? 'text-red-500' : 'text-slate-400'}`} />
          <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-500">Overdue</p>
          <p className="mt-1 text-xl font-black text-slate-950 dark:text-white">{summary ? `${summary.overdueCount} invoices` : '…'}</p>
        </div>
        <div className={card}>
          <Receipt className="h-5 w-5 text-emerald-600" />
          <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-500">Sales this month</p>
          <p className="mt-1 text-xl font-black text-slate-950 dark:text-white">{summary ? amounts(summary.salesThisMonth) : '…'}</p>
        </div>
        <div className={card}>
          <Gauge className="h-5 w-5 text-indigo-600" />
          <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-500">{usage ? `${usage.plan.name} plan` : 'Plan'}</p>
          <p className="mt-1 text-xl font-black text-slate-950 dark:text-white">
            {invoiceLimit === undefined ? '…' : invoiceLimit === -1 ? `${used} invoices` : `${used} / ${invoiceLimit} invoices`}
          </p>
          {invoiceLimit !== undefined && invoiceLimit !== -1 && (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-full rounded-full bg-indigo-600" style={{ width: `${Math.min(100, (used / Math.max(1, invoiceLimit)) * 100)}%` }} />
            </div>
          )}
          {usage?.plan.isFree && (
            <Link href="/app/invoices/settings?tab=plan" className="mt-2 inline-block text-xs font-bold text-indigo-600 hover:underline">
              Upgrade for unlimited invoices
            </Link>
          )}
        </div>
      </section>

      <section className={card}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-black text-slate-950 dark:text-white">Recent sales documents</h2>
          <Link href="/app/invoices/documents" className="text-sm font-bold text-indigo-600 hover:underline">View all</Link>
        </div>
        {recent.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No documents yet. Create your first invoice.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="py-2">Number</th><th>Type</th><th>Customer</th><th>Date</th><th className="text-right">Total</th><th className="text-right">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {recent.map((document) => (
                  <tr key={document.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 font-semibold">
                      <Link href={`/app/invoices/documents/${document.id}`} className="text-indigo-600 hover:underline">{document.number ?? 'Draft'}</Link>
                    </td>
                    <td className="text-slate-600 dark:text-slate-300">{DOCUMENT_LABELS[document.documentType]}</td>
                    <td className="text-slate-600 dark:text-slate-300">{document.counterpartyName}</td>
                    <td className="text-slate-500">{shortDate(document.issueDate)}</td>
                    <td className="text-right font-semibold">{money(document.grandTotal, document.currency)}</td>
                    <td className="text-right">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${document.overdue ? 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300' : STATUS_STYLES[document.status]}`}>
                        {statusLabel(document.status, document.overdue)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
