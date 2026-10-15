'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArrowLeft,
  BarChart3,
  Boxes,
  FileText,
  LayoutDashboard,
  Loader2,
  LockKeyhole,
  Package,
  Repeat,
  Settings,
  ShoppingCart,
  Users,
} from 'lucide-react';
import { useFeatureFlags } from '../../../lib/use-feature-flags';
import BusinessOnboarding from './components/BusinessOnboarding';
import { InvoicingProvider, useInvoicing } from './context';

function Shell({ children }: { children: React.ReactNode }) {
  const flags = useFeatureFlags();
  const pathname = usePathname();
  const { loading, error, business, businesses, selectBusiness } = useInvoicing();

  const nav = [
    { name: 'Overview', path: '/app/invoices', icon: LayoutDashboard },
    { name: 'Sales documents', path: '/app/invoices/documents', icon: FileText },
    { name: 'Recurring', path: '/app/invoices/recurring', icon: Repeat },
    { name: 'Purchases', path: '/app/invoices/purchases', icon: ShoppingCart },
    { name: 'Customers & suppliers', path: '/app/invoices/contacts', icon: Users },
    { name: 'Products & services', path: '/app/invoices/items', icon: Package },
    ...(flags.inventory ? [{ name: 'Stock', path: '/app/invoices/stock', icon: Boxes }] : []),
    { name: 'Reports', path: '/app/invoices/reports', icon: BarChart3 },
    { name: 'Settings', path: '/app/invoices/settings', icon: Settings },
  ];
  const onboarding = !loading && !error && businesses.length === 0;

  return (
    <div className="flex min-h-full w-full flex-col bg-slate-50 dark:bg-slate-950 lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:sticky lg:top-0 lg:h-[calc(100vh-4rem)] lg:w-64 lg:border-b-0 lg:border-r">
        <div className="flex h-16 items-center border-b border-slate-200 px-4 dark:border-slate-800">
          <Link href="/app" className="flex items-center gap-2 text-slate-500 transition-colors hover:text-slate-900 dark:hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Back to App</span>
          </Link>
        </div>
        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <h2 className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-white">
            <FileText className="h-5 w-5 text-indigo-600" /> Invoice Studio
          </h2>
          {businesses.length > 1 ? (
            <select
              aria-label="Business"
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
              value={business?.id ?? ''}
              onChange={(event) => selectBusiness(event.target.value)}
            >
              {businesses.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.name}</option>
              ))}
            </select>
          ) : (
            <p className="mt-1 truncate text-xs text-slate-500">{business?.name ?? 'Invoices & inventory'}</p>
          )}
        </div>
        <nav className="flex gap-1 overflow-x-auto p-3 lg:flex-1 lg:flex-col lg:overflow-y-auto">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = item.path === '/app/invoices' ? pathname === item.path : pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                aria-current={active ? 'page' : undefined}
                className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  active
                    ? 'bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/50'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="min-w-0 flex-1 p-4 sm:p-6 md:p-8">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading Invoice Studio…
          </div>
        ) : error ? (
          <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>
        ) : onboarding ? (
          <BusinessOnboarding />
        ) : (
          children
        )}
      </main>
    </div>
  );
}

export default function InvoicesLayout({ children }: { children: React.ReactNode }) {
  const flags = useFeatureFlags();
  if (!flags.invoicing) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <LockKeyhole className="mx-auto h-9 w-9 text-slate-400" />
          <h1 className="mt-5 text-2xl font-black text-slate-950 dark:text-white">Invoice Studio is not available yet</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">This workspace has not enabled invoicing and inventory.</p>
        </div>
      </div>
    );
  }
  return (
    <InvoicingProvider>
      <Shell>{children}</Shell>
    </InvoicingProvider>
  );
}
