'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Wrench,
  CheckCircle2,
  ShieldCheck,
  Zap,
  HelpCircle,
  ArrowRight,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { ToolDto } from '@docconv/shared-types';
import { InteractiveToolConverter } from '../../../components/InteractiveToolConverter';
import { TOOL_PRESENTATION_MAP, getToolPresentation } from '../../../lib/tools-registry';
import { fetchApi } from '../../../lib/api';
import { createStaticToolDto } from '../../../lib/tool-dtos';

export default function ToolDetailPage() {
  const params = useParams();
  const slug = (params?.slug as string) || 'pdf-to-docx';
  const staticTool = useMemo(() => createStaticToolDto(slug), [slug]);

  const [tool, setTool] = useState<ToolDto | null>(() => staticTool || null);
  const [loading, setLoading] = useState(!staticTool);

  useEffect(() => {
    async function loadTool() {
      setTool(staticTool || null);
      setLoading(!staticTool);
      const res = await fetchApi<ToolDto>(`/tools/${slug}`);
      setTool(res.success && res.data ? res.data : staticTool || null);
      setLoading(false);
    }
    loadTool();
  }, [slug, staticTool]);

  const pres = getToolPresentation(slug);
  const Icon = pres.icon || Wrench;

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center space-y-4">
        <div
          className="w-12 h-12 border-4 rounded-full animate-spin mx-auto"
          style={{ borderColor: 'var(--border)', borderTopColor: 'var(--brand-500)' }}
        />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Loading tool configuration...
        </p>
      </div>
    );
  }

  if (!tool) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center space-y-4">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Tool Not Found
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          The requested tool does not exist or is currently unpublished.
        </p>
        <Link href="/tools" className="btn btn-primary btn-md">
          <span>View All Tools</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* ─── Hero Section ─── */}
      <section
        className="relative py-14 overflow-hidden"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div
          className="absolute inset-0 -z-10"
          style={{
            background: `radial-gradient(ellipse 70% 60% at 50% 0%, ${pres.accentColor}18 0%, transparent 70%)`,
          }}
        />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          {/* Breadcrumbs */}
          <nav
            className="flex items-center justify-center gap-2 text-xs font-medium mb-4"
            style={{ color: 'var(--text-muted)' }}
          >
            <Link
              href="/"
              style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
              className="hover:text-indigo-400"
            >
              Home
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link
              href="/tools"
              style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
              className="hover:text-indigo-400"
            >
              Tools
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
              {pres.name || tool.name}
            </span>
          </nav>

          {/* Category Chip */}
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full badge-brand">
            <Icon className="w-3.5 h-3.5" style={{ color: pres.accentColor }} />
            <span>{tool.category} Utility Engine</span>
          </div>

          {/* Heading */}
          <h1 className="ts-h1" style={{ color: 'var(--text-primary)', lineHeight: 1.15 }}>
            {pres.name || tool.name}
          </h1>

          <p
            style={{
              fontSize: '1.0625rem',
              color: 'var(--text-secondary)',
              maxWidth: '600px',
              margin: '0 auto',
              lineHeight: '1.7',
            }}
          >
            {tool.seoMetadata?.description ||
              pres.features[0] ||
              'Fast, secure, and accurate online conversion engine. Convert directly in your browser.'}
          </p>
        </div>
      </section>

      {/* ─── Interactive Converter Card ─── */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {slug === 'document-editor' ? (
          <div className="card p-10 text-center">
            <Icon className="mx-auto mb-5 h-12 w-12" style={{ color: pres.accentColor }} />
            <h2 className="ts-h2 mb-3">Open the authenticated document studio</h2>
            <p
              className="mx-auto mb-7 max-w-xl text-sm leading-6"
              style={{ color: 'var(--text-muted)' }}
            >
              The studio runs inside your private workspace so exports and conversion history stay
              associated with your account.
            </p>
            <Link href="/app/editor" className="btn btn-primary btn-lg">
              Open Document Studio <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <InteractiveToolConverter tool={tool} />
        )}
      </div>

      {/* ─── How to Use in 3 Steps ─── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-10">
          <h2 className="ts-h2 mb-2" style={{ color: 'var(--text-primary)' }}>
            How to Use in 3 Simple Steps
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Zero installation required. Works smoothly across Windows, macOS, Linux, and mobile
            browsers.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {pres.steps.map((s) => (
            <div
              key={s.step}
              className="card p-6 flex flex-col justify-between"
              style={{ backgroundColor: 'var(--bg-card)' }}
            >
              <div
                style={{
                  width: '2rem',
                  height: '2rem',
                  borderRadius: '8px',
                  background: 'var(--gradient-brand)',
                  color: 'white',
                  fontWeight: 800,
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1rem',
                  boxShadow: 'var(--shadow-brand)',
                }}
              >
                {s.step}
              </div>
              <h3 className="font-bold text-base mb-2" style={{ color: 'var(--text-primary)' }}>
                {s.title}
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Features Checklist ─── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div
          className="card p-8"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
          }}
        >
          <h2 className="text-xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
            Key Capabilities &amp; Engine Features
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {pres.features.map((f, i) => (
              <div key={i} className="flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#10b981' }} />
                <span
                  style={{
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)',
                    lineHeight: '1.5',
                  }}
                >
                  {f}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      {pres.faq.length > 0 && (
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-10">
            <h2 className="ts-h2 mb-2" style={{ color: 'var(--text-primary)' }}>
              Frequently Asked Questions
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Everything you need to know about privacy, quotas, and conversion engines.
            </p>
          </div>

          <div className="space-y-4">
            {pres.faq.map((item, idx) => (
              <div key={idx} className="card p-6" style={{ backgroundColor: 'var(--bg-card)' }}>
                <h3
                  className="text-base font-bold mb-2 flex items-center gap-2"
                  style={{ color: 'var(--text-primary)' }}
                >
                  <HelpCircle className="w-4 h-4" style={{ color: 'var(--brand-500)' }} />
                  {item.q}
                </h3>
                <p
                  style={{
                    fontSize: '0.875rem',
                    color: 'var(--text-muted)',
                    lineHeight: '1.7',
                    paddingLeft: '1.5rem',
                  }}
                >
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── Pro Upgrade Banner ─── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div
          className="rounded-3xl p-8 sm:p-10 text-center relative overflow-hidden"
          style={{
            background: 'var(--gradient-brand)',
            boxShadow: 'var(--shadow-brand-lg)',
          }}
        >
          <div className="relative z-10 space-y-4">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
              style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Pro &amp; Business Plans
            </span>
            <h2 className="ts-h2" style={{ color: 'white' }}>
              Need Higher Limits &amp; Priority Worker Queues?
            </h2>
            <p
              style={{
                color: 'rgba(255,255,255,0.85)',
                fontSize: '0.9375rem',
                maxWidth: '520px',
                margin: '0 auto',
                lineHeight: '1.7',
              }}
            >
              Get 500 conversions per month, 100 MB max file sizes, and priority processing for
              $9/month (or ₹749/month). Uploaded conversion files expire within 10 minutes.
            </p>
            <div className="pt-2">
              <Link
                href="/pricing"
                className="btn btn-lg"
                style={{
                  backgroundColor: 'white',
                  color: 'var(--brand-600)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                  display: 'inline-flex',
                }}
              >
                <span>View All Plans</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
