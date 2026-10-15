'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Download, FileText, Loader2 } from 'lucide-react';
import DocumentFrame from '../../app/invoices/components/DocumentFrame';

type Shared = { html: string; number: string | null; documentType: string; status: string };

/** Public view of a shared invoice (no account needed). */
export default function SharedDocumentPage() {
  const { token } = useParams<{ token: string }>();
  const [shared, setShared] = useState<Shared | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/v1/public/invoices/${encodeURIComponent(token)}`)
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.message ?? 'This link is not available.');
        setShared(payload.data);
      })
      .catch((loadError) => setError((loadError as Error).message));
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 dark:bg-slate-950">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
            <FileText className="h-4 w-4 text-indigo-600" /> {shared?.number ?? 'Shared document'}
          </p>
          {shared && (
            <a
              href={`/api/v1/public/invoices/${encodeURIComponent(token)}/pdf`}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700"
            >
              <Download className="h-4 w-4" /> Download PDF
            </a>
          )}
        </div>
        {error ? (
          <p role="alert" className="rounded-2xl bg-white p-8 text-center text-sm font-semibold text-slate-600 shadow-sm dark:bg-slate-900">{error}</p>
        ) : !shared ? (
          <p className="text-sm text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading…</p>
        ) : (
          <DocumentFrame title="Document" html={shared.html} maxHeight="88vh" />
        )}
        <p className="mt-4 text-center text-xs text-slate-500">Shared securely with AppToolkitLab Invoice Studio.</p>
      </div>
    </div>
  );
}
