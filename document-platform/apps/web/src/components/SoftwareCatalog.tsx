'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import {
  ArrowRight, CheckCircle2, ChevronRight, Code2, CreditCard, Download,
  Package, RefreshCw, Rocket, Search, ShieldCheck, ShoppingBag, Terminal, Users,
} from 'lucide-react';
import { fetchApi } from '../lib/api';

type Currency = 'USD' | 'INR';
type CatalogPrice = { currency: Currency; amountMinorUnits: number; provider: string };
type CatalogProduct = {
  id: string; slug: string; name: string; tagline?: string; description: string;
  type: string; prices: CatalogPrice[];
  currentRelease?: { version: string; fileSizeBytes: number } | null;
};

const formatPrice = (price: CatalogPrice | undefined, currency: Currency) => {
  if (!price) return 'Unavailable';
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(price.amountMinorUnits / 100);
};

const SOFTWARE_USE_CASES = [
  { icon: Terminal, title: 'Developer automation', description: 'Run repeatable document tasks from scripts, terminals, and internal build pipelines.' },
  { icon: Code2, title: 'Product acceleration', description: 'Start with production-minded foundations instead of rebuilding common platform features.' },
  { icon: Users, title: 'Business operations', description: 'Equip teams with focused utilities that reduce repetitive document and content work.' },
];

const PURCHASE_STEPS = [
  { icon: Search, title: 'Choose a product', description: 'Review the product scope, regional price, and current release status.' },
  { icon: ShieldCheck, title: 'Verify availability', description: 'Checkout unlocks only when a downloadable release has been verified.' },
  { icon: CreditCard, title: 'Complete checkout', description: 'The platform routes payment using the selected price and currency.' },
  { icon: Download, title: 'Access your library', description: 'Paid entitlements provide protected access to eligible release files.' },
];

const SOFTWARE_FAQS = [
  { question: 'Why does a product say “Preview catalog”?', answer: 'Its description and regional prices are published, but no verified downloadable release is attached yet. Checkout stays unavailable until that release exists.' },
  { question: 'How does USD and INR pricing work?', answer: 'Select your preferred display currency above. The catalog uses the active regional price and routes an eligible checkout through the configured provider for that currency.' },
  { question: 'Where do purchased downloads appear?', answer: 'After a confirmed payment creates the required entitlement, eligible release files appear in your authenticated AppToolkitLab library.' },
  { question: 'Can I use the free tools without buying software?', answer: 'Yes. The free tools, one-time software products, and SaaS workspace are separate ways to use AppToolkitLab, so you can choose only what fits your workflow.' },
];

export function SoftwareCatalog() {
  const [currency, setCurrency] = useState<Currency>('USD');
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    const response = await fetchApi<CatalogProduct[]>('/products?type=SOFTWARE');
    if (response.success && response.data) setProducts(response.data);
    else setError(response.error?.message || 'The catalog is temporarily unavailable.');
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  return (
    <div className="min-h-screen">
      <section className="software-hero relative overflow-hidden">
        <div className="absolute inset-0 -z-10" style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 0%, rgba(139,92,246,.16), transparent 70%)' }} />
        <div className="container-custom relative z-10">
          <div className="software-hero-content">
            <div className="software-breadcrumb">
              <Link href="/">Home</Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <span>Software store</span>
            </div>
            <span className="badge badge-brand software-hero-badge"><ShoppingBag className="h-4 w-4" />Verified catalog data</span>
            <h1 className="ts-h1 software-hero-title">Software built for <span className="gradient-text">real work</span></h1>
            <p className="software-hero-description">Discover downloadable software and developer products. Prices, releases, and availability come directly from the AppToolkitLab catalog.</p>
            <div className="software-currency-control" role="group" aria-label="Choose display currency">
              {(['USD', 'INR'] as Currency[]).map((item) => (
                <button key={item} type="button" onClick={() => setCurrency(item)} aria-pressed={currency === item}
                  className={`software-currency-button${currency === item ? ' software-currency-button-active' : ''}`}>
                  {item === 'USD' ? 'USD ($)' : 'INR (₹)'}
                </button>
              ))}
            </div>
            <div className="software-trust-row">
              <span><ShieldCheck className="h-4 w-4" />Secure routed checkout</span>
              <span><Package className="h-4 w-4" />Verified release files</span>
              <span><CheckCircle2 className="h-4 w-4" />One-time purchase</span>
            </div>
          </div>
        </div>
      </section>

      <section className="software-catalog-section" id="software-catalog">
        <div className="container-custom">
          <div className="software-catalog-heading">
            <div>
              <p className="section-label">Software catalog</p>
              <h2>Choose the product that fits your workflow</h2>
              <p>Review supported capabilities, regional pricing, and verified release availability.</p>
            </div>
            {!loading && !error && <span className="software-product-count">{products.length} {products.length === 1 ? 'product' : 'products'}</span>}
          </div>

          {!loading && !error && products.length > 0 && products.every((product) => !product.currentRelease) && (
            <div className="software-preview-notice" role="status">
              <Package className="h-5 w-5" />
              <div><strong>Preview catalog</strong><span>Product details and regional prices are visible. Purchasing activates only after a verified release file is published.</span></div>
            </div>
          )}

          {loading && <div className="software-state-card"><RefreshCw className="h-6 w-6 animate-spin" />Loading live catalog…</div>}
          {!loading && error && <div className="software-state-card software-state-card-column"><Package className="h-10 w-10" /><h2 className="ts-h3">Catalog could not be loaded</h2><p>{error}</p><button className="btn btn-primary" onClick={() => void load()}>Try again</button></div>}
          {!loading && !error && products.length === 0 && <div className="software-state-card software-state-card-column"><Package className="h-10 w-10" /><h2 className="ts-h3">New products are being prepared</h2><p>Products appear here after an administrator publishes a catalog release.</p></div>}
        {!loading && !error && products.length > 0 && (
          <div className="software-product-grid">
            {products.map((product, index) => {
              const Icon = index % 2 ? Code2 : Terminal;
              const accent = index % 2 ? '#a855f7' : '#6366f1';
              const price = product.prices.find((item) => item.currency === currency);
              const available = Boolean(product.currentRelease && price);
              return (
                <article key={product.id} className="software-product-card" style={{ '--product-accent': accent } as CSSProperties}>
                  <div className="software-product-accent" />
                  <div className="software-product-topline"><div className="software-product-icon" style={{ color: accent, background: `${accent}14`, borderColor: `${accent}32` }}><Icon className="h-6 w-6" /></div><span className={`software-release-badge${available ? ' software-release-badge-live' : ''}`}>{available ? `Version ${product.currentRelease?.version}` : 'Preview catalog'}</span></div>
                  <div className="software-product-copy">
                    <p className="software-product-type" style={{ color: accent }}>{product.type}</p>
                    <h2>{product.name}</h2>
                    <p>{product.tagline || product.description}</p>
                  </div>
                  <ul className="software-product-features">
                    <li className="feature-item"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Currency-routed secure checkout</li>
                    <li className="feature-item"><ShieldCheck className="h-4 w-4 text-emerald-500" /> Protected entitlement and signed downloads</li>
                    <li className="feature-item"><Package className="h-4 w-4 text-emerald-500" /> Release availability verified before purchase</li>
                  </ul>
                  <div className="software-product-footer"><div><div className="software-product-price">{formatPrice(price, currency)}</div><div className="software-product-price-note">{available ? 'One-time purchase' : 'Not yet purchasable'}</div></div><Link href={`/software/${product.slug}`} className="btn btn-primary">View details <ArrowRight className="h-4 w-4" /></Link></div>
                </article>
              );
            })}
          </div>
        )}
        </div>
      </section>

      <section className="software-use-cases-section">
        <div className="container-custom">
          <div className="software-section-heading">
            <p className="section-label">Built for practical work</p>
            <h2>Software for the workflows that slow teams down</h2>
            <p>Choose focused products that support automation, faster delivery, and repeatable business operations.</p>
          </div>
          <div className="software-use-case-grid">
            {SOFTWARE_USE_CASES.map(({ icon: Icon, title, description }, index) => (
              <article key={title} className="software-use-case-card">
                <div className="software-use-case-number">0{index + 1}</div>
                <div className="software-use-case-icon"><Icon className="h-5 w-5" /></div>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="software-purchase-section">
        <div className="container-custom">
          <div className="software-purchase-layout">
            <div className="software-purchase-intro">
              <p className="section-label">Safe by design</p>
              <h2>From catalog to download, with clear safeguards</h2>
              <p>AppToolkitLab separates product previews from purchasable releases, so customers do not pay for a file that is not ready.</p>
              <Link href="/app/library" className="btn btn-secondary btn-md">View customer library <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <ol className="software-purchase-steps">
              {PURCHASE_STEPS.map(({ icon: Icon, title, description }, index) => (
                <li key={title}>
                  <span className="software-purchase-step-number">{index + 1}</span>
                  <div className="software-purchase-step-icon"><Icon className="h-5 w-5" /></div>
                  <div><h3>{title}</h3><p>{description}</p></div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="software-compare-section">
        <div className="container-custom">
          <div className="software-section-heading">
            <p className="section-label">Choose your model</p>
            <h2>Free tools, owned software, or a cloud workspace</h2>
            <p>AppToolkitLab gives you three clear ways to work—use only the level you need.</p>
          </div>
          <div className="software-model-grid">
            <article className="software-model-card">
              <div className="software-model-icon"><Search className="h-5 w-5" /></div>
              <p className="software-model-label">Free tools</p>
              <h3>Quick browser utilities</h3>
              <p>Best for occasional conversions and focused one-off tasks.</p>
              <ul><li><CheckCircle2 className="h-4 w-4" />No software purchase</li><li><CheckCircle2 className="h-4 w-4" />Daily free allowance</li><li><CheckCircle2 className="h-4 w-4" />Individual tool pages</li></ul>
              <Link href="/tools">Explore free tools <ArrowRight className="h-4 w-4" /></Link>
            </article>
            <article className="software-model-card software-model-card-featured">
              <span className="software-model-recommended">One-time purchase</span>
              <div className="software-model-icon"><Package className="h-5 w-5" /></div>
              <p className="software-model-label">Software store</p>
              <h3>Products you purchase once</h3>
              <p>Best for reusable utilities, developer assets, and local workflows.</p>
              <ul><li><CheckCircle2 className="h-4 w-4" />Regional one-time pricing</li><li><CheckCircle2 className="h-4 w-4" />Account entitlements</li><li><CheckCircle2 className="h-4 w-4" />Protected release access</li></ul>
              <a href="#software-catalog">Browse this catalog <ArrowRight className="h-4 w-4" /></a>
            </article>
            <article className="software-model-card">
              <div className="software-model-icon"><Rocket className="h-5 w-5" /></div>
              <p className="software-model-label">SaaS workspace</p>
              <h3>Ongoing cloud capabilities</h3>
              <p>Best for higher quotas, history, APIs, and collaborative work.</p>
              <ul><li><CheckCircle2 className="h-4 w-4" />Monthly plan options</li><li><CheckCircle2 className="h-4 w-4" />Cloud conversion history</li><li><CheckCircle2 className="h-4 w-4" />Team and API tiers</li></ul>
              <Link href="/saas">Explore SaaS plans <ArrowRight className="h-4 w-4" /></Link>
            </article>
          </div>
        </div>
      </section>

      <section className="software-assurance-section">
        <div className="container-custom">
          <div className="software-assurance-grid">
            <article><ShieldCheck className="h-5 w-5" /><div><h3>Protected purchases</h3><p>Entitlements are attached to your account after confirmed payment.</p></div></article>
            <article><Package className="h-5 w-5" /><div><h3>Release-controlled downloads</h3><p>Downloads are exposed only when a verified digital asset is available.</p></div></article>
            <article><CheckCircle2 className="h-5 w-5" /><div><h3>Regional checkout</h3><p>USD and INR prices route through their configured payment provider.</p></div></article>
          </div>
        </div>
      </section>

      <section className="software-faq-section">
        <div className="container-custom">
          <div className="software-faq-layout">
            <div className="software-faq-intro">
              <p className="section-label">Store questions</p>
              <h2>Everything to know before purchasing</h2>
              <p>Clear answers about preview products, currencies, entitlements, and free tools.</p>
              <Link href="/contact" className="software-faq-contact">Still need help? Contact us <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <div className="software-faq-list">
              {SOFTWARE_FAQS.map(({ question, answer }) => (
                <details key={question}>
                  <summary>{question}<span aria-hidden="true">+</span></summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
