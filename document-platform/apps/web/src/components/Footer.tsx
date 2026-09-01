'use client';

import React from 'react';
import Link from 'next/link';
import {
  Zap,
  ShieldCheck,
  ArrowUpRight,
} from 'lucide-react';

const TOOL_LINKS = [
  { name: 'PDF to Word', href: '/tools/pdf-to-docx' },
  { name: 'PDF OCR Extractor', href: '/tools/pdf-ocr' },
  { name: 'URL to PDF', href: '/tools/url-to-pdf' },
  { name: 'URL to Word', href: '/tools/url-to-docx' },
  { name: 'HTML to PDF', href: '/tools/html-to-pdf' },
  { name: 'Markdown to PDF', href: '/tools/markdown-to-pdf' },
  { name: 'Image to PDF', href: '/tools/image-to-pdf' },
  { name: 'Document Studio', href: '/tools/document-editor' },
];

const PRODUCT_LINKS = [
  { name: 'Software Store', href: '/software' },
  { name: 'Automations', href: '/automations' },
  { name: 'CLI Pro Engine', href: '/software/toolsuite-desktop-cli' },
  { name: 'SaaS Boilerplate', href: '/software/nextjs-saas-starter-kit' },
  { name: 'SaaS Platform', href: '/saas' },
  { name: 'Pricing & Plans', href: '/pricing' },
  { name: 'Developer API', href: '/saas#api' },
];

const LEGAL_LINKS = [
  { name: 'Terms of Service', href: '/terms' },
  { name: 'Privacy Policy', href: '/privacy' },
  { name: 'Refund Policy', href: '/refund-policy' },
  { name: 'Security', href: '/about#security' },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      style={{
        backgroundColor: 'var(--bg-card)',
        borderTop: '1px solid var(--border)',
        color: 'var(--text-secondary)',
      }}
    >
      {/* Main footer grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr',
            gap: '3rem',
          }}
        >
          {/* Brand column */}
          <div style={{ maxWidth: '320px' }}>
            <Link href="/" className="flex items-center gap-3 mb-5" style={{ textDecoration: 'none' }}>
              <div
                style={{
                  width: '2.25rem',
                  height: '2.25rem',
                  borderRadius: '10px',
                  background: 'var(--gradient-brand)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'var(--shadow-brand)',
                  flexShrink: 0,
                }}
              >
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div>
                <span
                  className="font-bold text-lg tracking-tight"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Tool<span style={{ color: 'var(--brand-500)' }}>Suite</span>
                </span>
              </div>
            </Link>

            <p
              style={{
                fontSize: '0.875rem',
                lineHeight: '1.7',
                color: 'var(--text-muted)',
                marginBottom: '1.25rem',
              }}
            >
              The complete ecosystem for online file utilities, cloud document
              conversion, SaaS services, and digital software marketplace.
            </p>

            <div className="flex items-center gap-2 mb-6">
              <span
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
                style={{
                  color: '#10b981',
                  backgroundColor: 'rgba(16,185,129,0.1)',
                  border: '1px solid rgba(16,185,129,0.2)',
                }}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Protected conversion pipeline
              </span>
            </div>

          </div>

          {/* Free Tools column */}
          <div>
            <h4
              className="mb-5 font-bold text-xs uppercase tracking-wider"
              style={{ color: 'var(--text-primary)', letterSpacing: '0.09em' }}
            >
              Free Online Tools
            </h4>
            <ul className="space-y-3">
              {TOOL_LINKS.slice(0, 6).map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm transition-colors"
                    style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--brand-500)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/tools"
                  className="text-xs font-semibold flex items-center gap-1"
                  style={{ color: 'var(--brand-500)', textDecoration: 'none' }}
                >
                  View all 8 tools
                  <ArrowUpRight className="w-3 h-3" />
                </Link>
              </li>
            </ul>
          </div>

          {/* Platform column */}
          <div>
            <h4
              className="mb-5 font-bold text-xs uppercase tracking-wider"
              style={{ color: 'var(--text-primary)', letterSpacing: '0.09em' }}
            >
              Platform & Products
            </h4>
            <ul className="space-y-3">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm transition-colors"
                    style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--brand-500)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal column */}
          <div>
            <h4
              className="mb-5 font-bold text-xs uppercase tracking-wider"
              style={{ color: 'var(--text-primary)', letterSpacing: '0.09em' }}
            >
              Legal & Trust
            </h4>
            <ul className="space-y-3">
              {LEGAL_LINKS.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm transition-colors"
                    style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--brand-500)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          © {year} ToolSuite Platform. All rights reserved.
        </p>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          Built with Next.js 16, NestJS & PostgreSQL
        </p>
      </div>
    </footer>
  );
}
