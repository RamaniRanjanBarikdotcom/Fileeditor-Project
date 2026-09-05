import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Bug, FileQuestion, Mail, ReceiptText, ShieldAlert } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Contact AppToolkitLab Support',
  description:
    'Contact routes for AppToolkitLab conversion help, billing questions, privacy requests, and security reports.',
};

const topics = [
  {
    icon: FileQuestion,
    title: 'Conversion help',
    copy: 'Include the tool, source format, target format, browser, and job ID. Do not attach confidential content unless support provides a protected upload.',
  },
  {
    icon: ReceiptText,
    title: 'Billing & orders',
    copy: 'Include your account email and order or invoice ID. Never send a full card or bank-account number.',
  },
  {
    icon: ShieldAlert,
    title: 'Privacy request',
    copy: 'State whether you need access, correction, deletion, restriction, objection, portability, or another applicable right.',
  },
  {
    icon: Bug,
    title: 'Security report',
    copy: 'Describe the affected URL or component, impact, reproduction steps, and safe proof. Do not access or change other users’ data.',
  },
];

export default function ContactPage() {
  return (
    <div className="info-page">
      <header className="info-hero">
        <div className="container-custom info-hero-inner info-hero-centered">
          <span className="info-eyebrow">
            <Mail className="h-4 w-4" />
            Contact
          </span>
          <h1>Route your question to the right support workflow.</h1>
          <p>
            AppToolkitLab&apos;s production support email and legal contact still need to be
            configured. Until then, this page documents what each request should contain.
          </p>
        </div>
      </header>
      <main className="info-section">
        <div className="container-custom">
          <div className="policy-notice">
            <ShieldAlert />
            <div>
              <strong>Contact channel not yet activated</strong>
              <p>
                Do not accept public payments or production personal data until a monitored support
                email, privacy contact, registered operator details, and response workflow are
                configured here.
              </p>
            </div>
          </div>
          <div className="info-card-grid info-card-grid-2 contact-topic-grid">
            {topics.map(({ icon: Icon, title, copy }) => (
              <article className="info-feature-card" key={title}>
                <span className="info-icon indigo">
                  <Icon />
                </span>
                <h2>{title}</h2>
                <p>{copy}</p>
              </article>
            ))}
          </div>
          <div className="info-final-cta">
            <div>
              <h2>Looking for a quick answer?</h2>
              <p>
                The FAQ covers file limits, URL capture, OCR, accounts, payments, downloads, and
                privacy.
              </p>
            </div>
            <Link className="btn btn-primary btn-md" href="/faq">
              Browse the FAQ <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
