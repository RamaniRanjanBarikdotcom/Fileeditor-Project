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
    label: 'Free Tools',
    sublabel: 'Focused document workflows',
    icon: FileOutput,
    accentColor: '#6366f1',
  },
  {
    value: '3',
    label: 'Product Paths',
    sublabel: 'Tools, SaaS, and software',
    icon: Users,
    accentColor: '#a855f7',
  },
  {
    value: 'Chromium',
    label: 'Web Capture',
    sublabel: 'Modern browser rendering',
    icon: TrendingUp,
    accentColor: '#10b981',
  },
  {
    value: 'Private',
    label: 'Processing Design',
    sublabel: 'Controlled file access',
    icon: ShieldCheck,
    accentColor: '#f59e0b',
  },
];

export default function HomePage() {
  const tools = Object.values(TOOL_PRESENTATION_MAP);

  const featuredSoftware = [
    {
      slug: 'apptoolkitlab-desktop-cli',
      name: 'AppToolkitLab CLI Pro Engine',
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
      <section className="home-hero relative overflow-hidden w-full">
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
            style={{
              maskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%, black 40%, transparent 100%)',
            }}
          />
        </div>

        <div className="container-custom relative z-10">
          <div className="home-hero-inner">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 mb-8 anim-fade-up" id="hero-badge">
              <span
                className="badge badge-brand"
                style={{ fontSize: '0.75rem', padding: '0.4rem 1rem' }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                AppToolkitLab — A Gonexel Product
              </span>
            </div>

            {/* Headline */}
            <h1
              className="ts-display anim-fade-up anim-delay-1 mb-6"
              style={{ color: 'var(--text-primary)' }}
            >
              Every Document Tool,{' '}
              <span className="block gradient-text" style={{ lineHeight: '1.1' }}>
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
              Convert PDFs, extract text with OCR, capture webpages, and purchase software catalog
              items from one consistent workspace.
            </p>

            {/* CTAs */}
            <div className="home-hero-actions anim-fade-up anim-delay-3">
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
            <div className="home-hero-trust anim-fade-up anim-delay-4">
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
      <section className="home-stats-section">
        <div className="container-custom">
          <div className="home-stats-panel">
            {/* Ambient inner background gradient */}
            <div
              className="absolute inset-0 pointer-events-none -z-0"
              style={{
                background:
                  'radial-gradient(ellipse 80% 80% at 50% 50%, rgba(99,102,241,0.08) 0%, transparent 80%)',
              }}
            />

            <div className="home-stats-grid relative z-10">
              {STATS.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className="home-stat-card"
                    style={{ '--stat-accent': stat.accentColor } as React.CSSProperties}
                  >
                    {/* Icon container */}
                    <div
                      className="home-stat-icon"
                      style={{
                        backgroundColor: `${stat.accentColor}18`,
                        border: `1px solid ${stat.accentColor}35`,
                        color: stat.accentColor,
                        boxShadow: `0 8px 20px -4px ${stat.accentColor}25`,
                      }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>

                    {/* Stat Value */}
                    <div className="home-stat-value">{stat.value}</div>

                    {/* Stat Label */}
                    <div className="home-stat-label">{stat.label}</div>

                    {/* Sublabel */}
                    <div className="home-stat-sublabel">{stat.sublabel}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ─── FEATURED FREE TOOLS ─── */}
      <section className="home-tools-section relative overflow-hidden">
        {/* Ambient background glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] rounded-full pointer-events-none -z-10"
          style={{
            background:
              'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(99,102,241,0.1) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />

        <div className="container-custom">
          {/* Centered Structured Header */}
          <div className="home-tools-heading">
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
              High-speed, private document utilities that process directly in your browser with zero
              registration required.
            </p>
          </div>

          {/* Symmetrical 4-Column Grid */}
          <div className="home-tools-grid">
            {tools.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link
                  key={tool.slug}
                  href={`/tools/${tool.slug}`}
                  id={`tool-card-${tool.slug}`}
                  className="home-tool-card group"
                  style={
                    {
                      '--tool-accent': tool.accentColor,
                    } as React.CSSProperties
                  }
                >
                  <div>
                    {/* Top Row: Icon + Badge */}
                    <div className="home-tool-card-topline">
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
                          className="home-tool-badge"
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
                      className="home-tool-title"
                      style={{
                        color: 'var(--text-primary)',
                        lineHeight: 1.3,
                      }}
                    >
                      {tool.name}
                    </h3>

                    {/* Description */}
                    <p className="home-tool-description">{tool.features[0]}</p>
                  </div>

                  {/* Bottom Footer */}
                  <div className="home-tool-card-footer">
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
          <div className="home-tools-action">
            <Link href="/tools" className="btn btn-secondary btn-md inline-flex items-center gap-2">
              <span>Explore All Tools in Directory</span>
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
            background:
              'radial-gradient(ellipse 60% 80% at 100% 50%, rgba(99,102,241,0.06) 0%, transparent 70%)',
          }}
        />

        <div className="container-custom relative z-10">
          <div className="flex flex-col items-center text-center mb-14">
            <p className="section-label mb-3">Digital Assets & Software Store</p>
            <h2 className="ts-h2 mb-4" style={{ color: 'var(--text-primary)' }}>
              Buy Production-Ready Software & Developer Kits
            </h2>
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: '1.0625rem',
                lineHeight: '1.6',
                maxWidth: '600px',
                margin: '0 auto',
              }}
            >
              Explore our curated catalog of source code, templates, and standalone tools available
              for one-time purchase.
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
                    <Link href={`/software/${item.slug}`} className="btn btn-primary btn-sm">
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
      <section className="home-pricing-section">
        <div className="container-custom relative z-10">
          <div className="home-pricing-heading">
            <p className="section-label">Transparent Pricing</p>
            <h2 className="ts-h2" style={{ color: 'var(--text-primary)' }}>
              Simple, High-Value SaaS Plans
            </h2>
            <p>
              Start completely free or scale with Pro & Business tiers for priority batch queues and
              API access.
            </p>
          </div>

          <div className="home-pricing-grid">
            {/* Free */}
            <article className="pricing-plan-card">
              <div className="pricing-plan-heading">
                <div>
                  <p className="pricing-plan-audience">For getting started</p>
                  <h3>Free Starter</h3>
                </div>
              </div>
              <div className="pricing-plan-price">
                <span>$0</span>
                <small>/ forever</small>
              </div>
              <p className="pricing-plan-summary">
                Essential document tools for occasional personal projects.
              </p>
              <ul className="pricing-plan-features">
                {['10 operations per day', '25 MB file size', '10-minute temporary files'].map(
                  (f) => (
                    <li key={f} className="feature-item">
                      <CheckCircle2
                        className="w-4 h-4"
                        style={{ color: 'var(--success)', flexShrink: 0 }}
                      />
                      {f}
                    </li>
                  ),
                )}
              </ul>
              <Link href="/register" className="btn btn-secondary btn-md pricing-plan-action">
                Start Free Today
              </Link>
            </article>

            {/* Pro — highlighted */}
            <article className="pricing-plan-card pricing-plan-card-popular">
              <div className="pricing-plan-heading">
                <div>
                  <p className="pricing-plan-audience">For professionals</p>
                  <h3>Pro Developer</h3>
                </div>
                <span className="pricing-plan-badge">
                  <Star className="w-3 h-3" fill="currentColor" />
                  Most popular
                </span>
              </div>
              <div className="pricing-plan-price">
                <span className="gradient-text">$9</span>
                <small>
                  / month <em>or ₹749</em>
                </small>
              </div>
              <p className="pricing-plan-summary">
                Higher limits and priority processing for regular workflows.
              </p>
              <ul className="pricing-plan-features">
                {[
                  '500 operations per month',
                  '100 MB file size',
                  '10-minute temporary files',
                  'Priority worker queues',
                ].map((f) => (
                  <li key={f} className="feature-item">
                    <CheckCircle2
                      className="w-4 h-4 shrink-0"
                      style={{ color: 'var(--brand-500)', flexShrink: 0 }}
                    />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/pricing" className="btn btn-primary btn-md pricing-plan-action">
                Get Pro Plan
                <ArrowRight className="w-4 h-4" />
              </Link>
            </article>

            {/* Business */}
            <article className="pricing-plan-card">
              <div className="pricing-plan-heading">
                <div>
                  <p className="pricing-plan-audience">For growing teams</p>
                  <h3>Business</h3>
                </div>
              </div>
              <div className="pricing-plan-price">
                <span>$29</span>
                <small>
                  / month <em>or ₹2,499</em>
                </small>
              </div>
              <p className="pricing-plan-summary">
                Team access, API capacity, and room for production workloads.
              </p>
              <ul className="pricing-plan-features">
                {[
                  '5,000 ops / month',
                  '250 MB file size',
                  '10-minute temporary files',
                  'Full REST API + 10 Team Seats',
                ].map((f) => (
                  <li key={f} className="feature-item">
                    <CheckCircle2
                      className="w-4 h-4"
                      style={{ color: 'var(--success)', flexShrink: 0 }}
                    />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/pricing" className="btn btn-secondary btn-md pricing-plan-action">
                Get Business Plan
              </Link>
            </article>
          </div>

          <div className="home-pricing-compare">
            <Link href="/pricing">
              Compare all features in full detail
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
