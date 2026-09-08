'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowRight, Sparkles, ShieldCheck, Zap, CheckCircle2,
  ShoppingBag, Star, TrendingUp, Lock,
} from 'lucide-react';
import { TOOL_PRESENTATION_MAP } from '../lib/tools-registry';

export default function HomePage() {
  const tools = Object.values(TOOL_PRESENTATION_MAP).slice(0, 8);

  return (
    <div style={{ overflowX: 'hidden' }}>

      {/* HERO */}
      <section style={{
        position: 'relative',
        padding: 'clamp(6rem,10vw,9rem) 0 clamp(4rem,6vw,6rem)',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          background: 'radial-gradient(ellipse 90% 70% at 50% -5%, rgba(99,102,241,0.22) 0%, transparent 65%)',
        }} />
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: 'radial-gradient(circle, rgba(99,102,241,0.12) 1px, transparent 1px)',
          backgroundSize: '30px 30px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, black 30%, transparent 80%)',
        }} />
        <div className="orb" style={{
          position: 'absolute', width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
          top: -120, left: -80, filter: 'blur(50px)', zIndex: 0,
        }} />
        <div className="orb-r" style={{
          position: 'absolute', width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(236,72,153,0.1) 0%, transparent 70%)',
          bottom: -60, right: -60, filter: 'blur(60px)', zIndex: 0,
        }} />

        <div className="container-custom" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ maxWidth: '54rem', margin: '0 auto', textAlign: 'center' }}>
            <div style={{ marginBottom: '1.75rem' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.4rem 1rem', borderRadius: '9999px',
                background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)',
                color: 'var(--brand-400)', fontSize: '0.72rem', fontWeight: 800,
                letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>
                <Sparkles style={{ width: '0.8rem', height: '0.8rem' }} />
                A Gonexel Product
              </span>
            </div>

            <h1 style={{
              fontSize: 'clamp(2.6rem,6vw,5rem)', fontWeight: 900,
              lineHeight: 1.06, letterSpacing: '-0.035em',
              color: 'var(--text-primary)', marginBottom: '1.5rem',
            }}>
              Document tools that{' '}
              <span className="gradient-text">actually work</span>
              <br />the way you think.
            </h1>

            <p style={{
              fontSize: 'clamp(1rem,1.8vw,1.15rem)', color: 'var(--text-secondary)',
              lineHeight: 1.75, maxWidth: '42rem', margin: '0 auto 2.5rem',
            }}>
              Convert PDFs, capture webpages, extract text with OCR, and edit documents —
              all from one clean workspace. No installs. No friction.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '2.5rem' }}>
              <Link href="/tools" className="btn btn-primary btn-lg">
                <Zap style={{ width: '1rem', height: '1rem' }} />
                Try free tools
              </Link>
              <Link href="/software" className="btn btn-secondary btn-lg">
                <ShoppingBag style={{ width: '1rem', height: '1rem', color: 'var(--brand-500)' }} />
                Browse software
              </Link>
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexWrap: 'wrap', gap: '0.6rem 1.75rem',
              fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500,
            }}>
              {[
                { icon: Zap, label: 'Instant browser processing', color: '#f59e0b' },
                { icon: ShieldCheck, label: 'Isolated worker jobs', color: '#10b981' },
                { icon: CheckCircle2, label: 'No credit card needed', color: '#6366f1' },
              ].map(({ icon: Icon, label, color }) => (
                <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Icon style={{ width: '0.9rem', height: '0.9rem', color }} />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* TOOLS GRID */}
      <section style={{
        padding: 'clamp(4rem,6vw,5.5rem) 0',
        borderTop: '1px solid var(--border)',
        background: 'var(--bg)',
      }}>
        <div className="container-custom">
          <div style={{ textAlign: 'center', marginBottom: 'clamp(2.5rem,4vw,3.5rem)' }}>
            <p className="section-label" style={{ marginBottom: '0.75rem' }}>17 tools and counting</p>
            <h2 className="ts-h2" style={{ color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              Everything you need, nothing you don&apos;t
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1.65, maxWidth: '38rem', margin: '0 auto' }}>
              Each tool is purpose-built for one job and does it exceptionally well.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '1rem', maxWidth: '72rem', margin: '0 auto',
          }}>
            {tools.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link key={tool.slug} href={`/tools/${tool.slug}`}
                  className="home-tool-card group"
                  style={{ '--tool-accent': tool.accentColor } as React.CSSProperties}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <div style={{
                        width: '2.5rem', height: '2.5rem', borderRadius: '0.65rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: `${tool.accentColor}15`, border: `1px solid ${tool.accentColor}30`,
                        color: tool.accentColor, flexShrink: 0,
                        transition: 'transform 200ms ease',
                      }} className="group-hover:scale-110">
                        <Icon style={{ width: '1.1rem', height: '1.1rem' }} />
                      </div>
                      {tool.badge && (
                        <span style={{
                          fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.04em',
                          textTransform: 'uppercase', padding: '0.22rem 0.5rem',
                          borderRadius: '9999px', background: `${tool.accentColor}12`,
                          color: tool.accentColor, border: `1px solid ${tool.accentColor}25`,
                        }}>
                          {tool.badge}
                        </span>
                      )}
                    </div>
                    <h3 className="home-tool-title">{tool.name}</h3>
                    <p className="home-tool-description">{tool.features[0]}</p>
                  </div>
                  <div className="home-tool-card-footer">
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                      <Zap style={{ width: '0.75rem', height: '0.75rem', display: 'inline', color: '#f59e0b', marginRight: '0.25rem' }} />
                      Free to try
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', fontWeight: 700, color: tool.accentColor }}>
                      Open <ArrowRight style={{ width: '0.75rem', height: '0.75rem' }} />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
            <Link href="/tools" className="btn btn-secondary btn-md">
              View all tools <ArrowRight style={{ width: '0.85rem', height: '0.85rem' }} />
            </Link>
          </div>
        </div>
      </section>

      {/* WHY SECTION */}
      <section style={{
        padding: 'clamp(4rem,6vw,5.5rem) 0',
        background: 'var(--bg-card)',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div className="container-custom">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1px', background: 'var(--border)',
            borderRadius: '1.25rem', overflow: 'hidden',
            border: '1px solid var(--border)',
          }}>
            {[
              { icon: ShieldCheck, color: '#10b981', title: 'Private by design', body: 'Browser tools never upload your file. Server jobs use isolated storage with automatic expiry.' },
              { icon: Zap, color: '#f59e0b', title: 'Fast every time', body: 'Browser processing is instant. Server jobs run in dedicated workers with no shared queues.' },
              { icon: CheckCircle2, color: '#6366f1', title: 'No account needed', body: 'Every tool works anonymously. Create an account only when you need history or higher limits.' },
              { icon: TrendingUp, color: '#a855f7', title: 'Built to scale', body: 'From a single PDF to thousands of batch jobs — the same API powers both seamlessly.' },
            ].map(({ icon: Icon, color, title, body }) => (
              <div key={title} style={{ padding: '2rem 1.75rem', background: 'var(--bg-card)' }}>
                <div style={{
                  width: '2.5rem', height: '2.5rem', borderRadius: '0.65rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `${color}12`, border: `1px solid ${color}28`,
                  color, marginBottom: '1.25rem',
                }}>
                  <Icon style={{ width: '1.1rem', height: '1.1rem' }} />
                </div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{title}</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.65 }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section style={{ padding: 'clamp(4rem,6vw,5.5rem) 0', background: 'var(--bg)' }}>
        <div className="container-custom">
          <div style={{ textAlign: 'center', marginBottom: 'clamp(2.5rem,4vw,3.5rem)' }}>
            <p className="section-label" style={{ marginBottom: '0.75rem' }}>Simple pricing</p>
            <h2 className="ts-h2" style={{ color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              Start free. Scale when ready.
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1.65, maxWidth: '36rem', margin: '0 auto' }}>
              No hidden fees. Cancel anytime. Every plan includes the full tool suite.
            </p>
          </div>

          <div className="home-pricing-grid">
            {[
              { name: 'Free', audience: 'For getting started', price: '$0', period: 'forever',
                features: ['10 operations / day', '25 MB file limit', 'All browser tools', 'No account required'],
                cta: 'Start for free', href: '/register', primary: false },
              { name: 'Pro', audience: 'For professionals', price: '$9', period: '/mo or \u20b9749',
                features: ['500 operations / month', '100 MB file limit', 'Priority processing', 'Conversion history'],
                cta: 'Get Pro', href: '/pricing', primary: true, badge: 'Most popular' },
              { name: 'Business', audience: 'For teams', price: '$29', period: '/mo or \u20b92,499',
                features: ['5,000 ops / month', '250 MB file limit', 'REST API access', '10 team seats'],
                cta: 'Get Business', href: '/pricing', primary: false },
            ].map((plan) => (
              <article key={plan.name} className={`pricing-plan-card${plan.primary ? ' pricing-plan-card-popular' : ''}`}>
                <div className="pricing-plan-heading">
                  <div>
                    <p className="pricing-plan-audience">{plan.audience}</p>
                    <h3>{plan.name}</h3>
                  </div>
                  {plan.badge && (
                    <span className="pricing-plan-badge">
                      <Star style={{ width: '0.6rem', height: '0.6rem' }} fill="currentColor" />
                      {plan.badge}
                    </span>
                  )}
                </div>
                <div className="pricing-plan-price">
                  <span className={plan.primary ? 'gradient-text' : ''}>{plan.price}</span>
                  <small>{plan.period}</small>
                </div>
                <ul className="pricing-plan-features">
                  {plan.features.map(f => (
                    <li key={f} className="feature-item">
                      <CheckCircle2 style={{ width: '0.9rem', height: '0.9rem', color: plan.primary ? 'var(--brand-500)' : 'var(--success)', flexShrink: 0 }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={plan.href} className={`btn ${plan.primary ? 'btn-primary' : 'btn-secondary'} btn-md pricing-plan-action`}>
                  {plan.cta} {plan.primary && <ArrowRight style={{ width: '0.85rem', height: '0.85rem' }} />}
                </Link>
              </article>
            ))}
          </div>

          <div className="home-pricing-compare">
            <Link href="/pricing">
              Compare all features in detail
              <ArrowRight style={{ width: '0.85rem', height: '0.85rem' }} />
            </Link>
          </div>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section style={{ padding: 'clamp(3rem,5vw,4.5rem) 0', borderTop: '1px solid var(--border)' }}>
        <div className="container-custom">
          <div style={{
            position: 'relative', overflow: 'hidden',
            padding: 'clamp(2.5rem,5vw,4rem)', borderRadius: '1.5rem',
            background: 'linear-gradient(130deg, #4338ca 0%, #6d28d9 50%, #9333ea 100%)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 24px 70px rgba(79,70,229,0.3)',
            textAlign: 'center',
          }}>
            <div style={{ position: 'absolute', top: -80, right: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: -60, left: -60, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.35rem 0.85rem', borderRadius: '9999px',
                background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff', fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em',
                textTransform: 'uppercase', marginBottom: '1.5rem',
              }}>
                <Lock style={{ width: '0.7rem', height: '0.7rem' }} />
                Free forever plan available
              </span>
              <h2 style={{ fontSize: 'clamp(1.75rem,4vw,2.75rem)', fontWeight: 900, color: '#fff', lineHeight: 1.15, letterSpacing: '-0.03em', marginBottom: '1rem' }}>
                Ready to convert your first file?
              </h2>
              <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.65, maxWidth: '36rem', margin: '0 auto 2rem' }}>
                No account required to start. Pick a tool, drop your file, and download the result in seconds.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <Link href="/tools" style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.85rem 2rem', borderRadius: '0.75rem',
                  background: '#fff', color: '#4338ca',
                  fontSize: '0.95rem', fontWeight: 800, textDecoration: 'none',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                }}>
                  Browse all tools <ArrowRight style={{ width: '0.9rem', height: '0.9rem' }} />
                </Link>
                <Link href="/register" style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.85rem 1.75rem', borderRadius: '0.75rem',
                  background: 'rgba(255,255,255,0.12)', color: '#fff',
                  border: '1px solid rgba(255,255,255,0.25)',
                  fontSize: '0.95rem', fontWeight: 700, textDecoration: 'none',
                }}>
                  Create free account
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
