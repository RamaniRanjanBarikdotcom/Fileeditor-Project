import React from 'react';
import Link from 'next/link';
import { ArrowUpRight, Check, FileCheck2, LockKeyhole, Zap } from 'lucide-react';

const FOOTER_GROUPS = [
  {
    title: 'Popular tools',
    links: [
      { name: 'PDF to Word', href: '/tools/pdf-to-docx' },
      { name: 'PDF to Markdown', href: '/tools/pdf-to-markdown' },
      { name: 'PDF to Images', href: '/tools/pdf-to-images' },
      { name: 'PDF OCR Extractor', href: '/tools/pdf-ocr' },
      { name: 'URL to PDF', href: '/tools/url-to-pdf' },
      { name: 'URL to Word', href: '/tools/url-to-docx' },
      { name: 'All free tools', href: '/tools', featured: true },
    ],
  },
  {
    title: 'Products',
    links: [
      { name: 'Software store', href: '/software' },
      { name: 'Automations', href: '/automations' },
      { name: 'SaaS platform', href: '/saas' },
      { name: 'Plans and pricing', href: '/pricing' },
      { name: 'Customer workspace', href: '/app', featured: true },
    ],
  },
  {
    title: 'Resources',
    links: [
      { name: 'About AppToolkitLab', href: '/about' },
      { name: 'Blog & guides', href: '/blog' },
      { name: 'Help & FAQ', href: '/faq' },
      { name: 'Contact support', href: '/contact' },
      { name: 'Policy center', href: '/policies', featured: true },
    ],
  },
  {
    title: 'Legal',
    links: [
      { name: 'Privacy policy', href: '/privacy' },
      { name: 'Data protection', href: '/data-policy' },
      { name: 'Terms of service', href: '/terms' },
      { name: 'Refund policy', href: '/refund-policy' },
      { name: 'Security approach', href: '/about#security' },
    ],
  },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container-custom">
        <div className="site-footer-grid">
          <div className="site-footer-brand-column">
            <Link href="/" className="site-footer-brand" aria-label="AppToolkitLab home">
              <span className="site-footer-brand-mark">
                <Zap className="h-4 w-4 text-white" />
              </span>
              <span>
                <span
                  className="block text-lg font-extrabold leading-none tracking-tight"
                  style={{ color: 'var(--text-primary)' }}
                >
                  AppToolkit<span style={{ color: 'var(--brand-500)' }}>Lab</span>
                </span>
                <span
                  className="mt-1 block text-[0.58rem] font-bold uppercase tracking-[0.16em]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Digital tools platform
                </span>
              </span>
            </Link>

            <p className="site-footer-description">
              A unified platform for document conversion, public web capture, cloud software, and
              practical automation tools.
            </p>

            <div className="site-footer-trust-list">
              <span>
                <LockKeyhole className="h-3.5 w-3.5" />
                Controlled file access
              </span>
              <span>
                <FileCheck2 className="h-3.5 w-3.5" />
                Isolated conversion workers
              </span>
            </div>
          </div>

          {FOOTER_GROUPS.map((group) => (
            <nav
              key={group.title}
              className="site-footer-group"
              aria-label={`${group.title} links`}
            >
              <h3>{group.title}</h3>
              <ul>
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={link.featured ? 'site-footer-link-featured' : undefined}
                    >
                      {link.featured && <Check className="h-3.5 w-3.5" />}
                      {link.name}
                      {link.featured && <ArrowUpRight className="h-3 w-3" />}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="site-footer-bottom">
          <p>
            © {year}{' '}
            <a href="https://apptoolkitlab.com/" target="_blank" rel="noreferrer">
              AppToolkitLab
            </a>
            . A{' '}
            <a href="https://www.gonexel.com/" target="_blank" rel="noreferrer">
              Gonexel
            </a>{' '}
            product. All rights reserved.
          </p>
          <div className="site-footer-bottom-links">
            <span className="site-footer-status">
              <span aria-hidden="true" />
              Secure processing
            </span>
            <Link href="/privacy">Privacy</Link>
            <Link href="/data-policy">Data policy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/refund-policy">Refunds</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
