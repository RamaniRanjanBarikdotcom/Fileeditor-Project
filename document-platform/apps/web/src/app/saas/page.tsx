import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  Edit3,
  FileOutput,
  Files,
  FolderClock,
  Gauge,
  Globe2,
  Layers,
  Library,
  LockKeyhole,
  ScanText,
  ShieldCheck,
  Sparkles,
  Users,
  WandSparkles,
  Workflow,
  Zap,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'SaaS Document Workspace — AppToolkitLab',
  description:
    'Convert, edit, organize, and manage document work from one AppToolkitLab cloud workspace.',
};

const PILLARS = [
  {
    icon: FileOutput,
    title: 'Universal converter',
    description:
      'Bring file, HTML, Markdown, image, and webpage conversion flows into one consistent workspace.',
  },
  {
    icon: Edit3,
    title: 'Document studio',
    description:
      'Create and edit rich document content, then export it into practical file formats.',
  },
  {
    icon: FolderClock,
    title: 'History and library',
    description:
      'Keep recent processing activity and eligible purchased assets connected to your account.',
  },
];

const CAPABILITIES = [
  {
    icon: Globe2,
    title: 'Chromium web capture',
    description: 'Render supported webpages before producing PDF or editable document output.',
  },
  {
    icon: ScanText,
    title: 'PDF and OCR tools',
    description: 'Handle selectable and scanned PDF content through dedicated processing paths.',
  },
  {
    icon: WandSparkles,
    title: 'Rich document editing',
    description: 'Draft, format, and export content from the browser-based studio.',
  },
  {
    icon: Clock3,
    title: 'Conversion history',
    description: 'Review job outcomes and return to recent document activity from the workspace.',
  },
  {
    icon: Library,
    title: 'Digital product library',
    description:
      'Keep product entitlements and eligible downloads associated with the same account.',
  },
  {
    icon: Gauge,
    title: 'Plan-aware usage',
    description: 'Match processing allowances and file limits to the active subscription tier.',
  },
];

const WORKFLOW_STEPS = [
  {
    icon: Files,
    title: 'Add a source',
    description: 'Upload a supported file, provide HTML or Markdown, or enter a webpage URL.',
  },
  {
    icon: Workflow,
    title: 'Choose an operation',
    description: 'Select the output and processing path that matches the source.',
  },
  {
    icon: Zap,
    title: 'Process the job',
    description: 'The API and worker pipeline execute the requested conversion.',
  },
  {
    icon: CheckCircle2,
    title: 'Review the result',
    description: 'Download the output and inspect the job in your workspace history.',
  },
];

const PLAN_PATHS = [
  {
    name: 'Free',
    audience: 'For trying the platform',
    description: 'Use core tools with a daily allowance and smaller file limits.',
    features: [
      'Core conversion tools',
      'Personal workspace access',
      'Short-term processing history',
    ],
    cta: 'Start free',
    href: '/register',
  },
  {
    name: 'Pro',
    audience: 'For regular document work',
    description: 'Move to higher monthly capacity and priority processing.',
    features: ['Higher operation limits', 'Larger supported files', 'Priority processing'],
    cta: 'View Pro plan',
    href: '/pricing',
    featured: true,
  },
  {
    name: 'Business',
    audience: 'For growing workflows',
    description: 'Choose the tier designed for team capacity and API-oriented usage.',
    features: ['Business-scale allowance', 'Priority processing', 'Team and API tier direction'],
    cta: 'Compare Business',
    href: '/pricing',
  },
];

const FAQS = [
  {
    question: 'How is the SaaS workspace different from the free tools?',
    answer:
      'Free tools focus on individual operations. The SaaS workspace connects conversion, editing, account history, library access, settings, and subscription-aware usage.',
  },
  {
    question: 'Can I capture a full webpage?',
    answer:
      'The URL tools use a Chromium-based processing path for supported public webpages. Sites that block automation, require unavailable authentication, or use anti-bot challenges may still reject capture.',
  },
  {
    question: 'Does every conversion preserve the original layout perfectly?',
    answer:
      'No converter can guarantee perfect fidelity for every source. AppToolkitLab uses format-specific engines, but complex scans, fonts, scripts, or page structures can affect the result.',
  },
  {
    question: 'Where can I see the current plan limits?',
    answer:
      'The Pricing page is the source of truth for the current Free, Pro, and Business allowances and regional prices.',
  },
];

export default function SaasPlatformPage() {
  return (
    <div className="min-h-screen">
      <section className="saas-hero relative overflow-hidden">
        <div className="saas-hero-grid" />
        <div className="container-custom relative z-10">
          <div className="saas-hero-layout">
            <div className="saas-hero-copy">
              <div className="saas-breadcrumb">
                <Link href="/">Home</Link>
                <ChevronRight className="h-3.5 w-3.5" />
                <span>SaaS workspace</span>
              </div>
              <span className="badge badge-brand saas-hero-badge">
                <Layers className="h-4 w-4" />
                Cloud document workspace
              </span>
              <h1 className="ts-h1">
                Convert, edit, and organize document work{' '}
                <span className="gradient-text">in one place</span>
              </h1>
              <p>
                Move from one-off tools to a connected AppToolkitLab workspace for document
                processing, editing, history, and account-based access.
              </p>
              <div className="saas-hero-actions">
                <Link href="/register" className="btn btn-primary btn-lg">
                  <Sparkles className="h-5 w-5" />
                  Start free
                </Link>
                <Link href="/pricing" className="btn btn-secondary btn-lg">
                  Compare plans <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="saas-trust-row">
                <span>
                  <ShieldCheck className="h-4 w-4" />
                  Isolated processing
                </span>
                <span>
                  <LockKeyhole className="h-4 w-4" />
                  Account-based access
                </span>
                <span>
                  <CheckCircle2 className="h-4 w-4" />
                  No card for Free
                </span>
              </div>
            </div>

            <div className="saas-workspace-preview" aria-label="AppToolkitLab workspace preview">
              <div className="saas-preview-topbar">
                <div>
                  <span />
                  <span />
                  <span />
                </div>
                <small>Workspace overview</small>
              </div>
              <div className="saas-preview-body">
                <aside>
                  <div className="saas-preview-logo">
                    <Zap className="h-4 w-4" />
                  </div>
                  {[Files, Edit3, Clock3, Library].map((Icon, index) => (
                    <span className={index === 0 ? 'active' : ''} key={index}>
                      <Icon className="h-4 w-4" />
                    </span>
                  ))}
                </aside>
                <div className="saas-preview-main">
                  <div className="saas-preview-heading">
                    <div>
                      <small>Good morning</small>
                      <strong>Your document workspace</strong>
                    </div>
                    <span>Free plan</span>
                  </div>
                  <div className="saas-preview-metrics">
                    <article>
                      <small>Jobs today</small>
                      <strong>3</strong>
                      <em>Daily activity</em>
                    </article>
                    <article>
                      <small>Recent files</small>
                      <strong>8</strong>
                      <em>Workspace history</em>
                    </article>
                  </div>
                  <div className="saas-preview-jobs">
                    <div>
                      <strong>Recent processing</strong>
                      <small>Status</small>
                    </div>
                    <p>
                      <span>
                        <FileOutput className="h-4 w-4" />
                        webpage-report.pdf
                      </span>
                      <em>Completed</em>
                    </p>
                    <p>
                      <span>
                        <ScanText className="h-4 w-4" />
                        scanned-notes.txt
                      </span>
                      <em>Completed</em>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="saas-pillars-section">
        <div className="container-custom">
          <div className="saas-section-heading">
            <p className="section-label">One connected platform</p>
            <h2>Everything around the document, not only the conversion</h2>
            <p>
              Start with a source, create the output, and keep the work connected to your account.
            </p>
          </div>
          <div className="saas-pillar-grid">
            {PILLARS.map(({ icon: Icon, title, description }, index) => (
              <article key={title}>
                <span>0{index + 1}</span>
                <div className="saas-card-icon">
                  <Icon className="h-5 w-5" />
                </div>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="saas-capabilities-section">
        <div className="container-custom">
          <div className="saas-capabilities-layout">
            <div className="saas-capabilities-intro">
              <p className="section-label">Workspace capabilities</p>
              <h2>Purpose-built paths for different document sources</h2>
              <p>
                AppToolkitLab combines browser utilities with account features, giving each source a
                clearer route to its result.
              </p>
              <Link href="/tools" className="btn btn-secondary btn-md">
                Explore all tools <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="saas-capability-grid">
              {CAPABILITIES.map(({ icon: Icon, title, description }) => (
                <article key={title}>
                  <div className="saas-card-icon">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="saas-workflow-section">
        <div className="container-custom">
          <div className="saas-section-heading">
            <p className="section-label">A consistent workflow</p>
            <h2>From source to result in four clear stages</h2>
            <p>
              The same workspace pattern supports files, structured text, and public webpage
              sources.
            </p>
          </div>
          <ol className="saas-workflow-grid">
            {WORKFLOW_STEPS.map(({ icon: Icon, title, description }, index) => (
              <li key={title}>
                <span>{index + 1}</span>
                <div className="saas-card-icon">
                  <Icon className="h-5 w-5" />
                </div>
                <h3>{title}</h3>
                <p>{description}</p>
                {index < WORKFLOW_STEPS.length - 1 && (
                  <ArrowRight className="saas-workflow-arrow h-4 w-4" />
                )}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="saas-plans-section">
        <div className="container-custom">
          <div className="saas-section-heading">
            <p className="section-label">Grow when you need to</p>
            <h2>A clear path from free usage to larger workloads</h2>
            <p>
              Choose the plan direction that matches your volume. Current allowances and prices
              remain on the Pricing page.
            </p>
          </div>
          <div className="saas-plan-grid">
            {PLAN_PATHS.map((plan) => (
              <article
                key={plan.name}
                className={plan.featured ? 'saas-plan-card featured' : 'saas-plan-card'}
              >
                {plan.featured && <span className="saas-plan-badge">Most popular</span>}
                <p>{plan.audience}</p>
                <h3>{plan.name}</h3>
                <div className="saas-plan-rule" />
                <p>{plan.description}</p>
                <ul>
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <CheckCircle2 className="h-4 w-4" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className={plan.featured ? 'btn btn-primary btn-md' : 'btn btn-secondary btn-md'}
                >
                  {plan.cta}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="saas-safeguards-section">
        <div className="container-custom">
          <div className="saas-safeguards-grid">
            <article>
              <ShieldCheck className="h-5 w-5" />
              <div>
                <h3>Isolated job processing</h3>
                <p>
                  Conversion work is separated from the public web interface through the worker
                  pipeline.
                </p>
              </div>
            </article>
            <article>
              <Database className="h-5 w-5" />
              <div>
                <h3>Controlled file lifecycle</h3>
                <p>
                  Customer file bytes expire within 10 minutes; non-content job metadata follows
                  the documented account and legal retention policy.
                </p>
              </div>
            </article>
            <article>
              <Users className="h-5 w-5" />
              <div>
                <h3>Plan-aware access</h3>
                <p>
                  Usage and workspace capabilities can be governed by the account subscription tier.
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="saas-faq-section">
        <div className="container-custom">
          <div className="saas-faq-layout">
            <div className="saas-faq-intro">
              <p className="section-label">SaaS questions</p>
              <h2>Understand the workspace before upgrading</h2>
              <p>
                Practical answers about tools, webpage capture, conversion fidelity, and plan
                limits.
              </p>
              <Link href="/contact">
                Ask a question <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="saas-faq-list">
              {FAQS.map(({ question, answer }) => (
                <details key={question}>
                  <summary>
                    {question}
                    <span aria-hidden="true">+</span>
                  </summary>
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
