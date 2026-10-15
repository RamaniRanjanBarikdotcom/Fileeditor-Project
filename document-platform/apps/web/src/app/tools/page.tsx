'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Check, ChevronRight, Search, Sparkles, Wrench, Zap } from 'lucide-react';
import { TOOL_GROUPS, groupIdForSlug, groupTools } from '../../lib/tool-groups';
import { toolGroupIcon } from '../../lib/tool-group-icons';
import { ToolDto } from '@docconv/shared-types';
import { TOOL_PRESENTATION_MAP } from '../../lib/tools-registry';
import { fetchApi } from '../../lib/api';
import { listStaticToolDtos } from '../../lib/tool-dtos';

type DirectoryTool = Pick<
  ToolDto,
  | 'slug'
  | 'name'
  | 'category'
  | 'anonymousEnabled'
  | 'acceptedFormats'
  | 'outputFormats'
  | 'seoMetadata'
>;

const CATEGORY_BY_SLUG: Record<string, string> = {
  'pdf-to-docx': 'Document',
  'pdf-to-markdown': 'Document',
  'pdf-ocr': 'Document',
  'pdf-to-images': 'Image',
  'url-to-pdf': 'Web',
  'url-to-docx': 'Web',
  'html-to-pdf': 'Developer',
  'markdown-to-pdf': 'Developer',
  'image-to-pdf': 'Image',
  'document-editor': 'Studio',
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

export default function ToolsDirectoryPage() {
  // The prerendered fallback is the complete "All tools" directory, so the
  // initial HTML stays fully indexable; the URL's ?group= applies on hydration.
  return (
    <Suspense fallback={<ToolsDirectory selectedGroup="all" />}>
      <ToolsDirectoryFromUrl />
    </Suspense>
  );
}

function ToolsDirectoryFromUrl() {
  const group = useSearchParams().get('group');
  return (
    <ToolsDirectory
      selectedGroup={group && TOOL_GROUPS.some((g) => g.id === group) ? group : 'all'}
    />
  );
}

function ToolsDirectory({ selectedGroup }: { selectedGroup: string }) {
  const router = useRouter();
  const setSelectedGroup = (group: string) =>
    router.replace(group === 'all' ? '/tools' : `/tools?group=${group}`, { scroll: false });
  const [tools, setTools] = useState<DirectoryTool[]>(FALLBACK_TOOLS);
  const [searchQuery, setSearchQuery] = useState('');
  const [syncing, setSyncing] = useState(true);

  useEffect(() => {
    let active = true;
    void fetchApi<ToolDto[]>('/tools').then((res) => {
      if (!active) return;
      if (res.success && res.data?.length) {
        const apiBySlug = new Map(res.data.map((t) => [t.slug, t]));
        setTools([
          // The canonical registry decides which tools exist; the API only
          // refreshes their details. Unknown slugs would link to a 404 page.
          ...FALLBACK_TOOLS.map((t) => apiBySlug.get(t.slug) || t),
        ]);
      }
      setSyncing(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const filteredTools = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tools.filter((tool) => {
      const matchGroup = selectedGroup === 'all' || groupIdForSlug(tool.slug) === selectedGroup;
      const pres = TOOL_PRESENTATION_MAP[tool.slug];
      const text = [
        tool.name,
        pres?.name,
        tool.slug,
        tool.category,
        tool.seoMetadata?.description,
        ...tool.acceptedFormats,
        ...tool.outputFormats,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return matchGroup && (!q || text.includes(q));
    });
  }, [searchQuery, selectedGroup, tools]);

  const sections = useMemo(() => groupTools(filteredTools), [filteredTools]);
  const groupCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tool of tools) {
      const id = groupIdForSlug(tool.slug);
      counts.set(id, (counts.get(id) || 0) + 1);
    }
    return counts;
  }, [tools]);

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Hero */}
      <section
        style={{
          position: 'relative',
          overflow: 'hidden',
          padding: 'clamp(4.5rem,7vw,6rem) 0 clamp(3rem,5vw,4rem)',
          background:
            'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(62, 99, 221,0.18) 0%, transparent 60%), var(--bg-card)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(circle, rgba(62, 99, 221,0.1) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            maskImage: 'linear-gradient(to bottom, black, transparent 85%)',
            pointerEvents: 'none',
          }}
        />
        <div className="container-custom" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ maxWidth: '52rem', margin: '0 auto', textAlign: 'center' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                marginBottom: '1.25rem',
                fontSize: '0.76rem',
                color: 'var(--text-muted)',
              }}
            >
              <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>
                Home
              </Link>
              <ChevronRight style={{ width: '0.85rem', height: '0.85rem' }} />
              <span style={{ color: 'var(--text-secondary)' }}>Free tools</span>
            </div>
            <span className="badge badge-brand" style={{ marginBottom: '1.25rem' }}>
              <Sparkles style={{ width: '0.8rem', height: '0.8rem' }} />
              {FALLBACK_TOOLS.length} tools available
            </span>
            <h1 className="ts-h1" style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>
              Every document tool you need, <span className="gradient-text">in one place</span>
            </h1>
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: '1rem',
                lineHeight: 1.7,
                maxWidth: '40rem',
                margin: '0 auto 2rem',
              }}
            >
              Convert PDFs, capture webpages with Chromium, extract scanned text, and create
              polished files — no software required.
            </p>

            {/* Search */}
            <div
              style={{
                width: 'min(100%, 38rem)',
                margin: '0 auto 1.75rem',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '0.9rem',
                padding: '0.35rem',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <div style={{ position: 'relative' }}>
                <Search
                  style={{
                    position: 'absolute',
                    left: '0.9rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '1rem',
                    height: '1rem',
                    color: 'var(--text-muted)',
                  }}
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder='Search tools — try "PDF to Word"'
                  style={{
                    width: '100%',
                    height: '3rem',
                    paddingLeft: '2.75rem',
                    paddingRight: '1rem',
                    background: 'var(--bg-muted)',
                    border: '1px solid transparent',
                    borderRadius: '0.6rem',
                    fontSize: '0.88rem',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    fontFamily: 'inherit',
                  }}
                  aria-label="Search tools"
                />
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexWrap: 'wrap',
                gap: '0.6rem 1.5rem',
                fontSize: '0.76rem',
                color: 'var(--text-secondary)',
              }}
            >
              {['No installation required', '5 free server jobs a day', 'Secure file handling'].map(
                (label) => (
                  <span
                    key={label}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <span
                      style={{
                        display: 'flex',
                        width: '1.1rem',
                        height: '1.1rem',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '50%',
                        background: 'rgba(16,185,129,0.12)',
                        color: '#10b981',
                      }}
                    >
                      <Check style={{ width: '0.6rem', height: '0.6rem' }} />
                    </span>
                    {label}
                  </span>
                ),
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Directory */}
      <section className="tools-dir">
        <div className="container-custom">
          <div className="tools-dir-filters" role="toolbar" aria-label="Filter tools by group">
            <button
              type="button"
              aria-pressed={selectedGroup === 'all'}
              className={`tools-dir-chip${selectedGroup === 'all' ? ' is-active' : ''}`}
              onClick={() => setSelectedGroup('all')}
            >
              All tools <span>{tools.length}</span>
            </button>
            {TOOL_GROUPS.map((group) => {
              const count = groupCounts.get(group.id) || 0;
              if (!count) return null;
              const GroupIcon = toolGroupIcon(group.id);
              return (
                <button
                  key={group.id}
                  type="button"
                  aria-pressed={selectedGroup === group.id}
                  className={`tools-dir-chip${selectedGroup === group.id ? ' is-active' : ''}`}
                  onClick={() => setSelectedGroup(group.id)}
                >
                  <GroupIcon aria-hidden="true" />
                  {group.shortTitle} <span>{count}</span>
                </button>
              );
            })}
            {syncing && <span className="tools-dir-syncing">Syncing…</span>}
          </div>

          {sections.length === 0 ? (
            <div className="tools-dir-empty">
              <span>
                <Wrench />
              </span>
              <h3>No matching tool</h3>
              <p>Try another task or format, or show every tool.</p>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedGroup('all');
                }}
              >
                Show all tools
              </button>
            </div>
          ) : (
            sections.map(({ group, tools: groupTools }) => {
              const GroupIcon = toolGroupIcon(group.id);
              return (
                <section
                  key={group.id}
                  id={group.id}
                  className="tools-dir-group"
                  aria-labelledby={`${group.id}-title`}
                >
                  <header className="tools-dir-group-head">
                    <span className="tools-dir-group-icon">
                      <GroupIcon />
                    </span>
                    <div>
                      <h2 id={`${group.id}-title`}>
                        {group.title} <span>{groupTools.length}</span>
                      </h2>
                      <p>{group.description}</p>
                    </div>
                  </header>
                  <div className="tools-dir-grid">
                    {groupTools.map((tool) => {
                      const pres = TOOL_PRESENTATION_MAP[tool.slug];
                      const Icon = pres?.icon ?? Wrench;
                      const accent = pres?.accentColor ?? '#3e63dd';
                      const desc =
                        tool.seoMetadata?.description ??
                        pres?.features[0] ??
                        'Fast, secure file processing.';
                      return (
                        <Link
                          key={tool.slug}
                          href={`/tools/${tool.slug}`}
                          className="tool-directory-card group"
                          style={{ '--tool-accent': accent } as React.CSSProperties}
                        >
                          <div className="tool-directory-topline">
                            <div
                              className="tool-icon-ring h-12 w-12"
                              style={{ background: `${accent}14`, border: `1px solid ${accent}30` }}
                            >
                              <Icon style={{ width: '1.1rem', height: '1.1rem', color: accent }} />
                            </div>
                          </div>
                          <div className="tool-directory-copy">
                            <h3>{pres?.name ?? tool.name}</h3>
                            <p>{desc}</p>
                          </div>
                          <div className="tool-directory-formats">
                            {tool.acceptedFormats.slice(0, 2).map((f) => (
                              <span key={`in-${f}`} className="tool-format-chip">
                                {f}
                              </span>
                            ))}
                            <ArrowRight
                              style={{
                                width: '0.85rem',
                                height: '0.85rem',
                                color: 'var(--text-muted)',
                              }}
                            />
                            {tool.outputFormats.slice(0, 2).map((f) => (
                              <span key={`out-${f}`} className="tool-format-chip">
                                {f}
                              </span>
                            ))}
                          </div>
                          <div className="tool-directory-footer">
                            <span
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                fontSize: '0.72rem',
                                color: 'var(--text-muted)',
                              }}
                            >
                              <Zap
                                style={{ width: '0.8rem', height: '0.8rem', color: '#f59e0b' }}
                              />
                              {tool.anonymousEnabled ? 'Free to try' : 'Account required'}
                            </span>
                            <span
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                color: 'var(--text-accent)',
                              }}
                            >
                              Open tool
                              <ArrowRight
                                style={{
                                  width: '0.85rem',
                                  height: '0.85rem',
                                  transition: 'transform 150ms ease',
                                }}
                                className="group-hover:translate-x-1"
                              />
                            </span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              );
            })
          )}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="hp-cta-section" style={{ paddingTop: 'clamp(3rem,5vw,4.5rem)' }}>
        <div className="container-custom">
          <div className="hp-cta">
            <div>
              <h2>Need more files, history and team access?</h2>
              <p>
                Move to the AppToolkitLab workspace for larger quotas, saved history and business
                controls.
              </p>
            </div>
            <div className="hp-cta-actions">
              <Link href="/register" className="btn btn-lg hp-cta-primary">
                Create free account <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/pricing" className="btn btn-lg hp-cta-secondary">
                Compare plans
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
