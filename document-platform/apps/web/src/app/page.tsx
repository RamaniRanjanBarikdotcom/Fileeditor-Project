import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  MousePointerClick,
  ScanSearch,
  ShieldCheck,
  Star,
  UploadCloud,
  UserRound,
} from 'lucide-react';
import { listToolDefinitions } from '@docconv/tool-registry';
import { getToolPresentation } from '../lib/tools-registry';
import { groupTools } from '../lib/tool-groups';
import { toolGroupIcon } from '../lib/tool-group-icons';

const POPULAR_TOOL_SLUGS = [
  'merge-pdf',
  'compress-pdf',
  'pdf-to-docx',
  'split-pdf',
  'pdf-editor',
  'ocr-pdf',
  'protect-pdf',
  'image-to-pdf',
];

const PLANS = [
  {
    name: 'Free',
    audience: 'For occasional use',
    price: '$0',
    period: 'forever',
    features: [
      '300 operations per month',
      '25 MB maximum file size',
      'Private browser tools included',
      'Start without an account',
    ],
    cta: 'Start for free',
    href: '/register',
  },
  {
    name: 'Pro',
    audience: 'For regular document work',
    price: '$9',
    period: '/mo · ₹749',
    features: [
      '500 operations per month',
      '100 MB maximum file size',
      'Priority processing',
      '1 workspace seat',
    ],
    cta: 'Choose Pro',
    href: '/pricing',
    featured: true,
  },
  {
    name: 'Business',
    audience: 'For larger workflows',
    price: '$29',
    period: '/mo · ₹2,499',
    features: [
      '5,000 operations per month',
      '250 MB maximum file size',
      'Up to 10 seats',
      'API access enabled',
    ],
    cta: 'Choose Business',
    href: '/pricing',
  },
];

const PRINCIPLES = [
  {
    icon: ShieldCheck,
    title: 'Private by design',
    body: 'PDF utilities run entirely in your browser. Files sent to the server expire automatically within ten minutes.',
  },
  {
    icon: BadgeCheck,
    title: 'Validated output',
    body: 'Every converted file is checked before it is offered for download, so you never receive a broken document.',
  },
  {
    icon: ScanSearch,
    title: 'Scanned before processing',
    body: 'Uploads pass a malware scan and strict file-type checks before any conversion engine touches them.',
  },
  {
    icon: UserRound,
    title: 'No account to start',
    body: 'Use the tools straight away. Create a free account only when you want history and higher limits.',
  },
];

const STEPS = [
  {
    icon: MousePointerClick,
    title: 'Choose a tool',
    body: 'Pick from PDF, document, image and web tools — each built for one job.',
  },
  {
    icon: UploadCloud,
    title: 'Add your file',
    body: 'Drop a file or paste a link. Private tools never leave your device.',
  },
  {
    icon: Download,
    title: 'Download the result',
    body: 'Get a validated file in seconds, ready to share or edit.',
  },
];

function HeroPreview() {
  const files = [
    { name: 'Quarterly-report.pdf', meta: '2.4 MB · 18 pages' },
    { name: 'Appendix-tables.pdf', meta: '860 KB · 6 pages' },
    { name: 'Signed-cover.pdf', meta: '312 KB · 1 page' },
  ];
  return (
    <div className="hp-preview" aria-hidden="true">
      <div className="hp-preview-window">
        <div className="hp-preview-bar">
          <span />
          <span />
          <span />
          <p>Merge PDF</p>
        </div>
        <div className="hp-preview-body">
          <div className="hp-preview-drop">
            <UploadCloud />
            <div>
              <strong>3 files ready</strong>
              <small>Drag to reorder pages</small>
            </div>
          </div>
          <ul className="hp-preview-files">
            {files.map((file, index) => (
              <li key={file.name}>
                <span className="hp-preview-index">{index + 1}</span>
                <span className="hp-preview-fileicon">
                  <FileText />
                </span>
                <span className="hp-preview-filename">
                  <strong>{file.name}</strong>
                  <small>{file.meta}</small>
                </span>
                <CheckCircle2 className="hp-preview-check" />
              </li>
            ))}
          </ul>
          <div className="hp-preview-progress">
            <div>
              <strong>Merging locally</strong>
              <span>86%</span>
            </div>
            <span className="hp-preview-track">
              <span />
            </span>
          </div>
          <div className="hp-preview-result">
            <span className="hp-preview-fileicon hp-preview-fileicon-done">
              <FileText />
            </span>
            <span className="hp-preview-filename">
              <strong>merged-report.pdf</strong>
              <small>25 pages · validated</small>
            </span>
            <span className="hp-preview-download">
              <Download /> Download
            </span>
          </div>
        </div>
      </div>
      <div className="hp-preview-chip hp-preview-chip-top">
        <ShieldCheck /> Processed on your device
      </div>
      <div className="hp-preview-chip hp-preview-chip-bottom">
        <Clock3 /> Server files expire in 10 min
      </div>
    </div>
  );
}

export default function HomePage() {
  const definitions = listToolDefinitions();
  const toolCount = definitions.length;
  const privateCount = definitions.filter(
    (tool) => tool.capability.preferred === 'BROWSER',
  ).length;
  const categoryCount = new Set(definitions.map((tool) => tool.category)).size;
  const taskGroups = groupTools(definitions);
  const popular = POPULAR_TOOL_SLUGS.map((slug) => ({
    definition: definitions.find((tool) => tool.slug === slug),
    presentation: getToolPresentation(slug),
  })).filter((tool) => tool.definition);

  return (
    <div className="hp">
      {/* Hero */}
      <section className="hp-hero">
        <div className="hp-hero-backdrop" aria-hidden="true" />
        <div className="container-custom hp-hero-grid">
          <div className="hp-hero-copy">
            <span className="hp-eyebrow">
              <span className="hp-eyebrow-dot" />
              PDF, Office, OCR and web capture in one place
            </span>
            <h1>
              Every document task,
              <span> done in seconds.</span>
            </h1>
            <p className="hp-lead">
              Merge, split, convert and edit PDFs, turn webpages into documents and pull text out of
              scans — with private in-browser processing and no software to install.
            </p>
            <div className="hp-hero-actions">
              <Link href="/tools" className="btn btn-primary btn-lg">
                Explore free tools <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/pricing" className="btn btn-secondary btn-lg">
                View pricing
              </Link>
            </div>
            <ul className="hp-hero-trust">
              <li>
                <CheckCircle2 /> No sign-up to start
              </li>
              <li>
                <CheckCircle2 /> Free plan, no card required
              </li>
              <li>
                <CheckCircle2 /> Works on any device
              </li>
            </ul>
          </div>
          <HeroPreview />
        </div>
      </section>

      {/* Stats */}
      <section className="hp-stats" aria-label="Platform at a glance">
        <div className="container-custom">
          <dl>
            <div>
              <dt>Online tools</dt>
              <dd>{toolCount}</dd>
            </div>
            <div>
              <dt>Private in-browser tools</dt>
              <dd>{privateCount}</dd>
            </div>
            <div>
              <dt>Tool categories</dt>
              <dd>{categoryCount}</dd>
            </div>
            <div>
              <dt>Maximum server file lifetime</dt>
              <dd>10 min</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Popular tools */}
      <section className="hp-section">
        <div className="container-custom">
          <header className="hp-section-head">
            <p className="section-label">Popular tools</p>
            <h2>The tools people reach for every day</h2>
            <p>
              {toolCount} focused tools across {categoryCount} categories. Each one does a single
              job well.
            </p>
          </header>
          <div className="hp-tool-grid">
            {popular.map(({ definition, presentation }) => {
              const Icon = presentation.icon;
              return (
                <Link
                  key={presentation.slug}
                  href={`/tools/${presentation.slug}`}
                  className="hp-tool-card"
                  style={{ '--tool-accent': presentation.accentColor } as React.CSSProperties}
                >
                  <span className="hp-tool-icon">
                    <Icon />
                  </span>
                  <span className="hp-tool-category">{definition!.category}</span>
                  <h3>{presentation.name}</h3>
                  <p>{definition!.description}</p>
                  <span className="hp-tool-link">
                    Open tool <ArrowRight />
                  </span>
                </Link>
              );
            })}
          </div>
          <div className="hp-center">
            <Link href="/tools" className="btn btn-secondary btn-md">
              Browse all {toolCount} tools <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Browse by task */}
      <section className="hp-section hp-section-alt">
        <div className="container-custom">
          <header className="hp-section-head">
            <p className="section-label">Browse by task</p>
            <h2>Find the right tool for the job</h2>
            <p>Every tool is organized by what you want to do with your file.</p>
          </header>
          <div className="hp-task-grid">
            {taskGroups.map(({ group, tools }) => {
              const GroupIcon = toolGroupIcon(group.id);
              return (
                <Link key={group.id} href={`/tools?group=${group.id}`} className="hp-task-card">
                  <span className="hp-step-icon">
                    <GroupIcon />
                  </span>
                  <span className="hp-task-copy">
                    <strong>
                      {group.title} <small>{tools.length} tools</small>
                    </strong>
                    <span>{group.description}</span>
                  </span>
                  <ArrowRight className="hp-task-arrow" />
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="hp-section">
        <div className="container-custom">
          <header className="hp-section-head">
            <p className="section-label">How it works</p>
            <h2>From file to finished in three steps</h2>
          </header>
          <ol className="hp-steps">
            {STEPS.map(({ icon: Icon, title, body }, index) => (
              <li key={title}>
                <span className="hp-step-number">{index + 1}</span>
                <span className="hp-step-icon">
                  <Icon />
                </span>
                <h3>{title}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Principles */}
      <section className="hp-section hp-section-alt">
        <div className="container-custom">
          <header className="hp-section-head">
            <p className="section-label">Built for trust</p>
            <h2>Your documents stay yours</h2>
            <p>Security and privacy are part of how every tool is built, not an add-on.</p>
          </header>
          <div className="hp-principles">
            {PRINCIPLES.map(({ icon: Icon, title, body }) => (
              <article key={title}>
                <span className="hp-principle-icon">
                  <Icon />
                </span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="hp-section">
        <div className="container-custom">
          <header className="hp-section-head">
            <p className="section-label">Pricing</p>
            <h2>Start free. Upgrade when you need more.</h2>
            <p>Simple monthly plans with clear limits. Cancel anytime.</p>
          </header>
          <div className="home-pricing-grid">
            {PLANS.map((plan) => (
              <article
                key={plan.name}
                className={`pricing-plan-card${plan.featured ? ' pricing-plan-card-popular' : ''}`}
              >
                <div className="pricing-plan-heading">
                  <div>
                    <p className="pricing-plan-audience">{plan.audience}</p>
                    <h3>{plan.name}</h3>
                  </div>
                  {plan.featured && (
                    <span className="pricing-plan-badge">
                      <Star style={{ width: '0.6rem', height: '0.6rem' }} fill="currentColor" />
                      Most popular
                    </span>
                  )}
                </div>
                <div className="pricing-plan-price">
                  <span>{plan.price}</span>
                  <small>{plan.period}</small>
                </div>
                <ul className="pricing-plan-features">
                  {plan.features.map((feature) => (
                    <li key={feature} className="feature-item">
                      <CheckCircle2
                        style={{
                          width: '0.9rem',
                          height: '0.9rem',
                          color: plan.featured ? 'var(--brand-500)' : 'var(--success)',
                          flexShrink: 0,
                        }}
                      />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className={`btn ${plan.featured ? 'btn-primary' : 'btn-secondary'} btn-md pricing-plan-action`}
                >
                  {plan.cta}
                </Link>
              </article>
            ))}
          </div>
          <div className="home-pricing-compare">
            <Link href="/pricing">
              Compare all plan features
              <ArrowRight style={{ width: '0.85rem', height: '0.85rem' }} />
            </Link>
          </div>
        </div>
      </section>

      {/* Closing call to action */}
      <section className="hp-cta-section">
        <div className="container-custom">
          <div className="hp-cta">
            <div>
              <h2>Ready to convert your first file?</h2>
              <p>No account required. Pick a tool, add your file and download the result.</p>
            </div>
            <div className="hp-cta-actions">
              <Link href="/tools" className="btn btn-lg hp-cta-primary">
                Browse all tools <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/register" className="btn btn-lg hp-cta-secondary">
                Create free account
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
