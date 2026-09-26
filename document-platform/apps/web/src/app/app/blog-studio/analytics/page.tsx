'use client';

import { useEffect, useState } from 'react';
import { BarChart2, BookOpen, Coins, FileCheck2, Gauge, Send } from 'lucide-react';
import { fetchApi } from '../../../../lib/api';

type Metrics = { overview: { totalGenerated: number; completedGenerated: number; failedGenerated: number; totalPublished: number; totalWords: number; avgSeoScore: number; totalCreditsUsed: number }; trend: Array<{ date: string; generations: number; publications: number }> };
export default function AnalyticsPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null); const [error, setError] = useState('');
  useEffect(() => { void fetchApi<Metrics>('/blog-studio/analytics').then((result) => result.success && result.data ? setMetrics(result.data) : setError(result.error?.message || 'Analytics could not be loaded.')); }, []);
  const cards = metrics ? [
    ['Completed blogs', metrics.overview.completedGenerated, BookOpen], ['Published', metrics.overview.totalPublished, Send], ['Words written', metrics.overview.totalWords.toLocaleString(), FileCheck2], ['Average SEO', metrics.overview.avgSeoScore, Gauge], ['Credits used', metrics.overview.totalCreditsUsed, Coins],
  ] as const : [];
  const max = Math.max(1, ...(metrics?.trend.map((point) => point.generations + point.publications) || [1]));
  return <div className="mx-auto max-w-7xl space-y-6"><header><span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-indigo-500"><BarChart2 className="h-4 w-4" /> Analytics</span><h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white">Studio performance</h1><p className="mt-2 text-sm text-slate-500">Thirty-day generation, publishing, quality and cost data from your organization.</p></header>{error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}<section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{cards.map(([label, value, Icon]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><Icon className="h-5 w-5 text-indigo-500" /><p className="mt-5 text-2xl font-black text-slate-950 dark:text-white">{value}</p><p className="mt-1 text-xs font-semibold text-slate-500">{label}</p></div>)}</section><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"><h2 className="font-bold text-slate-950 dark:text-white">Daily output</h2><div className="mt-6 flex h-56 items-end gap-1 overflow-hidden">{metrics?.trend.map((point) => <div key={point.date} title={`${point.date}: ${point.generations} generated, ${point.publications} published`} className="flex h-full min-w-1 flex-1 items-end"><div className="w-full rounded-t bg-gradient-to-t from-indigo-600 to-fuchsia-400" style={{ height: `${Math.max(2, ((point.generations + point.publications) / max) * 100)}%` }} /></div>)}</div><div className="mt-3 flex justify-between text-xs text-slate-400"><span>{metrics?.trend[0]?.date || 'Loading…'}</span><span>{metrics?.trend.at(-1)?.date || ''}</span></div></section></div>;
}
