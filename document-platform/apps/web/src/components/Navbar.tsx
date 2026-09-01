'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Wrench,
  Sparkles,
  ShoppingBag,
  Layers,
  Bot,
  CreditCard,
  Menu,
  X,
  Sun,
  Moon,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { useTheme } from '../lib/ThemeContext';
import { fetchApi } from '../lib/api';

export function Navbar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 16);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    let active = true;
    void fetchApi('/auth/me').then((response) => {
      if (active) setIsLoggedIn(response.success);
    });
    return () => { active = false; };
  }, [pathname]);

  const navLinks = [
    { name: 'Free Tools', href: '/tools', icon: Wrench },
    { name: 'Software Store', href: '/software', icon: ShoppingBag },
    { name: 'Automations', href: '/automations', icon: Bot },
    { name: 'SaaS Platform', href: '/saas', icon: Layers },
    { name: 'Pricing', href: '/pricing', icon: CreditCard },
  ];

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        backgroundColor: isScrolled ? 'rgba(var(--bg-card-rgb, 255,255,255), 0.85)' : 'transparent',
        backdropFilter: isScrolled ? 'blur(20px) saturate(1.8)' : 'none',
        WebkitBackdropFilter: isScrolled ? 'blur(20px) saturate(1.8)' : 'none',
        borderBottom: isScrolled ? '1px solid var(--border)' : '1px solid transparent',
        boxShadow: isScrolled ? 'var(--shadow-sm)' : 'none',
      }}
    >
      {/* Scrolled backdrop for dark mode */}
      {isScrolled && (
        <div
          className="absolute inset-0 -z-10"
          style={{
            backgroundColor: 'var(--bg)',
            opacity: 0.85,
          }}
        />
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-3 group" id="nav-logo">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
              style={{
                background: 'var(--gradient-brand)',
                boxShadow: 'var(--shadow-brand)',
                transition: 'transform 0.2s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08) rotate(-3deg)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1) rotate(0deg)')}
            >
              <Zap className="w-4.5 h-4.5 text-white" style={{ width: '1.125rem', height: '1.125rem' }} />
            </div>
            <div className="flex flex-col leading-none">
              <span
                className="font-bold text-[1.1rem] tracking-tight"
                style={{ color: 'var(--text-primary)' }}
              >
                Tool<span style={{ color: 'var(--brand-500)' }}>Suite</span>
              </span>
              <span
                className="text-[9px] font-bold tracking-widest uppercase mt-0.5"
                style={{ color: 'var(--text-muted)' }}
              >
                SaaS & Tools Hub
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-0.5">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href || pathname?.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium"
                  style={{
                    color: isActive ? 'var(--brand-500)' : 'var(--text-secondary)',
                    backgroundColor: isActive ? 'rgba(99,102,241,0.08)' : 'transparent',
                    fontWeight: isActive ? 600 : 500,
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'var(--bg-muted)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }
                  }}
                >
                  <Icon className="w-4 h-4 opacity-75" />
                  {link.name}
                </Link>
              );
            })}
          </nav>

          {/* Actions */}
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={toggleTheme}
              id="theme-toggle"
              className="p-2 rounded-xl transition-all focus-ring"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-muted)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {isLoggedIn ? (
              <Link
                href="/app"
                id="nav-workspace-btn"
                className="btn btn-primary btn-sm"
              >
                <span>Workspace</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  id="nav-signin-btn"
                  className="px-3.5 py-2 text-sm font-medium rounded-xl transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-muted)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  id="nav-getstarted-btn"
                  className="btn btn-primary btn-sm"
                >
                  Get Started Free
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Toggle */}
          <div className="flex items-center gap-1.5 md:hidden">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl"
              style={{ color: 'var(--text-muted)' }}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl"
              style={{ color: 'var(--text-primary)' }}
              aria-label="Open Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div
          className="md:hidden px-4 pt-3 pb-6 space-y-1"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderBottom: '1px solid var(--border)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.name}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium"
                style={{
                  backgroundColor: isActive ? 'rgba(99,102,241,0.08)' : 'transparent',
                  color: isActive ? 'var(--brand-500)' : 'var(--text-secondary)',
                }}
              >
                <Icon className="w-4 h-4" style={{ color: 'var(--brand-500)' }} />
                {link.name}
              </Link>
            );
          })}

          <div className="pt-3 flex flex-col gap-2" style={{ borderTop: '1px solid var(--border)' }}>
            {isLoggedIn ? (
              <Link
                href="/app"
                onClick={() => setMobileMenuOpen(false)}
                className="btn btn-primary w-full"
                style={{ justifyContent: 'center' }}
              >
                Go to Workspace
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn btn-secondary w-full"
                  style={{ justifyContent: 'center' }}
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn btn-primary w-full"
                  style={{ justifyContent: 'center' }}
                >
                  Get Started Free
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
