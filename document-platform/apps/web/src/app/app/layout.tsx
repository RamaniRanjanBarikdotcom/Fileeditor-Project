'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  FileText,
  Clock,
  Settings,
  LogOut,
  ArrowLeftRight,
  Edit,
  Sun,
  Moon,
  ChevronRight,
  ShoppingBag,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useTheme } from '../../lib/ThemeContext';
import { fetchApi, setAccessToken } from '../../lib/api';

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
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
    },
    {
      name: 'Account Settings',
      path: '/app/settings',
      icon: Settings,
      description: 'Preferences & API keys',
    },
  ];

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-white dark:bg-slate-950 font-sans">
      {/* Workspace Sidebar */}
      <aside className="w-64 min-w-64 flex flex-col bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
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
              Free Plan (Active)
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 py-2">
            Workspace Tools
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.name}
                href={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
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

          <div className="pt-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 py-2">
            Marketplace & Store
          </div>
          <Link
            href="/software"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800"
          >
            <ShoppingBag className="w-4 h-4 text-indigo-500" />
            <span>Software Store</span>
          </Link>
        </nav>

        {/* User Card & Logout */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
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

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-950 p-6 md:p-8">
        {children}
      </main>
    </div>
  );
}
