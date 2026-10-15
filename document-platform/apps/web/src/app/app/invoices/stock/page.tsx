'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeftRight, Loader2, Plus, SlidersHorizontal, Warehouse as WarehouseIcon } from 'lucide-react';
import { useInvoicing } from '../context';
import { api, card, input, label, money, primaryButton, secondaryButton, shortDate, type Warehouse } from '../lib';

type Level = {
  itemId: string;
  name: string;
  sku: string | null;
  unit: string;
  onHand: string;
  averageCost: string;
  value: string;
  reorderLevel: string | null;
  low: boolean;
  byWarehouse: Array<{ warehouseId: string; onHand: string }>;
};
type Movement = {
  id: string;
  type: string;
  quantity: string;
  balanceAfter: string;
  reason: string | null;
  createdAt: string;
  item: { name: string; unit: string };
  warehouse: { name: string };
  document: { number: string | null; documentType: string } | null;
};
type Panel = { kind: 'adjust' | 'transfer'; itemId: string } | { kind: 'warehouse' } | null;

export default function StockPage() {
  const { business } = useInvoicing();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [levels, setLevels] = useState<{ items: Level[]; totalValue: string; lowCount: number } | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [panel, setPanel] = useState<Panel>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (warehouseId) params.set('warehouseId', warehouseId);
      if (lowOnly) params.set('low', 'true');
      const [warehouseList, levelData, movementData] = await Promise.all([
        api<Warehouse[]>('/inventory/warehouses'),
        api<{ items: Level[]; totalValue: string; lowCount: number }>(`/inventory/levels?${params}`),
        api<{ items: Movement[] }>(`/inventory/movements${warehouseId ? `?warehouseId=${warehouseId}` : ''}`),
      ]);
      setWarehouses(warehouseList);
      setLevels(levelData);
      setMovements(movementData.items);
      setError('');
    } catch (loadError) {
      setError((loadError as Error).message);
    }
  }, [warehouseId, lowOnly]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    void load();
  }, [load]);

  const currency = business?.currency ?? 'USD';
  const changeItem = panel && panel.kind !== 'warehouse' ? levels?.items.find((level) => level.itemId === panel.itemId) : undefined;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white">Stock</h1>
          <p className="mt-1 text-sm text-slate-500">
            Value {levels ? money(levels.totalValue, currency) : '—'} at average cost
            {levels?.lowCount ? <> · <strong className="text-red-600">{levels.lowCount} low</strong></> : null}
          </p>
        </div>
        <button type="button" className={secondaryButton} onClick={() => setPanel({ kind: 'warehouse' })}><Plus className="h-4 w-4" /> Warehouse</button>
      </header>

      {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
      {panel?.kind === 'warehouse' && <WarehouseForm onDone={async (message) => { setPanel(null); if (message) setError(message); await load(); }} />}
      {panel && panel.kind !== 'warehouse' && changeItem && (
        <StockChangeForm
          kind={panel.kind}
          item={changeItem}
          warehouses={warehouses}
          onDone={async (message) => { setPanel(null); setError(message ?? ''); await load(); }}
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <select aria-label="Warehouse" className={`${input} sm:w-56`} value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
          <option value="">All warehouses</option>
          {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
        </select>
        <label className="inline-flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={lowOnly} onChange={(event) => setLowOnly(event.target.checked)} /> Low stock only</label>
      </div>

      <section className={`${card} p-0`}>
        {!levels ? <p className="p-6 text-sm text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading…</p> : levels.items.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500">No stocked items. Turn on “Track stock” for a product to manage it here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800">
                <tr><th className="px-5 py-3">Item</th><th className="text-right">On hand</th><th className="text-right">Avg cost</th><th className="text-right">Value</th><th className="text-right">Alert at</th><th className="px-5" /></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {levels.items.map((level) => (
                  <tr key={level.itemId}>
                    <td className="px-5 py-3 font-semibold text-slate-900 dark:text-white">{level.name}<span className="ml-2 text-xs font-normal text-slate-500">{level.sku}</span></td>
                    <td className={`text-right font-bold ${level.low ? 'text-red-600' : ''}`}>{Number(level.onHand)} {level.unit}</td>
                    <td className="text-right">{money(level.averageCost, currency)}</td>
                    <td className="text-right">{money(level.value, currency)}</td>
                    <td className="text-right text-slate-500">{level.reorderLevel ? Number(level.reorderLevel) : '—'}</td>
                    <td className="px-5 text-right">
                      <button type="button" className="rounded-lg px-2 py-1 text-xs font-bold text-indigo-600 hover:bg-indigo-50" onClick={() => setPanel({ kind: 'adjust', itemId: level.itemId })}><SlidersHorizontal className="mr-1 inline h-3.5 w-3.5" />Adjust</button>
                      {warehouses.length > 1 && (
                        <button type="button" className="rounded-lg px-2 py-1 text-xs font-bold text-indigo-600 hover:bg-indigo-50" onClick={() => setPanel({ kind: 'transfer', itemId: level.itemId })}><ArrowLeftRight className="mr-1 inline h-3.5 w-3.5" />Move</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={card}>
        <h2 className="mb-3 text-base font-black text-slate-950 dark:text-white">Recent movements</h2>
        {movements.length === 0 ? <p className="text-sm text-slate-500">No stock movements yet.</p> : (
          <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {movements.map((movement) => (
              <li key={movement.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <strong className={Number(movement.quantity) < 0 ? 'text-red-600' : 'text-emerald-600'}>{Number(movement.quantity) > 0 ? '+' : ''}{Number(movement.quantity)}</strong>{' '}
                  {movement.item.name} · {movement.warehouse.name} · {movement.type.replace(/_/g, ' ').toLowerCase()}
                  {movement.document?.number ? ` · ${movement.document.number}` : movement.reason ? ` · ${movement.reason}` : ''}
                </span>
                <span className="text-xs text-slate-500">{shortDate(movement.createdAt)} · balance {Number(movement.balanceAfter)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 flex items-center gap-1 text-xs text-slate-500"><WarehouseIcon className="h-3.5 w-3.5" /> {warehouses.map((warehouse) => warehouse.name + (warehouse.isDefault ? ' (default)' : '')).join(' · ')}</p>
      </section>
    </div>
  );
}

function StockChangeForm({ kind, item, warehouses, onDone }: { kind: 'adjust' | 'transfer'; item: Level; warehouses: Warehouse[]; onDone: (message?: string) => void }) {
  const defaultWarehouse = warehouses.find((warehouse) => warehouse.isDefault)?.id ?? warehouses[0]?.id ?? '';
  const [form, setForm] = useState({ warehouseId: defaultWarehouse, toWarehouseId: warehouses.find((warehouse) => warehouse.id !== defaultWarehouse)?.id ?? '', quantity: '', unitCost: '', reason: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const quantity = form.quantity.replace(',', '.').trim();
      await api(kind === 'adjust' ? '/inventory/adjustments' : '/inventory/transfers', {
        method: 'POST',
        body: JSON.stringify(kind === 'adjust'
          ? { itemId: item.itemId, warehouseId: form.warehouseId, quantity, unitCost: form.unitCost || undefined, type: 'ADJUSTMENT', reason: form.reason || 'Stock count' }
          : { itemId: item.itemId, fromWarehouseId: form.warehouseId, toWarehouseId: form.toWarehouseId, quantity, reason: form.reason || undefined }),
      });
      onDone();
    } catch (submitError) {
      setError((submitError as Error).message);
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className={`${card} grid gap-3 sm:grid-cols-5`}>
      <h2 className="text-sm font-black sm:col-span-5">{kind === 'adjust' ? `Adjust ${item.name}` : `Move ${item.name}`}</h2>
      <div><label className={label} htmlFor="s-wh">{kind === 'adjust' ? 'Warehouse' : 'From'}</label>
        <select id="s-wh" className={input} value={form.warehouseId} onChange={(event) => setForm({ ...form, warehouseId: event.target.value })}>
          {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
        </select>
      </div>
      {kind === 'transfer' && (
        <div><label className={label} htmlFor="s-to">To</label>
          <select id="s-to" className={input} value={form.toWarehouseId} onChange={(event) => setForm({ ...form, toWarehouseId: event.target.value })}>
            {warehouses.filter((warehouse) => warehouse.id !== form.warehouseId).map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
          </select>
        </div>
      )}
      <div><label className={label} htmlFor="s-qty">{kind === 'adjust' ? 'Change (e.g. -2 or 10)' : 'Quantity'}</label><input id="s-qty" required inputMode="decimal" className={input} value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></div>
      {kind === 'adjust' && <div><label className={label} htmlFor="s-cost">Unit cost (for additions)</label><input id="s-cost" inputMode="decimal" className={input} value={form.unitCost} onChange={(event) => setForm({ ...form, unitCost: event.target.value })} /></div>}
      <div><label className={label} htmlFor="s-reason">Reason</label><input id="s-reason" maxLength={300} className={input} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder={kind === 'adjust' ? 'Stock count, damage…' : ''} /></div>
      {error && <p role="alert" className="text-sm font-semibold text-red-600 sm:col-span-5">{error}</p>}
      <div className="flex gap-2 sm:col-span-5"><button type="submit" disabled={busy} className={primaryButton}>Save</button><button type="button" className={secondaryButton} onClick={() => onDone()}>Cancel</button></div>
    </form>
  );
}

function WarehouseForm({ onDone }: { onDone: (message?: string) => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  return (
    <form className={`${card} flex flex-wrap items-end gap-3`} onSubmit={(event) => {
      event.preventDefault();
      api('/inventory/warehouses', { method: 'POST', body: JSON.stringify({ name }) }).then(() => onDone()).catch((createError) => setError((createError as Error).message));
    }}>
      <div className="flex-1"><label className={label} htmlFor="w-name">Warehouse name</label><input id="w-name" required maxLength={120} className={input} value={name} onChange={(event) => setName(event.target.value)} /></div>
      <button type="submit" className={primaryButton}>Add</button>
      <button type="button" className={secondaryButton} onClick={() => onDone()}>Cancel</button>
      {error && <p role="alert" className="w-full text-sm font-semibold text-red-600">{error}</p>}
    </form>
  );
}
