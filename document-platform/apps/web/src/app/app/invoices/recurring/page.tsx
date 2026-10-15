'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Pause, Play, Repeat, Trash2, Zap } from 'lucide-react';
import { api, card, shortDate } from '../lib';

type Profile = {
  id: string;
  sourceDocumentId: string;
  frequency: string;
  nextRunOn: string;
  endOn: string | null;
  autoIssue: boolean;
  emailTo: string | null;
  active: boolean;
  runCount: number;
  lastDocumentId: string | null;
  lastError: string | null;
};

export default function RecurringPage() {
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setProfiles(await api<Profile[]>('/invoicing/recurring'));
    } catch (loadError) {
      setError((loadError as Error).message);
    }
  }, []);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);

  async function act(id: string, action: () => Promise<unknown>) {
    setBusy(id);
    setError('');
    try {
      await action();
      await load();
    } catch (actionError) {
      setError((actionError as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white">Recurring invoices</h1>
        <p className="mt-1 text-sm text-slate-500">Set one up from any invoice with “Repeat”. Invoices are created automatically on schedule.</p>
      </header>
      {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
      <section className={`${card} p-0`}>
        {!profiles ? <p className="p-6 text-sm text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading…</p> : profiles.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">No recurring invoices yet. Open an invoice and choose “Repeat”.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {profiles.map((profile) => (
              <li key={profile.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                    <Repeat className="h-4 w-4 text-indigo-600" />
                    {profile.frequency.charAt(0) + profile.frequency.slice(1).toLowerCase()} ·{' '}
                    <Link className="text-indigo-600 hover:underline" href={`/app/invoices/documents/${profile.sourceDocumentId}`}>source invoice</Link>
                    {!profile.active && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600 dark:bg-slate-800">Paused</span>}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Next {shortDate(profile.nextRunOn)}{profile.endOn ? ` · ends ${shortDate(profile.endOn)}` : ''} · {profile.autoIssue ? `issued automatically${profile.emailTo ? ` and emailed to ${profile.emailTo}` : ''}` : 'created as drafts'} · {profile.runCount} created
                    {profile.lastDocumentId && <> · <Link className="text-indigo-600 hover:underline" href={`/app/invoices/documents/${profile.lastDocumentId}`}>latest</Link></>}
                  </p>
                  {profile.lastError && <p className="mt-1 text-xs font-semibold text-red-600">Paused after an error: {profile.lastError}</p>}
                </div>
                <div className="flex shrink-0 gap-1">
                  {profile.active && (
                    <button type="button" disabled={busy === profile.id} className="rounded-lg px-2 py-1 text-xs font-bold text-indigo-600 hover:bg-indigo-50" onClick={() => void act(profile.id, () => api(`/invoicing/recurring/${profile.id}/run`, { method: 'POST', body: '{}' }))}>
                      <Zap className="mr-1 inline h-3.5 w-3.5" />Create now
                    </button>
                  )}
                  <button type="button" disabled={busy === profile.id} className="rounded-lg px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => void act(profile.id, () => api(`/invoicing/recurring/${profile.id}`, { method: 'PATCH', body: JSON.stringify({ active: !profile.active }) }))}>
                    {profile.active ? <><Pause className="mr-1 inline h-3.5 w-3.5" />Pause</> : <><Play className="mr-1 inline h-3.5 w-3.5" />Resume</>}
                  </button>
                  <button type="button" aria-label="Delete" disabled={busy === profile.id} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => window.confirm('Stop and delete this recurring invoice? Invoices already created stay.') && void act(profile.id, () => api(`/invoicing/recurring/${profile.id}`, { method: 'DELETE' }))}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
