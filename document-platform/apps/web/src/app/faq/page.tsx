import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CircleHelp } from 'lucide-react';

export const metadata: Metadata = { title: 'AppToolkitLab FAQ — Tools, Billing, Files & Privacy', description: 'Answers about AppToolkitLab conversions, URL capture, OCR, accounts, quotas, software purchases, billing, privacy, and retention.' };

const groups = [
  { id: 'conversion', title: 'Tools & conversion', items: [
    ['Can AppToolkitLab convert every PDF perfectly?', 'No converter can guarantee perfect editable output for every PDF. Scans need OCR, and complex columns, embedded fonts, forms, charts, or damaged files may require manual correction. The source file remains the final reference.'],
    ['Can the URL tools convert any website?', 'They use Chromium to support JavaScript, web fonts, and print layout, but cannot guarantee every URL. Login walls, CAPTCHAs, paywalls, bot protection, region rules, timeouts, or a site’s policies may block capture. AppToolkitLab does not bypass access controls.'],
    ['Why does URL output look different from the browser?', 'Sites often define separate print styles, lazy-load content, personalize by session, or animate elements. Page size, viewport, cookie prompts, and font availability can also change the result.'],
    ['Does OCR guarantee accurate text?', 'No. OCR accuracy depends on resolution, orientation, language, contrast, handwriting, and page complexity. Verify important names, amounts, and dates before relying on the result.'],
    ['Which output format should I choose?', 'Choose PDF for stable visual sharing, DOCX for editing, HTML for web reuse, and plain text when structure is less important than searchable content.'],
  ]},
  { id: 'accounts', title: 'Accounts, limits & files', items: [
    ['Do I need an account for free tools?', 'Not for tools marked available to anonymous visitors. Anonymous limits may use a signed first-party cookie and a privacy-preserving network identifier. Larger jobs, history, team features, or purchases require an account.'],
    ['How are limits calculated?', 'Limits can include operations, file size, processing time, storage, API calls, or team seats. The active plan and server response are authoritative; marketing examples may change before launch.'],
    ['How long are files kept?', 'The configured target is up to 24 hours for free processing, 30 days for Pro, and 90 days for Business. A job may be deleted sooner by the user, after an error, or for security and operational reasons. Backups and legally required records may follow separate schedules.'],
    ['Can I delete my files or account?', 'Account controls should support file deletion and an account-deletion request. Some order, tax, fraud-prevention, or audit records may need to be retained where law requires.'],
  ]},
  { id: 'commerce', title: 'Software, billing & refunds', items: [
    ['Are all marketplace products available to buy?', 'No. Some catalog entries may be previews. A product is purchasable only when its page shows an active version, price, supported platform, license terms, and a working checkout action.'],
    ['Which payment provider is used?', 'The intended routing is Razorpay for supported INR transactions and Stripe for supported international transactions. Final availability depends on configured merchant accounts, country, currency, and checkout response.'],
    ['Do purchases include lifetime updates?', 'Only when the product page and license terms explicitly say so. A license may cover one version, a period of updates, a device count, a user count, or a subscription term.'],
    ['Can I get a refund?', 'Eligibility depends on the item, whether a digital asset was downloaded or activated, any checkout promise, technical failure, and applicable law. Read the refund policy and submit the order details for review.'],
  ]},
  { id: 'privacy', title: 'Privacy, security & legal', items: [
    ['Does AppToolkitLab own uploaded content?', 'No. You retain your rights. You grant only the limited permission needed to receive, process, store temporarily, and return the content as requested. You must have the right to upload it.'],
    ['Does AppToolkitLab sell personal information?', 'The current policy is not to sell personal information or share it for cross-context behavioral advertising. If practices change, the privacy notice and required controls must be updated first.'],
    ['Is AppToolkitLab compliant with every privacy law?', 'No service should make that blanket claim. Applicable duties depend on the operator, customer, location, data, and use case. The platform is being designed for data minimization, access control, retention, and rights handling, but requires legal and operational review before production.'],
  ]},
];

export default function FAQPage() {
  return <div className="info-page"><header className="info-hero"><div className="container-custom info-hero-inner info-hero-centered"><span className="info-eyebrow"><CircleHelp className="h-4 w-4" />Help center</span><h1>Answers before you upload, subscribe, or buy.</h1><p>Clear information about conversion limits, webpage capture, file retention, billing, licenses, privacy, and account controls.</p></div></header><main className="info-section"><div className="container-custom faq-layout"><aside className="faq-nav"><p>Browse topics</p>{groups.map(group => <a key={group.id} href={`#${group.id}`}>{group.title}</a>)}<Link href="/contact">Still need help? <ArrowRight /></Link></aside><div className="faq-groups">{groups.map(group => <section id={group.id} key={group.id}><span className="section-label">FAQ category</span><h2>{group.title}</h2><div className="faq-list">{group.items.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>)}<div className="info-final-cta"><div><h2>Need an answer about your own job?</h2><p>Include the tool, input format, target format, and job ID—never send passwords or payment-card details.</p></div><Link href="/contact" className="btn btn-primary btn-md">Contact support <ArrowRight className="h-4 w-4" /></Link></div></div></div></main></div>;
}
