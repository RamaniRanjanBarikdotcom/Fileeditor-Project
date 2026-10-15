'use client';

import { useState } from 'react';
import { Download, Loader2, Upload } from 'lucide-react';
import { fetchWithAuth } from '../../../../lib/api';
import { downloadFile, errorMessage, secondaryButton } from '../lib';

type Result = { created: number; updated: number; errors: Array<{ row: number; message: string }> };

const COLUMNS: Record<'items' | 'contacts', string> = {
  items: 'name, kind (goods/service), sku, barcode, unit, hsn_sac, tax_rate, sale_price, purchase_price, track_stock (yes/no), reorder_level',
  contacts: 'name, type (customer/supplier/both), country, state_code, tax_id, email, phone, address, city, postal_code, payment_terms_days',
};

/** CSV export and import for products or contacts, with per-row errors. */
export default function CsvTools({ kind, onImported }: { kind: 'items' | 'contacts'; onImported: () => void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');

  async function importFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError('');
    setResult(null);
    const body = new FormData();
    body.append('file', file);
    const response = await fetchWithAuth(`/api/v1/invoicing/${kind}/import`, { method: 'POST', body });
    const payload = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) {
      setError(errorMessage(payload, 'The import failed.'));
      return;
    }
    setResult(payload.data);
    onImported();
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <button type="button" className={secondaryButton} onClick={() => void downloadFile(`/invoicing/${kind}/export`, `${kind === 'items' ? 'products' : 'contacts'}.csv`).catch((downloadError) => setError((downloadError as Error).message))}>
          <Download className="h-4 w-4" /> Export CSV
        </button>
        <label className={`${secondaryButton} cursor-pointer`} title={`Columns: ${COLUMNS[kind]}`}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Import CSV
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => { void importFile(event.target.files?.[0]); event.target.value = ''; }} />
        </label>
      </div>
      {error && <p role="alert" className="text-xs font-semibold text-red-600">{error}</p>}
      {result && (
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-900">
          <p className="font-semibold text-slate-800 dark:text-slate-200">{result.created} added · {result.updated} updated · {result.errors.length} skipped</p>
          {result.errors.slice(0, 8).map((rowError) => (
            <p key={rowError.row} className="mt-1 text-red-600">Row {rowError.row}: {rowError.message}</p>
          ))}
          <p className="mt-2 text-slate-500">Columns: {COLUMNS[kind]}</p>
        </div>
      )}
    </div>
  );
}
