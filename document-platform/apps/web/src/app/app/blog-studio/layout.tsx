'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LockKeyhole, 
  LayoutDashboard, 
  PenTool, 
  History, 
  Send, 
  Calendar, 
  ShoppingBag, 
  Image as ImageIcon, 
  BarChart2, 
  Activity, 
  Settings,
  ArrowLeft
} from 'lucide-react';
import { useFeatureFlags } from '../../../lib/use-feature-flags';

export default function BlogStudioLayout({ children }: { children: React.ReactNode }) {
  const flags = useFeatureFlags();
  const pathname = usePathname();

  if (!flags.blogStudio) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <LockKeyhole className="mx-auto h-9 w-9 text-slate-400" />
          <h1 className="mt-5 text-2xl font-black text-slate-950 dark:text-white">
            Blog Studio is unavailable
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            This workspace has not enabled Blog Studio. No generation or checkout actions are exposed
            while the feature is disabled.
          </p>
          <Link
            href="/app"
            className="mt-6 inline-flex rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-700"
          >
            Return to workspace
          </Link>
        </div>
      </div>
    );
  }

  const navItems = [
    { name: 'Overview', path: '/app/blog-studio', icon: LayoutDashboard, enabled: true },
    { name: 'Generator', path: '/app/blog-studio/new', icon: PenTool, enabled: true },
    { name: 'History', path: '/app/blog-studio/history', icon: History, enabled: true },
    { name: 'Published', path: '/app/blog-studio/posts', icon: Send, enabled: flags.blogStudioPublishing },
    { name: 'Scheduler', path: '/app/blog-studio/scheduler', icon: Calendar, enabled: flags.blogStudioScheduler },
    { name: 'Products Context', path: '/app/blog-studio/products', icon: ShoppingBag, enabled: flags.blogStudioFullSuite },
    { name: 'Media Gallery', path: '/app/blog-studio/images', icon: ImageIcon, enabled: flags.blogStudioImages },
    { name: 'Analytics', path: '/app/blog-studio/analytics', icon: BarChart2, enabled: flags.blogStudioAnalytics },
    { name: 'Activity Logs', path: '/app/blog-studio/logs', icon: Activity, enabled: flags.blogStudioFullSuite },
    { name: 'Settings', path: '/app/blog-studio/settings', icon: Settings, enabled: flags.blogStudioFullSuite },
  ].filter((item) => item.enabled);

  return (
    <div className="flex min-h-full w-full flex-col bg-slate-50 dark:bg-slate-950 lg:flex-row">
      {/* Dedicated Blog Studio Sidebar */}
      <aside className="flex w-full shrink-0 flex-col border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:sticky lg:top-0 lg:h-[calc(100vh-4rem)] lg:w-64 lg:border-b-0 lg:border-r">
        <div className="h-16 flex items-center px-4 border-b border-slate-200 dark:border-slate-800">
          <Link href="/app" className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Back to App</span>
          </Link>
        </div>
        
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <PenTool className="w-5 h-5 text-indigo-600" />
            Blog Studio
          </h2>
          <p className="text-xs text-slate-500 mt-1">Research, write & publish</p>
        </div>

        <nav className="flex gap-1 overflow-x-auto p-3 lg:flex-1 lg:flex-col lg:overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            // Exact match for overview, startsWith for others
            const isActive = item.path === '/app/blog-studio' 
              ? pathname === item.path 
              : pathname.startsWith(item.path);
              
            return (
              <Link
                key={item.name}
                href={item.path}
                className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="min-w-0 flex-1 p-4 sm:p-6 md:p-8">
        {children}
      </main>
    </div>
  );
}
