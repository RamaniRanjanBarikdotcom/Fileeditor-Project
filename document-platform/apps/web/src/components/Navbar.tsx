'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowRight,
  Bot,
  CreditCard,
  Layers,
  Menu,
  Moon,
  ShoppingBag,
  Sun,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { useTheme } from '../lib/ThemeContext';
import { fetchApi } from '../lib/api';

const NAV_LINKS = [
  { name: 'Free Tools', href: '/tools', icon: Wrench },
  { name: 'Software', href: '/software', icon: ShoppingBag },
  { name: 'Automations', href: '/automations', icon: Bot },
  { name: 'SaaS', href: '/saas', icon: Layers },
  { name: 'Pricing', href: '/pricing', icon: CreditCard },
];

export function Navbar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 8);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    let active = true;
    void fetchApi('/auth/me').then((response) => {
      if (active) setIsLoggedIn(response.success);
    });
    return () => {
      active = false;
    };
  }, [pathname]);

  const isActive = (href: string) => pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <header className={`site-header${isScrolled || mobileMenuOpen ? ' site-header-elevated' : ''}`}>
      <div className="container-custom h-full">
        <div className="site-header-grid">
          <Link href="/" className="site-brand group" id="nav-logo" aria-label="AppToolkitLab home">
            <span className="site-brand-mark" aria-hidden="true">
              <Zap className="h-[1.1rem] w-[1.1rem] text-white" />
            </span>
            <span className="min-w-0">
              <span
                className="block text-[1.08rem] font-extrabold leading-none tracking-[-0.025em]"
                style={{ color: 'var(--text-primary)' }}
              >
                AppToolkit<span style={{ color: 'var(--brand-500)' }}>Lab</span>
              </span>
              <span
                className="mt-1 hidden text-[0.58rem] font-bold uppercase leading-none tracking-[0.16em] sm:block"
                style={{ color: 'var(--text-muted)' }}
              >
                Digital tools platform
              </span>
            </span>
          </Link>

          <nav className="site-desktop-nav" aria-label="Primary navigation">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`site-nav-link${isActive(link.href) ? ' site-nav-link-active' : ''}`}
                aria-current={isActive(link.href) ? 'page' : undefined}
              >
                {link.name}
              </Link>
            ))}
          </nav>

          <div className="site-desktop-actions">
            <button
              type="button"
              onClick={toggleTheme}
              id="theme-toggle"
              className="site-icon-button focus-ring"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <span className="site-action-divider" aria-hidden="true" />

            {isLoggedIn ? (
              <Link href="/app" id="nav-workspace-btn" className="btn btn-primary btn-sm">
                Workspace <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <>
                <Link href="/login" id="nav-signin-btn" className="site-sign-in">
                  Sign in
                </Link>
                <Link href="/register" id="nav-getstarted-btn" className="btn btn-primary btn-sm">
                  Start free
                </Link>
              </>
            )}
          </div>

          <div className="site-mobile-actions">
            <button
              type="button"
              onClick={toggleTheme}
              className="site-icon-button focus-ring"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="site-menu-button focus-ring"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div id="mobile-navigation" className="site-mobile-menu lg:hidden">
          <div className="container-custom py-4">
            <nav className="grid gap-1" aria-label="Mobile navigation">
              {NAV_LINKS.map((link) => {
                const Icon = link.icon;
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`site-mobile-link${active ? ' site-mobile-link-active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    <span className="site-mobile-link-icon">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="flex-1">{link.name}</span>
                    <ArrowRight className="h-4 w-4 opacity-45" />
                  </Link>
                );
              })}
            </nav>

            <div
              className="mt-4 grid gap-2 border-t pt-4 sm:grid-cols-2"
              style={{ borderColor: 'var(--border)' }}
            >
              {isLoggedIn ? (
                <Link href="/app" className="btn btn-primary w-full">
                  Go to workspace <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <>
                  <Link href="/login" className="btn btn-secondary w-full">
                    Sign in
                  </Link>
                  <Link href="/register" className="btn btn-primary w-full">
                    Create free account <ArrowRight className="h-4 w-4" />
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
