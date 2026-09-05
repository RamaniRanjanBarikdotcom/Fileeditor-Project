import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  FileSearch,
  Globe2,
  Layers3,
  LockKeyhole,
  Sparkles,
  Store,
  Workflow,
  Wrench,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'About AppToolkitLab — A Gonexel Product',
  description:
    'Learn how AppToolkitLab, a Gonexel product, brings free document tools, cloud workflows, automations, and downloadable software into one platform.',
};

const principles = [
  [
    'Useful before complicated',
    'A visitor should understand a tool, its inputs, and its limitations before creating an account.',
  ],
  [
    'Honest product status',
    'Available features, preview products, prices, and quotas should come from the same server-backed source of truth.',
  ],
  [
    'Privacy by default',
    'Files are retained only for the configured processing window, while access is controlled with signed sessions and download links.',
  ],
  [
    'Quality with clear limits',
    'Document conversion is format-specific. We explain when OCR, browser rendering, or manual review can affect fidelity.',
  ],
];

export default function AboutPage() {
  return (
    <div className="info-page">
      <header className="info-hero info-hero-about">
        <div className="container-custom info-hero-inner info-hero-centered">
          <span className="info-eyebrow">
            <Sparkles className="h-4 w-4" />
            About AppToolkitLab
          </span>
          <h1>Digital tools should feel simple, even when the work behind them is not.</h1>
          <p>
            AppToolkitLab is a Gonexel product being built as one dependable place to convert
            documents, capture webpages, run repeatable automations, and discover practical
            software.
          </p>
          <div className="info-hero-actions">
            <Link href="/tools" className="btn btn-primary btn-lg">
              Explore free tools <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/saas" className="btn btn-secondary btn-lg">
              See the cloud platform
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="info-section">
          <div className="container-custom">
            <div className="info-section-heading">
              <span className="section-label">One connected ecosystem</span>
              <h2>Start free. Add a workspace. Buy only what helps.</h2>
              <p>
                The platform separates quick public utilities, subscription software, and
                downloadable products while keeping discovery and account access consistent.
              </p>
            </div>
            <div className="info-card-grid info-card-grid-3">
              <article className="info-feature-card">
                <span className="info-icon indigo">
                  <Wrench />
                </span>
                <h3>Free tools</h3>
                <p>
                  Focused browser and cloud utilities for PDF, OCR, images, Markdown, HTML, and
                  webpage capture.
                </p>
                <Link href="/tools">
                  Browse tools <ArrowRight />
                </Link>
              </article>
              <article className="info-feature-card">
                <span className="info-icon emerald">
                  <Layers3 />
                </span>
                <h3>SaaS workspace</h3>
                <p>
                  A private place for larger jobs, history, reusable documents, API access, and team
                  workflows.
                </p>
                <Link href="/saas">
                  Explore SaaS <ArrowRight />
                </Link>
              </article>
              <article className="info-feature-card">
                <span className="info-icon amber">
                  <Store />
                </span>
                <h3>Software marketplace</h3>
                <p>
                  Versioned digital products, automations, protected downloads, and license-aware
                  purchases.
                </p>
                <Link href="/software">
                  Visit the store <ArrowRight />
                </Link>
              </article>
            </div>
          </div>
        </section>

        <section className="info-section info-section-muted">
          <div className="container-custom info-split">
            <div>
              <span className="section-label">How it works</span>
              <h2>One clear path from input to useful output.</h2>
              <p className="info-lead">
                Every job is routed to the engine designed for it—not forced through a single
                generic converter.
              </p>
            </div>
            <ol className="info-steps">
              <li>
                <span>01</span>
                <div>
                  <h3>Choose the right tool</h3>
                  <p>
                    File type, target format, and webpage requirements determine the conversion
                    path.
                  </p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <h3>Validate and process</h3>
                  <p>
                    Inputs are checked before isolated workers, OCR engines, or Chromium rendering
                    begin.
                  </p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <h3>Review and download</h3>
                  <p>
                    Results are made available through controlled downloads and retained according
                    to the active plan.
                  </p>
                </div>
              </li>
            </ol>
          </div>
        </section>

        <section className="info-section">
          <div className="container-custom info-security-panel">
            <div className="info-security-copy">
              <span className="section-label">Part of Gonexel</span>
              <h2>Product engineering backed by a wider digital team.</h2>
              <p>
                AppToolkitLab is part of Gonexel, a digital growth agency based in Raipur, India.
                Gonexel works across AI automation, ecommerce, web and app development, SEO, digital
                marketing, and custom software solutions for businesses in India and international
                markets.
              </p>
              <a
                href="https://www.gonexel.com/about/"
                target="_blank"
                rel="noreferrer"
                className="text-link"
              >
                Learn about Gonexel <ArrowRight />
              </a>
            </div>
            <div className="info-security-grid">
              <article>
                <Building2 />
                <h3>One connected team</h3>
                <p>
                  Product, development, automation, and growth experience contribute to the
                  AppToolkitLab direction.
                </p>
              </article>
              <article>
                <Workflow />
                <h3>Built for real workflows</h3>
                <p>
                  The platform focuses on practical document, web-capture, software, and automation
                  tasks.
                </p>
              </article>
              <article>
                <Globe2 />
                <h3>India and global reach</h3>
                <p>Gonexel states that it serves businesses in India and international markets.</p>
              </article>
              <article>
                <Layers3 />
                <h3>Modern product stack</h3>
                <p>
                  AppToolkitLab combines browser tools, cloud services, APIs, and digital products
                  in one experience.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="info-section">
          <div className="container-custom">
            <div className="info-section-heading">
              <span className="section-label">Our product principles</span>
              <h2>Built around trust, not just feature count.</h2>
            </div>
            <div className="info-principles-grid">
              {principles.map(([title, copy]) => (
                <article key={title}>
                  <CheckCircle2 />
                  <div>
                    <h3>{title}</h3>
                    <p>{copy}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="security" className="info-section info-section-muted">
          <div className="container-custom info-security-panel">
            <div className="info-security-copy">
              <span className="section-label">Security boundaries</span>
              <h2>Protection is layered across the whole workflow.</h2>
              <p>
                AppToolkitLab is designed around limited file access, short-lived sessions,
                controlled network requests, isolated conversion workers, verified payment events,
                and expiring download URLs.
              </p>
              <Link href="/data-policy" className="text-link">
                Read the data protection approach <ArrowRight />
              </Link>
            </div>
            <div className="info-security-grid">
              <article>
                <Globe2 />
                <h3>Safer web capture</h3>
                <p>
                  URL validation and network restrictions help reduce server-side request forgery
                  risk.
                </p>
              </article>
              <article>
                <LockKeyhole />
                <h3>Controlled access</h3>
                <p>
                  Authenticated resources use server-side authorization and time-limited delivery
                  links.
                </p>
              </article>
              <article>
                <Workflow />
                <h3>Isolated processing</h3>
                <p>
                  Conversion work is separated from the public web application and queued by
                  capability.
                </p>
              </article>
              <article>
                <FileSearch />
                <h3>Traceable operations</h3>
                <p>
                  Job states and important administrative actions can be recorded for support and
                  auditing.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="info-section">
          <div className="container-custom info-final-cta">
            <div>
              <span className="section-label">Keep exploring</span>
              <h2>See what AppToolkitLab can do today.</h2>
              <p>
                Browse the working tools, read practical guides, or learn how the plans are
                structured.
              </p>
            </div>
            <div className="info-hero-actions">
              <Link href="/blog" className="btn btn-secondary btn-md">
                Read the blog
              </Link>
              <Link href="/pricing" className="btn btn-primary btn-md">
                Compare plans <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
