'use client';

import { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useInvoicing } from '../context';
import { api, card, downloadFile, input, label, money, primaryButton } from '../lib';

type Ageing = { contactId: string | null; name: string; currency: string; current: string; '1-30': string; '31-60': string; '61-90': string; '90+': string; total: string };

function monthBounds(month: string) {
  const [year, index] = month.split('-').map(Number) as [number, number];
  const from = new Date(Date.UTC(year, index - 1, 1)).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(year, index, 0)).toISOString().slice(0, 10);
  return { from, to };
}

export default function ReportsPage() {
  const { business } = useInvoicing();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [ageing, setAgeing] = useState<Ageing[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Ageing[]>('/invoicing/reports/receivables').then(setAgeing).catch((loadError) => setError((loadError as Error).message));
  }, []);

  if (!business) return null;
  const { from, to } = monthBounds(month);
  const gst = business.taxRegime === 'IN_GST';
  const vat = business.taxRegime === 'EU_VAT';

  async function download() {
    setBusy(true);
    setError('');
    try {
      const kind = gst ? 'gstr1' : 'vat';
      await downloadFile(`/invoicing/reports/${kind}?businessId=${business!.id}&from=${from}&to=${to}`, `${gst ? 'GSTR-1' : 'VAT'}-${month}.xlsx`);
    } catch (downloadError) {
      setError((downloadError as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white">Reports</h1>
      {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}

      {(gst || vat) && (
        <section className={`${card} flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between`}>
          <div>
            <h2 className="flex items-center gap-2 text-base font-black text-slate-950 dark:text-white">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" /> {gst ? 'GSTR-1 data' : 'VAT return and EC Sales List'}
            </h2>
            <p className="mt-1 max-w-xl text-sm text-slate-500">
              {gst
                ? 'B2B, B2C large and small, exports, credit/debit notes and the HSN summary, in the layout of the GST portal’s offline tool. Review before filing.'
                : 'VAT by treatment and rate, intra-EU supplies per customer VAT ID, and OSS sales by country. Review before filing.'}
            </p>
          </div>
          <div className="flex items-end gap-3">
            <div>
              <label className={label} htmlFor="r-month">Month</label>
              <input id="r-month" type="month" className={input} value={month} onChange={(event) => setMonth(event.target.value)} />
            </div>
            <button type="button" className={primaryButton} disabled={busy} onClick={() => void download()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Excel
            </button>
          </div>
        </section>
      )}

      <section className={`${card} p-0`}>
        <h2 className="px-5 pt-5 text-base font-black text-slate-950 dark:text-white">Receivables ageing</h2>
        <p className="px-5 text-sm text-slate-500">Unpaid amounts by how many days they are past due.</p>
        {!ageing ? (
          <p className="p-5 text-sm text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading…</p>
        ) : ageing.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">Nothing outstanding.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800">
                <tr><th className="px-5 py-2">Customer</th>{['Not due', '1–30', '31–60', '61–90', '90+', 'Total'].map((heading) => <th key={heading} className="px-3 text-right">{heading}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {ageing.map((row) => (
                  <tr key={`${row.contactId ?? row.name}-${row.currency}`}>
                    <td className="px-5 py-2.5 font-semibold">
                      {row.name}
                    </td>
                    {(['current', '1-30', '31-60', '61-90', '90+'] as const).map((bucket) => (
                      <td key={bucket} className={`px-3 text-right ${bucket !== 'current' && Number(row[bucket]) > 0 ? 'text-red-600' : 'text-slate-600 dark:text-slate-300'}`}>
                        {Number(row[bucket]) ? money(row[bucket], row.currency) : '—'}
                      </td>
                    ))}
                    <td className="px-3 text-right font-bold">{money(row.total, row.currency)}</td>
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
