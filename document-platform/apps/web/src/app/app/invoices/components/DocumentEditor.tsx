'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Barcode, Loader2, Plus, Save, Send, Trash2 } from 'lucide-react';
import { useInvoicing } from '../context';
import DocumentFrame from './DocumentFrame';
import {
  COUNTRIES,
  DOCUMENT_LABELS,
  api,
  card,
  input,
  label,
  money,
  primaryButton,
  secondaryButton,
  todayIso,
  type Contact,
  type DocumentRecord,
  type Item,
  type Line,
  type Warehouse,
} from '../lib';

type Calculation = {
  treatment: string;
  subtotal: string;
  discountTotal: string;
  taxableTotal: string;
  taxTotal: string;
  reverseChargeTaxTotal: string;
  roundOff: string;
  grandTotal: string;
  taxBreakdown: Array<{ code: string; rate: string; amount: string }>;
  warnings: string[];
};

const blankLine = (): Line => ({ description: '', quantity: '1', unitPrice: '0', taxRate: '0', supplyKind: 'GOODS' });

/** Accepts "12", "12.5", "1,5" (comma decimal) and returns the API's decimal string. */
function decimal(value: string) {
  const normalized = value.replace(',', '.').trim();
  return /^\d{1,14}(\.\d{1,4})?$/.test(normalized) ? normalized : null;
}

export default function DocumentEditor({
  documentType,
  existing,
  referenceDocumentId,
}: {
  documentType: string;
  existing?: DocumentRecord;
  referenceDocumentId?: string;
}) {
  const router = useRouter();
  const { business, meta } = useInvoicing();
  const typeDefinition = meta?.documentTypes.find((type) => type.id === documentType);
  const purchase = typeDefinition?.side === 'purchase';
  const india = business?.taxRegime === 'IN_GST';
  const eu = business?.taxRegime === 'EU_VAT';

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [contactId, setContactId] = useState(existing?.contactId ?? '');
  const [issueDate, setIssueDate] = useState(existing?.issueDate.slice(0, 10) ?? todayIso());
  const [dueDate, setDueDate] = useState(existing?.dueDate?.slice(0, 10) ?? '');
  const [placeState, setPlaceState] = useState(existing?.placeOfSupplyState ?? '');
  const [language, setLanguage] = useState(existing?.language ?? business?.language ?? 'en');
  const [secondaryLanguage, setSecondaryLanguage] = useState(existing?.secondaryLanguage ?? business?.secondaryLanguage ?? '');
  const [template, setTemplate] = useState(existing?.template ?? business?.template ?? 'classic');
  const [flags, setFlags] = useState({
    pricesIncludeTax: existing?.pricesIncludeTax ?? business?.pricesIncludeTax ?? false,
    reverseCharge: existing?.reverseCharge ?? false,
    exportWithPayment: existing?.exportWithPayment ?? false,
    euOss: existing?.euOss ?? false,
    returnToStock: existing?.returnToStock ?? false,
  });
  const [warehouseId, setWarehouseId] = useState(existing?.warehouseId ?? '');
  const [reference, setReference] = useState(existing?.reference ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? business?.defaultNotes ?? '');
  const [terms, setTerms] = useState(existing?.terms ?? business?.defaultTerms ?? '');
  const [lines, setLines] = useState<Line[]>(
    existing?.lines.length
      ? existing.lines.map((line) => ({
          itemId: line.itemId ?? undefined,
          description: line.description,
          details: line.details ?? undefined,
          hsnSac: line.hsnSac ?? undefined,
          quantity: String(Number(line.quantity)),
          unit: line.unit ?? undefined,
          unitPrice: String(Number(line.unitPrice)),
          discountType: (line.discountType as Line['discountType']) ?? undefined,
          discountValue: line.discountValue ? String(Number(line.discountValue)) : undefined,
          taxRate: String(Number(line.taxRate)),
          cessRate: String(Number(line.cessRate)),
          taxCategory: line.taxCategory,
          supplyKind: line.supplyKind,
        }))
      : [blankLine()],
  );
  const [quickContact, setQuickContact] = useState<{ name: string; country: string; stateCode: string; taxId: string } | null>(null);
  const [barcode, setBarcode] = useState('');
  const [calculation, setCalculation] = useState<Calculation | null>(null);
  const [html, setHtml] = useState('');
  const [previewError, setPreviewError] = useState('');
  const [busy, setBusy] = useState<'save' | 'issue' | null>(null);
  const [error, setError] = useState('');
  const idempotencyKey = useRef(`issue-${crypto.randomUUID()}`);

  useEffect(() => {
    const kind = purchase ? 'supplier' : 'customer';
    Promise.all([
      api<{ items: Contact[] }>(`/invoicing/contacts?type=${kind}`),
      api<{ items: Item[] }>('/invoicing/items'),
      api<Warehouse[]>('/inventory/warehouses').catch(() => [] as Warehouse[]),
    ])
      .then(([contactList, itemList, warehouseList]) => {
        setContacts(contactList.items);
        setItems(itemList.items);
        setWarehouses(warehouseList);
      })
      .catch((loadError) => setError((loadError as Error).message));
  }, [purchase]);

  const contact = contacts.find((entry) => entry.id === contactId);

  // Place of supply follows the customer's state unless changed.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    if (contact && india && !existing) setPlaceState(contact.stateCode ?? '');
  }, [contact, india, existing]);

  const payload = useMemo(() => {
    if (!business) return null;
    const cleanLines = lines
      .filter((line) => line.description.trim())
      .map((line) => ({
        ...line,
        description: line.description.trim(),
        quantity: decimal(line.quantity) ?? '0',
        unitPrice: decimal(line.unitPrice) ?? '0',
        taxRate: decimal(line.taxRate ?? '0') ?? '0',
        discountValue: line.discountValue ? (decimal(line.discountValue) ?? undefined) : undefined,
        discountType: line.discountValue ? (line.discountType ?? 'PERCENT') : undefined,
        hsnSac: line.hsnSac?.trim() || undefined,
        details: line.details?.trim() || undefined,
      }));
    return {
      businessId: business.id,
      documentType,
      issueDate,
      dueDate: dueDate || undefined,
      contactId: contactId || undefined,
      // One-off customer details (no saved contact): keep a draft's own, else a
      // placeholder used only for the live preview (saving requires a customer).
      ...(contactId
        ? {}
        : {
            buyer: existing?.buyerJson?.name
              ? {
                  name: existing.buyerJson.name,
                  country: existing.buyerJson.country ?? business.country,
                  stateCode: existing.buyerJson.stateCode ?? undefined,
                  taxId: existing.buyerJson.taxId ?? undefined,
                  address: existing.buyerJson.address,
                }
              : { name: purchase ? 'Supplier' : 'Customer', country: business.country },
          }),
      ...(india && placeState && !purchase ? { placeOfSupplyCountry: 'IN', placeOfSupplyState: placeState } : {}),
      language,
      secondaryLanguage: secondaryLanguage || null,
      template,
      ...flags,
      warehouseId: warehouseId || undefined,
      reference: reference || undefined,
      notes: notes || null,
      terms: terms || null,
      referenceDocumentId: existing?.referenceDocumentId ?? referenceDocumentId,
      lines: cleanLines.length ? cleanLines : [{ description: '—', quantity: '1', unitPrice: '0' }],
    };
  }, [business, documentType, issueDate, dueDate, contactId, india, placeState, purchase, language, secondaryLanguage, template, flags, warehouseId, reference, notes, terms, existing, referenceDocumentId, lines]);

  // Live preview (debounced), rendered by the same code as the PDF.
  useEffect(() => {
    if (!payload) return;
    const timer = setTimeout(() => {
      api<{ calculation: Calculation; html: string }>('/invoicing/documents/preview', { method: 'POST', body: JSON.stringify(payload) })
        .then((result) => {
          setCalculation(result.calculation);
          setHtml(result.html);
          setPreviewError('');
        })
        .catch((previewFailure) => setPreviewError((previewFailure as Error).message));
    }, 450);
    return () => clearTimeout(timer);
  }, [payload]);

  const updateLine = (index: number, patch: Partial<Line>) =>
    setLines((current) => current.map((line, position) => (position === index ? { ...line, ...patch } : line)));

  const fromItem = (item: Item): Partial<Line> => ({
      itemId: item.id,
      description: item.name,
      hsnSac: item.hsnSac ?? undefined,
      unit: item.unit,
      unitPrice: String(Number(purchase ? item.purchasePrice : item.salePrice)),
      taxRate: String(Number(item.taxRate)),
      cessRate: String(Number(item.cessRate)),
      taxCategory: item.taxCategory,
      supplyKind: item.kind,
    });
  const applyItem = (index: number, item: Item) => updateLine(index, fromItem(item));

  async function scan(event: React.FormEvent) {
    event.preventDefault();
    if (!barcode.trim()) return;
    try {
      const item = await api<Item>(`/invoicing/items/lookup?code=${encodeURIComponent(barcode.trim())}`);
      setLines((current) => {
        const empty = current.findIndex((line) => !line.description.trim());
        const scanned = { ...blankLine(), ...fromItem(item) };
        return empty >= 0
          ? current.map((line, position) => (position === empty ? { ...line, ...scanned } : line))
          : [...current, scanned];
      });
      setBarcode('');
    } catch (scanError) {
      setError((scanError as Error).message);
    }
  }

  async function addQuickContact() {
    if (!quickContact?.name.trim()) return;
    try {
      const created = await api<Contact>('/invoicing/contacts', {
        method: 'POST',
        body: JSON.stringify({
          name: quickContact.name,
          country: quickContact.country,
          stateCode: quickContact.country === 'IN' ? quickContact.stateCode || undefined : undefined,
          taxId: quickContact.taxId || undefined,
          isCustomer: !purchase,
          isSupplier: purchase,
        }),
      });
      setContacts((current) => [...current, created]);
      setContactId(created.id);
      setQuickContact(null);
    } catch (contactError) {
      setError((contactError as Error).message);
    }
  }

  async function save(issue: boolean) {
    if (!payload) return;
    if (!lines.some((line) => line.description.trim())) {
      setError('Add at least one line.');
      return;
    }
    if (!contactId && !existing?.buyerJson?.name) {
      setError(purchase ? 'Choose or add a supplier.' : 'Choose or add a customer.');
      return;
    }
    setBusy(issue ? 'issue' : 'save');
    setError('');
    try {
      const saved = existing
        ? await api<DocumentRecord>(`/invoicing/documents/${existing.id}`, { method: 'PUT', body: JSON.stringify({ ...payload, version: existing.version }) })
        : await api<DocumentRecord>('/invoicing/documents', { method: 'POST', body: JSON.stringify(payload) });
      if (issue) {
        await api(`/invoicing/documents/${saved.id}/issue`, { method: 'POST', body: JSON.stringify({ idempotencyKey: idempotencyKey.current }) });
      }
      router.push(`/app/invoices/documents/${saved.id}`);
    } catch (saveError) {
      setError((saveError as Error).message);
      setBusy(null);
    }
  }

  if (!business || !meta) return null;
  const currency = contact?.currency ?? business.currency;

  return (
    <div className="mx-auto max-w-[1500px]">
      <header className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <span className="text-xs font-bold uppercase tracking-[.16em] text-indigo-500">{existing ? 'Edit draft' : 'New'}</span>
          <h1 className="text-2xl font-black text-slate-950 dark:text-white">{DOCUMENT_LABELS[documentType] ?? documentType}</h1>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void save(false)} disabled={busy !== null} className={secondaryButton}>
            {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save draft
          </button>
          <button type="button" onClick={() => void save(true)} disabled={busy !== null || Boolean(previewError)} className={primaryButton}>
            {busy === 'issue' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Save &amp; issue
          </button>
        </div>
      </header>
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-5">
          <section className={card}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={label} htmlFor="doc-contact">{purchase ? 'Supplier' : 'Customer'}</label>
                <div className="flex gap-2">
                  <select id="doc-contact" className={input} value={contactId} onChange={(event) => setContactId(event.target.value)}>
                    <option value="">Choose…</option>
                    {contacts.map((entry) => (
                      <option key={entry.id} value={entry.id}>{entry.name}{entry.taxId ? ` · ${entry.taxId}` : ''}</option>
                    ))}
                  </select>
                  <button type="button" className={secondaryButton} onClick={() => setQuickContact({ name: '', country: business.country, stateCode: business.stateCode ?? '', taxId: '' })}>
                    <Plus className="h-4 w-4" /> New
                  </button>
                </div>
                {quickContact && (
                  <div className="mt-3 grid gap-2 rounded-xl border border-dashed border-slate-300 p-3 dark:border-slate-700 sm:grid-cols-2">
                    <input aria-label="Name" placeholder="Name" className={input} value={quickContact.name} onChange={(event) => setQuickContact({ ...quickContact, name: event.target.value })} />
                    <select aria-label="Country" className={input} value={quickContact.country} onChange={(event) => setQuickContact({ ...quickContact, country: event.target.value })}>
                      {COUNTRIES.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
                    </select>
                    {quickContact.country === 'IN' && (
                      <select aria-label="State" className={input} value={quickContact.stateCode} onChange={(event) => setQuickContact({ ...quickContact, stateCode: event.target.value })}>
                        <option value="">State…</option>
                        {meta.indiaStates.map((state) => <option key={state.code} value={state.code}>{state.code} · {state.name}</option>)}
                      </select>
                    )}
                    <input aria-label="Tax ID" placeholder={quickContact.country === 'IN' ? 'GSTIN (optional)' : 'VAT / tax ID (optional)'} className={input} value={quickContact.taxId} onChange={(event) => setQuickContact({ ...quickContact, taxId: event.target.value })} />
                    <div className="flex gap-2 sm:col-span-2">
                      <button type="button" className={primaryButton} onClick={() => void addQuickContact()}>Add</button>
                      <button type="button" className={secondaryButton} onClick={() => setQuickContact(null)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className={label} htmlFor="doc-date">Date</label>
                <input id="doc-date" type="date" className={input} value={issueDate} onChange={(event) => setIssueDate(event.target.value)} />
              </div>
              {typeDefinition?.payable && (
                <div>
                  <label className={label} htmlFor="doc-due">Due date</label>
                  <input id="doc-due" type="date" className={input} value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
                </div>
              )}
              {india && !purchase && (
                <div>
                  <label className={label} htmlFor="doc-pos">Place of supply</label>
                  <select id="doc-pos" className={input} value={placeState} onChange={(event) => setPlaceState(event.target.value)}>
                    <option value="">From customer address</option>
                    {meta.indiaStates.map((state) => <option key={state.code} value={state.code}>{state.code} · {state.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className={label} htmlFor="doc-ref">{purchase ? 'Supplier reference' : 'Reference / PO number'}</label>
                <input id="doc-ref" maxLength={80} className={input} value={reference} onChange={(event) => setReference(event.target.value)} />
              </div>
            </div>
          </section>

          <section className={card}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-black text-slate-950 dark:text-white">Lines</h2>
              <form onSubmit={scan} className="flex items-center gap-2">
                <Barcode className="h-4 w-4 text-slate-400" />
                <input aria-label="Scan barcode or SKU" placeholder="Scan barcode / SKU" className={`${input} w-44`} value={barcode} onChange={(event) => setBarcode(event.target.value)} />
              </form>
            </div>
            <div className="space-y-3">
              {lines.map((line, index) => (
                <div key={index} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                    <div className="flex gap-2">
                      <select
                        aria-label="Product"
                        className={`${input} max-w-[40%]`}
                        value={line.itemId ?? ''}
                        onChange={(event) => {
                          const item = items.find((entry) => entry.id === event.target.value);
                          if (item) applyItem(index, item);
                          else updateLine(index, { itemId: undefined });
                        }}
                      >
                        <option value="">Free text</option>
                        {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                      <input aria-label="Description" placeholder="Description" className={input} value={line.description} onChange={(event) => updateLine(index, { description: event.target.value })} />
                    </div>
                    <button type="button" aria-label="Remove line" className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, position) => position !== index))}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <LineField title="Qty">
                      <input aria-label="Quantity" inputMode="decimal" className={input} value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} />
                    </LineField>
                    <LineField title="Unit">
                      <input aria-label="Unit" placeholder="pcs" className={input} value={line.unit ?? ''} onChange={(event) => updateLine(index, { unit: event.target.value })} />
                    </LineField>
                    <LineField title={`Price (${currency})`}>
                      <input aria-label="Unit price" inputMode="decimal" className={input} value={line.unitPrice} onChange={(event) => updateLine(index, { unitPrice: event.target.value })} />
                    </LineField>
                    <LineField title="Discount %">
                      <input aria-label="Discount %" placeholder="0" inputMode="decimal" className={input} value={line.discountValue ?? ''} onChange={(event) => updateLine(index, { discountValue: event.target.value || undefined, discountType: 'PERCENT' })} />
                    </LineField>
                    <LineField title={india ? 'GST' : 'Tax %'}>
                      {india ? (
                        <select aria-label="GST rate" className={input} value={line.taxRate ?? '0'} onChange={(event) => updateLine(index, { taxRate: event.target.value })}>
                          {[...new Set([...meta.gstRates, line.taxRate ?? '0'])].map((rate) => <option key={rate} value={rate}>{rate}%</option>)}
                        </select>
                      ) : (
                        <input aria-label="Tax rate %" placeholder="0" inputMode="decimal" className={input} value={line.taxRate ?? ''} onChange={(event) => updateLine(index, { taxRate: event.target.value })} />
                      )}
                    </LineField>
                    <LineField title={india ? 'HSN / SAC' : 'Type'}>
                      {india ? (
                        <input aria-label="HSN/SAC" placeholder="7318" className={input} value={line.hsnSac ?? ''} onChange={(event) => updateLine(index, { hsnSac: event.target.value })} />
                      ) : (
                        <select aria-label="Goods or services" className={input} value={line.supplyKind ?? 'GOODS'} onChange={(event) => updateLine(index, { supplyKind: event.target.value as Line['supplyKind'] })}>
                          <option value="GOODS">Goods</option>
                          <option value="SERVICES">Services</option>
                        </select>
                      )}
                    </LineField>
                  </div>
                  {(!decimal(line.quantity) || !decimal(line.unitPrice)) && line.description && (
                    <p className="mt-1 text-xs font-semibold text-amber-600">Use numbers such as 2 or 12.50.</p>
                  )}
                </div>
              ))}
            </div>
            <button type="button" className={`${secondaryButton} mt-3`} onClick={() => setLines((current) => [...current, blankLine()])}>
              <Plus className="h-4 w-4" /> Add line
            </button>
          </section>

          <section className={card}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={label} htmlFor="doc-lang">Document language</label>
                <select id="doc-lang" className={input} value={language} onChange={(event) => setLanguage(event.target.value)}>
                  {meta.languages.map((entry) => <option key={entry.code} value={entry.code}>{entry.name} · {entry.englishName}</option>)}
                </select>
              </div>
              <div>
                <label className={label} htmlFor="doc-lang2">Second language (bilingual)</label>
                <select id="doc-lang2" className={input} value={secondaryLanguage} onChange={(event) => setSecondaryLanguage(event.target.value)}>
                  <option value="">None</option>
                  {meta.languages.filter((entry) => entry.code !== language).map((entry) => <option key={entry.code} value={entry.code}>{entry.name}</option>)}
                </select>
              </div>
              <div>
                <label className={label} htmlFor="doc-template">Layout</label>
                <select id="doc-template" className={input} value={template} onChange={(event) => setTemplate(event.target.value)}>
                  {meta.templates.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
                </select>
              </div>
              {warehouses.length > 1 && typeDefinition?.stockEffect !== 'none' && (
                <div>
                  <label className={label} htmlFor="doc-warehouse">Warehouse</label>
                  <select id="doc-warehouse" className={input} value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
                    <option value="">Default</option>
                    {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {([
                ['pricesIncludeTax', 'Prices include tax', true],
                ['reverseCharge', 'Reverse charge', india && !purchase],
                ['exportWithPayment', 'Export with IGST payment (not LUT)', india && !purchase],
                ['euOss', 'EU OSS (customer-country VAT rate)', eu && !purchase],
                ['returnToStock', 'Return goods to stock', documentType === 'CREDIT_NOTE'],
              ] as const).filter(([, , show]) => show).map(([key, text]) => (
                <label key={key} className="inline-flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
                  <input type="checkbox" checked={flags[key]} onChange={(event) => setFlags((current) => ({ ...current, [key]: event.target.checked }))} />
                  {text}
                </label>
              ))}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={label} htmlFor="doc-notes">Notes</label>
                <textarea id="doc-notes" rows={3} maxLength={4000} className={input} value={notes} onChange={(event) => setNotes(event.target.value)} />
              </div>
              <div>
                <label className={label} htmlFor="doc-terms">Terms</label>
                <textarea id="doc-terms" rows={3} maxLength={8000} className={input} value={terms} onChange={(event) => setTerms(event.target.value)} />
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <section className={card}>
            {previewError ? (
              <p role="alert" className="text-sm font-semibold text-red-600">{previewError}</p>
            ) : calculation ? (
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-slate-500"><span>Taxable</span><span>{money(calculation.taxableTotal, currency)}</span></div>
                {calculation.taxBreakdown.filter((tax) => Number(tax.amount) !== 0).map((tax) => (
                  <div key={`${tax.code}${tax.rate}`} className="flex justify-between text-slate-500"><span>{tax.code} {tax.rate}%</span><span>{money(tax.amount, currency)}</span></div>
                ))}
                {Number(calculation.roundOff) !== 0 && <div className="flex justify-between text-slate-500"><span>Round off</span><span>{money(calculation.roundOff, currency)}</span></div>}
                <div className="flex justify-between border-t border-slate-200 pt-2 text-lg font-black text-slate-950 dark:border-slate-700 dark:text-white">
                  <span>Total</span><span>{money(calculation.grandTotal, currency)}</span>
                </div>
                {calculation.warnings.map((warning) => <p key={warning} className="pt-1 text-xs font-semibold text-amber-600">{warning}</p>)}
              </div>
            ) : (
              <p className="text-sm text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Calculating…</p>
            )}
          </section>
          <DocumentFrame title="Document preview" html={html} maxHeight="78vh" />
        </div>
      </div>
    </div>
  );
}

function LineField({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">{title}</span>
      {children}
    </div>
  );
}
