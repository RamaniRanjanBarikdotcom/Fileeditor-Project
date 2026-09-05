import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookOpen, Bot, FileText, Globe2, ScanText, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'AppToolkitLab Blog — Document, Automation & Software Guides',
  description:
    'Practical guides to webpage capture, OCR, document conversion, automation, security, and choosing the right AppToolkitLab workflow.',
};

const posts = [
  {
    id: 'web-capture',
    category: 'Web capture',
    title: 'Why URL conversion needs a real browser engine',
    excerpt:
      'Modern pages depend on JavaScript, fonts, cookies, and print styles. Learn what Chromium solves—and what no converter can bypass.',
    read: '6 min',
    icon: Globe2,
  },
  {
    id: 'ocr-quality',
    category: 'OCR',
    title: 'Getting cleaner text from scanned PDFs',
    excerpt:
      'Resolution, rotation, language selection, and page contrast can matter more than the OCR model itself.',
    read: '5 min',
    icon: ScanText,
  },
  {
    id: 'conversion-fidelity',
    category: 'Documents',
    title: 'Editable output versus pixel-perfect output',
    excerpt:
      'PDF, DOCX, and HTML represent layout differently. Pick the output based on what you need to edit next.',
    read: '7 min',
    icon: FileText,
  },
  {
    id: 'automation-safety',
    category: 'Automation',
    title: 'A checklist before running a downloaded script',
    excerpt:
      'Review permissions, secrets, network access, and dependencies before an automation touches production data.',
    read: '5 min',
    icon: Bot,
  },
  {
    id: 'privacy-workflow',
    category: 'Security',
    title: 'A privacy-first document workflow',
    excerpt:
      'Minimize uploads, choose a retention window, remove secrets, and verify downloaded results before sharing.',
    read: '6 min',
    icon: ShieldCheck,
  },
  {
    id: 'choose-a-plan',
    category: 'Product guide',
    title: 'Free tool, subscription, or software purchase?',
    excerpt:
      'A simple decision guide for occasional conversions, repeated team workflows, and standalone utilities.',
    read: '4 min',
    icon: BookOpen,
  },
];

export default function BlogPage() {
  return (
    <div className="info-page">
      <header className="info-hero">
        <div className="container-custom info-hero-inner info-hero-centered">
          <span className="info-eyebrow">
            <BookOpen className="h-4 w-4" />
            AppToolkitLab field notes
          </span>
          <h1>Practical guidance for better files, safer workflows, and useful automation.</h1>
          <p>
            No vague trend pieces. These notes explain how the tools work, where conversions have
            limits, and how to choose the right workflow.
          </p>
        </div>
      </header>
      <main>
        <section className="info-section">
          <div className="container-custom">
            <div className="blog-grid">
              {posts.map(({ id, category, title, excerpt, read, icon: Icon }, index) => (
                <article
                  key={id}
                  className={index === 0 ? 'blog-card blog-card-featured' : 'blog-card'}
                >
                  <span className="info-icon indigo">
                    <Icon />
                  </span>
                  <div className="blog-card-meta">
                    <span>{category}</span>
                    <span>{read} read</span>
                  </div>
                  <h2>{title}</h2>
                  <p>{excerpt}</p>
                  <a href={`#${id}`}>
                    Read guide <ArrowRight />
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="info-section info-section-muted">
          <div className="container-custom blog-articles">
            <article id="web-capture">
              <div className="blog-article-number">01</div>
              <div>
                <span className="section-label">Web capture</span>
                <h2>Why URL conversion needs a real browser engine</h2>
                <p>
                  A basic HTTP downloader sees source markup, not necessarily the page a visitor
                  sees. AppToolkitLab&apos;s URL tools use Chromium so JavaScript can run, web fonts
                  can load, and browser print layout can be applied before PDF or editable content
                  extraction begins.
                </p>
                <p>
                  That still does not make every URL accessible. Login walls, CAPTCHAs, bot
                  protection, paywalls, robots policies, region restrictions, network timeouts, or a
                  site&apos;s own terms can prevent capture. Only convert content you have a right
                  to access, and never expect the service to bypass access controls.
                </p>
                <Link href="/tools/url-to-pdf" className="text-link">
                  Open URL to PDF <ArrowRight />
                </Link>
              </div>
            </article>
            <article id="ocr-quality">
              <div className="blog-article-number">02</div>
              <div>
                <span className="section-label">OCR quality</span>
                <h2>Getting cleaner text from scanned PDFs</h2>
                <p>
                  OCR works best when pages are upright, evenly lit, high contrast, and close to 300
                  DPI. Compression artifacts, handwriting, decorative fonts, mixed languages,
                  tables, and multi-column pages can reduce accuracy.
                </p>
                <p>
                  For important material, compare the extracted text with the source—especially
                  names, dates, decimal values, and account numbers. OCR output is a starting point
                  for review, not a guaranteed transcription.
                </p>
                <Link href="/tools/pdf-ocr" className="text-link">
                  Try PDF OCR <ArrowRight />
                </Link>
              </div>
            </article>
            <article id="conversion-fidelity">
              <div className="blog-article-number">03</div>
              <div>
                <span className="section-label">Format decisions</span>
                <h2>Editable output versus pixel-perfect output</h2>
                <p>
                  PDF is designed to preserve appearance; DOCX is designed for editing and reflow.
                  Converting between them requires reconstruction, so complex columns, floating
                  graphics, embedded fonts, forms, and mathematical notation may move.
                </p>
                <p>
                  Choose PDF when visual consistency matters, DOCX when editing matters, and HTML
                  when responsive web reuse matters. Always review the output before publishing or
                  sending it as a final business document.
                </p>
                <Link href="/faq#conversion" className="text-link">
                  Read conversion FAQs <ArrowRight />
                </Link>
              </div>
            </article>
            <article id="automation-safety">
              <div className="blog-article-number">04</div>
              <div>
                <span className="section-label">Automation safety</span>
                <h2>Review a script before it reaches production data</h2>
                <p>
                  Confirm the publisher, version, supported runtime, permissions, external
                  connections, dependency lockfile, secret handling, and rollback path. Run
                  unfamiliar automation against sample data in an isolated environment first.
                </p>
                <Link href="/automations" className="text-link">
                  Browse automations <ArrowRight />
                </Link>
              </div>
            </article>
            <article id="privacy-workflow">
              <div className="blog-article-number">05</div>
              <div>
                <span className="section-label">Privacy</span>
                <h2>Use the minimum data needed for the job</h2>
                <p>
                  Remove unnecessary personal information before uploading, select the shortest
                  suitable retention window, restrict account access, and delete exported copies
                  when the work is complete. Business customers should also define who is
                  responsible for uploaded data.
                </p>
                <Link href="/data-policy" className="text-link">
                  See the data protection framework <ArrowRight />
                </Link>
              </div>
            </article>
            <article id="choose-a-plan">
              <div className="blog-article-number">06</div>
              <div>
                <span className="section-label">Product guide</span>
                <h2>Choose the simplest product that solves the problem</h2>
                <p>
                  Use a free tool for occasional single jobs, a subscription for recurring volume,
                  history, API access, or teamwork, and a downloadable product when you need a
                  standalone utility. Availability and final prices should always be confirmed on
                  the product or checkout page.
                </p>
                <Link href="/pricing" className="text-link">
                  Compare plans <ArrowRight />
                </Link>
              </div>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}
