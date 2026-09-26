'use client';

import { useState } from 'react';
import { Database, Play, Save, Server, AlertCircle } from 'lucide-react';
import { fetchApi } from '../../../../lib/api';

export default function BlogStudioProductsPage() {
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState('Generic');
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function handleScrape() {
    setError(null);
    setRunning(true);
    setProducts([]);

    try {
      // 1. Create or get collection
      const collectionName = `Scrape ${new URL(url).hostname}`;
      const createRes = await fetchApi('/blog-studio/product-collections', {
        method: 'POST',
        body: JSON.stringify({ name: collectionName, sourceUrl: url, sourceType: platform }),
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

  async function handleSave() {
    setSaving(true);
    setTimeout(() => setSaving(false), 800);
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
          Scrape your store and build a local product database.
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
              <option value="Generic">Generic</option>
              <option value="Shopify">Shopify</option>
              <option value="WooCommerce">WooCommerce</option>
              <option value="Magento">Magento</option>
            </select>
          </div>
        </div>

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
          
          <button
            onClick={handleSave}
            disabled={saving || products.length === 0}
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-transparent px-6 py-2.5 text-sm font-bold text-slate-300 hover:bg-slate-800 disabled:opacity-50 transition"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save database'}
          </button>
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
