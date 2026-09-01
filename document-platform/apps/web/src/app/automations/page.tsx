'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Bot, Braces, CheckCircle2, ChevronRight, Clock3, CloudCog,
  FileCheck2, FileInput, Gauge, GitBranch, LockKeyhole, Package, RefreshCw,
  ScanText, ShieldCheck, Terminal, Webhook, Workflow, Zap,
} from 'lucide-react';
import { fetchApi } from '../../lib/api';

type Product = { id: string; slug: string; name: string; tagline?: string; description: string };

const USE_CASES = [
  { icon: FileInput, title: 'Document intake', description: 'Standardize repetitive file preparation before documents enter a team workflow.' },
  { icon: ScanText, title: 'Extraction pipelines', description: 'Turn OCR and content extraction steps into repeatable processing routines.' },
  { icon: GitBranch, title: 'Format routing', description: 'Direct different source types toward the appropriate conversion or export path.' },
];

const EXECUTION_MODELS = [
  { icon: Terminal, label: 'Scripts & CLI', title: 'Run from your environment', description: 'Package repeatable operations for local terminals and controlled build systems.' },
  { icon: Clock3, label: 'Scheduled jobs', title: 'Process on a timetable', description: 'Design recurring routines for folders, reports, or operational document batches.' },
  { icon: Webhook, label: 'Webhooks & APIs', title: 'Connect application events', description: 'Trigger a workflow when an approved system sends a request or business event.' },
];

const WORKFLOW_STEPS = [
  { icon: Zap, title: 'Trigger', description: 'Receive a file, schedule, or supported application event.' },
  { icon: CloudCog, title: 'Process', description: 'Run the configured document or data operation.' },
  { icon: FileCheck2, title: 'Validate', description: 'Check completion and preserve a useful execution result.' },
  { icon: Package, title: 'Deliver', description: 'Send the finished output to its approved destination.' },
];

const FAQS = [
  { question: 'Why are there no automation products yet?', answer: 'The live catalog does not currently contain a published AUTOMATION product. New items will appear here automatically after an administrator publishes them.' },
  { question: 'Will automation products use the same checkout as software?', answer: 'Yes. Catalog-managed automations use the same regional pricing, payment confirmation, entitlement, and release controls as other digital products.' },
  { question: 'Are the workflow examples on this page already purchasable?', answer: 'No. They describe the automation categories the marketplace is designed to support. A product is purchasable only when it appears in the live catalog with an eligible release.' },
  { question: 'Can I use document tools while the catalog is empty?', answer: 'Yes. AppToolkitLab free tools and the SaaS workspace remain separate from the automation marketplace and can be used independently.' },
];

export default function AutomationsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadCatalog = async () => {
    setLoading(true);
    setError('');
    const response = await fetchApi<Product[]>('/products?type=AUTOMATION');
    if (response.success && response.data) setItems(response.data);
    else setError(response.error?.message || 'The automation catalog is temporarily unavailable.');
    setLoading(false);
  };

  useEffect(() => { void loadCatalog(); }, []);

  return (
    <div className="min-h-screen">
      <section className="automation-hero relative overflow-hidden">
        <div className="automation-hero-glow" />
        <div className="container-custom relative z-10">
          <div className="automation-hero-content">
            <div className="automation-breadcrumb">
              <Link href="/">Home</Link><ChevronRight className="h-3.5 w-3.5" /><span>Automations</span>
            </div>
            <span className="badge badge-brand automation-hero-badge"><Bot className="h-4 w-4" />Automation marketplace</span>
            <h1 className="ts-h1 automation-hero-title">Turn repetitive document work into <span className="gradient-text">reliable workflows</span></h1>
            <p className="automation-hero-description">Discover catalog-managed scripts, workflow packages, and automation assets with controlled releases and protected delivery.</p>
            <div className="automation-hero-actions">
              <a href="#automation-catalog" className="btn btn-primary btn-lg"><Workflow className="h-5 w-5" />Browse catalog</a>
              <Link href="/tools" className="btn btn-secondary btn-lg">Explore free tools <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <div className="automation-trust-row">
              <span><ShieldCheck className="h-4 w-4" />Verified releases</span>
              <span><LockKeyhole className="h-4 w-4" />Protected delivery</span>
              <span><CheckCircle2 className="h-4 w-4" />Catalog-managed access</span>
            </div>
          </div>
        </div>
      </section>

      <section className="automation-catalog-section" id="automation-catalog">
        <div className="container-custom">
          <div className="automation-catalog-heading">
            <div><p className="section-label">Live catalog</p><h2>Automation products and workflow assets</h2><p>Every item shown here comes directly from the published AppToolkitLab catalog.</p></div>
            {!loading && !error && <span className="automation-count">{items.length} {items.length === 1 ? 'item' : 'items'} available</span>}
          </div>

          {loading && <div className="automation-state-card"><RefreshCw className="h-6 w-6 animate-spin" />Loading automation catalog…</div>}
          {!loading && error && <div className="automation-state-card automation-state-column"><Package className="h-10 w-10" /><h2>Catalog could not be loaded</h2><p>{error}</p><button type="button" className="btn btn-primary" onClick={() => void loadCatalog()}>Try again</button></div>}
          {!loading && !error && items.length === 0 && (
            <div className="automation-empty-state">
              <div className="automation-empty-icon"><Workflow className="h-7 w-7" /></div>
              <div><span>Catalog status</span><h2>Automation products are being prepared</h2><p>No automation products are published yet. This page will populate automatically when an administrator adds the first catalog release.</p></div>
              <Link href="/software" className="btn btn-secondary btn-md">Browse software <ArrowRight className="h-4 w-4" /></Link>
            </div>
          )}
          {!loading && !error && items.length > 0 && (
            <div className="automation-product-grid">
              {items.map((item, index) => {
                const Icon = index % 2 ? Braces : Workflow;
                return (
                  <article className="automation-product-card" key={item.id}>
                    <div className="automation-product-icon"><Icon className="h-6 w-6" /></div>
                    <p className="automation-product-type">Automation</p>
                    <h2>{item.name}</h2>
                    <p>{item.tagline || item.description}</p>
                    <Link className="btn btn-secondary btn-md" href={`/software/${item.slug}`}>View catalog item <ArrowRight className="h-4 w-4" /></Link>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="automation-use-cases-section">
        <div className="container-custom">
          <div className="automation-section-heading"><p className="section-label">Where automation helps</p><h2>Build repeatability into document operations</h2><p>Reduce manual handoffs around the work that teams perform again and again.</p></div>
          <div className="automation-use-case-grid">
            {USE_CASES.map(({ icon: Icon, title, description }, index) => (
              <article key={title}><span className="automation-card-number">0{index + 1}</span><div className="automation-card-icon"><Icon className="h-5 w-5" /></div><h3>{title}</h3><p>{description}</p></article>
            ))}
          </div>
        </div>
      </section>

      <section className="automation-models-section">
        <div className="container-custom">
          <div className="automation-section-heading"><p className="section-label">Flexible execution</p><h2>Automation patterns for different environments</h2><p>Choose the delivery pattern that matches where and when your work begins.</p></div>
          <div className="automation-model-grid">
            {EXECUTION_MODELS.map(({ icon: Icon, label, title, description }) => (
              <article key={title}><div className="automation-model-top"><div className="automation-card-icon"><Icon className="h-5 w-5" /></div><span>{label}</span></div><h3>{title}</h3><p>{description}</p><div className="automation-model-line" /></article>
            ))}
          </div>
        </div>
      </section>

      <section className="automation-workflow-section">
        <div className="container-custom">
          <div className="automation-workflow-layout">
            <div className="automation-workflow-intro"><p className="section-label">A clear execution path</p><h2>From trigger to delivered result</h2><p>Good automation makes every stage observable and gives each output a predictable destination.</p><Link href="/saas" className="btn btn-secondary btn-md">Explore SaaS workspace <ArrowRight className="h-4 w-4" /></Link></div>
            <ol className="automation-workflow-steps">
              {WORKFLOW_STEPS.map(({ icon: Icon, title, description }, index) => (
                <li key={title}><span>{index + 1}</span><div className="automation-workflow-icon"><Icon className="h-5 w-5" /></div><div><h3>{title}</h3><p>{description}</p></div></li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="automation-safeguards-section">
        <div className="container-custom">
          <div className="automation-safeguards-grid">
            <article><ShieldCheck className="h-5 w-5" /><div><h3>Release verification</h3><p>Catalog delivery remains tied to published and approved product releases.</p></div></article>
            <article><Gauge className="h-5 w-5" /><div><h3>Clear execution results</h3><p>Workflow packages should expose completion and failure states to operators.</p></div></article>
            <article><LockKeyhole className="h-5 w-5" /><div><h3>Entitlement controls</h3><p>Protected assets are available only to accounts with eligible access.</p></div></article>
          </div>
        </div>
      </section>

      <section className="automation-faq-section">
        <div className="container-custom">
          <div className="automation-faq-layout">
            <div className="automation-faq-intro"><p className="section-label">Automation questions</p><h2>Know what is available before you buy</h2><p>The catalog is intentionally transparent about product status, delivery, and access.</p><Link href="/contact">Ask a question <ArrowRight className="h-4 w-4" /></Link></div>
            <div className="automation-faq-list">
              {FAQS.map(({ question, answer }) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
