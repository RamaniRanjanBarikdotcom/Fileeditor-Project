'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Ban,
  Copy,
  Download,
  FileCheck2,
  Link2,
  Loader2,
  Mail,
  PackageCheck,
  Repeat,
  Trash2,
  Wallet,
} from 'lucide-react';
import DocumentEditor from '../../components/DocumentEditor';
import DocumentFrame from '../../components/DocumentFrame';
import { useInvoicing } from '../../context';
import {
  DOCUMENT_LABELS,
  STATUS_STYLES,
  api,
  card,
  downloadPdf,
  input,
  label,
  money,
  primaryButton,
  secondaryButton,
  shortDate,
  statusLabel,
  todayIso,
  type DocumentRecord,
  type Warehouse,
} from '../../lib';

type Panel = 'payment' | 'share' | 'email' | 'void' | 'receive' | 'repeat' | null;

export default function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { meta } = useInvoicing();
  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [html, setHtml] = useState('');
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const record = await api<DocumentRecord>(`/invoicing/documents/${id}`);
      setDocument(record);
      if (record.status !== 'DRAFT') setHtml((await api<{ html: string }>(`/invoicing/documents/${id}/html`)).html);
    } catch (loadError) {
      setError((loadError as Error).message);
    }
  }, [id]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);

  if (error && !document) return <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>;
  if (!document) return <p className="text-sm text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading…</p>;
  if (document.status === 'DRAFT') {
    return <DocumentEditor key={document.version} documentType={document.documentType} existing={document} />;
  }

  const type = meta?.documentTypes.find((entry) => entry.id === document.documentType);
  const balance = Number(document.grandTotal) - Number(document.amountPaid);
  const open = ['ISSUED', 'PARTIALLY_PAID'].includes(document.status);
  const receivable = document.documentType === 'PURCHASE_ORDER' && ['ISSUED', 'PARTIALLY_RECEIVED'].includes(document.status);

  async function run<T>(action: () => Promise<T>, success?: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await action();
      setPanel(null);
      await load();
      // Confirm only once the page shows the new state.
      if (success) setNotice(success);
      return result;
    } catch (actionError) {
      setError((actionError as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function convert(targetType: string) {
    const created = await run(() =>
      api<{ id: string }>(`/invoicing/documents/${id}/convert`, { method: 'POST', body: JSON.stringify({ targetType }) }),
    );
    if (created) router.push(`/app/invoices/documents/${created.id}`);
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-5">
      <header className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div>
          <Link href={type?.side === 'purchase' ? '/app/invoices/purchases' : '/app/invoices/documents'} className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-slate-500 hover:text-slate-800">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
          <h1 className="mt-1 flex flex-wrap items-center gap-3 text-2xl font-black text-slate-950 dark:text-white">
            {DOCUMENT_LABELS[document.documentType]} {document.number}
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLES[document.status]}`}>{statusLabel(document.status)}</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {document.buyerJson.name} · {shortDate(document.issueDate)} · {money(document.grandTotal, document.currency)}
            {type?.payable && document.status !== 'VOID' && balance > 0 && <> · <strong className="text-slate-800 dark:text-slate-200">{money(balance.toFixed(2), document.currency)} due</strong></>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={secondaryButton} disabled={busy} onClick={() => void run(() => downloadPdf(`/invoicing/documents/${id}/pdf`, `${document.number}.pdf`))}>
            <Download className="h-4 w-4" /> PDF
          </button>
          <button
            type="button"
            className={secondaryButton}
            disabled={busy}
            title="The copy archived when the document was issued"
            onClick={() => void run(async () => window.open((await api<{ url: string }>(`/invoicing/documents/${id}/original`)).url, '_blank', 'noopener'))}
          >
            <FileCheck2 className="h-4 w-4" /> Legal copy
          </button>
          {document.status !== 'VOID' && (
            <>
              <button type="button" className={secondaryButton} onClick={() => setPanel('share')}><Link2 className="h-4 w-4" /> Share</button>
              <button type="button" className={secondaryButton} onClick={() => setPanel('email')}><Mail className="h-4 w-4" /> Email</button>
            </>
          )}
          {type?.payable && open && (
            <button type="button" className={primaryButton} onClick={() => setPanel('payment')}><Wallet className="h-4 w-4" /> Record payment</button>
          )}
          {receivable && (
            <button type="button" className={primaryButton} onClick={() => setPanel('receive')}><PackageCheck className="h-4 w-4" /> Receive goods</button>
          )}
          {['TAX_INVOICE', 'BILL_OF_SUPPLY', 'EXPORT_INVOICE'].includes(document.documentType) && document.status !== 'VOID' && (
            <button type="button" className={secondaryButton} onClick={() => setPanel('repeat')}><Repeat className="h-4 w-4" /> Repeat</button>
          )}
        </div>
      </header>

      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
      {notice && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">{notice}</p>}

      {panel === 'payment' && <PaymentPanel balance={balance} currency={document.currency} busy={busy} onCancel={() => setPanel(null)} onSubmit={(body) => void run(() => api(`/invoicing/documents/${id}/payments`, { method: 'POST', body: JSON.stringify(body) }), 'Payment recorded.')} />}
      {panel === 'share' && <SharePanel documentId={id} onClose={() => setPanel(null)} />}
      {panel === 'email' && <EmailPanel busy={busy} onCancel={() => setPanel(null)} onSubmit={(to, message) => void run(() => api(`/invoicing/documents/${id}/email`, { method: 'POST', body: JSON.stringify({ to, message: message || undefined }) }), `Sent to ${to}.`)} />}
      {panel === 'void' && <VoidPanel busy={busy} onCancel={() => setPanel(null)} onSubmit={(reason) => void run(() => api(`/invoicing/documents/${id}/void`, { method: 'POST', body: JSON.stringify({ reason }) }), 'Document voided.')} />}
      {panel === 'repeat' && <RepeatPanel busy={busy} onCancel={() => setPanel(null)} onSubmit={(body) => void run(() => api('/invoicing/recurring', { method: 'POST', body: JSON.stringify({ ...body, sourceDocumentId: id }) }), 'Recurring invoice set up. Manage it under Recurring.')} />}
      {panel === 'receive' && <ReceivePanel document={document} busy={busy} onCancel={() => setPanel(null)} onSubmit={(body) => void run(() => api('/inventory/receipts', { method: 'POST', body: JSON.stringify(body) }), 'Goods received into stock.')} />}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <DocumentFrame title="Document" html={html} maxHeight="85vh" />
        <aside className="space-y-4">
          {document.voidReason && (
            <section className={card}><h2 className="text-sm font-black text-red-600">Voided</h2><p className="mt-1 text-sm text-slate-600">{document.voidReason}</p></section>
          )}
          {type?.payable && (
            <section className={card}>
              <h2 className="text-sm font-black text-slate-950 dark:text-white">Payments</h2>
              {document.payments.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No payments yet.</p>
              ) : (
                <ul className="mt-2 space-y-2 text-sm">
                  {document.payments.map((payment) => (
                    <li key={payment.id} className="flex items-center justify-between gap-2">
                      <span>{shortDate(payment.paidOn)} · {payment.method}{payment.reference ? ` · ${payment.reference}` : ''}</span>
                      <span className="flex items-center gap-2 font-semibold">
                        {money(payment.amount, document.currency)}
                        {document.status !== 'VOID' && (
                          <button type="button" aria-label="Delete payment" className="text-slate-400 hover:text-red-600" onClick={() => window.confirm('Delete this payment?') && void run(() => api(`/invoicing/documents/${id}/payments/${payment.id}`, { method: 'DELETE' }), 'Payment deleted.')}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          {(document.referenceDocument || document.referencedBy.length > 0) && (
            <section className={card}>
              <h2 className="text-sm font-black text-slate-950 dark:text-white">Related</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {document.referenceDocument && (
                  <li><Link className="text-indigo-600 hover:underline" href={`/app/invoices/documents/${document.referenceDocument.id}`}>{DOCUMENT_LABELS[document.referenceDocument.documentType]} {document.referenceDocument.number}</Link></li>
                )}
                {document.referencedBy.map((entry) => (
                  <li key={entry.id}><Link className="text-indigo-600 hover:underline" href={`/app/invoices/documents/${entry.id}`}>{DOCUMENT_LABELS[entry.documentType]} {entry.number ?? '(draft)'}</Link> <span className="text-xs text-slate-500">{statusLabel(entry.status)}</span></li>
                ))}
              </ul>
            </section>
          )}
          {document.status !== 'VOID' && type && type.convertsTo.length > 0 && (
            <section className={card}>
              <h2 className="text-sm font-black text-slate-950 dark:text-white">Create from this</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {type.convertsTo.map((target) => (
                  <button key={target} type="button" disabled={busy} className={secondaryButton} onClick={() => void convert(target)}>
                    <Repeat className="h-4 w-4" /> {DOCUMENT_LABELS[target]}
                  </button>
                ))}
              </div>
            </section>
          )}
          {document.status !== 'VOID' && (
            <button type="button" className="inline-flex items-center gap-2 text-sm font-bold text-red-600 hover:underline" onClick={() => setPanel('void')}>
              <Ban className="h-4 w-4" /> Void this document
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}

function PanelShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={`${card} border-indigo-200 dark:border-indigo-500/30`}>
      <h2 className="mb-3 text-sm font-black text-slate-950 dark:text-white">{title}</h2>
      {children}
    </section>
  );
}

function PaymentPanel({ balance, currency, busy, onCancel, onSubmit }: { balance: number; currency: string; busy: boolean; onCancel: () => void; onSubmit: (body: Record<string, string>) => void }) {
  const [form, setForm] = useState({ paidOn: todayIso(), amount: balance.toFixed(2), method: 'BANK', reference: '' });
  return (
    <PanelShell title={`Record payment (balance ${money(balance.toFixed(2), currency)})`}>
      <form className="grid gap-3 sm:grid-cols-5" onSubmit={(event) => { event.preventDefault(); onSubmit({ ...form, reference: form.reference || undefined } as Record<string, string>); }}>
        <div><label className={label} htmlFor="pay-date">Date</label><input id="pay-date" type="date" className={input} value={form.paidOn} onChange={(event) => setForm({ ...form, paidOn: event.target.value })} /></div>
        <div><label className={label} htmlFor="pay-amount">Amount</label><input id="pay-amount" inputMode="decimal" className={input} value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></div>
        <div><label className={label} htmlFor="pay-method">Method</label>
          <select id="pay-method" className={input} value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })}>
            {['BANK', 'UPI', 'CASH', 'CARD', 'CHEQUE', 'OTHER'].map((method) => <option key={method} value={method}>{method}</option>)}
          </select>
        </div>
        <div><label className={label} htmlFor="pay-ref">Reference</label><input id="pay-ref" maxLength={80} className={input} value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} /></div>
        <div className="flex items-end gap-2"><button type="submit" disabled={busy} className={primaryButton}>Save</button><button type="button" className={secondaryButton} onClick={onCancel}>Cancel</button></div>
      </form>
    </PanelShell>
  );
}

function SharePanel({ documentId, onClose }: { documentId: string; onClose: () => void }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    api<{ token: string }>(`/invoicing/documents/${documentId}/share-links`, { method: 'POST', body: JSON.stringify({ expiresInDays: 30 }) })
      .then((link) => setUrl(`${window.location.origin}/i/${link.token}`))
      .catch((shareError) => setError((shareError as Error).message));
  }, [documentId]);
  return (
    <PanelShell title="Share link (valid for 30 days)">
      {error ? <p className="text-sm text-red-600">{error}</p> : (
        <div className="flex gap-2">
          <input aria-label="Share link" readOnly className={input} value={url || 'Creating link…'} />
          <button type="button" className={secondaryButton} disabled={!url} onClick={() => { void navigator.clipboard.writeText(url); setCopied(true); }}>
            <Copy className="h-4 w-4" /> {copied ? 'Copied' : 'Copy'}
          </button>
          <button type="button" className={secondaryButton} onClick={onClose}>Done</button>
        </div>
      )}
    </PanelShell>
  );
}

function EmailPanel({ busy, onCancel, onSubmit }: { busy: boolean; onCancel: () => void; onSubmit: (to: string, message: string) => void }) {
  const [to, setTo] = useState('');
  const [message, setMessage] = useState('');
  return (
    <PanelShell title="Email with PDF attached">
      <form className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]" onSubmit={(event) => { event.preventDefault(); onSubmit(to, message); }}>
        <input aria-label="Recipient email" type="email" required placeholder="customer@example.com" className={input} value={to} onChange={(event) => setTo(event.target.value)} />
        <input aria-label="Message" placeholder="Message (optional)" maxLength={2000} className={input} value={message} onChange={(event) => setMessage(event.target.value)} />
        <div className="flex gap-2"><button type="submit" disabled={busy} className={primaryButton}>Send</button><button type="button" className={secondaryButton} onClick={onCancel}>Cancel</button></div>
      </form>
    </PanelShell>
  );
}

function VoidPanel({ busy, onCancel, onSubmit }: { busy: boolean; onCancel: () => void; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  return (
    <PanelShell title="Void this document">
      <p className="mb-3 text-sm text-slate-500">The number stays used and the document is kept for your records. Stock it moved is returned.</p>
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); onSubmit(reason); }}>
        <input aria-label="Reason" required maxLength={500} placeholder="Reason" className={input} value={reason} onChange={(event) => setReason(event.target.value)} />
        <button type="submit" disabled={busy || !reason.trim()} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Void</button>
        <button type="button" className={secondaryButton} onClick={onCancel}>Cancel</button>
      </form>
    </PanelShell>
  );
}

function RepeatPanel({ busy, onCancel, onSubmit }: { busy: boolean; onCancel: () => void; onSubmit: (body: Record<string, unknown>) => void }) {
  // Lazy initialiser: "tomorrow" is computed once, not on every render.
  const [form, setForm] = useState(() => ({
    frequency: 'MONTHLY',
    startOn: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
    endOn: '',
    autoIssue: true,
    emailTo: '',
  }));
  return (
    <PanelShell title="Repeat this invoice">
      <form className="grid gap-3 sm:grid-cols-5" onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ frequency: form.frequency, startOn: form.startOn, endOn: form.endOn || undefined, autoIssue: form.autoIssue, emailTo: form.autoIssue && form.emailTo ? form.emailTo : undefined });
      }}>
        <div><label className={label} htmlFor="rp-frequency">Every</label>
          <select id="rp-frequency" className={input} value={form.frequency} onChange={(event) => setForm({ ...form, frequency: event.target.value })}>
            <option value="WEEKLY">Week</option><option value="MONTHLY">Month</option><option value="QUARTERLY">Quarter</option><option value="YEARLY">Year</option>
          </select>
        </div>
        <div><label className={label} htmlFor="rp-start">First invoice</label><input id="rp-start" type="date" min={todayIso()} className={input} value={form.startOn} onChange={(event) => setForm({ ...form, startOn: event.target.value })} /></div>
        <div><label className={label} htmlFor="rp-end">Stop after (optional)</label><input id="rp-end" type="date" className={input} value={form.endOn} onChange={(event) => setForm({ ...form, endOn: event.target.value })} /></div>
        <div><label className={label} htmlFor="rp-email">Email to (optional)</label><input id="rp-email" type="email" className={input} disabled={!form.autoIssue} value={form.emailTo} onChange={(event) => setForm({ ...form, emailTo: event.target.value })} /></div>
        <label className="flex items-end gap-2 pb-2 text-sm font-medium"><input type="checkbox" checked={form.autoIssue} onChange={(event) => setForm({ ...form, autoIssue: event.target.checked })} /> Issue automatically</label>
        <div className="flex gap-2 sm:col-span-5"><button type="submit" disabled={busy} className={primaryButton}>Set up</button><button type="button" className={secondaryButton} onClick={onCancel}>Cancel</button></div>
      </form>
    </PanelShell>
  );
}

function ReceivePanel({ document, busy, onCancel, onSubmit }: { document: DocumentRecord; busy: boolean; onCancel: () => void; onSubmit: (body: unknown) => void }) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(document.lines.map((line) => [line.id, String(Math.max(0, Number(line.quantity) - Number(line.receivedQuantity)))])),
  );
  useEffect(() => {
    api<Warehouse[]>('/inventory/warehouses').then((list) => {
      setWarehouses(list);
      setWarehouseId(list.find((warehouse) => warehouse.isDefault)?.id ?? list[0]?.id ?? '');
    }).catch(() => undefined);
  }, []);
  const lines = document.lines.filter((line) => line.itemId && Number(quantities[line.id]) > 0);
  return (
    <PanelShell title="Receive goods into stock">
      <form className="space-y-3" onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          purchaseOrderId: document.id,
          warehouseId,
          receivedOn: todayIso(),
          lines: lines.map((line) => ({ itemId: line.itemId, purchaseOrderLineId: line.id, quantity: quantities[line.id], unitCost: String(Number(line.unitPrice)) })),
        });
      }}>
        <select aria-label="Warehouse" className={`${input} sm:w-64`} value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
          {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
        </select>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-500"><tr><th>Item</th><th>Ordered</th><th>Received</th><th>Receive now</th></tr></thead>
          <tbody>
            {document.lines.filter((line) => line.itemId).map((line) => (
              <tr key={line.id}>
                <td className="py-1">{line.description}</td>
                <td>{Number(line.quantity)}</td>
                <td>{Number(line.receivedQuantity)}</td>
                <td><input aria-label={`Receive ${line.description}`} inputMode="decimal" className={`${input} w-28`} value={quantities[line.id] ?? '0'} onChange={(event) => setQuantities({ ...quantities, [line.id]: event.target.value })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex gap-2"><button type="submit" disabled={busy || !lines.length || !warehouseId} className={primaryButton}>Receive</button><button type="button" className={secondaryButton} onClick={onCancel}>Cancel</button></div>
      </form>
    </PanelShell>
  );
}
