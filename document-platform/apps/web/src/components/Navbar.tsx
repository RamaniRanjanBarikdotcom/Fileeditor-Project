'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Moon, Sun, X, Zap, ArrowRight } from 'lucide-react';
import { useTheme } from '../lib/ThemeContext';
import { fetchApi } from '../lib/api';

const NAV_LINKS = [
  { name: 'Tools', href: '/tools' },
  { name: 'Software', href: '/software' },
  { name: 'Automations', href: '/automations' },
  { name: 'SaaS', href: '/saas' },
  { name: 'Pricing', href: '/pricing' },
];

export function Navbar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    let alive = true;
    void fetchApi('/auth/me').then((r) => { if (alive) setLoggedIn(r.success); });
    return () => { alive = false; };
  }, [pathname]);

  const active = (href: string) => pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <header
      style={{
        position: 'fixed',
        inset: '0 0 auto',
        zIndex: 50,
        height: '4rem',
        transition: 'background 200ms ease, box-shadow 200ms ease, border-color 200ms ease',
        background: scrolled || open
          ? 'color-mix(in srgb, var(--bg-card) 94%, transparent)'
          : 'color-mix(in srgb, var(--bg-card) 70%, transparent)',
        backdropFilter: 'blur(20px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.6)',
        borderBottom: `1px solid ${scrolled || open ? 'var(--border)' : 'color-mix(in srgb, var(--border) 50%, transparent)'}`,
        boxShadow: scrolled ? 'var(--shadow-sm)' : 'none',
      }}
    >
      <div className="container-custom h-full flex items-center justify-between gap-6">

        {/* Brand */}
        <Link href="/" aria-label="AppToolkitLab home" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '2rem', height: '2rem', borderRadius: '0.6rem',
            background: 'var(--gradient-brand)',
            boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
            flexShrink: 0,
          }}>
            <Zap style={{ width: '1rem', height: '1rem', color: '#fff' }} />
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              AppToolkit<span style={{ color: 'var(--brand-500)' }}>Lab</span>
            </span>
            <span className="hidden sm:block" style={{ fontSize: '0.52rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: '2px' }}>
              by Gonexel
            </span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden xl:flex items-center" style={{
          gap: '0.15rem',
          padding: '0.2rem',
          background: 'color-mix(in srgb, var(--bg-muted) 70%, transparent)',
          border: '1px solid var(--border)',
          borderRadius: '0.8rem',
        }}>
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} style={{
              padding: '0.45rem 0.85rem',
              fontSize: '0.8rem',
              fontWeight: active(link.href) ? 700 : 600,
              borderRadius: '0.55rem',
              textDecoration: 'none',
              transition: 'all 150ms ease',
              color: active(link.href) ? 'var(--brand-600)' : 'var(--text-secondary)',
              background: active(link.href) ? 'var(--bg-card)' : 'transparent',
              boxShadow: active(link.href) ? 'var(--shadow-xs)' : 'none',
            }}>
              {link.name}
            </Link>
          ))}
        </nav>

        {/* Desktop actions */}
        <div className="hidden xl:flex items-center gap-2" style={{ flexShrink: 0 }}>
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '2rem', height: '2rem', borderRadius: '0.55rem',
              background: 'transparent', border: '1px solid transparent',
              color: 'var(--text-muted)', cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.borderColor = 'transparent'; }}
          >
            {theme === 'dark' ? <Sun style={{ width: '0.9rem', height: '0.9rem' }} /> : <Moon style={{ width: '0.9rem', height: '0.9rem' }} />}
          </button>

          <div style={{ width: '1px', height: '1.25rem', background: 'var(--border)' }} />

          {loggedIn ? (
            <Link href="/app" style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.45rem 1rem', borderRadius: '0.6rem',
              background: 'var(--gradient-brand)', color: '#fff',
              fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none',
              boxShadow: 'var(--shadow-brand)',
            }}>
              Workspace <ArrowRight style={{ width: '0.8rem', height: '0.8rem' }} />
            </Link>
          ) : (
            <>
              <Link href="/login" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'none', padding: '0.45rem 0.5rem' }}>
                Sign in
              </Link>
              <Link href="/register" style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.45rem 1rem', borderRadius: '0.6rem',
                background: 'var(--gradient-brand)', color: '#fff',
                fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none',
                boxShadow: 'var(--shadow-brand)',
              }}>
                Start free
              </Link>
            </>
          )}
        </div>

        {/* Mobile actions */}
        <div className="flex xl:hidden items-center gap-1.5">
          <button onClick={toggleTheme} aria-label="Toggle theme" style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '2rem', height: '2rem', borderRadius: '0.55rem',
            background: 'var(--bg-muted)', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', cursor: 'pointer',
          }}>
            {theme === 'dark' ? <Sun style={{ width: '0.9rem', height: '0.9rem' }} /> : <Moon style={{ width: '0.9rem', height: '0.9rem' }} />}
          </button>
          <button
            onClick={() => setOpen(o => !o)}
            aria-label="Toggle menu"
            aria-expanded={open}
            aria-controls="mobile-site-menu"
            style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '2rem', height: '2rem', borderRadius: '0.55rem',
            background: 'var(--bg-muted)', border: '1px solid var(--border)',
            color: 'var(--text-primary)', cursor: 'pointer',
          }}>
            {open ? <X style={{ width: '1rem', height: '1rem' }} /> : <Menu style={{ width: '1rem', height: '1rem' }} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div id="mobile-site-menu" style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          background: 'color-mix(in srgb, var(--bg-card) 98%, transparent)',
          borderBottom: '1px solid var(--border)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          boxShadow: 'var(--shadow-lg)',
          animation: 'fadeUp 180ms ease both',
        }}>
          <div className="container-custom py-4">
            <nav style={{ display: 'grid', gap: '0.25rem' }}>
              {NAV_LINKS.map((link) => (
                <Link key={link.href} href={link.href} onClick={() => setOpen(false)} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.7rem 0.85rem', borderRadius: '0.7rem',
                  fontSize: '0.9rem', fontWeight: 600, textDecoration: 'none',
                  color: active(link.href) ? 'var(--brand-500)' : 'var(--text-secondary)',
                  background: active(link.href) ? 'rgba(99,102,241,0.08)' : 'transparent',
                }}>
                  {link.name}
                  <ArrowRight style={{ width: '0.85rem', height: '0.85rem', opacity: 0.4 }} />
                </Link>
              ))}
            </nav>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              {loggedIn ? (
                <Link href="/app" onClick={() => setOpen(false)} className="btn btn-primary" style={{ gridColumn: '1/-1', justifyContent: 'center' }}>
                  Go to workspace <ArrowRight style={{ width: '0.9rem', height: '0.9rem' }} />
                </Link>
              ) : (
                <>
                  <Link href="/login" onClick={() => setOpen(false)} className="btn btn-secondary" style={{ justifyContent: 'center' }}>Sign in</Link>
                  <Link href="/register" onClick={() => setOpen(false)} className="btn btn-primary" style={{ justifyContent: 'center' }}>
                    Start free <ArrowRight style={{ width: '0.9rem', height: '0.9rem' }} />
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
