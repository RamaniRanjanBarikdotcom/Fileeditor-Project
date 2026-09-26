'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpenCheck, Coins, Info } from 'lucide-react';
import { fetchApi } from '../../../../lib/api';

type Usage = {
  accessLevel: 'ADMIN' | 'SUBSCRIPTION';
  unlimited: boolean;
  blogsConsumed: number;
  blogLimit: number;
  creditsConsumed: number;
  creditLimit: number;
  reservedBlogs?: number;
  reservedCredits?: number;
  blogsRemaining?: number;
  creditsRemaining?: number;
  windowStart: string;
  windowEnd: string;
};

export default function BlogUsagePage() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    void fetchApi<Usage>('/blog-studio/usage').then((result) =>
      result.success && result.data
        ? setUsage(result.data)
        : setError(result.error?.message || 'Usage could not be loaded.'),
    );
  }, []);
  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/app/blog-studio"
        className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-500"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Blog Studio
      </Link>
      <div className="mt-5">
        <span className="text-xs font-black uppercase tracking-[.16em] text-indigo-500">
          Monthly allowances
        </span>
        <h1 className="mt-2 text-3xl font-black text-slate-950 dark:text-white">
          Usage and reservations
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          A failed or cancelled generation releases its reservation and does not consume a completed
          blog.
        </p>
      </div>
      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}
      {usage && (
        <>
          {usage.unlimited && (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
              Administrator access is unlimited. Usage is recorded for operational visibility but is
              never blocked by subscription allowances.
            </div>
          )}
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <UsageCard
              icon={BookOpenCheck}
              title="Completed blogs"
              consumed={usage.blogsConsumed}
              reserved={usage.reservedBlogs || 0}
              limit={usage.blogLimit}
              unlimited={usage.unlimited}
            />
            <UsageCard
              icon={Coins}
              title="AI credits"
              consumed={usage.creditsConsumed}
              reserved={usage.reservedCredits || 0}
              limit={usage.creditLimit}
              unlimited={usage.unlimited}
            />
          </div>
          <div className="mt-5 flex gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            <Info className="h-5 w-5 shrink-0 text-indigo-500" />
            <p>
              One credit represents $0.01 of calculated provider cost. The current window runs from{' '}
              {new Date(usage.windowStart).toLocaleDateString()} to{' '}
              {new Date(usage.windowEnd).toLocaleDateString()}.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function UsageCard({
  icon: Icon,
  title,
  consumed,
  reserved,
  limit,
  unlimited,
}: {
  icon: typeof Coins;
  title: string;
  consumed: number;
  reserved: number;
  limit: number;
  unlimited: boolean;
}) {
  const committed = Math.min(limit || 1, consumed + reserved);
  const percent = limit ? Math.round((committed / limit) * 100) : 0;
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-500/10 text-indigo-500">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-black text-slate-950 dark:text-white">{title}</h2>
          <p className="text-xs text-slate-500">{reserved} currently reserved</p>
        </div>
      </div>
      <strong className="mt-7 block text-4xl text-slate-950 dark:text-white">
        {consumed}{' '}
        <span className="text-base font-semibold text-slate-400">
          / {unlimited ? 'Unlimited' : limit}
        </span>
      </strong>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-fuchsia-500"
          style={{ width: unlimited ? '0%' : `${percent}%` }}
        />
      </div>
      <p className="mt-3 text-xs font-semibold text-slate-500">
        {unlimited
          ? 'No subscription ceiling for administrators'
          : `${Math.max(0, limit - consumed - reserved)} available after reservations`}
      </p>
    </article>
  );
}
