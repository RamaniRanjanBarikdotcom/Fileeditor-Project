'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, CheckCircle2, ChevronRight, CreditCard, Database,
  Files, Gauge, Globe2, KeyRound, LockKeyhole, ShieldCheck, Sparkles,
  UserPlus, Users, WalletCards, Zap,
} from 'lucide-react';

type Currency = 'USD' | 'INR';

const PLANS = [
  {
    name: 'Free Starter', audience: 'For occasional use', usd: '$0', inr: '₹0', period: 'forever',
    description: 'Explore the core workspace with a practical personal allowance.', cta: 'Start free', href: '/register',
    features: ['300 operations per month', '25 MB maximum file size', '1-day file retention', '1 workspace seat', 'Core tools included'],
  },
  {
    name: 'Pro Developer', audience: 'For regular document work', usd: '$9', inr: '₹749', period: 'per month',
    description: 'Increase file capacity and keep results available for longer.', cta: 'Choose Pro', href: '/register?plan=pro', featured: true,
    features: ['500 operations per month', '100 MB maximum file size', '30-day file retention', '1 workspace seat', 'Core tools included'],
  },
  {
    name: 'Business', audience: 'For larger workflows', usd: '$29', inr: '₹2,499', period: 'per month',
    description: 'Add business-scale quotas, API eligibility, and more seats.', cta: 'Choose Business', href: '/register?plan=business',
    features: ['5,000 operations per month', '250 MB maximum file size', '90-day file retention', 'Up to 10 seats', 'API access enabled'],
  },
];

const COMPARISON = [
  { label: 'Monthly operations', free: '300', pro: '500', business: '5,000' },
  { label: 'Maximum file size', free: '25 MB', pro: '100 MB', business: '250 MB' },
  { label: 'File retention', free: '1 day', pro: '30 days', business: '90 days' },
  { label: 'Workspace seats', free: '1', pro: '1', business: 'Up to 10' },
  { label: 'API access', free: false, pro: false, business: true },
  { label: 'Core conversion tools', free: true, pro: true, business: true },
  { label: 'Document workspace', free: true, pro: true, business: true },
];

const BILLING_STEPS = [
  { icon: Globe2, title: 'Select currency', description: 'View the published USD or INR price for the plan.' },
  { icon: UserPlus, title: 'Create an account', description: 'Your workspace and selected plan begin from one identity.' },
  { icon: CreditCard, title: 'Complete eligible checkout', description: 'Paid checkout requires the matching payment provider to be configured.' },
  { icon: ShieldCheck, title: 'Verify and sync', description: 'A verified payment event can update the subscription and plan access.' },
];

const PLAN_FIT = [
  { icon: Files, title: 'Trying document workflows?', plan: 'Start with Free', description: 'Use the personal allowance before deciding whether you need more capacity.' },
  { icon: Gauge, title: 'Processing files every week?', plan: 'Consider Pro', description: 'The larger file limit and longer retention suit recurring individual work.' },
  { icon: Users, title: 'Building a team or integration?', plan: 'Review Business', description: 'Business is the seeded tier with API eligibility and additional seats.' },
];

const FAQS = [
  { question: 'Does changing the currency selector charge me?', answer: 'No. It only changes the displayed regional price. A payment can happen only through a separate eligible checkout flow.' },
  { question: 'Are Stripe and Razorpay always available?', answer: 'No. The backend supports USD routing through Stripe and INR routing through Razorpay, but checkout works only when the corresponding credentials and webhook configuration are present.' },
  { question: 'Where do these limits come from?', answer: 'The operation, file-size, retention, API, and seat values match the Free, Pro, and Business plans seeded in the application database.' },
  { question: 'What happens if I exceed my plan allowance?', answer: 'Plan-aware quota enforcement can reject or delay additional work until capacity becomes available or the account moves to an eligible tier.' },
  { question: 'What is the refund policy?', answer: 'Refund eligibility follows the published Refund Policy and the payment state of the specific purchase. This page does not promise an automatic refund window.' },
];

export default function PricingPage() {
  const [currency, setCurrency] = useState<Currency>('USD');

  return (
    <div className="min-h-screen">
      <section className="pricing-page-hero relative overflow-hidden">
        <div className="pricing-page-grid" />
        <div className="container-custom relative z-10">
          <div className="pricing-page-hero-content">
            <div className="pricing-page-breadcrumb"><Link href="/">Home</Link><ChevronRight className="h-3.5 w-3.5" /><span>Pricing</span></div>
            <span className="badge badge-brand pricing-page-badge"><WalletCards className="h-4 w-4" />Simple workspace plans</span>
            <h1 className="ts-h1">Choose the capacity that <span className="gradient-text">fits your workflow</span></h1>
            <p>Start with the Free workspace, then move to higher limits when your document volume, file size, or retention needs grow.</p>
            <div className="pricing-currency-control" role="group" aria-label="Choose display currency">
              {(['USD', 'INR'] as Currency[]).map((item) => <button key={item} type="button" aria-pressed={currency === item} onClick={() => setCurrency(item)} className={`pricing-currency-button${currency === item ? ' active' : ''}`}>{item === 'USD' ? 'USD ($)' : 'INR (₹)'}</button>)}
            </div>
            <div className="pricing-page-trust"><span><CheckCircle2 className="h-4 w-4" />Free plan needs no card</span><span><ShieldCheck className="h-4 w-4" />Plan-aware quotas</span><span><Globe2 className="h-4 w-4" />Regional price display</span></div>
          </div>
        </div>
      </section>

      <section className="pricing-plans-section">
        <div className="container-custom">
          <div className="pricing-page-section-heading"><p className="section-label">Plans and limits</p><h2>Three tiers, one consistent workspace</h2><p>The plan cards below use the limits currently defined by the application database seed.</p></div>
          <div className="pricing-page-plan-grid">
            {PLANS.map((plan) => (
              <article key={plan.name} className={plan.featured ? 'pricing-page-card featured' : 'pricing-page-card'}>
                {plan.featured && <span className="pricing-page-popular"><Sparkles className="h-3 w-3" />Most popular</span>}
                <p className="pricing-page-audience">{plan.audience}</p><h3>{plan.name}</h3>
                <div className="pricing-page-price"><strong>{currency === 'USD' ? plan.usd : plan.inr}</strong><span>/ {plan.period}</span></div>
                <p className="pricing-page-description">{plan.description}</p>
                <ul>{plan.features.map((feature) => <li key={feature}><CheckCircle2 className="h-4 w-4" />{feature}</li>)}</ul>
                <Link href={plan.href} className={plan.featured ? 'btn btn-primary btn-md' : 'btn btn-secondary btn-md'}>{plan.cta}<ArrowRight className="h-4 w-4" /></Link>
              </article>
            ))}
          </div>
          <p className="pricing-gateway-note"><LockKeyhole className="h-4 w-4" />Paid checkout becomes available only when the selected currency provider and subscription flow are configured.</p>
        </div>
      </section>

      <section className="pricing-comparison-section">
        <div className="container-custom">
          <div className="pricing-page-section-heading"><p className="section-label">Compare capabilities</p><h2>See every seeded plan difference</h2><p>A focused comparison of the quota and access values the application currently stores.</p></div>
          <div className="pricing-table-shell">
            <table>
              <thead><tr><th>Capability</th><th>Free</th><th className="pro">Pro</th><th>Business</th></tr></thead>
              <tbody>{COMPARISON.map((row) => <tr key={row.label}><th>{row.label}</th>{(['free', 'pro', 'business'] as const).map((column) => { const value = row[column]; return <td key={column} className={column === 'pro' ? 'pro' : ''}>{typeof value === 'boolean' ? value ? <CheckCircle2 className="h-4 w-4" /> : <span>—</span> : value}</td>; })}</tr>)}</tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="pricing-billing-section">
        <div className="container-custom">
          <div className="pricing-billing-layout">
            <div className="pricing-billing-intro"><p className="section-label">How paid billing works</p><h2>From selected plan to verified access</h2><p>The platform separates price display, account creation, provider checkout, and subscription activation.</p><Link href="/register" className="btn btn-secondary btn-md">Create free account <ArrowRight className="h-4 w-4" /></Link></div>
            <ol className="pricing-billing-steps">{BILLING_STEPS.map(({ icon: Icon, title, description }, index) => <li key={title}><span>{index + 1}</span><div className="pricing-page-icon"><Icon className="h-5 w-5" /></div><div><h3>{title}</h3><p>{description}</p></div></li>)}</ol>
          </div>
        </div>
      </section>

      <section className="pricing-fit-section">
        <div className="container-custom">
          <div className="pricing-page-section-heading"><p className="section-label">Find your starting point</p><h2>Match the plan to the way you work</h2><p>Choose based on real volume and access needs rather than features you may not use.</p></div>
          <div className="pricing-fit-grid">{PLAN_FIT.map(({ icon: Icon, title, plan, description }) => <article key={plan}><div className="pricing-page-icon"><Icon className="h-5 w-5" /></div><p>{title}</p><h3>{plan}</h3><span>{description}</span></article>)}</div>
        </div>
      </section>

      <section className="pricing-safeguards-section">
        <div className="container-custom"><div className="pricing-safeguards-grid"><article><Database className="h-5 w-5" /><div><h3>Database-defined limits</h3><p>Quota, size, retention, API, and seat values are stored per plan.</p></div></article><article><KeyRound className="h-5 w-5" /><div><h3>Verified provider events</h3><p>Payment webhooks are signature checked before application processing.</p></div></article><article><Zap className="h-5 w-5" /><div><h3>Usage-aware jobs</h3><p>Conversion work can reserve and settle quota against the active plan.</p></div></article></div></div>
      </section>

      <section className="pricing-faq-section">
        <div className="container-custom"><div className="pricing-faq-layout"><div className="pricing-faq-intro"><p className="section-label">Pricing questions</p><h2>Understand billing before upgrading</h2><p>Clear answers about currency, gateways, quotas, and refunds.</p><Link href="/refund-policy">Read refund policy <ArrowRight className="h-4 w-4" /></Link></div><div className="pricing-faq-list">{FAQS.map(({ question, answer }) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></div></div>
      </section>
    </div>
  );
}
