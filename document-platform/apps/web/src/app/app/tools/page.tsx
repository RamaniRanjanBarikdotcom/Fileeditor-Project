'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Search, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { listStaticToolDtos } from '../../../lib/tool-dtos';
import { getToolPresentation } from '../../../lib/tools-registry';

const tools = listStaticToolDtos().filter((tool) => tool.isPublished);
const categories = ['All', ...Array.from(new Set(tools.map((tool) => tool.category)))];

export default function WorkspaceToolsPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return tools.filter((tool) => {
      const matchesCategory = category === 'All' || tool.category === category;
      const searchable = [
        tool.name,
        tool.category,
        tool.seoMetadata?.description,
        ...tool.acceptedFormats,
        ...tool.outputFormats,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return matchesCategory && (!normalized || searchable.includes(normalized));
    });
  }, [category, query]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-7">
      <section className="relative overflow-hidden rounded-3xl border border-indigo-200/60 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 px-6 py-8 text-white shadow-xl shadow-indigo-500/15 sm:px-8">
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="relative max-w-3xl">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5" /> AppToolkitLab workspace
          </span>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
            Your complete document toolbox
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-indigo-100 sm:text-base">
            Use private browser tools without uploading a file, or run managed conversions with job
            history and secure temporary storage.
          </p>
          <div className="mt-6 flex flex-wrap gap-4 text-xs font-semibold text-indigo-50">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4" /> Local tools stay on this device
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Zap className="h-4 w-4" /> {tools.length} verified or available tools
            </span>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block w-full lg:max-w-md">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by task or format"
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold transition ${
                  category === item
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'border border-slate-200 bg-slate-50 text-slate-600 hover:border-indigo-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400">
              Available now
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">
              {filtered.length} tools
            </h2>
          </div>
          <Link
            href="/app/history"
            className="text-sm font-bold text-indigo-600 hover:text-indigo-500"
          >
            View job history
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((tool) => {
            const presentation = getToolPresentation(tool.slug);
            const Icon = presentation.icon;
            const isLocal = Boolean(tool.capability?.browser.supported);
            return (
              <Link
                key={tool.slug}
                href={`/tools/${tool.slug}`}
                className="group flex min-h-56 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-indigo-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-700"
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: `${presentation.accentColor}16`,
                      color: presentation.accentColor,
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${isLocal ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'}`}
                  >
                    {isLocal ? 'Private browser' : 'Secure worker'}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-black text-slate-950 dark:text-white">
                  {presentation.name}
                </h3>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  {tool.seoMetadata?.description || presentation.features[0]}
                </p>
                <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
                  <span className="text-xs font-semibold text-slate-400">
                    {tool.acceptedFormats.join(', ').toUpperCase()} →{' '}
                    {tool.outputFormats.join(', ').toUpperCase()}
                  </span>
                  <ArrowRight className="h-4 w-4 text-indigo-600 transition group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
