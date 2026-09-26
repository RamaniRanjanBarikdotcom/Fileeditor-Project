'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Clock,
  Settings,
  LogOut,
  ArrowLeftRight,
  Edit,
  ShoppingBag,
  Sparkles,
  Wrench,
  Bot,
  BrainCircuit,
  PenTool,
  CreditCard,
} from 'lucide-react';
import { fetchApi, setAccessToken, restoreAccessToken } from '../../lib/api';
import { useFeatureFlags } from '../../lib/use-feature-flags';

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const featureFlags = useFeatureFlags();

  useEffect(() => {
    async function checkAuth() {
      // Restore the access token from sessionStorage or the HttpOnly refresh
      // cookie before hitting /auth/me. This keeps the user logged in across
      // page refreshes, tab duplications, and Blog Studio navigations.
      await restoreAccessToken();

      const res = await fetchApi<{ id: string; email: string; firstName?: string }>('/auth/me');
      if (res.success && res.data) {
        setUser(res.data);
      } else {
        router.push('/login');
      }
      setLoading(false);
    }
    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    await fetchApi('/auth/logout', { method: 'POST' });
    setAccessToken(null);
    router.push('/login');
  };

  const navItems = [
    {
      name: 'Blog Studio',
      path: '/app/blog-studio',
      icon: PenTool,
      description: 'Research, write, optimize & export',
      enabled: featureFlags.blogStudio,
    },
    {
      name: 'AI Assistant',
      path: '/app/assistant',
      icon: Bot,
      description: 'Project-aware conversations',
    },
    {
      name: 'Project Memory',
      path: '/app/memory',
      icon: BrainCircuit,
      description: 'Inspect and control AI memory',
    },
    {
      name: 'All Tools',
      path: '/app/tools',
      icon: Wrench,
      description: 'Browse every available tool',
    },
    {
      name: 'Converter',
      path: '/app',
      icon: ArrowLeftRight,
      description: 'Universal file converter',
    },
    {
      name: 'Document Studio',
      path: '/app/editor',
      icon: Edit,
      description: 'Rich document exporter',
    },
    { name: 'History', path: '/app/history', icon: Clock, description: 'Past conversions & files' },
    {
      name: 'My Software Library',
      path: '/app/library',
      icon: ShoppingBag,
      description: 'Purchased software & keys',
      enabled: featureFlags.storeCheckout,
    },
    {
      name: 'Billing',
      path: '/app/billing',
      icon: CreditCard,
      description: 'Plans and SaaS entitlements',
      enabled: featureFlags.subscriptionsEnabled || featureFlags.blogStudio,
    },
    {
      name: 'Account Settings',
      path: '/app/settings',
      icon: Settings,
      description: 'Preferences & API keys',
    },
  ].filter((item) => item.enabled !== false);

  if (loading) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-white dark:bg-slate-950">
        <div
          className="flex items-center gap-3 text-sm font-medium text-slate-500 dark:text-slate-400"
          role="status"
        >
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          Opening your workspace…
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col bg-white font-sans dark:bg-slate-950 lg:h-[calc(100dvh-4rem)] lg:flex-row">
      {/* Workspace Sidebar - Hidden in Blog Studio for isolated workspace feel */}
      {!pathname.startsWith('/app/blog-studio') && (
        <aside className="flex w-full flex-col border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900 lg:w-64 lg:min-w-64 lg:border-b-0 lg:border-r">
          {/* Workspace Brand / Org Header */}
          <div className="h-16 flex items-center px-5 border-b border-slate-200 dark:border-slate-800 gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {user?.firstName ? `${user.firstName}'s Workspace` : 'AppToolkitLab Workspace'}
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                {user?.platformRole === 'ADMIN'
                  ? 'Administrator · Unlimited access'
                  : `${user?.memberships?.[0]?.organization?.subscriptions?.[0]?.plan?.name || user?.memberships?.[0]?.organization?.plan?.name || 'Free Starter'} (Active)`}
              </span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex gap-2 overflow-x-auto p-2 lg:flex-1 lg:flex-col lg:gap-0 lg:space-y-1 lg:overflow-y-auto lg:p-3">
            <div className="hidden text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 py-2 lg:block">
              Workspace Tools
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.path || pathname.startsWith(`${item.path}/`);
              const isBlogStudio = item.path === '/app/blog-studio';

              return (
                <Link
                  key={item.name}
                  href={item.path}
                  className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium transition-all lg:gap-3 ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20 font-semibold'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <div className="flex flex-col">
                    <span>{item.name}</span>
                  </div>
                </Link>
              );
            })}

            {featureFlags.storeCheckout && (
              <>
                <div className="hidden pt-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 py-2 lg:block">
                  Marketplace & Store
                </div>
                <Link
                  href="/software"
                  className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800 lg:gap-3"
                >
                  <ShoppingBag className="w-4 h-4 text-indigo-500" />
                  <span>Software Store</span>
                </Link>
              </>
            )}
          </nav>

          {/* User Card & Logout */}
          <div className="hidden items-center justify-between border-t border-slate-200 p-3 dark:border-slate-800 lg:flex">
            <div className="flex flex-col overflow-hidden">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                {user?.email || 'Authenticated User'}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <section className={`min-w-0 flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-950 ${pathname.startsWith('/app/blog-studio') ? '' : 'p-4 sm:p-6 md:p-8'}`}>
        {children}
      </section>
    </div>
  );
}
