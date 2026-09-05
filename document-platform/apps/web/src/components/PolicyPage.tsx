import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, FileWarning, Scale } from 'lucide-react';

export const POLICY_LINKS = [
  { label: 'Policy center', href: '/policies' },
  { label: 'Privacy policy', href: '/privacy' },
  { label: 'Data protection & law', href: '/data-policy' },
  { label: 'Terms of service', href: '/terms' },
  { label: 'Refund policy', href: '/refund-policy' },
];

type PolicyPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  currentPath: string;
  showDraftNotice?: boolean;
};

export function PolicyPage({
  eyebrow,
  title,
  description,
  children,
  currentPath,
  showDraftNotice = true,
}: PolicyPageProps) {
  return (
    <div className="info-page">
      <header className="info-hero">
        <div className="container-custom info-hero-inner">
          <span className="info-eyebrow">
            <Scale className="h-4 w-4" />
            {eyebrow}
          </span>
          <h1>{title}</h1>
          <p>{description}</p>
          <div className="info-meta-row">
            <span>Last updated September 1, 2026</span>
            <span>Plain-language version</span>
          </div>
        </div>
      </header>

      <div className="container-custom policy-layout">
        <aside className="policy-sidebar" aria-label="Policy navigation">
          <p className="policy-sidebar-title">Legal &amp; policies</p>
          <nav>
            {POLICY_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={currentPath === link.href ? 'page' : undefined}
              >
                {link.label}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ))}
          </nav>
          <p className="policy-sidebar-help">
            Questions about your data or an order? <Link href="/contact">Contact support</Link>.
          </p>
        </aside>

        <main className="policy-content">
          {showDraftNotice && (
            <div className="policy-notice" role="note">
              <FileWarning className="h-5 w-5" />
              <div>
                <strong>Pre-launch legal review required</strong>
                <p>
                  AppToolkitLab is still being configured. The operator&apos;s legal name,
                  registered address, support channels, tax details, and governing jurisdiction must
                  be added before accepting payments.
                </p>
              </div>
            </div>
          )}
          <div className="policy-prose">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function PolicySection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
