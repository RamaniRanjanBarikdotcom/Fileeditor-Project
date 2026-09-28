'use client';

import { useState } from 'react';
import { Database, Play, Server, AlertCircle, CheckCircle2, SlidersHorizontal } from 'lucide-react';
import { fetchApi } from '../../../../lib/api';
import {
  CUSTOM_SELECTOR_FIELDS,
  PRODUCT_PLATFORMS,
  type CustomSelectorKey,
} from '../product-platforms';

export default function BlogStudioProductsPage() {
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState('auto');
  const [running, setRunning] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    scrapedCount: number;
    inserted: number;
    updated: number;
    detectedPlatform?: string;
  } | null>(null);
  const [customSelectors, setCustomSelectors] = useState<Record<CustomSelectorKey, string>>({
    productCard: '',
    title: '',
    price: '',
    link: '',
    image: '',
    description: '',
    sku: '',
  });

  async function handleScrape() {
    setError(null);
    setRunning(true);
    setProducts([]);
    setResult(null);

    try {
      const normalizedUrl = new URL(url).toString();
      // 1. Create or get collection
      const collectionName = `Scrape ${new URL(normalizedUrl).hostname}`;
      const scrapeConfig = Object.fromEntries(
        Object.entries(customSelectors).filter(([, value]) => value.trim()),
      );
      const createRes = await fetchApi('/blog-studio/product-collections', {
        method: 'POST',
        body: JSON.stringify({
          name: collectionName,
          sourceUrl: normalizedUrl,
          sourceType: platform,
          scrapeConfig: platform === 'custom' ? scrapeConfig : undefined,
        }),
      });

      if (!createRes.success) {
        throw new Error(createRes.error?.message || 'Failed to create product collection');
      }

      const collectionId = createRes.data.id;

      // 2. Trigger Scrape
      const scrapeRes = await fetchApi(`/blog-studio/product-collections/${collectionId}/scrape`, {
        method: 'POST',
      });

      if (!scrapeRes.success) {
        throw new Error(scrapeRes.error?.message || 'Failed to scrape products');
      }
      setResult(scrapeRes.data);

      // 3. Fetch scraped products
      const productsRes = await fetchApi(`/blog-studio/product-collections/${collectionId}/products`);
      
      if (!productsRes.success) {
        throw new Error(productsRes.error?.message || 'Failed to fetch scraped products');
      }

      setProducts(productsRes.data || []);
    } catch (err: any) {
      setError(err.message || 'An error occurred during scraping');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-12">
      <header>
        <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-indigo-500">
          <Database className="h-4 w-4" />
          Products
        </span>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
          Product Scraper
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Import products from JTL, React/Next.js, major commerce platforms, or any public
          custom-coded storefront.
        </p>
      </header>

      {error && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-[#0f172a] p-6 dark:border-slate-800 dark:bg-slate-900 shadow-sm text-white">
        <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-300">Store URL</label>
            <input
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={e => setUrl(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm outline-none focus:border-indigo-500 text-white"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-300">Platform</label>
            <select
              value={platform}
              onChange={e => setPlatform(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm outline-none focus:border-indigo-500 text-white"
            >
              {PRODUCT_PLATFORMS.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </div>
        </div>

        {platform === 'custom' && (
          <div className="mt-6 rounded-xl border border-indigo-400/30 bg-indigo-500/10 p-5">
            <div className="flex items-start gap-3">
              <SlidersHorizontal className="mt-0.5 h-5 w-5 text-indigo-300" />
              <div>
                <h2 className="text-sm font-bold text-white">Optional custom CSS mapping</h2>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  Leave these empty for automatic structured-data and visual detection. For an
                  unusual custom site, add selectors from one product card to make extraction exact.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {CUSTOM_SELECTOR_FIELDS.map((field) => (
                <label key={field.key} className="space-y-1.5 text-xs font-semibold text-slate-300">
                  <span>{field.label}</span>
                  <input
                    value={customSelectors[field.key]}
                    onChange={(event) => setCustomSelectors((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }))}
                    placeholder={field.placeholder}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 font-mono text-xs text-white outline-none focus:border-indigo-400"
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center gap-4">
          <button
            onClick={handleScrape}
            disabled={running || !url}
            className="flex items-center gap-2 rounded-xl bg-blue-500 px-6 py-2.5 text-sm font-bold text-white hover:bg-blue-600 disabled:opacity-50 transition"
          >
            {running ? (
              <span className="flex items-center gap-2">
                <Server className="h-4 w-4 animate-pulse" />
                Scraping...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Play className="h-4 w-4" />
                Run scraper
              </span>
            )}
          </button>
          
          {result && (
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              Saved automatically · detected {result.detectedPlatform || platform}
            </span>
          )}
        </div>
      </section>

      {products.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Scraped Products ({products.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {products.map((product, idx) => (
              <div key={product.id || idx} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm flex flex-col gap-2">
                {product.imageUrl && (
                  <div className="h-32 w-full overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={product.imageUrl} alt={product.title} className="h-full w-full object-cover" />
                  </div>
                )}
                <h3 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-2">{product.title}</h3>
                {product.price && <span className="font-semibold text-emerald-600 text-xs">{product.currency} {product.price}</span>}
                <div className="mt-auto pt-2 text-[10px] text-slate-500 break-all border-t border-slate-100 dark:border-slate-800">
                  {product.productUrl || product.externalId || product.id}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
