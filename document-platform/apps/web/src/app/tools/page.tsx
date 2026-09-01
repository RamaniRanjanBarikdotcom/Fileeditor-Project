'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Wrench,
  Search,
  ArrowRight,
  Zap,
  Sparkles,
} from 'lucide-react';
import { ToolDto } from '@docconv/shared-types';
import { TOOL_PRESENTATION_MAP } from '../../lib/tools-registry';
import { fetchApi } from '../../lib/api';

const CATEGORIES = ['All', 'Document', 'Web', 'Developer', 'Image', 'Studio'];

export default function ToolsDirectoryPage() {
  const [tools, setTools] = useState<ToolDto[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTools() {
      setLoading(true);
      const res = await fetchApi<ToolDto[]>('/tools');
      if (res.success && res.data) {
        setTools(res.data);
      }
      setLoading(false);
    }
    loadTools();
  }, []);

  const filteredTools = tools.filter((tool) => {
    const matchesCategory =
      selectedCategory === 'All' ||
      tool.category.toLowerCase() === selectedCategory.toLowerCase();
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      tool.name.toLowerCase().includes(q) ||
      tool.slug.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* ─── Page Hero ─── */}
      <section
        className="relative py-20 overflow-hidden"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        {/* Background gradient */}
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(ellipse 70% 60% at 50% 0%, rgba(99,102,241,0.12) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute inset-0 dot-grid opacity-30 dark:opacity-15 -z-10"
          style={{
            maskImage: 'radial-gradient(ellipse 70% 100% at 50% 0%, black 40%, transparent 100%)',
          }}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 mb-5">
            <span className="badge badge-brand">
              <Sparkles className="w-3.5 h-3.5" />
              Server-Authoritative Free Utilities
            </span>
          </div>
          <h1
            className="ts-h1 mb-4"
            style={{ color: 'var(--text-primary)' }}
          >
            Online Document &amp;{' '}
            <span className="gradient-text">File Tools Directory</span>
          </h1>
          <p
            style={{
              fontSize: '1.0625rem',
              color: 'var(--text-secondary)',
              maxWidth: '560px',
              margin: '0 auto',
              lineHeight: '1.7',
            }}
          >
            Fast, browser-accessible conversion engines and OCR extractors.
            No credit card required — 3 free operations per day.
          </p>
        </div>
      </section>

      {/* ─── Filter Bar ─── */}
      <div style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border)', position: 'sticky', top: '64px', zIndex: 30 }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-center gap-4 justify-between">
            {/* Category chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:pb-0 w-full sm:w-auto" style={{ flexShrink: 0 }}>
              {CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className="shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all"
                    style={{
                      backgroundColor: isActive ? 'var(--brand-500)' : 'var(--bg-muted)',
                      color: isActive ? 'white' : 'var(--text-secondary)',
                      border: isActive ? 'none' : '1px solid var(--border)',
                      boxShadow: isActive ? 'var(--shadow-brand)' : 'none',
                    }}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Search input */}
            <div className="relative w-full sm:w-72" style={{ flexShrink: 0 }}>
              <Search
                className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)', pointerEvents: 'none' }}
              />
              <input
                type="text"
                id="tools-search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tools..."
                className="input"
                style={{ paddingLeft: '2.5rem', paddingTop: '0.6rem', paddingBottom: '0.6rem', fontSize: '0.875rem' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Tools Grid ─── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {loading ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '1.25rem',
            }}
          >
            {Array.from({ length: 8 }).map((_, n) => (
              <div
                key={n}
                className="card shimmer-line"
                style={{ height: '220px', opacity: 0.6 }}
              />
            ))}
          </div>
        ) : filteredTools.length === 0 ? (
          <div className="text-center py-20">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'var(--bg-muted)', border: '1px solid var(--border)' }}
            >
              <Wrench className="w-8 h-8" style={{ color: 'var(--text-muted)' }} />
            </div>
            <p
              className="font-bold text-lg mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              No matching tools found
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
              Try clearing your search or selecting a different category.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '1.25rem',
            }}
          >
            {filteredTools.map((tool, idx) => {
              const pres = TOOL_PRESENTATION_MAP[tool.slug] || {
                accentColor: '#6366f1',
                name: tool.name,
                features: ['High-speed conversion'],
              };
              const Icon = pres.icon || Wrench;

              return (
                <Link
                  key={tool.slug}
                  href={`/tools/${tool.slug}`}
                  id={`tool-${tool.slug}`}
                  className="card card-hover group flex flex-col justify-between"
                  style={{
                    padding: '1.5rem',
                    textDecoration: 'none',
                    animationDelay: `${idx * 0.05}s`,
                  }}
                >
                  <div>
                    {/* Icon & Category */}
                    <div className="flex items-start justify-between mb-5">
                      <div
                        className="tool-icon-ring"
                        style={{
                          width: '2.75rem',
                          height: '2.75rem',
                          borderRadius: '12px',
                          backgroundColor: `${pres.accentColor}18`,
                          border: `1px solid ${pres.accentColor}28`,
                        }}
                      >
                        <Icon className="w-5 h-5" style={{ color: pres.accentColor }} />
                      </div>
                      <span
                        className="badge badge-neutral"
                        style={{ fontSize: '0.625rem', letterSpacing: '0.06em' }}
                      >
                        {tool.category}
                      </span>
                    </div>

                    <h3
                      className="font-bold mb-2"
                      style={{
                        fontSize: '0.9375rem',
                        color: 'var(--text-primary)',
                        lineHeight: '1.3',
                      }}
                    >
                      {pres.name || tool.name}
                    </h3>
                    <p
                      style={{
                        fontSize: '0.8125rem',
                        color: 'var(--text-muted)',
                        lineHeight: '1.6',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {tool.seoMetadata?.description || pres.features?.[0] || 'Fast, reliable conversion engine.'}
                    </p>
                  </div>

                  {/* Footer */}
                  <div
                    className="flex items-center justify-between mt-5 pt-4"
                    style={{ borderTop: '1px solid var(--border)' }}
                  >
                    <span
                      className="flex items-center gap-1"
                      style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}
                    >
                      <Zap className="w-3 h-3" style={{ color: '#f59e0b' }} />
                      {tool.anonymousEnabled ? '3 free / day' : 'Account required'}
                    </span>
                    <span
                      className="flex items-center gap-1 font-semibold"
                      style={{ fontSize: '0.8125rem', color: pres.accentColor }}
                    >
                      Open Tool
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
