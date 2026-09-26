'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Wrench,
  CheckCircle2,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  Sparkles,
  ShieldCheck,
  Gauge,
  FileOutput,
} from 'lucide-react';
import { ToolDto } from '@docconv/shared-types';
import { InteractiveToolConverter } from '../../../components/InteractiveToolConverter';
import { getToolPresentation } from '../../../lib/tools-registry';
import { fetchApi } from '../../../lib/api';
import { createStaticToolDto, listStaticToolDtos } from '../../../lib/tool-dtos';

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
  const relatedTools = useMemo(
    () =>
      listStaticToolDtos()
        .filter((candidate) => candidate.slug !== slug && candidate.category === tool?.category)
        .slice(0, 3),
    [slug, tool?.category],
  );
  const isPrivateBrowserTool = Boolean(tool?.operation && tool.capability?.browser.supported);

  if (loading) {
    return (
      <div className="tool-detail-state">
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
      <div className="tool-detail-state">
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
    <div className="tool-detail-page">
      {/* ─── Hero Section ─── */}
      <section className="tool-detail-hero" style={{ borderBottom: '1px solid var(--border)' }}>
        <div
          className="absolute inset-0 -z-10"
          style={{
            background: `radial-gradient(ellipse 70% 60% at 50% 0%, ${pres.accentColor}18 0%, transparent 70%)`,
          }}
        />

        <div className="container-custom tool-detail-hero-inner">
          {/* Breadcrumbs */}
          <nav className="tool-detail-breadcrumb" style={{ color: 'var(--text-muted)' }}>
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
          <div className="tool-detail-category badge-brand">
            <Icon className="w-3.5 h-3.5" style={{ color: pres.accentColor }} />
            <span>{tool.category} Utility Engine</span>
          </div>

          {/* Heading */}
          <h1 className="ts-h1 tool-detail-title" style={{ color: 'var(--text-primary)' }}>
            {pres.name || tool.name}
          </h1>

          <p className="tool-detail-description">
            {tool.seoMetadata?.description ||
              pres.features[0] ||
              'Fast, secure, and accurate online conversion engine. Convert directly in your browser.'}
          </p>

          <div className="tool-detail-meta" aria-label="Tool processing details">
            <span>
              <ShieldCheck className="h-4 w-4" />
              {isPrivateBrowserTool ? 'Files stay on your device' : 'Secure temporary processing'}
            </span>
            <span>
              <Gauge className="h-4 w-4" />
              Up to {Math.round(tool.maxFileSizeBytes / 1024 / 1024)} MB
            </span>
            <span>
              <FileOutput className="h-4 w-4" />
              {tool.outputFormats.map((format) => format.toUpperCase()).join(', ')} output
            </span>
          </div>
        </div>
      </section>

      {/* ─── Interactive Converter Card ─── */}
      <div className="container-custom tool-detail-converter-wrap">
        {slug === 'document-editor' ? (
          <div className="card tool-detail-editor-card">
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
      <section className="tool-detail-section">
        <div className="container-custom tool-detail-section-inner">
          <div className="tool-detail-section-heading">
            <h2 className="ts-h2 mb-2" style={{ color: 'var(--text-primary)' }}>
              How to Use in 3 Simple Steps
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Zero installation required. Works smoothly across Windows, macOS, Linux, and mobile
              browsers.
            </p>
          </div>

          <div className="tool-detail-step-grid">
            {pres.steps.map((s) => (
              <div
                key={s.step}
                className="card tool-detail-step-card"
                style={{ backgroundColor: 'var(--bg-card)' }}
              >
                <div
                  className="tool-detail-step-number"
                  style={{
                    background: 'var(--gradient-brand)',
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
        </div>
      </section>

      {/* ─── Features Checklist ─── */}
      <section className="tool-detail-section tool-detail-features-section">
        <div className="container-custom tool-detail-section-inner">
          <div
            className="card tool-detail-features-card"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
            }}
          >
            <h2 className="text-xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
              Key Capabilities &amp; Engine Features
            </h2>
            <div className="tool-detail-features-grid">
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
        </div>
      </section>

      {/* ─── FAQ ─── */}
      {pres.faq.length > 0 && (
        <section className="tool-detail-section tool-detail-faq-section">
          <div className="container-custom tool-detail-section-inner">
            <div className="tool-detail-section-heading">
              <h2 className="ts-h2 mb-2" style={{ color: 'var(--text-primary)' }}>
                Frequently Asked Questions
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Everything you need to know about privacy, quotas, and conversion engines.
              </p>
            </div>

            <div className="tool-detail-faq-list">
              {pres.faq.map((item, idx) => (
                <details
                  key={idx}
                  className="card tool-detail-faq-card"
                  style={{ backgroundColor: 'var(--bg-card)' }}
                  open={idx === 0}
                >
                  <summary style={{ color: 'var(--text-primary)' }}>
                    <span>{item.q}</span>
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  </summary>
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
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {relatedTools.length > 0 && (
        <section className="tool-detail-section tool-detail-related-section">
          <div className="container-custom tool-detail-section-inner">
            <div className="tool-detail-section-heading">
              <span className="tool-detail-section-kicker">Continue working</span>
              <h2 className="ts-h2" style={{ color: 'var(--text-primary)' }}>
                More {tool.category} tools
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Keep your workflow moving with another focused utility.
              </p>
            </div>
            <div className="tool-detail-related-grid">
              {relatedTools.map((relatedTool) => {
                const related = getToolPresentation(relatedTool.slug);
                const RelatedIcon = related.icon || Wrench;
                return (
                  <Link
                    key={relatedTool.slug}
                    href={`/tools/${relatedTool.slug}`}
                    className="tool-detail-related-card"
                  >
                    <span
                      className="tool-detail-related-icon"
                      style={{ color: related.accentColor, background: `${related.accentColor}14` }}
                    >
                      <RelatedIcon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <strong>{related.name || relatedTool.name}</strong>
                      <small>{relatedTool.seoMetadata?.description}</small>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ─── Pro Upgrade Banner ─── */}
      <section className="tool-detail-upgrade-section">
        <div className="container-custom tool-detail-section-inner">
          <div
            className="tool-detail-upgrade-card"
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
        </div>
      </section>
    </div>
  );
}
