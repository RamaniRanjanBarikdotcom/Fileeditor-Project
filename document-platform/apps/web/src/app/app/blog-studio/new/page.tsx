'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, CircleStop, Eye, Gauge, Globe, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { fetchApi, fetchWithAuth } from '../../../../lib/api';
import { useFeatureFlags } from '../../../../lib/use-feature-flags';

const STAGES = [
  'Research',
  'Sources',
  'Takeaways',
  'Outline',
  'Draft',
  'Repair',
  'Humanize',
  'Quality',
  'Expand',
  'Finalize',
];

const WRITING_STYLES = ['Professional', 'Casual', 'Technical', 'Creative', 'Educational', 'Thought leadership', 'Story-driven'];
const WRITING_TONES = ['Friendly', 'Formal', 'Persuasive', 'Casual', 'Authoritative', 'Playful', 'Direct'];
const LANGUAGES = ['English', 'German', 'Spanish', 'French', 'Italian', 'Dutch', 'Polish', 'Portuguese', 'Hindi', 'Japanese', 'Chinese'];
const PLATFORMS = ['Generic', 'Shopify', 'WooCommerce', 'Magento', 'PrestaShop', 'BigCommerce', 'JTL', 'Custom'];

type Job = {
  id: string;
  status: string;
  progress: number;
  currentStage?: string;
  errorMessage?: string;
  blog?: { id: string };
};

export default function NewBlogPage() {
  const flags = useFeatureFlags();
  const router = useRouter();
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const monitorAbort = useRef<AbortController | null>(null);
  const [form, setForm] = useState({
    topic: '',
    keywords: '',
    focusKeyword: '',
    language: 'English',
    writingStyle: 'Professional',
    tone: 'Friendly',
    targetLength: 2500,
    brandContext: '',
    brandWebsiteUrl: '',
    storeUrl: '',
    platform: 'Generic',
    useProductContext: false,
    providerCredentialId: '',
    promptTemplateVersion: '',
    collectionId: '',
    productId: '',
  });
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapeStatus, setScrapeStatus] = useState('');
  const [productCount, setProductCount] = useState<number | null>(null);
  const [providers, setProviders] = useState<{ id: string; name: string }[]>([]);
  const [prompts, setPrompts] = useState<{ id: string; name: string; version: number }[]>([]);
  const [collections, setCollections] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    if (flags.blogStudioByok) void fetchApi<any[]>('/blog-studio/providers').then((res) => {
      if (res.success && res.data) setProviders(res.data
        .filter((item) => !['TAVILY', 'HUGGINGFACE'].includes(item.providerType))
        .map((item) => ({ id: item.id, name: `${item.label} · ${item.providerType}` })));
    });
    if (flags.blogStudioFullSuite) {
      void fetchApi<any[]>('/blog-studio/prompts').then((res) => {
        if (res.success && res.data) setPrompts(res.data.map((item) => ({ id: item.id, name: item.name, version: item.version })));
      });
      void fetchApi<any[]>('/blog-studio/product-collections').then((res) => {
        if (res.success && res.data) {
          setCollections(res.data);
          // Load total product count for "use product context" checkbox display
          if (res.data.length > 0) {
            fetchApi<any[]>(`/blog-studio/product-collections/${res.data[0].id}/products`).then((pRes) => {
              if (pRes.success && pRes.data) setProductCount(pRes.data.length);
            });
          }
        }
      });
    }
  }, [flags.blogStudioByok, flags.blogStudioFullSuite]);

  useEffect(() => {
    if (!form.collectionId) {
      const timer = setTimeout(() => setProducts([]), 0);
      return () => clearTimeout(timer);
    }
    void fetchApi<any[]>(`/blog-studio/product-collections/${form.collectionId}/products`).then((res) => {
      if (res.success && res.data) setProducts(res.data);
    });
    return undefined;
  }, [form.collectionId]);

  const update = <K extends keyof typeof form>(key: K, value: typeof form[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const stageIndex = useMemo(
    () =>
      job?.currentStage
        ? [
            'research',
            'sources',
            'takeaways',
            'outline',
            'draft',
            'repair',
            'humanize',
            'quality',
            'expand',
            'finalize',
          ].indexOf(job.currentStage)
        : -1,
    [job],
  );

  const estimatedCredits = useMemo(
    () =>
      Math.min(
        80,
        Math.max(10, Math.ceil(form.targetLength / 100) + (form.brandContext ? 12 : 10)),
      ),
    [form.targetLength, form.brandContext],
  );

  const handleJobUpdate = useCallback(
    (next: Job) => {
      setJob(next);
      if (next.status === 'COMPLETED' && next.blog?.id) {
        monitorAbort.current?.abort();
        sessionStorage.removeItem('blog-studio-active-generation');
        router.push(`/app/blog-studio/${next.blog.id}`);
        return true;
      }
      if (['FAILED', 'CANCELLED'].includes(next.status)) {
        monitorAbort.current?.abort();
        sessionStorage.removeItem('blog-studio-active-generation');
        if (next.status === 'FAILED') {
          setError(next.errorMessage || 'Generation failed. Your reservation was released.');
        }
        return true;
      }
      return false;
    },
    [router],
  );

  const startMonitoring = useCallback(
    function monitor(id: string) {
      monitorAbort.current?.abort();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      const controller = new AbortController();
      monitorAbort.current = controller;

      void (async () => {
        try {
          const response = await fetchWithAuth(`/api/v1/blog-studio/generations/${id}/events`, {
            headers: { Accept: 'text/event-stream' },
            signal: controller.signal,
          });
          if (!response.ok || !response.body) throw new Error('Progress stream unavailable.');
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          while (!controller.signal.aborted) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split('\n\n');
            buffer = events.pop() || '';
            for (const event of events) {
              const dataLine = event
                .split('\n')
                .find((line) => line.startsWith('data:'))
                ?.slice(5)
                .trim();
              if (!dataLine) continue;
              const payload = JSON.parse(dataLine) as Job & { stage?: string; error?: string };
              if (
                handleJobUpdate({
                  ...payload,
                  currentStage: payload.stage || payload.currentStage,
                  errorMessage: payload.error || payload.errorMessage,
                })
              ) {
                return;
              }
            }
          }
        } catch {
          if (controller.signal.aborted) return;
          const snapshot = await fetchApi<Job>(`/blog-studio/generations/${id}`);
          if (snapshot.success && snapshot.data && handleJobUpdate(snapshot.data)) return;
        }
        if (!controller.signal.aborted) {
          reconnectTimer.current = setTimeout(() => monitor(id), 1_500);
        }
      })();
    },
    [handleJobUpdate],
  );

  useEffect(() => {
    const activeJobId = sessionStorage.getItem('blog-studio-active-generation');
    if (activeJobId) {
      const resumeTimer = setTimeout(() => {
        setJob({ id: activeJobId, status: 'QUEUED', progress: 0 });
        startMonitoring(activeJobId);
      }, 0);
      return () => {
        clearTimeout(resumeTimer);
        monitorAbort.current?.abort();
        if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      };
    }
    return () => {
      monitorAbort.current?.abort();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [startMonitoring]);

  async function handleRunScraper() {
    if (!form.storeUrl) return;
    setScraping(true);
    setScrapeStatus('');
    try {
      const collectionName = `Scrape ${new URL(form.storeUrl).hostname}`;
      const createRes = await fetchApi('/blog-studio/product-collections', {
        method: 'POST',
        body: JSON.stringify({ name: collectionName, sourceUrl: form.storeUrl, sourceType: form.platform }),
      });

      if (!createRes.success) throw new Error(createRes.error?.message || 'Failed to create collection');
      const collectionId = createRes.data.id;

      const res = await fetchApi<{ scrapedCount: number }>(`/blog-studio/product-collections/${collectionId}/scrape`, {
        method: 'POST',
      });
      if (res.success && res.data) {
        setScrapeStatus(`Loaded ${res.data.scrapedCount} products from the store.`);
        setProductCount(res.data.scrapedCount);
        update('collectionId', collectionId);
        update('useProductContext', true);
      } else {
        setScrapeStatus(res.error?.message || 'Scraper failed. Check the URL and try again.');
      }
    } catch (err: any) {
      setScrapeStatus(err.message || 'Scraper failed. Check the URL and try again.');
    }
    setScraping(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    const response = await fetchApi<{ id: string }>('/blog-studio/generations', {
      method: 'POST',
      body: JSON.stringify({
        topic: form.topic,
        focusKeyword: form.focusKeyword || undefined,
        language: form.language,
        writingStyle: form.writingStyle,
        tone: form.tone,
        targetLength: form.targetLength,
        brandContext: form.brandContext || undefined,
        brandWebsiteUrl: form.storeUrl || form.brandWebsiteUrl || undefined,
        providerCredentialId: form.providerCredentialId || undefined,
        promptTemplateVersion: form.promptTemplateVersion ? Number(form.promptTemplateVersion) : undefined,
        productContext: products.find((item) => item.id === form.productId)
          ? (() => { const item = products.find((candidate) => candidate.id === form.productId); return { title: item.title, description: item.description, price: item.price, currency: item.currency, url: item.productUrl, brand: item.brand, category: item.category, customFields: item.fieldsJson }; })()
          : undefined,
        keywords: form.keywords
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      }),
    });
    setSubmitting(false);
    if (!response.success || !response.data) {
      setError(response.error?.message || 'Generation could not be started.');
      return;
    }
    const id = response.data.id;
    setJob({ id, status: 'QUEUED', progress: 0 });
    sessionStorage.setItem('blog-studio-active-generation', id);
    startMonitoring(id);
  }

  async function cancel() {
    if (!job) return;
    await fetchApi(`/blog-studio/generations/${job.id}/cancel`, { method: 'POST' });
  }

  if (job && !['FAILED', 'CANCELLED'].includes(job.status)) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-10">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <span className="text-xs font-black uppercase tracking-[.16em] text-indigo-500">
                Generation in progress
              </span>
              <h1 className="mt-2 text-3xl font-black text-slate-950 dark:text-white">
                Building your article
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                The checkpoint is saved after every completed stage.
              </p>
            </div>
            <button
              onClick={cancel}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40"
            >
              <CircleStop className="h-4 w-4" />
              Cancel safely
            </button>
          </div>
          <div className="mt-8">
            <div className="mb-2 flex justify-between text-sm font-bold">
              <span className="capitalize">{job.currentStage || 'Queued'}</span>
              <span>{job.progress}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-fuchsia-500 transition-all"
                style={{ width: `${job.progress}%` }}
              />
            </div>
          </div>
          <ol className="mt-8 grid gap-3 sm:grid-cols-2">
            {STAGES.map((stage, index) => (
              <li
                key={stage}
                className={`flex items-center gap-3 rounded-xl border p-3 text-sm font-semibold ${index <= stageIndex ? 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-300' : 'border-slate-200 text-slate-400 dark:border-slate-800'}`}
              >
                <span
                  className={`grid h-7 w-7 place-items-center rounded-lg text-xs ${index < stageIndex ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}
                >
                  {index < stageIndex ? <Check className="h-4 w-4" /> : index + 1}
                </span>
                {stage}
              </li>
            ))}
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center justify-between">
        <Link
          href="/app/blog-studio"
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-500"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {/* Header */}
        <div className="border-b border-slate-100 dark:border-slate-800 p-6">
          <h1 className="text-2xl font-black text-slate-950 dark:text-white flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-indigo-500" />
            Create New Blog
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Generate SEO-optimized blog posts with AI
          </p>
        </div>

        <form onSubmit={submit} className="p-6 space-y-6">
          {/* Blog Topic */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
              Blog Topic <span className="text-red-500">*</span>
            </label>
            <input
              required
              maxLength={300}
              value={form.topic}
              onChange={(e) => update('topic', e.target.value)}
              placeholder="e.g., Best Coffee Brewing Methods for Home Baristas"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/30"
            />
          </div>

          {/* Target Keywords */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
              Target Keywords <span className="text-xs font-normal text-slate-400">(optional)</span>
            </label>
            <input
              value={form.keywords}
              onChange={(e) => update('keywords', e.target.value)}
              placeholder="coffee brewing, french press, pour over (comma separated)"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/30"
            />
          </div>

          {/* Focus Keyword */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
              Focus Keyword <span className="text-xs font-normal text-slate-400">(optional)</span>
            </label>
            <input
              value={form.focusKeyword}
              onChange={(e) => update('focusKeyword', e.target.value)}
              placeholder="e.g., coffee brewing"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/30"
            />
          </div>

          {/* Store URL + Platform + Scraper */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-5 space-y-4 bg-slate-50 dark:bg-slate-800/50">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-1.5">
                Store URL
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-300 dark:bg-slate-600 text-slate-600 dark:text-slate-300 text-[10px] font-bold cursor-help" title="Enter your store URL to automatically load product data">?</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={form.storeUrl}
                  onChange={(e) => update('storeUrl', e.target.value)}
                  placeholder="https://example.com"
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/30"
                />
                <button
                  type="button"
                  title="Preview store"
                  className="px-3 py-3 rounded-xl border border-slate-200 bg-white text-indigo-500 hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-indigo-900/30 transition"
                  onClick={() => form.storeUrl && window.open(form.storeUrl, '_blank')}
                >
                  <Eye className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                Platform
              </label>
              <select
                value={form.platform}
                onChange={(e) => update('platform', e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/30"
              >
                {PLATFORMS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              disabled={!form.storeUrl || scraping}
              onClick={handleRunScraper}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 text-sm font-bold text-white transition"
            >
              <Globe className="h-4 w-4" />
              {scraping ? 'Running scraper…' : 'Run scraper'}
            </button>

            {scrapeStatus && (
              <p className="text-xs text-slate-500 dark:text-slate-400">{scrapeStatus}</p>
            )}

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.useProductContext}
                onChange={(e) => update('useProductContext', e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
              />
              <span className="text-sm text-slate-600 dark:text-slate-300">
                Use product database context
                {productCount !== null && (
                  <span className="ml-2 text-xs text-slate-400">
                    (Loaded {productCount} products from the database.)
                  </span>
                )}
              </span>
            </label>
          </div>

          {/* Writing Style */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
              Writing Style
            </label>
            <div className="flex flex-wrap gap-2">
              {WRITING_STYLES.map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => update('writingStyle', style)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold border transition ${
                    form.writingStyle === style
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-400 dark:hover:border-indigo-500 bg-white dark:bg-slate-800'
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          {/* Writing Tone */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
              Writing Tone
            </label>
            <div className="flex flex-wrap gap-2">
              {WRITING_TONES.map((tone) => (
                <button
                  key={tone}
                  type="button"
                  onClick={() => update('tone', tone)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold border transition ${
                    form.tone === tone
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-indigo-400 dark:hover:border-indigo-500 bg-white dark:bg-slate-800'
                  }`}
                >
                  {tone}
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
              Language
            </label>
            <select
              value={form.language}
              onChange={(e) => update('language', e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:focus:border-indigo-500 dark:focus:ring-indigo-900/30"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang}>{lang}</option>
              ))}
            </select>
          </div>

          {/* Target Word Count Slider */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
              Target Word Count: <span className="text-indigo-500">{form.targetLength.toLocaleString()}</span>
            </label>
            <input
              type="range"
              min={1000}
              max={5000}
              step={100}
              value={form.targetLength}
              onChange={(e) => update('targetLength', Number(e.target.value))}
              className="w-full accent-indigo-600"
            />
            <div className="mt-2 flex justify-between text-xs text-slate-400">
              <span>1,000</span>
              <span>5,000</span>
            </div>
          </div>

          {/* Advanced options */}
          {(flags.blogStudioByok || flags.blogStudioFullSuite) && (
            <details className="group">
              <summary className="cursor-pointer text-sm font-semibold text-slate-500 hover:text-indigo-500 list-none flex items-center gap-2">
                <span className="text-xs border border-slate-200 dark:border-slate-700 rounded px-2 py-0.5 group-open:hidden">▸ Advanced options</span>
                <span className="text-xs border border-slate-200 dark:border-slate-700 rounded px-2 py-0.5 hidden group-open:inline">▾ Advanced options</span>
              </summary>
              <div className="mt-4 space-y-4 pl-1">
                {flags.blogStudioByok && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">AI Provider</label>
                    <select
                      value={form.providerCredentialId}
                      onChange={(e) => update('providerCredentialId', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800"
                    >
                      <option value="">Managed AI (Default)</option>
                      {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                )}
                {flags.blogStudioFullSuite && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Prompt Template</label>
                    <select
                      value={form.promptTemplateVersion}
                      onChange={(e) => update('promptTemplateVersion', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800"
                    >
                      <option value="">System Default Prompts</option>
                      {prompts.map(p => <option key={p.id} value={p.version}>{p.name} · v{p.version}</option>)}
                    </select>
                  </div>
                )}
                {flags.blogStudioFullSuite && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Product Collection</label>
                    <select
                      value={form.collectionId}
                      onChange={(e) => { update('collectionId', e.target.value); update('productId', ''); }}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800"
                    >
                      <option value="">No product context</option>
                      {collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
                    </select>
                  </div>
                )}
                {flags.blogStudioFullSuite && form.collectionId && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Product Context</label>
                    <select
                      value={form.productId}
                      onChange={(e) => update('productId', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-indigo-400 dark:border-slate-700 dark:bg-slate-800"
                    >
                      <option value="">Choose a product</option>
                      {products.map((product) => <option key={product.id} value={product.id}>{product.title}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                    Brand Context
                    <small className="ml-2 font-normal text-slate-400">Do not paste secrets</small>
                  </label>
                  <textarea
                    value={form.brandContext}
                    onChange={(e) => update('brandContext', e.target.value)}
                    rows={3}
                    maxLength={4000}
                    placeholder="Audience, positioning, products, style guidance…"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-indigo-400 resize-y dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>
            </details>
          )}

          {/* Credit estimate */}
          <div className="flex items-center justify-between rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-indigo-700 dark:text-indigo-300">
              <Gauge className="h-4 w-4" />
              Estimated AI credits
            </div>
            <strong className="text-lg text-indigo-700 dark:text-indigo-300">{estimatedCredits}</strong>
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </div>
          )}

          <button
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-500 px-5 py-4 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 disabled:opacity-60 hover:shadow-indigo-500/30 transition"
          >
            <Sparkles className="h-4 w-4" />
            {submitting ? 'Reserving usage…' : 'Generate Blog'}
          </button>
        </form>
      </div>
    </div>
  );
}
