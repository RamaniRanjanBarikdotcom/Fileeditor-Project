import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Check,
  FileOutput,
  Gauge,
  Layers3,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Blog Studio — AI Research, Writing & SEO | AppToolkitLab',
  description:
    'Research, generate, edit, optimize, and export publish-ready articles from one secure AppToolkitLab workspace.',
  alternates: { canonical: '/saas/blog-studio' },
};

const workflow = [
  ['01', 'Research', 'Discover search intent, questions, and source material before drafting.'],
  ['02', 'Structure', 'Build takeaways and a purposeful outline around your focus keyword.'],
  ['03', 'Create', 'Draft, repair, humanize, and expand the article through clear checkpoints.'],
  ['04', 'Refine', 'Edit the result, review SEO metadata, and export for your publishing workflow.'],
];

export default function BlogStudioLandingPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <section className="relative overflow-hidden border-b border-[var(--border)] px-5 py-24 sm:py-32">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,.18),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(236,72,153,.13),transparent_30%)]" />
        <div className="container-custom relative grid items-center gap-14 lg:grid-cols-[1.05fr_.95fr]">
          <div className="max-w-3xl">
            <span className="badge badge-brand mb-6 inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Native AppToolkitLab SaaS
            </span>
            <h1 className="ts-h1 text-balance">
              Turn a strong idea into a <span className="gradient-text">publish-ready article</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--text-secondary)]">
              Blog Studio combines staged research, long-form generation, hands-on editing, SEO
              guidance, and dependable exports—without a second login or a separate content silo.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/app/blog-studio/new" target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-lg">
                Create your first blog <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/pricing" className="btn btn-secondary btn-lg">See allowances</Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-[var(--text-secondary)]">
              {['Managed AI credentials', 'Checkpointed generation', 'No blog counted on failure'].map((item) => (
                <span key={item} className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" />{item}</span>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-2xl shadow-indigo-500/10">
            <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--bg-muted)] p-5 sm:p-7">
              <div className="flex items-center justify-between">
                <div><p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-500">Generation in progress</p><h2 className="mt-2 text-xl font-bold">The practical guide to document automation</h2></div>
                <span className="rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-500">72%</span>
              </div>
              <div className="mt-6 h-2 overflow-hidden rounded-full bg-[var(--border)]"><div className="h-full w-[72%] rounded-full bg-gradient-to-r from-indigo-500 to-pink-500" /></div>
              <div className="mt-6 grid gap-3">
                {[
                  [Search, 'Research and source synthesis', true],
                  [Layers3, 'Outline and first draft', true],
                  [BookOpenCheck, 'Humanization and quality checks', false],
                  [BarChart3, 'SEO metadata and score', false],
                ].map(([Icon, label, complete]) => {
                  const StageIcon = Icon as typeof Search;
                  return <div key={String(label)} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3"><span className={`grid h-9 w-9 place-items-center rounded-lg ${complete ? 'bg-emerald-500/10 text-emerald-500' : 'bg-indigo-500/10 text-indigo-500'}`}><StageIcon className="h-4 w-4" /></span><span className="text-sm font-semibold">{String(label)}</span>{complete && <Check className="ml-auto h-4 w-4 text-emerald-500" />}</div>;
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container-custom py-24">
        <div className="mx-auto max-w-3xl text-center"><p className="section-label">A deliberate writing system</p><h2 className="mt-3 text-3xl font-bold sm:text-4xl">Every stage is visible, resumable, and editable</h2><p className="mt-4 text-[var(--text-secondary)]">A ten-stage pipeline gives the model structure while leaving the final editorial decision with you.</p></div>
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {workflow.map(([number, title, description]) => <article key={number} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6"><span className="text-sm font-black text-indigo-500">{number}</span><h3 className="mt-5 text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{description}</p></article>)}
        </div>
      </section>

      <section className="border-y border-[var(--border)] bg-[var(--bg-muted)] py-24">
        <div className="container-custom grid gap-8 lg:grid-cols-3">
          {[
            [Gauge, 'Honest usage controls', 'Blogs and AI credits are tracked separately. Failed or cancelled generations release their reservations.'],
            [FileOutput, 'Useful export paths', 'Download Markdown or HTML immediately, and send DOCX or PDF through the existing document conversion engines.'],
            [ShieldCheck, 'Workspace-grade boundaries', 'Organization-scoped data, sanitized article HTML, guarded endpoints, audit events, and managed provider credentials.'],
          ].map(([Icon, title, body]) => { const FeatureIcon = Icon as typeof Gauge; return <article key={String(title)} className="rounded-3xl border border-[var(--border)] bg-[var(--bg-card)] p-7"><span className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-500/10 text-indigo-500"><FeatureIcon className="h-5 w-5" /></span><h3 className="mt-5 text-xl font-bold">{String(title)}</h3><p className="mt-3 leading-7 text-[var(--text-secondary)]">{String(body)}</p></article>; })}
        </div>
      </section>

      <section className="container-custom py-24">
        <div className="grid gap-8 rounded-[2rem] border border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 to-pink-500/5 p-8 lg:grid-cols-[1fr_auto] lg:items-center lg:p-12">
          <div><p className="section-label">Simple add-on</p><h2 className="mt-2 text-3xl font-bold">40 completed blogs and 800 AI credits each month</h2><p className="mt-3 max-w-2xl text-[var(--text-secondary)]">$19/month or ₹1,599/month. Checkout stays unavailable until payment-provider lifecycle tests are approved.</p></div>
          <div className="flex flex-wrap gap-3"><Link href="/app/blog-studio/new" target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-lg"><Sparkles className="h-4 w-4" />Start with your plan</Link><Link href="/app/blog-studio/usage" target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-lg"><Gauge className="h-4 w-4" />View usage</Link></div>
        </div>
      </section>
    </div>
  );
}
