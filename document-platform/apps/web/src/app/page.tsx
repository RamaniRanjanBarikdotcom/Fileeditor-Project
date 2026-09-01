'use client';

import React from 'react';
import Link from 'next/link';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  CheckCircle2,
  FileText,
  Globe,
  Code2,
  Image,
  Edit3,
  FileOutput,
  ScanText,
  Layers,
  Terminal,
  ShoppingBag,
  Star,
  Users,
  TrendingUp,
  Lock,
} from 'lucide-react';
import { TOOL_PRESENTATION_MAP } from '../lib/tools-registry';

const STATS = [
  {
    value: '8',
    label: 'Launch Tools',
    sublabel: 'Registry-backed workflows',
    icon: FileText,
    accentColor: '#6366f1',
  },
  {
    value: '3/day',
    label: 'Anonymous Uses',
    sublabel: 'No account required',
    icon: Users,
    accentColor: '#a855f7',
  },
  {
    value: '10 MB',
    label: 'Public File Limit',
    sublabel: 'Server-enforced upload size',
    icon: TrendingUp,
    accentColor: '#10b981',
  },
  {
    value: '24 h',
    label: 'Free Retention',
    sublabel: 'Configured cleanup window',
    icon: Lock,
    accentColor: '#f59e0b',
  },
];

export default function HomePage() {
  const tools = Object.values(TOOL_PRESENTATION_MAP);

  const featuredSoftware = [
    {
      slug: 'toolsuite-desktop-cli',
      name: 'ToolSuite CLI Pro Engine',
      category: 'Desktop CLI',
      priceUSD: '$29',
      priceINR: '₹2,499',
      badge: 'Catalog Preview',
      badgeColor: '#10b981',
      desc: 'Planned command-line conversion product. Checkout remains disabled until a verified release asset is published.',
      icon: Terminal,
      accentColor: '#6366f1',
    },
    {
      slug: 'nextjs-saas-starter-kit',
      name: 'Next.js SaaS Enterprise Starter',
      category: 'Boilerplate',
      priceUSD: '$49',
      priceINR: '₹3,999',
      badge: 'Catalog Preview',
      badgeColor: '#8b5cf6',
      desc: 'Planned full-stack starter product. Checkout remains disabled until a verified release asset is published.',
      icon: Code2,
      accentColor: '#8b5cf6',
    },
  ];

  return (
    <div className="w-full" style={{ overflowX: 'hidden' }}>

      {/* ─── HERO ─── */}
      <section
        className="relative py-20 overflow-hidden w-full"
      >
        {/* Animated mesh background */}
        <div className="absolute inset-0 -z-10">
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99,102,241,0.25) 0%, transparent 70%)',
            }}
          />
          <div
            className="orb absolute"
            style={{
              width: '600px',
              height: '600px',
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(99,102,241,0.18) 0%, rgba(139,92,246,0.1) 40%, transparent 70%)',
              top: '-100px',
              left: '-100px',
              filter: 'blur(40px)',
            }}
          />
          <div
            className="orb-r absolute"
            style={{
              width: '500px',
              height: '500px',
              borderRadius: '50%',
              background:
                'radial-gradient(circle, rgba(236,72,153,0.12) 0%, rgba(139,92,246,0.08) 40%, transparent 70%)',
              bottom: '-80px',
              right: '-80px',
              filter: 'blur(50px)',
            }}
          />
          {/* Grid overlay */}
          <div
            className="absolute inset-0 dot-grid opacity-40 dark:opacity-20"
            style={{ maskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%, black 40%, transparent 100%)' }}
          />
        </div>

        <div className="container-custom">
          <div className="text-center" style={{ maxWidth: '900px', margin: '0 auto' }}>

            {/* Badge */}
            <div className="inline-flex items-center gap-2 mb-8 anim-fade-up" id="hero-badge">
              <span
                className="badge badge-brand"
                style={{ fontSize: '0.75rem', padding: '0.4rem 1rem' }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                ToolSuite 2.0 — 8 Free Tools + Software Store
              </span>
            </div>

            {/* Headline */}
            <h1
              className="ts-display anim-fade-up anim-delay-1 mb-6"
              style={{ color: 'var(--text-primary)' }}
            >
              Every Document Tool,{' '}
              <span
                className="block gradient-text"
                style={{ lineHeight: '1.1' }}
              >
                SaaS Studio & Marketplace
              </span>
              <span className="block">In One Platform.</span>
            </h1>

            {/* Subheadline */}
            <p
              className="anim-fade-up anim-delay-2 mb-10"
              style={{
                fontSize: '1.125rem',
                color: 'var(--text-secondary)',
                maxWidth: '640px',
                margin: '0 auto 2.5rem',
                lineHeight: '1.7',
              }}
            >
              Convert PDFs, extract text with OCR, capture webpages, and purchase
              software catalog items from one consistent workspace.
            </p>

            {/* CTAs */}
            <div
              className="flex flex-wrap items-center justify-center gap-3 mb-12 anim-fade-up anim-delay-3"
            >
              <Link href="/tools" id="hero-explore-tools" className="btn btn-primary btn-lg">
                <Zap className="w-5 h-5" />
                <span>Explore 8 Free Tools</span>
              </Link>
              <Link href="/software" id="hero-software-store" className="btn btn-secondary btn-lg">
                <ShoppingBag className="w-5 h-5" style={{ color: 'var(--brand-500)' }} />
                <span>Browse Software Store</span>
              </Link>
            </div>

            {/* Trust bar */}
            <div
              className="flex flex-wrap items-center justify-center gap-6 anim-fade-up anim-delay-4"
              style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', fontWeight: 500 }}
            >
              <span className="flex items-center gap-1.5">
                <Zap className="w-4 h-4" style={{ color: '#f59e0b' }} />
                Instant Browser Processing
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" style={{ color: '#10b981' }} />
                Isolated Worker Processing
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" style={{ color: '#6366f1' }} />
                No Credit Card Required
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── STATS SHOWCASE SECTION ─── */}
      <section
        className="relative z-20 overflow-hidden"
        style={{ marginTop: '3rem', marginBottom: '5rem' }}
      >
        <div className="container-custom">
          <div
            className="rounded-3xl p-8 sm:p-10 md:p-14 relative overflow-hidden"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              boxShadow: '0 24px 64px -12px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            }}
          >
            {/* Ambient inner background gradient */}
            <div
              className="absolute inset-0 pointer-events-none -z-0"
              style={{
                background: 'radial-gradient(ellipse 80% 80% at 50% 50%, rgba(99,102,241,0.08) 0%, transparent 80%)',
              }}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
              {STATS.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className="group flex flex-col items-center text-center p-6 sm:p-8 rounded-2xl transition-all cursor-default"
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = `${stat.accentColor}60`;
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = `0 16px 36px -8px ${stat.accentColor}30`;
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                    }}
                  >
                    {/* Icon container */}
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                      style={{
                        backgroundColor: `${stat.accentColor}18`,
                        border: `1px solid ${stat.accentColor}35`,
                        color: stat.accentColor,
                        boxShadow: `0 8px 20px -4px ${stat.accentColor}25`,
                      }}
                    >
                      <Icon className="w-7 h-7" />
                    </div>

                    {/* Stat Value */}
                    <div
                      className="text-4xl sm:text-5xl font-black tracking-tight mb-2"
                      style={{
                        color: 'var(--text-primary)',
                        lineHeight: 1.05,
                      }}
                    >
                      {stat.value}
                    </div>

                    {/* Stat Label */}
                    <div
                      className="text-base font-bold mb-1"
                      style={{
                        color: 'var(--text-primary)',
                      }}
                    >
                      {stat.label}
                    </div>

                    {/* Sublabel */}
                    <div
                      style={{
                        fontSize: '0.8125rem',
                        color: 'var(--text-muted)',
                        fontWeight: 500,
                      }}
                    >
                      {stat.sublabel}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ─── FEATURED FREE TOOLS ─── */}
      <section className="relative overflow-hidden" style={{ paddingTop: '5rem', paddingBottom: '4rem' }}>
        {/* Ambient background glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] rounded-full pointer-events-none -z-10"
          style={{
            background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(99,102,241,0.1) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />

        <div className="container-custom">
          {/* Centered Structured Header */}
          <div className="text-center max-w-3xl mx-auto mb-14 space-y-3">
            <div
              className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
              style={{
                backgroundColor: 'rgba(99,102,241,0.15)',
                color: 'var(--brand-400)',
                border: '1px solid rgba(99,102,241,0.25)',
              }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Instant Browser Utilities</span>
            </div>
            <h2 className="ts-h2" style={{ color: 'var(--text-primary)' }}>
              Featured Free Tools
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: '1.6' }}>
              High-speed, private document utilities that process directly in your browser with zero registration required.
            </p>
          </div>

          {/* Symmetrical 4-Column Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {tools.map((tool, idx) => {
              const Icon = tool.icon;
              return (
                <Link
                  key={tool.slug}
                  href={`/tools/${tool.slug}`}
                  id={`tool-card-${tool.slug}`}
                  className="group flex flex-col justify-between"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '1.25rem',
                    padding: '1.5rem',
                    textDecoration: 'none',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = `${tool.accentColor}80`;
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.boxShadow = `0 12px 30px -6px ${tool.accentColor}30`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                  }}
                >
                  <div>
                    {/* Top Row: Icon + Badge */}
                    <div className="flex items-center justify-between mb-5">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                        style={{
                          backgroundColor: `${tool.accentColor}18`,
                          border: `1px solid ${tool.accentColor}35`,
                          color: tool.accentColor,
                          boxShadow: `0 4px 12px ${tool.accentColor}20`,
                        }}
                      >
                        <Icon className="w-6 h-6" />
                      </div>
                      {tool.badge && (
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
                          style={{
                            backgroundColor: `${tool.accentColor}15`,
                            color: tool.accentColor,
                            border: `1px solid ${tool.accentColor}30`,
                          }}
                        >
                          {tool.badge}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3
                      className="font-bold text-base mb-2 transition-colors"
                      style={{
                        color: 'var(--text-primary)',
                        lineHeight: 1.3,
                      }}
                    >
                      {tool.name}
                    </h3>

                    {/* Description */}
                    <p
                      style={{
                        fontSize: '0.875rem',
                        color: 'var(--text-secondary)',
                        lineHeight: '1.6',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {tool.features[0]}
                    </p>
                  </div>

                  {/* Bottom Footer */}
                  <div
                    className="flex items-center justify-between mt-5 pt-4"
                    style={{ borderTop: '1px solid var(--border)' }}
                  >
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        fontWeight: 600,
                      }}
                    >
                      ⚡ 3 Free / Day
                    </span>
                    <span
                      className="flex items-center gap-1.5 text-xs font-bold transition-transform group-hover:translate-x-0.5"
                      style={{
                        color: tool.accentColor,
                      }}
                    >
                      <span>Use Tool</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Centered Bottom CTA */}
          <div className="text-center mt-12">
            <Link
              href="/tools"
              className="btn btn-secondary btn-md inline-flex items-center gap-2"
            >
              <span>Explore All 8 Tools in Directory</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── SOFTWARE STORE ─── */}
      <section
        style={{
          backgroundColor: 'var(--bg-card)',
          borderTop: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
          padding: '6rem 0',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle gradient overlay */}
        <div
          className="absolute inset-0 -z-0"
          style={{
            background: 'radial-gradient(ellipse 60% 80% at 100% 50%, rgba(99,102,241,0.06) 0%, transparent 70%)',
          }}
        />

        <div className="container-custom relative z-10">
          <div className="text-center mb-14">
            <p className="section-label mb-3">Digital Assets & Software Store</p>
            <h2 className="ts-h2 mb-4" style={{ color: 'var(--text-primary)' }}>
              Buy Production-Ready Software & Developer Kits
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem', maxWidth: '520px', margin: '0 auto' }}>
              Preview software and developer kits. Purchases only open after a verified
              release asset and payment gateway have been configured.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
              gap: '1.5rem',
              maxWidth: '880px',
              margin: '0 auto',
            }}
          >
            {featuredSoftware.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.slug}
                  className="card card-hover group relative overflow-hidden flex flex-col justify-between"
                  style={{ padding: '2rem' }}
                >
                  {/* Gradient accent top-left */}
                  <div
                    className="absolute top-0 left-0 w-32 h-32 -z-0 opacity-20"
                    style={{
                      background: `radial-gradient(circle at 0 0, ${item.accentColor}, transparent 70%)`,
                    }}
                  />

                  <div className="relative z-10 space-y-4">
                    <div className="flex items-center justify-between">
                      <div
                        className="tool-icon-ring"
                        style={{
                          width: '2.75rem',
                          height: '2.75rem',
                          backgroundColor: `${item.accentColor}15`,
                          border: `1px solid ${item.accentColor}25`,
                        }}
                      >
                        <Icon className="w-5 h-5" style={{ color: item.accentColor }} />
                      </div>
                      <span
                        className="badge"
                        style={{
                          backgroundColor: `${item.badgeColor}15`,
                          color: item.badgeColor,
                          border: `1px solid ${item.badgeColor}25`,
                        }}
                      >
                        {item.badge}
                      </span>
                    </div>

                    <div>
                      <p
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                          color: 'var(--brand-500)',
                          marginBottom: '0.375rem',
                        }}
                      >
                        {item.category}
                      </p>
                      <h3
                        className="ts-h3"
                        style={{
                          color: 'var(--text-primary)',
                          fontSize: '1.125rem',
                          transition: 'color 0.15s',
                        }}
                      >
                        {item.name}
                      </h3>
                      <p
                        style={{
                          fontSize: '0.875rem',
                          color: 'var(--text-muted)',
                          lineHeight: '1.6',
                          marginTop: '0.5rem',
                        }}
                      >
                        {item.desc}
                      </p>
                    </div>
                  </div>

                  <div
                    className="flex items-center justify-between relative z-10 mt-6 pt-5"
                    style={{ borderTop: '1px solid var(--border)' }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: '1.75rem',
                          fontWeight: 800,
                          color: 'var(--text-primary)',
                          letterSpacing: '-0.03em',
                        }}
                      >
                        {item.priceUSD}
                      </span>
                      <span
                        style={{
                          fontSize: '0.8125rem',
                          color: 'var(--text-muted)',
                          marginLeft: '0.375rem',
                        }}
                      >
                        / {item.priceINR} one-time
                      </span>
                    </div>
                    <Link
                      href={`/software/${item.slug}`}
                      className="btn btn-primary btn-sm"
                    >
                      View Product
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-center mt-10">
            <Link href="/software" className="btn btn-secondary btn-md">
              <ShoppingBag className="w-4 h-4" />
              Browse All Products
            </Link>
          </div>
        </div>
      </section>

      {/* ─── PRICING PREVIEW ─── */}
      <section className="py-24">
        <div className="container-custom">
          <div className="text-center mb-14">
            <p className="section-label mb-3">Transparent Pricing</p>
            <h2 className="ts-h2 mb-4" style={{ color: 'var(--text-primary)' }}>
              Simple, High-Value SaaS Plans
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
              Start completely free or scale with Pro & Business tiers for priority batch queues and API access.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '1.25rem',
              maxWidth: '960px',
              margin: '0 auto',
              alignItems: 'start',
            }}
          >
            {/* Free */}
            <div className="card p-8 flex flex-col">
              <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Free Starter</h3>
              <div className="flex items-baseline gap-1 my-4">
                <span style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>$0</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>/ forever</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {['10 operations per day', '25 MB file size', '24-hour cloud retention'].map((f) => (
                  <li key={f} className="feature-item">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--success)', flexShrink: 0 }} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/register" className="btn btn-secondary btn-md" style={{ justifyContent: 'center' }}>
                Start Free Today
              </Link>
            </div>

            {/* Pro — highlighted */}
            <div
              className="pricing-card-popular rounded-3xl p-8 flex flex-col relative"
              style={{
                backgroundColor: 'var(--bg-card)',
                boxShadow: 'var(--shadow-brand-lg)',
                transform: 'translateY(-6px)',
              }}
            >
              <div
                className="absolute -top-4 left-1/2 -translate-x-1/2"
                style={{
                  background: 'var(--gradient-brand)',
                  color: 'white',
                  fontSize: '0.6875rem',
                  fontWeight: 800,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  padding: '0.3rem 1rem',
                  borderRadius: '9999px',
                  boxShadow: 'var(--shadow-brand)',
                  whiteSpace: 'nowrap',
                }}
              >
                ⭐ Most Popular
              </div>
              <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Pro Developer</h3>
              <div className="flex items-baseline gap-1 my-4">
                <span style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.03em' }} className="gradient-text">$9</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>/ month (or ₹749)</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {['500 operations per month', '100 MB file size', '30-day cloud retention', 'Priority worker queues'].map((f) => (
                  <li key={f} className="feature-item">
                    <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: 'var(--brand-500)', flexShrink: 0 }} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/pricing" className="btn btn-primary btn-md" style={{ justifyContent: 'center' }}>
                Get Pro Plan
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Business */}
            <div className="card p-8 flex flex-col">
              <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Business</h3>
              <div className="flex items-baseline gap-1 my-4">
                <span style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>$29</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>/ month (or ₹2,499)</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {['5,000 ops / month', '250 MB file size', '90-day cloud retention', 'Full REST API + 10 Team Seats'].map((f) => (
                  <li key={f} className="feature-item">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'var(--success)', flexShrink: 0 }} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/pricing" className="btn btn-secondary btn-md" style={{ justifyContent: 'center' }}>
                Get Business Plan
              </Link>
            </div>
          </div>

          <div className="text-center mt-10">
            <Link
              href="/pricing"
              style={{ color: 'var(--brand-500)', fontSize: '0.9375rem', fontWeight: 600 }}
              className="flex items-center gap-1.5 justify-center"
            >
              Compare all features in full detail
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA BANNER ─── */}
      <section className="py-20 relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10"
          style={{ background: 'var(--gradient-brand)' }}
        />
        <div
          className="absolute inset-0 -z-10 dot-grid opacity-20"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2
            className="ts-h2 mb-4"
            style={{ color: 'white', letterSpacing: '-0.025em' }}
          >
            Start Converting Documents Free Today
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '1.0625rem', marginBottom: '2.5rem', maxWidth: '480px', margin: '0 auto 2.5rem' }}>
            No credit card required. 3 conversions per day, forever free.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/register"
              className="btn btn-lg"
              style={{
                backgroundColor: 'white',
                color: 'var(--brand-600)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              }}
            >
              <Sparkles className="w-5 h-5" />
              Get Started — It's Free
            </Link>
            <Link
              href="/tools"
              className="btn btn-lg"
              style={{
                backgroundColor: 'rgba(255,255,255,0.15)',
                color: 'white',
                border: '1.5px solid rgba(255,255,255,0.4)',
                backdropFilter: 'blur(10px)',
              }}
            >
              Browse Free Tools
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
