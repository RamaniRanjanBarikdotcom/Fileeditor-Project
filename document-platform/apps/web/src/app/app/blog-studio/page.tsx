'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Clock3, FileText, Gauge, Plus, Search, Sparkles, Image as ImageIcon, Settings, Send, Calendar, LockKeyhole, CheckCircle2 } from 'lucide-react';
import { fetchApi } from '../../../lib/api';
import { useFeatureFlags } from '../../../lib/use-feature-flags';

type Blog = {
  id: string;
  title: string;
  topic: string;
  language: string;
  seoScore: number;
  wordCount: number;
  updatedAt: string;
  status: string;
};
type Usage = {
  unlimited: boolean;
  blogsConsumed: number;
  blogLimit: number;
  creditsConsumed: number;
  creditLimit: number;
  blogsRemaining?: number;
  creditsRemaining?: number;
};

export default function BlogStudioDashboard() {
  const flags = useFeatureFlags();
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchApi<Blog[]>('/blog-studio/blogs'),
      fetchApi<Usage>('/blog-studio/usage'),
    ]).then(([blogResult, usageResult]) => {
      if (blogResult.success && blogResult.data) setBlogs(blogResult.data);
      if (usageResult.success && usageResult.data) setUsage(usageResult.data);
      setLoading(false);
    });
  }, []);

  const visible = blogs.filter((blog) =>
    `${blog.title} ${blog.topic}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-indigo-500">
            <Sparkles className="h-4 w-4" />
            Blog Studio
          </span>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
            Your content workspace
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Generate with checkpoints, refine in the editor, and export when it is ready.
          </p>
        </div>
        <Link
          href="/app/blog-studio/new"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/20"
        >
          <Plus className="h-4 w-4" />
          New article
        </Link>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <Metric
          icon={FileText}
          label="Blogs this month"
          value={
            usage
              ? `${usage.blogsConsumed} / ${usage.unlimited ? 'Unlimited' : usage.blogLimit}`
              : '—'
          }
          detail={
            usage?.unlimited ? 'Administrator access' : `${usage?.blogsRemaining ?? 0} available`
          }
        />
        <Metric
          icon={Gauge}
          label="AI credits"
          value={
            usage
              ? `${usage.creditsConsumed} / ${usage.unlimited ? 'Unlimited' : usage.creditLimit}`
              : '—'
          }
          detail={
            usage?.unlimited
              ? 'Usage recorded, never blocked'
              : `${usage?.creditsRemaining ?? 0} available`
          }
        />
        <Metric
          icon={Clock3}
          label="Article library"
          value={String(blogs.length)}
          detail="Saved in this workspace"
        />
      </section>

      {/* Advanced Capabilities Overview */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CapabilityCard 
          title="Image Generation" 
          description="Create private AI cover images with the configured managed image model."
          isUnlocked={flags.blogStudioImages}
          icon={ImageIcon}
          href="/app/blog-studio/images"
        />
        <CapabilityCard 
          title="Bring-Your-Own-Key" 
          description="Use your own OpenAI/Anthropic keys for generation."
          isUnlocked={flags.blogStudioByok}
          icon={Settings}
          href="/app/blog-studio/settings"
        />
        <CapabilityCard 
          title="Remote Publishing" 
          description="Publish directly to WordPress & Shopify."
          isUnlocked={flags.blogStudioPublishing}
          icon={Send}
          href="/app/blog-studio/posts"
        />
        <CapabilityCard 
          title="Advanced Scheduler" 
          description="Auto-publish queues & CSV bulk imports."
          isUnlocked={flags.blogStudioScheduler}
          icon={Calendar}
          href="/app/blog-studio/scheduler"
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold text-slate-950 dark:text-white">Recent articles</h2>
            <p className="mt-1 text-xs text-slate-500">
              Open any article to edit, regenerate, or export it.
            </p>
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search articles"
              className="w-56 bg-transparent text-sm outline-none"
            />
          </label>
        </div>
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">Loading your Blog Studio…</div>
        ) : visible.length === 0 ? (
          <div className="p-12 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-indigo-500" />
            <h3 className="mt-4 font-bold text-slate-950 dark:text-white">No articles here yet</h3>
            <p className="mt-2 text-sm text-slate-500">
              Create a topic and Blog Studio will guide it through the full pipeline.
            </p>
            <Link
              href="/app/blog-studio/new"
              className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-indigo-500"
            >
              Create an article <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {visible.map((blog) => (
              <Link
                key={blog.id}
                href={`/app/blog-studio/${blog.id}`}
                className="grid gap-3 p-5 transition hover:bg-slate-50 dark:hover:bg-slate-800/50 sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div>
                  <h3 className="font-bold text-slate-950 dark:text-white">{blog.title}</h3>
                  <p className="mt-1 line-clamp-1 text-sm text-slate-500">{blog.topic}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-slate-500">
                    <span>{blog.language}</span>
                    <span>•</span>
                    <span>{blog.wordCount.toLocaleString()} words</span>
                    <span>•</span>
                    <span>{new Date(blog.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600">
                    SEO {blog.seoScore}
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-500/10 text-indigo-500">
          <Icon className="h-5 w-5" />
        </span>
        <span className="text-xs font-semibold text-slate-400">{detail}</span>
      </div>
      <p className="mt-5 text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <strong className="mt-1 block text-2xl text-slate-950 dark:text-white">{value}</strong>
    </article>
  );
}

function CapabilityCard({
  title,
  description,
  isUnlocked,
  icon: Icon,
  href,
}: {
  title: string;
  description: string;
  isUnlocked: boolean;
  icon: React.ElementType;
  href: string;
}) {
  const content = (
    <div className={`relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border p-5 transition-all ${isUnlocked ? 'border-indigo-100 bg-white shadow-sm dark:border-indigo-900/30 dark:bg-slate-900 hover:border-indigo-200 dark:hover:border-indigo-800' : 'border-slate-200 bg-slate-50 opacity-75 dark:border-slate-800 dark:bg-slate-900/50'}`}>
      <div>
        <div className="flex items-center justify-between">
          <span className={`grid h-10 w-10 place-items-center rounded-xl ${isUnlocked ? 'bg-indigo-500/10 text-indigo-500' : 'bg-slate-200/50 text-slate-500 dark:bg-slate-800'}`}>
            <Icon className="h-5 w-5" />
          </span>
          {isUnlocked ? (
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" /> Unlocked
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full bg-slate-200/50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800">
              <LockKeyhole className="h-3 w-3" /> Upgrade
            </span>
          )}
        </div>
        <h3 className="mt-4 font-bold text-slate-900 dark:text-white">{title}</h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>
      </div>
    </div>
  );
  return isUnlocked ? <Link href={href}>{content}</Link> : content;
}
