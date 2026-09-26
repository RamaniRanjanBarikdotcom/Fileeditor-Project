'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Check, ChevronRight, Search, Sparkles, Wrench, Zap,
} from 'lucide-react';
import { ToolDto } from '@docconv/shared-types';
import { TOOL_PRESENTATION_MAP } from '../../lib/tools-registry';
import { fetchApi } from '../../lib/api';
import { listStaticToolDtos } from '../../lib/tool-dtos';

type DirectoryTool = Pick<ToolDto, 'slug'|'name'|'category'|'anonymousEnabled'|'acceptedFormats'|'outputFormats'|'seoMetadata'>;

const CATEGORY_BY_SLUG: Record<string, string> = {
  'pdf-to-docx': 'Document', 'pdf-to-markdown': 'Document', 'pdf-ocr': 'Document',
  'pdf-to-images': 'Image',
  'url-to-pdf': 'Web', 'url-to-docx': 'Web',
  'html-to-pdf': 'Developer', 'markdown-to-pdf': 'Developer',
  'image-to-pdf': 'Image', 'document-editor': 'Studio',
};

const FORMAT_BY_SLUG: Record<string, { input: string[]; output: string[] }> = {
  'pdf-to-docx': { input: ['PDF'], output: ['DOCX'] },
  'pdf-to-markdown': { input: ['PDF'], output: ['MARKDOWN'] },
  'pdf-to-images': { input: ['PDF'], output: ['PNG', 'JPG'] },
  'pdf-ocr': { input: ['PDF'], output: ['TXT'] },
  'url-to-pdf': { input: ['URL'], output: ['PDF'] },
  'url-to-docx': { input: ['URL'], output: ['DOCX'] },
  'html-to-pdf': { input: ['HTML', 'CSS'], output: ['PDF'] },
  'markdown-to-pdf': { input: ['MD'], output: ['PDF'] },
  'image-to-pdf': { input: ['JPG', 'PNG'], output: ['PDF'] },
  'document-editor': { input: ['TEXT'], output: ['PDF', 'DOCX'] },
};

const FALLBACK_TOOLS: DirectoryTool[] = listStaticToolDtos().map((tool) => ({
  slug: tool.slug,
  name: tool.name,
  category: tool.category || CATEGORY_BY_SLUG[tool.slug] || 'Document',
  anonymousEnabled: tool.anonymousEnabled,
  acceptedFormats: tool.acceptedFormats || FORMAT_BY_SLUG[tool.slug]?.input || [],
  outputFormats: tool.outputFormats || FORMAT_BY_SLUG[tool.slug]?.output || [],
  seoMetadata: tool.seoMetadata,
}));

const CATEGORIES = ['All', 'PDF', 'Document', 'Web', 'Developer', 'Image', 'Studio'];

export default function ToolsDirectoryPage() {
  const [tools, setTools] = useState<DirectoryTool[]>(FALLBACK_TOOLS);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [syncing, setSyncing] = useState(true);

  useEffect(() => {
    let active = true;
    void fetchApi<ToolDto[]>('/tools').then((res) => {
      if (!active) return;
      if (res.success && res.data?.length) {
        const apiBySlug = new Map(res.data.map((t) => [t.slug, t]));
        setTools([
          ...FALLBACK_TOOLS.map((t) => apiBySlug.get(t.slug) || t),
          ...res.data.filter((t) => !FALLBACK_TOOLS.some((f) => f.slug === t.slug)),
        ]);
      }
      setSyncing(false);
    });
    return () => { active = false; };
  }, []);

  const filteredTools = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tools.filter((tool) => {
      const matchCat = selectedCategory === 'All' || tool.category.toLowerCase() === selectedCategory.toLowerCase();
      const text = [tool.name, tool.slug, tool.category, tool.seoMetadata?.description, ...tool.acceptedFormats, ...tool.outputFormats].filter(Boolean).join(' ').toLowerCase();
      return matchCat && (!q || text.includes(q));
    });
  }, [searchQuery, selectedCategory, tools]);

  return (
    <div style={{ minHeight: '100vh' }}>

      {/* Hero */}
      <section style={{
        position: 'relative', overflow: 'hidden',
        padding: 'clamp(4.5rem,7vw,6rem) 0 clamp(3rem,5vw,4rem)',
        background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99,102,241,0.18) 0%, transparent 60%), var(--bg-card)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle, rgba(99,102,241,0.1) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'linear-gradient(to bottom, black, transparent 85%)',
          pointerEvents: 'none',
        }} />
        <div className="container-custom" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ maxWidth: '52rem', margin: '0 auto', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginBottom: '1.25rem', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>Home</Link>
              <ChevronRight style={{ width: '0.85rem', height: '0.85rem' }} />
              <span style={{ color: 'var(--text-secondary)' }}>Free tools</span>
            </div>
            <span className="badge badge-brand" style={{ marginBottom: '1.25rem' }}>
              <Sparkles style={{ width: '0.8rem', height: '0.8rem' }} />
              {FALLBACK_TOOLS.length} tools available
            </span>
            <h1 className="ts-h1" style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>
              Every document tool you need,{' '}
              <span className="gradient-text">in one place</span>
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1.7, maxWidth: '40rem', margin: '0 auto 2rem' }}>
              Convert PDFs, capture webpages with Chromium, extract scanned text, and create polished files — no software required.
            </p>

            {/* Search */}
            <div style={{
              width: 'min(100%, 38rem)', margin: '0 auto 1.75rem',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: '0.9rem', padding: '0.35rem',
              boxShadow: 'var(--shadow-lg)',
            }}>
              <div style={{ position: 'relative' }}>
                <Search style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: 'var(--text-muted)' }} />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder='Search tools — try "PDF to Word"'
                  style={{
                    width: '100%', height: '3rem', paddingLeft: '2.75rem', paddingRight: '1rem',
                    background: 'var(--bg-muted)', border: '1px solid transparent',
                    borderRadius: '0.6rem', fontSize: '0.88rem', color: 'var(--text-primary)',
                    outline: 'none', fontFamily: 'inherit',
                  }}
                  aria-label="Search tools"
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: '0.6rem 1.5rem', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
              {['No installation required', '3 free jobs each day', 'Secure file handling'].map((label) => (
                <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ display: 'flex', width: '1.1rem', height: '1.1rem', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                    <Check style={{ width: '0.6rem', height: '0.6rem' }} />
                  </span>
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Directory */}
      <section style={{ padding: 'clamp(3rem,5vw,4.5rem) 0' }}>
        <div className="container-custom">

          {/* Filter bar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: '1rem',
            padding: '1rem 1.25rem', marginBottom: '1.5rem',
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: '0.9rem', boxShadow: 'var(--shadow-xs)',
            maxWidth: '72rem', margin: '0 auto 1.5rem',
          }}>
            <div>
              <p className="section-label" style={{ marginBottom: '0.2rem' }}>Explore the collection</p>
              <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {filteredTools.length} {filteredTools.length === 1 ? 'tool' : 'tools'} found
                {syncing && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '0.5rem' }}>syncing…</span>}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              {CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat;
                return (
                  <button key={cat} type="button" onClick={() => setSelectedCategory(cat)}
                    style={{
                      padding: '0.45rem 0.85rem', borderRadius: '9999px',
                      fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
                      border: isActive ? '1px solid transparent' : '1px solid var(--border)',
                      background: isActive ? 'var(--gradient-brand)' : 'var(--bg-muted)',
                      color: isActive ? '#fff' : 'var(--text-secondary)',
                      boxShadow: isActive ? 'var(--shadow-brand)' : 'none',
                      transition: 'all 150ms ease',
                    }}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grid */}
          {filteredTools.length === 0 ? (
            <div style={{
              maxWidth: '72rem', margin: '0 auto',
              padding: '4rem 2rem', textAlign: 'center',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: '1rem',
            }}>
              <div style={{ width: '3rem', height: '3rem', borderRadius: '0.75rem', background: 'var(--bg-muted)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <Wrench style={{ width: '1.25rem', height: '1.25rem', color: 'var(--text-muted)' }} />
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No matching tool</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>Try another format or reset the category filter.</p>
              <button className="btn btn-secondary btn-sm" onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}>
                Show all tools
              </button>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '1rem', maxWidth: '72rem', margin: '0 auto',
            }}>
              {filteredTools.map((tool) => {
                const pres = TOOL_PRESENTATION_MAP[tool.slug];
                const Icon = pres?.icon ?? Wrench;
                const accent = pres?.accentColor ?? '#6366f1';
                const desc = tool.seoMetadata?.description ?? pres?.features[0] ?? 'Fast, secure file processing.';
                return (
                  <Link key={tool.slug} href={`/tools/${tool.slug}`}
                    className="tool-directory-card group"
                    style={{ '--tool-accent': accent } as React.CSSProperties}
                  >
                    <div className="tool-directory-topline">
                      <div className="tool-icon-ring h-12 w-12" style={{ background: `${accent}14`, border: `1px solid ${accent}30` }}>
                        <Icon style={{ width: '1.1rem', height: '1.1rem', color: accent }} />
                      </div>
                      <span className="badge badge-neutral" style={{ fontSize: '0.62rem' }}>{tool.category}</span>
                    </div>
                    <div className="tool-directory-copy">
                      <h3>{pres?.name ?? tool.name}</h3>
                      <p>{desc}</p>
                    </div>
                    <div className="tool-directory-formats">
                      {tool.acceptedFormats.slice(0, 2).map((f) => (
                        <span key={`in-${f}`} className="tool-format-chip">{f}</span>
                      ))}
                      <ArrowRight style={{ width: '0.85rem', height: '0.85rem', color: 'var(--text-muted)' }} />
                      {tool.outputFormats.slice(0, 2).map((f) => (
                        <span key={`out-${f}`} className="tool-format-chip">{f}</span>
                      ))}
                    </div>
                    <div className="tool-directory-footer">
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        <Zap style={{ width: '0.8rem', height: '0.8rem', color: '#f59e0b' }} />
                        {tool.anonymousEnabled ? 'Free to try' : 'Account required'}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', fontWeight: 700, color: accent }}>
                        Open tool
                        <ArrowRight style={{ width: '0.85rem', height: '0.85rem', transition: 'transform 150ms ease' }} className="group-hover:translate-x-1" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Bottom CTA */}
      <section style={{ padding: 'clamp(3rem,5vw,4.5rem) 0', borderTop: '1px solid var(--border)' }}>
        <div className="container-custom">
          <div style={{
            position: 'relative', overflow: 'hidden',
            padding: 'clamp(2rem,4vw,3rem)', borderRadius: '1.5rem',
            background: 'linear-gradient(130deg, #4338ca 0%, #6d28d9 55%, #9333ea 100%)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 20px 60px rgba(79,70,229,0.28)',
          }}>
            <div style={{ position: 'absolute', top: -60, right: -60, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', zIndex: 1, maxWidth: '42rem' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.3rem 0.75rem', borderRadius: '9999px',
                background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff', fontSize: '0.65rem', fontWeight: 800,
                letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '1.25rem',
              }}>
                Workspace plans
              </span>
              <h2 style={{ fontSize: 'clamp(1.5rem,3vw,2.25rem)', fontWeight: 900, color: '#fff', lineHeight: 1.15, letterSpacing: '-0.025em', marginBottom: '0.75rem' }}>
                Need more files, history, and team access?
              </h2>
              <p style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.65, marginBottom: '1.75rem', maxWidth: '36rem' }}>
                Move from free utilities to the complete AppToolkitLab workspace with larger quotas, persistent history, and business controls.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.65rem' }}>
                <Link href="/register" style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.75rem 1.5rem', borderRadius: '0.65rem',
                  background: '#fff', color: '#4338ca',
                  fontSize: '0.88rem', fontWeight: 800, textDecoration: 'none',
                }}>
                  Create free account <ArrowRight style={{ width: '0.85rem', height: '0.85rem' }} />
                </Link>
                <Link href="/pricing" style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.75rem 1.25rem', borderRadius: '0.65rem',
                  background: 'rgba(255,255,255,0.12)', color: '#fff',
                  border: '1px solid rgba(255,255,255,0.22)',
                  fontSize: '0.88rem', fontWeight: 700, textDecoration: 'none',
                }}>
                  Compare plans
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
