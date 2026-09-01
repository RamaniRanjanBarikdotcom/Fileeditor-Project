'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Check, ChevronRight, Cloud, FileOutput, LockKeyhole,
  Search, ShieldCheck, Sparkles, WandSparkles, Wrench, Zap,
} from 'lucide-react';
import { ToolDto } from '@docconv/shared-types';
import { TOOL_PRESENTATION_MAP } from '../../lib/tools-registry';
import { fetchApi } from '../../lib/api';

type DirectoryTool = Pick<ToolDto, 'slug' | 'name' | 'category' | 'anonymousEnabled' | 'acceptedFormats' | 'outputFormats' | 'seoMetadata'>;

const CATEGORY_BY_SLUG: Record<string, string> = {
  'pdf-to-docx': 'Document', 'pdf-ocr': 'Document', 'url-to-pdf': 'Web',
  'url-to-docx': 'Web', 'html-to-pdf': 'Developer', 'markdown-to-pdf': 'Developer',
  'image-to-pdf': 'Image', 'document-editor': 'Studio',
};

const FORMAT_BY_SLUG: Record<string, { input: string[]; output: string[] }> = {
  'pdf-to-docx': { input: ['PDF'], output: ['DOCX'] },
  'pdf-ocr': { input: ['PDF'], output: ['TXT'] },
  'url-to-pdf': { input: ['URL'], output: ['PDF'] },
  'url-to-docx': { input: ['URL'], output: ['DOCX'] },
  'html-to-pdf': { input: ['HTML', 'CSS'], output: ['PDF'] },
  'markdown-to-pdf': { input: ['MD'], output: ['PDF'] },
  'image-to-pdf': { input: ['JPG', 'PNG'], output: ['PDF'] },
  'document-editor': { input: ['TEXT'], output: ['PDF', 'DOCX'] },
};

const FALLBACK_TOOLS: DirectoryTool[] = Object.values(TOOL_PRESENTATION_MAP).map((tool) => ({
  slug: tool.slug,
  name: tool.name,
  category: CATEGORY_BY_SLUG[tool.slug] ?? 'Document',
  anonymousEnabled: true,
  acceptedFormats: FORMAT_BY_SLUG[tool.slug]?.input ?? [],
  outputFormats: FORMAT_BY_SLUG[tool.slug]?.output ?? [],
  seoMetadata: { description: tool.features[0] },
}));

const CATEGORIES = ['All', 'Document', 'Web', 'Developer', 'Image', 'Studio'];
const BENEFITS = [
  { icon: WandSparkles, title: 'Choose the right tool', description: 'Select a utility built for your exact source and output format.' },
  { icon: ShieldCheck, title: 'Process securely', description: 'Your job runs through isolated storage and a purpose-built conversion engine.' },
  { icon: Cloud, title: 'Download the result', description: 'Get the finished file in your browser without installing any software.' },
];

export default function ToolsDirectoryPage() {
  const [tools, setTools] = useState<DirectoryTool[]>(FALLBACK_TOOLS);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [syncing, setSyncing] = useState(true);

  useEffect(() => {
    let active = true;
    void fetchApi<ToolDto[]>('/tools').then((res) => {
      if (!active) return;
      if (res.success && res.data?.length) setTools(res.data);
      setSyncing(false);
    });
    return () => { active = false; };
  }, []);

  const filteredTools = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return tools.filter((tool) => {
      const matchesCategory = selectedCategory === 'All' || tool.category.toLowerCase() === selectedCategory.toLowerCase();
      const searchableText = [tool.name, tool.slug, tool.category, tool.seoMetadata?.description, ...tool.acceptedFormats, ...tool.outputFormats]
        .filter(Boolean).join(' ').toLowerCase();
      return matchesCategory && (!query || searchableText.includes(query));
    });
  }, [searchQuery, selectedCategory, tools]);

  return (
    <div className="min-h-screen">
      <section className="tools-hero relative overflow-hidden">
        <div className="mesh-bg" />
        <div className="absolute inset-0 dot-grid opacity-30 dark:opacity-15" />
        <div className="absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full blur-3xl" style={{ background: 'rgba(99,102,241,0.16)' }} />
        <div className="container-custom relative z-10">
          <div className="tools-hero-content">
            <div className="tools-breadcrumb">
              <Link href="/" className="transition-colors hover:text-indigo-500">Home</Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <span style={{ color: 'var(--text-secondary)' }}>Free tools</span>
            </div>
            <span className="badge badge-brand tools-hero-badge"><Sparkles className="h-3.5 w-3.5" />8 tools available now</span>
            <h1 className="ts-h1 tools-hero-title" style={{ color: 'var(--text-primary)' }}>
              Every document tool you need, <span className="gradient-text">in one clean workspace</span>
            </h1>
            <p className="tools-hero-description">
              Convert PDFs, capture complete webpages with Chromium, extract scanned text, and create polished files without installing software.
            </p>
            <div className="tools-search-shell">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input type="search" id="tools-search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="What do you want to convert? Try “URL to PDF”" className="tools-search-input" aria-label="Search all tools" />
              </div>
            </div>
            <div className="tools-trust-row">
              {['No installation', '3 free jobs each day', 'Secure file handling'].map((label) => (
                <span key={label} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}><Check className="h-3 w-3" /></span>{label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="tools-directory-section">
        <div className="container-custom">
          <div className="tools-filter-panel">
            <div>
              <p className="section-label">Explore the collection</p>
              <h2>Choose a tool and start immediately</h2>
            </div>
            <div className="tools-category-list" role="group" aria-label="Filter tools by category">
              {CATEGORIES.map((category) => {
                const isActive = selectedCategory === category;
                return <button key={category} type="button" onClick={() => setSelectedCategory(category)}
                  className={`tools-category-button focus-ring${isActive ? ' tools-category-button-active' : ''}`}
                  style={{ background: isActive ? 'var(--gradient-brand)' : 'var(--bg-muted)', color: isActive ? '#fff' : 'var(--text-secondary)', border: isActive ? '1px solid transparent' : '1px solid var(--border)', boxShadow: isActive ? 'var(--shadow-brand)' : 'none' }}>
                  {category}
                </button>;
              })}
            </div>
          </div>

          <div className="tools-results-bar">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}><strong style={{ color: 'var(--text-primary)' }}>{filteredTools.length}</strong> {filteredTools.length === 1 ? 'tool' : 'tools'} found</p>
            {syncing && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Syncing availability…</span>}
          </div>

          {filteredTools.length === 0 ? (
            <div className="card px-6 py-16 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'var(--bg-muted)', border: '1px solid var(--border)' }}><Wrench className="h-7 w-7" style={{ color: 'var(--text-muted)' }} /></div>
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>No matching tool</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6" style={{ color: 'var(--text-muted)' }}>Try another format or reset the category to see the complete collection.</p>
              <button type="button" className="btn btn-secondary btn-sm mt-5" onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}>Show all tools</button>
            </div>
          ) : (
            <div className="tools-card-grid">
              {filteredTools.map((tool) => {
                const presentation = TOOL_PRESENTATION_MAP[tool.slug];
                const Icon = presentation?.icon ?? Wrench;
                const accent = presentation?.accentColor ?? '#6366f1';
                const description = tool.seoMetadata?.description ?? presentation?.features[0] ?? 'Fast, secure file processing in your browser.';
                return (
                  <Link key={tool.slug} href={`/tools/${tool.slug}`} id={`tool-${tool.slug}`} className="tool-directory-card group" style={{ '--tool-accent': accent } as React.CSSProperties}>
                    <div className="tool-directory-topline">
                      <div className="tool-icon-ring h-12 w-12" style={{ background: `${accent}14`, border: `1px solid ${accent}30` }}><Icon className="h-5 w-5" style={{ color: accent }} /></div>
                      <span className="badge badge-neutral">{tool.category}</span>
                    </div>
                    <div className="tool-directory-copy">
                      <h3>{presentation?.name ?? tool.name}</h3>
                      <p>{description}</p>
                    </div>
                    <div className="tool-directory-formats">
                      {tool.acceptedFormats.slice(0, 2).map((format) => <span key={`in-${format}`} className="tool-format-chip">{format}</span>)}
                      <ArrowRight className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                      {tool.outputFormats.slice(0, 2).map((format) => <span key={`out-${format}`} className="tool-format-chip">{format}</span>)}
                    </div>
                    <div className="tool-directory-footer">
                      <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: 'var(--text-muted)' }}><Zap className="h-3.5 w-3.5" style={{ color: '#f59e0b' }} />{tool.anonymousEnabled ? 'Free to try' : 'Account required'}</span>
                      <span className="flex items-center gap-1.5 text-sm font-bold" style={{ color: accent }}>Open tool<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="tools-workflow-section">
        <div className="container-custom">
          <div className="tools-workflow-heading">
            <p className="section-label">A simple workflow</p>
            <h2 className="ts-h2" style={{ color: 'var(--text-primary)' }}>From source to finished file in three steps</h2>
            <p>Every utility shares one clear experience while using the best engine for its format.</p>
          </div>
          <div className="tools-benefit-grid">
            {BENEFITS.map(({ icon: Icon, title, description }, index) => (
              <article key={title} className="tools-benefit-card">
                <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'var(--gradient-brand-subtle)', color: 'var(--brand-500)', border: '1px solid rgba(99,102,241,0.2)' }}><Icon className="h-5 w-5" /></div>
                <p className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--brand-500)' }}>Step {index + 1}</p>
                <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
                <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-muted)' }}>{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="tools-upgrade-section">
        <div className="container-custom">
          <div className="tools-cta relative overflow-hidden">
            <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="tools-cta-copy relative z-10">
              <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white"><LockKeyhole className="h-3.5 w-3.5" />Workspace plans</span>
              <h2 className="text-2xl font-extrabold leading-tight text-white sm:text-3xl lg:text-4xl">Need more files, history, and team access?</h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-white/80 sm:text-base">Move from free utilities to the complete AppToolkitLab workspace with larger quotas, persistent history, purchased software, and business controls.</p>
              <div className="tools-cta-actions">
                <Link href="/register" className="btn bg-white px-6 py-3 font-bold text-indigo-700 hover:-translate-y-0.5">Create free account<ArrowRight className="h-4 w-4" /></Link>
                <Link href="/pricing" className="btn border border-white/25 bg-white/10 px-6 py-3 font-bold text-white hover:bg-white/15"><FileOutput className="h-4 w-4" />Compare plans</Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
