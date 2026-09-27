'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Download, ExternalLink, FileText, RefreshCw, Search, Send } from 'lucide-react';
import { fetchApi } from '../../../../lib/api';

type Blog = {
  id: string;
  title: string;
  topic: string;
  language: string;
  status: string;
  seoScore: number;
  wordCount: number;
  updatedAt: string;
  publications?: { status: string; remoteUrl?: string }[];
};

const DATE_OPTIONS = [
  { label: 'All time', value: 'all' },
  { label: 'Last 7 days', value: '7' },
  { label: 'Last 30 days', value: '30' },
  { label: 'Last 90 days', value: '90' },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const FORMAT_OPTIONS = [
  { label: 'Export Markdown', value: 'markdown' },
  { label: 'Export HTML', value: 'html' },
  { label: 'Export Word', value: 'docx' },
  { label: 'Export PDF', value: 'pdf' },
];

export default function BlogStudioHistoryPage() {
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [referenceTime, setReferenceTime] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'all' | 'published' | 'draft' | 'unpublished'>('all');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [exportFormat, setExportFormat] = useState('markdown');

  const fetchBlogs = useCallback(() => {
    setLoading(true);
    fetchApi<Blog[]>('/blog-studio/blogs').then((response) => {
      if (response.success && response.data) setBlogs(response.data);
      else setError(response.error?.message || 'Blog history could not be loaded.');
      setReferenceTime(new Date().getTime());
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(fetchBlogs, 0);
    return () => clearTimeout(timer);
  }, [fetchBlogs]);

  // Counts for tabs
  const counts = useMemo(() => {
    const all = blogs.length;
    const published = blogs.filter(b => b.publications?.some(p => p.status === 'PUBLISHED')).length;
    const draft = blogs.filter(b => b.status === 'DRAFT').length;
    const unpublished = blogs.filter(b => !b.publications?.some(p => p.status === 'PUBLISHED')).length;
    return { all, published, draft, unpublished };
  }, [blogs]);

  const visible = useMemo(() => {
    const cutoff =
      period === '7'
        ? referenceTime - 7 * 86_400_000
        : period === '30'
          ? referenceTime - 30 * 86_400_000
          : period === '90'
            ? referenceTime - 90 * 86_400_000
            : 0;
    const normalized = query.trim().toLowerCase();
    return blogs.filter((blog) => {
      if (activeTab === 'published' && !blog.publications?.some(p => p.status === 'PUBLISHED')) return false;
      if (activeTab === 'draft' && blog.status !== 'DRAFT') return false;
      if (activeTab === 'unpublished' && blog.publications?.some(p => p.status === 'PUBLISHED')) return false;
      if (cutoff && new Date(blog.updatedAt).getTime() < cutoff) return false;
      return !normalized || `${blog.title} ${blog.topic}`.toLowerCase().includes(normalized);
    });
  }, [blogs, period, query, referenceTime, activeTab]);

  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const paginated = useMemo(() => visible.slice((page - 1) * pageSize, page * pageSize), [visible, page, pageSize]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) setSelectedIds(new Set(paginated.map(b => b.id)));
    else setSelectedIds(new Set());
  };

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedIds.size} article(s)?`)) return;
    const results = await Promise.all(
      Array.from(selectedIds).map((id) => fetchApi(`/blog-studio/blogs/${id}`, { method: 'DELETE' })),
    );
    if (results.some((r) => !r.success)) {
      setError('One or more articles could not be deleted.');
    } else {
      setSelectedIds(new Set());
      fetchBlogs();
    }
  };

  async function handleExport(ids?: string[]) {
    const toExport = ids ?? (selectedIds.size > 0 ? Array.from(selectedIds) : visible.map(b => b.id));
    if (!toExport.length) return;
    setError(`Preparing ${toExport.length} export${toExport.length === 1 ? '' : 's'}…`);
    let downloaded = 0;
    for (const id of toExport.slice(0, 20)) {
      const created = await fetchApi<{ id: string; status: string; url?: string }>(
        `/blog-studio/blogs/${id}/exports`,
        { method: 'POST', body: JSON.stringify({ format: exportFormat }) },
      );
      if (!created.success || !created.data) continue;
      let result = created.data;
      for (let attempt = 0; !result.url && result.status !== 'FAILED' && attempt < 80; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1_500));
        const status = await fetchApi<{ id: string; status: string; url?: string }>(
          `/blog-studio/exports/${result.id}`,
        );
        if (!status.success || !status.data) break;
        result = status.data;
      }
      if (result.url) {
        const anchor = document.createElement('a');
        anchor.href = result.url;
        anchor.download = '';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        downloaded += 1;
      }
    }
    setError(
      downloaded === toExport.length
        ? `${downloaded} export${downloaded === 1 ? '' : 's'} downloaded.`
        : `${downloaded} of ${toExport.length} exports downloaded. Retry any failed items individually.`,
    );
  }

  function handleExportCSV() {
    const rows = [
      ['Title', 'Topic', 'Language', 'Status', 'SEO Score', 'Word Count', 'Updated'].join(','),
      ...visible.map(b =>
        [b.title, b.topic, b.language, b.status, b.seoScore, b.wordCount, new Date(b.updatedAt).toLocaleDateString()].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
      )
    ].join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `blog-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  const TABS = [
    { key: 'all', label: `All time: ${counts.all}` },
    { key: 'published', label: `Publish: ${counts.published}` },
    { key: 'draft', label: `Draft: ${counts.draft}` },
    { key: 'unpublished', label: `Not published: ${counts.unpublished}` },
  ] as const;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-indigo-500">
          <CalendarDays className="h-4 w-4" />
          Blog Studio
        </span>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
          Previous Blog Generations
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Generate SEO-optimized blog posts with AI
        </p>
      </header>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {/* Search + Date filter */}
        <div className="border-b border-slate-100 dark:border-slate-800 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 flex-1">
            <label className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 dark:border-slate-700 dark:bg-slate-800 max-w-sm">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by title..."
                className="w-full bg-transparent py-2.5 text-sm outline-none"
              />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Filter by date</span>
            <select
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
            >
              {DATE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button
              onClick={fetchBlogs}
              title="Refresh"
              className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 transition"
            >
              <RefreshCw className="h-4 w-4 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Status Tab Pills */}
        <div className="border-b border-slate-100 dark:border-slate-800 px-4 pt-3 pb-0 flex flex-wrap items-center gap-2">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setPage(1);
              }}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition mb-3 ${
                activeTab === tab.key
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-600 bg-white dark:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Export Controls Row */}
        <div className="border-b border-slate-100 dark:border-slate-800 px-4 py-3 flex flex-wrap items-center gap-2 justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">FORMAT</span>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs outline-none dark:border-slate-700 dark:bg-slate-800"
            >
              {FORMAT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button
              onClick={() => handleExport()}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 transition"
            >
              <Download className="h-3 w-3" />
              Bulk Export
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-600 transition"
            >
              <FileText className="h-3 w-3" />
              Export History CSV
            </button>
            {selectedIds.size > 0 && (
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-100 transition"
              >
                Delete {selectedIds.size} selected
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs font-semibold text-slate-500">Per page:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs outline-none dark:border-slate-700 dark:bg-slate-800"
            >
              {PAGE_SIZE_OPTIONS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table header */}
        {!loading && !error && paginated.length > 0 && (
          <div className="flex items-center px-5 py-2.5 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <input
              type="checkbox"
              checked={selectedIds.size > 0 && selectedIds.size === paginated.length}
              ref={input => {
                if (input) input.indeterminate = selectedIds.size > 0 && selectedIds.size < paginated.length;
              }}
              onChange={handleSelectAll}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 mr-4"
            />
            <span className="flex-1">Title</span>
            <span className="hidden md:block w-24 text-right">Language</span>
            <span className="hidden md:block w-20 text-right ml-4">Actions</span>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">Loading article history…</div>
        ) : error ? (
          <div className="p-8 text-sm font-semibold text-red-600">{error}</div>
        ) : visible.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="mx-auto h-8 w-8 text-slate-400" />
            <h3 className="mt-4 font-bold text-slate-950 dark:text-white">No matching articles</h3>
            <p className="mt-2 text-sm text-slate-500">Try clearing a filter or start a new generation.</p>
            <Link href="/app/blog-studio/new" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-indigo-500">
              Create new article
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {paginated.map((blog) => {
              const isPublished = blog.publications?.some(p => p.status === 'PUBLISHED');
              const remoteUrl = blog.publications?.find(p => p.status === 'PUBLISHED')?.remoteUrl;
              return (
                <div
                  key={blog.id}
                  className="flex items-center gap-4 p-4 transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(blog.id)}
                    onChange={() => toggleSelection(blog.id)}
                    className="w-4 h-4 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
                  />
                  <div className="flex-1 min-w-0">
                    <Link href={`/app/blog-studio/${blog.id}`} className="group block">
                      <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                        {blog.title}
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-400 truncate">
                        {new Date(blog.updatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        {' '}· {blog.wordCount.toLocaleString()} words
                        {isPublished && blog.publications?.find(p => p.status === 'PUBLISHED') && (
                          <span className="ml-1 text-emerald-500">· Published</span>
                        )}
                      </p>
                    </Link>
                  </div>

                  {/* Language badge */}
                  <span className="hidden md:inline-flex shrink-0 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {blog.language}
                  </span>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isPublished ? (
                      <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-200 dark:border-emerald-900 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        ✓ Publish
                      </span>
                    ) : (
                      <Link
                        href={`/app/blog-studio/${blog.id}`}
                        className="flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600 transition"
                      >
                        <Send className="h-3 w-3" />
                        Publish
                      </Link>
                    )}
                    {remoteUrl && (
                      <a
                        href={remoteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 text-slate-400 hover:text-indigo-600 transition"
                        title="Open remote post"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <Link
                      href={`/app/blog-studio/${blog.id}`}
                      className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400 transition"
                    >
                      View
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-3 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, visible.length)} of {visible.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition"
              >
                ← Prev
              </button>
              <span className="px-3 py-1.5 text-xs font-semibold text-slate-600">
                {page} / {totalPages}
              </span>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
