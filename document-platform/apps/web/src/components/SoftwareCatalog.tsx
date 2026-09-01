'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Code2, Package, RefreshCw, ShieldCheck, ShoppingBag, Terminal } from 'lucide-react';
import { fetchApi } from '../lib/api';

type Currency = 'USD' | 'INR';
type CatalogPrice = { currency: Currency; amountMinorUnits: number; provider: string };
type CatalogProduct = {
  id: string; slug: string; name: string; tagline?: string; description: string;
  type: string; prices: CatalogPrice[];
  currentRelease?: { version: string; fileSizeBytes: number } | null;
};

const formatPrice = (price: CatalogPrice | undefined, currency: Currency) => {
  if (!price) return 'Unavailable';
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(price.amountMinorUnits / 100);
};

export function SoftwareCatalog() {
  const [currency, setCurrency] = useState<Currency>('USD');
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    const response = await fetchApi<CatalogProduct[]>('/products?type=SOFTWARE');
    if (response.success && response.data) setProducts(response.data);
    else setError(response.error?.message || 'The catalog is temporarily unavailable.');
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden border-b py-20" style={{ borderColor: 'var(--border)' }}>
        <div className="absolute inset-0 -z-10" style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 0%, rgba(139,92,246,.16), transparent 70%)' }} />
        <div className="mx-auto max-w-4xl px-5 text-center">
          <span className="badge mb-5 inline-flex border border-violet-500/20 bg-violet-500/10 px-4 py-2 text-violet-500"><ShoppingBag className="h-4 w-4" /> Verified catalog</span>
          <h1 className="ts-h1 mb-5">Software built for <span className="text-gradient">real work</span></h1>
          <p className="mx-auto max-w-2xl text-lg leading-8" style={{ color: 'var(--text-secondary)' }}>Discover downloadable software and developer products. Prices, releases, and availability come directly from the ToolSuite catalog.</p>
          <div className="mt-8 inline-flex rounded-xl border p-1" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
            {(['USD', 'INR'] as Currency[]).map((item) => <button key={item} onClick={() => setCurrency(item)} className={`rounded-lg px-5 py-2 text-sm font-bold transition ${currency === item ? 'bg-indigo-600 text-white' : ''}`} style={currency !== item ? { color: 'var(--text-muted)' } : undefined}>{item === 'USD' ? 'USD ($)' : 'INR (₹)'}</button>)}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        {loading && <div className="flex items-center justify-center gap-3 py-20" style={{ color: 'var(--text-muted)' }}><RefreshCw className="h-5 w-5 animate-spin" /> Loading live catalog…</div>}
        {!loading && error && <div className="card mx-auto max-w-xl p-8 text-center"><Package className="mx-auto mb-4 h-10 w-10 text-violet-500" /><h2 className="ts-h3">Catalog could not be loaded</h2><p className="my-3" style={{ color: 'var(--text-muted)' }}>{error}</p><button className="btn btn-primary" onClick={() => void load()}>Try again</button></div>}
        {!loading && !error && products.length === 0 && <div className="card mx-auto max-w-xl p-10 text-center"><Package className="mx-auto mb-4 h-10 w-10 text-violet-500" /><h2 className="ts-h3">New products are being prepared</h2><p className="mt-3" style={{ color: 'var(--text-muted)' }}>Products appear here after an administrator publishes a catalog release.</p></div>}
        {!loading && !error && products.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2">
            {products.map((product, index) => {
              const Icon = index % 2 ? Code2 : Terminal;
              const price = product.prices.find((item) => item.currency === currency);
              const available = Boolean(product.currentRelease && price);
              return (
                <article key={product.id} className="card card-hover relative overflow-hidden p-8">
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 to-fuchsia-500" />
                  <div className="mb-6 flex items-start justify-between gap-4"><div className="tool-icon-ring h-14 w-14 rounded-2xl border border-indigo-500/20 bg-indigo-500/10"><Icon className="h-6 w-6 text-indigo-500" /></div><span className={`badge ${available ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>{available ? `v${product.currentRelease?.version}` : 'Preview catalog'}</span></div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-widest text-indigo-500">{product.type}</p>
                  <h2 className="ts-h3 mb-3">{product.name}</h2>
                  <p className="mb-6 min-h-12 text-sm leading-6" style={{ color: 'var(--text-muted)' }}>{product.tagline || product.description}</p>
                  <ul className="mb-7 space-y-3 border-t pt-6 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                    <li className="feature-item"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Currency-routed secure checkout</li>
                    <li className="feature-item"><ShieldCheck className="h-4 w-4 text-emerald-500" /> Protected entitlement and signed downloads</li>
                    <li className="feature-item"><Package className="h-4 w-4 text-emerald-500" /> Release availability verified before purchase</li>
                  </ul>
                  <div className="flex items-end justify-between gap-4 border-t pt-6" style={{ borderColor: 'var(--border)' }}><div><div className="text-3xl font-extrabold">{formatPrice(price, currency)}</div><div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{available ? 'one-time purchase' : 'not yet purchasable'}</div></div><Link href={`/software/${product.slug}`} className="btn btn-primary">Details <ArrowRight className="h-4 w-4" /></Link></div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
