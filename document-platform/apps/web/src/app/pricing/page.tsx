'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  X,
  CreditCard,
  ArrowRight,
  Zap,
  Sparkles,
  Shield,
  Headphones,
} from 'lucide-react';

const FEATURES_COMPARISON = [
  { label: 'Monthly Operations', free: '~300 / mo', pro: '500 / month', business: '5,000 / month', proHighlight: true },
  { label: 'Max File Size', free: '25 MB', pro: '100 MB', business: '250 MB', proHighlight: true },
  { label: 'Cloud File Retention', free: '24 Hours', pro: '30 Days', business: '90 Days', proHighlight: true },
  { label: 'Worker Queue Priority', free: 'Standard', pro: '10x High-Speed', business: 'Dedicated', proHighlight: true },
  { label: 'Batch Multi-File Uploads', free: false, pro: true, business: true },
  { label: 'Document Studio Exporter', free: false, pro: true, business: true },
  { label: 'Full REST API Keys', free: false, pro: false, business: true },
  { label: 'Team Workspace Seats', free: '1', pro: '1', business: '10 Seats' },
  { label: 'Audit Logs', free: false, pro: false, business: true },
  { label: 'Priority Support SLA', free: false, pro: 'Email', business: '24/7 SLA' },
];

export default function PricingPage() {
  const [currency, setCurrency] = useState<'USD' | 'INR'>('USD');

  const plans = [
    {
      name: 'Free Starter',
      tagline: 'Perfect for quick one-off conversions',
      price: '$0',
      priceINR: '₹0',
      period: 'forever free',
      popular: false,
      accentColor: '#6366f1',
      cta: 'Start Free Today',
      ctaHref: '/register',
      ctaStyle: 'secondary' as const,
      features: [
        '10 operations per day',
        '25 MB maximum file size',
        '24-hour cloud file retention',
        'Standard conversion speed',
        'Personal workspace',
        'Community support',
      ],
    },
    {
      name: 'Pro Developer',
      tagline: 'For freelancers and power creators',
      price: '$9',
      priceINR: '₹749',
      period: 'per month',
      popular: true,
      accentColor: '#6366f1',
      cta: 'Upgrade to Pro',
      ctaHref: '/register?plan=pro',
      ctaStyle: 'primary' as const,
      features: [
        '500 operations per month',
        '100 MB maximum file size',
        '30-day cloud file retention',
        '10x Priority worker queues',
        'Batch multi-file processing',
        'Document Studio exporter',
        'Email customer support',
      ],
    },
    {
      name: 'Business Enterprise',
      tagline: 'For engineering teams & agencies',
      price: '$29',
      priceINR: '₹2,499',
      period: 'per month',
      popular: false,
      accentColor: '#8b5cf6',
      cta: 'Start Business Trial',
      ctaHref: '/register?plan=business',
      ctaStyle: 'secondary' as const,
      features: [
        '5,000 operations per month',
        '250 MB maximum file size',
        '90-day cloud file retention',
        'Dedicated queue priority',
        'Full REST API + SDKs',
        '10 Team workspace seats',
        'Audit logs & org tracking',
        'Priority 24/7 SLA support',
      ],
    },
  ];

  return (
    <div style={{ minHeight: '100vh' }}>

      {/* ─── Hero ─── */}
      <section
        className="relative py-20 overflow-hidden"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div
          className="absolute inset-0 -z-10"
          style={{
            background: 'radial-gradient(ellipse 70% 60% at 50% 0%, rgba(99,102,241,0.12) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute inset-0 dot-grid opacity-25 dark:opacity-10 -z-10"
          style={{ maskImage: 'radial-gradient(ellipse 70% 100% at 50% 0%, black 40%, transparent 100%)' }}
        />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 mb-5">
            <span className="badge badge-brand">
              <CreditCard className="w-3.5 h-3.5" />
              Simple & Transparent SaaS Billing
            </span>
          </div>
          <h1 className="ts-h1 mb-4" style={{ color: 'var(--text-primary)' }}>
            Choose Your{' '}
            <span className="gradient-text">Perfect Plan</span>
          </h1>
          <p
            style={{
              fontSize: '1.0625rem',
              color: 'var(--text-secondary)',
              maxWidth: '520px',
              margin: '0 auto 2rem',
              lineHeight: '1.7',
            }}
          >
            Scale from free browser conversions to high-throughput cloud API integrations.
            Payments processed via Stripe (USD) and Razorpay (INR).
          </p>

          {/* Currency Switcher */}
          <div
            className="inline-flex items-center p-1 rounded-2xl"
            style={{
              backgroundColor: 'var(--bg-muted)',
              border: '1px solid var(--border)',
              gap: '4px',
            }}
          >
            {['USD', 'INR'].map((cur) => (
              <button
                key={cur}
                id={`currency-${cur.toLowerCase()}`}
                onClick={() => setCurrency(cur as 'USD' | 'INR')}
                className="px-5 py-2 rounded-xl font-semibold text-sm transition-all"
                style={{
                  backgroundColor: currency === cur ? 'var(--bg-card)' : 'transparent',
                  color: currency === cur ? 'var(--brand-500)' : 'var(--text-muted)',
                  boxShadow: currency === cur ? 'var(--shadow-sm)' : 'none',
                }}
              >
                {cur === 'USD' ? '🇺🇸 USD – Stripe' : '🇮🇳 INR – Razorpay'}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing Cards ─── */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '1.25rem',
              alignItems: 'start',
            }}
          >
            {plans.map((plan, idx) => {
              const price = currency === 'USD' ? plan.price : plan.priceINR;
              return (
                <div
                  key={plan.name}
                  id={`pricing-card-${plan.name.toLowerCase().replace(/\s+/g, '-')}`}
                  className={plan.popular ? 'pricing-card-popular rounded-3xl flex flex-col relative' : 'card flex flex-col relative'}
                  style={{
                    padding: '2rem',
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: '1.5rem',
                    transform: plan.popular ? 'translateY(-8px)' : 'none',
                    boxShadow: plan.popular ? 'var(--shadow-brand-lg)' : 'var(--shadow-sm)',
                  }}
                >
                  {plan.popular && (
                    <div
                      className="absolute -top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5"
                      style={{
                        background: 'var(--gradient-brand)',
                        color: 'white',
                        fontSize: '0.6875rem',
                        fontWeight: 800,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        padding: '0.35rem 1.1rem',
                        borderRadius: '9999px',
                        boxShadow: 'var(--shadow-brand)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Sparkles className="w-3 h-3" />
                      Most Popular
                    </div>
                  )}

                  <div className="space-y-1 mb-6">
                    <h3 className="font-bold text-xl" style={{ color: 'var(--text-primary)' }}>
                      {plan.name}
                    </h3>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                      {plan.tagline}
                    </p>
                  </div>

                  <div className="flex items-baseline gap-1 mb-6">
                    <span
                      style={{
                        fontSize: '3rem',
                        fontWeight: 800,
                        letterSpacing: '-0.03em',
                        lineHeight: 1,
                        color: plan.popular ? 'transparent' : 'var(--text-primary)',
                        backgroundImage: plan.popular ? 'var(--gradient-brand)' : 'none',
                        WebkitBackgroundClip: plan.popular ? 'text' : 'unset',
                        backgroundClip: plan.popular ? 'text' : 'unset',
                      }}
                    >
                      {price}
                    </span>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                      / {plan.period}
                    </span>
                  </div>

                  <ul className="space-y-3 mb-8 flex-1" style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                    {plan.features.map((f) => (
                      <li key={f} className="feature-item">
                        <CheckCircle2
                          className="w-4 h-4 shrink-0"
                          style={{ color: plan.popular ? 'var(--brand-500)' : 'var(--success)', flexShrink: 0 }}
                        />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={plan.ctaHref}
                    className={plan.ctaStyle === 'primary' ? 'btn btn-primary btn-md' : 'btn btn-secondary btn-md'}
                    style={{ justifyContent: 'center', marginTop: 'auto' }}
                  >
                    {plan.cta}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Trust badges ─── */}
      <section className="py-10" style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-card)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-10">
            {[
              { icon: Zap, label: 'Instant activation on payment', color: '#f59e0b' },
              { icon: Shield, label: '256-bit SSL encryption', color: '#10b981' },
              { icon: CreditCard, label: 'Secure Stripe & Razorpay checkout', color: '#6366f1' },
              { icon: Headphones, label: 'Human support, not bots', color: '#8b5cf6' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="flex items-center gap-2.5"
                  style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 500 }}
                >
                  <Icon className="w-4 h-4 shrink-0" style={{ color: item.color }} />
                  {item.label}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Comparison Table ─── */}
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="ts-h2 mb-3" style={{ color: 'var(--text-primary)' }}>
              Detailed Feature Comparison
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
              Everything you need to choose the right plan for your workflow.
            </p>
          </div>

          <div
            className="card overflow-hidden"
            style={{ borderRadius: 'var(--radius-2xl)' }}
          >
            <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-muted)', borderBottom: '1px solid var(--border)' }}>
                  <th className="text-left px-6 py-4 font-bold" style={{ color: 'var(--text-primary)', width: '34%' }}>
                    Capability
                  </th>
                  <th className="text-center px-4 py-4 font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    Free Starter
                  </th>
                  <th className="text-center px-4 py-4 font-bold" style={{ color: 'var(--brand-500)' }}>
                    Pro Developer
                  </th>
                  <th className="text-center px-4 py-4 font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    Business
                  </th>
                </tr>
              </thead>
              <tbody>
                {FEATURES_COMPARISON.map((row, i) => (
                  <tr
                    key={row.label}
                    style={{
                      borderBottom: i < FEATURES_COMPARISON.length - 1 ? '1px solid var(--border)' : 'none',
                      backgroundColor: i % 2 === 1 ? 'var(--bg-subtle)' : 'transparent',
                    }}
                  >
                    <td
                      className="px-6 py-4 font-medium"
                      style={{ color: 'var(--text-primary)', fontSize: '0.875rem' }}
                    >
                      {row.label}
                    </td>
                    {(['free', 'pro', 'business'] as const).map((col) => {
                      const val = row[col];
                      const isPro = col === 'pro';
                      return (
                        <td
                          key={col}
                          className="px-4 py-4 text-center"
                          style={{
                            fontWeight: isPro && row.proHighlight ? 600 : 400,
                            color: isPro && row.proHighlight
                              ? 'var(--brand-500)'
                              : typeof val === 'string' && val.includes('Seats') || val === true
                              ? 'var(--success)'
                              : 'var(--text-muted)',
                          }}
                        >
                          {val === true ? (
                            <CheckCircle2 className="w-4 h-4 mx-auto" style={{ color: 'var(--success)' }} />
                          ) : val === false ? (
                            <span style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>—</span>
                          ) : (
                            <span>{val}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─── FAQ callout ─── */}
      <section
        className="py-14 text-center"
        style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--bg-card)' }}
      >
        <div className="max-w-lg mx-auto px-4">
          <p className="font-bold text-lg mb-2" style={{ color: 'var(--text-primary)' }}>
            Questions about billing?
          </p>
          <p className="mb-6" style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
            We offer a 7-day refund guarantee on all paid plans. Cancel anytime with no hidden fees.
          </p>
          <Link href="/register" className="btn btn-primary btn-lg" style={{ display: 'inline-flex' }}>
            <Sparkles className="w-5 h-5" />
            Get Started Free
          </Link>
        </div>
      </section>
    </div>
  );
}
