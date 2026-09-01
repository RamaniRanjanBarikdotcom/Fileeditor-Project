import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Database, FileCheck2, Landmark, ReceiptText, ShieldCheck } from 'lucide-react';
import { PolicyPage } from '../../components/PolicyPage';

export const metadata: Metadata = { title: 'AppToolkitLab Policy Center', description: 'Find AppToolkitLab privacy, data protection, terms of service, and refund information in one policy center.' };

const policies = [
  { icon: ShieldCheck, title: 'Privacy policy', copy: 'What information is collected, why it is used, how long it is retained, and the choices available to you.', href: '/privacy' },
  { icon: Landmark, title: 'Data protection & law', copy: 'How India’s DPDP framework, the EU GDPR, and California privacy rules may apply to the platform.', href: '/data-policy' },
  { icon: FileCheck2, title: 'Terms of service', copy: 'Rules for accounts, uploads, URL capture, subscriptions, software licenses, acceptable use, and service limitations.', href: '/terms' },
  { icon: ReceiptText, title: 'Refund policy', copy: 'How subscription, digital-product, duplicate-charge, and technical-failure refund requests are reviewed.', href: '/refund-policy' },
];

export default function PoliciesPage() {
  return <PolicyPage eyebrow="Policy center" title="Clear rules for tools, data, purchases, and accounts." description="These documents explain how AppToolkitLab is intended to operate and where final business configuration is still required before production launch." currentPath="/policies"><section><h2>Choose a document</h2><p>Each policy is written in plain language and links to related rules where context matters.</p><div className="policy-card-grid">{policies.map(({ icon: Icon, title, copy, href }) => <Link key={href} href={href} className="policy-card"><Icon /><h3>{title}</h3><p>{copy}</p><span>Read policy <ArrowRight /></span></Link>)}</div></section><section><h2>What still must be configured</h2><p>These pages are a strong product and engineering baseline, but publishing legal terms requires the actual business identity and operating decisions.</p><ul><li>Operator legal name, registered address, support email, and grievance/contact channel.</li><li>Governing law, courts or arbitration process, tax registration, and invoice requirements.</li><li>Final payment-provider accounts, processor list, hosting regions, retention jobs, and subprocessor contracts.</li><li>Product-specific license terms, cancellation controls, and refund promises shown at checkout.</li></ul></section><section><h2>Policy updates</h2><p>Material changes should be dated, summarized, and communicated through the account or verified email where required. Prior versions should be retained for auditability.</p><div className="policy-inline-note"><Database /><p>The application must enforce what these policies say. Retention, deletion, consent, checkout, and access-control behavior should be verified before launch.</p></div></section></PolicyPage>;
}
