'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Building2, Coins, Image, Send, ShieldAlert } from 'lucide-react';
import { fetchApi } from '../../../lib/api';

type AdminMetrics = { documents: number; jobs: Record<string, number>; publications: Record<string, number>; activeOrganizations: number; creditsConsumed: number; completedBlogs: number; generatedImages: number };
export default function AdminBlogStudioPage() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null); const [error, setError] = useState('');
  useEffect(() => { void fetchApi<AdminMetrics>('/blog-studio/admin/overview').then((result) => result.success && result.data ? setMetrics(result.data) : setError(result.error?.message || 'Admin metrics could not be loaded.')); }, []);
  const cards = metrics ? [
    ['Active workspaces', metrics.activeOrganizations, Building2], ['Stored articles', metrics.documents, BookOpen], ['Completed generations', metrics.completedBlogs, BookOpen], ['Published posts', metrics.publications.PUBLISHED || 0, Send], ['Generated images', metrics.generatedImages, Image], ['Credits consumed', metrics.creditsConsumed, Coins],
  ] as const : [];
  return <div className="mx-auto max-w-7xl space-y-6"><header><span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-red-500"><ShieldAlert className="h-4 w-4" /> Global administration</span><h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white">Blog Studio operations</h1><p className="mt-2 text-sm text-slate-500">Live platform totals. Feature flags remain environment-controlled so a browser action cannot silently enable unfinished commercial flows.</p></header>{error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}<section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map(([label, value, Icon]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-slate-500">{label}</p><Icon className="h-5 w-5 text-red-500" /></div><p className="mt-4 text-3xl font-black text-slate-950 dark:text-white">{value.toLocaleString()}</p></div>)}</section><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h2 className="font-bold text-slate-950 dark:text-white">Queue health snapshot</h2><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'].map((status) => <div key={status} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-950"><p className="text-xs font-bold text-slate-500">{status}</p><p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{metrics?.jobs[status] || 0}</p></div>)}</div></section></div>;
}
