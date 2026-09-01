'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Bot, Braces, Workflow } from 'lucide-react';
import { fetchApi } from '../../lib/api';

type Product = { id: string; slug: string; name: string; tagline?: string; description: string };

export default function AutomationsPage() {
  const [items, setItems] = useState<Product[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => { void fetchApi<Product[]>('/products?type=AUTOMATION').then((response) => { if (response.success && response.data) setItems(response.data); setLoading(false); }); }, []);
  return <div className="min-h-screen"><section className="border-b py-20 text-center" style={{ borderColor: 'var(--border)' }}><Bot className="mx-auto mb-5 h-12 w-12 text-fuchsia-500" /><p className="section-label mb-3">Automation marketplace</p><h1 className="ts-h1 mb-5">Scripts and workflows that save time</h1><p className="mx-auto max-w-2xl text-lg leading-8" style={{ color: 'var(--text-muted)' }}>Browse catalog-managed automation products. Every published item uses the same protected checkout, entitlement, and release system as the software store.</p></section><section className="mx-auto max-w-6xl px-5 py-16">{loading ? <p className="text-center" style={{ color: 'var(--text-muted)' }}>Loading automation catalog…</p> : items.length ? <div className="grid gap-6 md:grid-cols-2">{items.map((item, index) => { const Icon = index % 2 ? Braces : Workflow; return <article className="card card-hover p-8" key={item.id}><Icon className="mb-5 h-9 w-9 text-fuchsia-500" /><h2 className="ts-h3 mb-3">{item.name}</h2><p className="mb-6 text-sm leading-6" style={{ color: 'var(--text-muted)' }}>{item.tagline || item.description}</p><Link className="btn btn-secondary" href={`/software/${item.slug}`}>View catalog item <ArrowRight className="h-4 w-4" /></Link></article>; })}</div> : <div className="card mx-auto max-w-xl p-10 text-center"><Workflow className="mx-auto mb-4 h-10 w-10 text-fuchsia-500" /><h2 className="ts-h3">Automation catalog ready</h2><p className="mt-3 text-sm leading-6" style={{ color: 'var(--text-muted)' }}>No automation products are published yet. They will appear here automatically when an administrator adds them to the catalog.</p></div>}</section></div>;
}
