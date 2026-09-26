'use client';

import { useEffect, useState } from 'react';
import { CreditCard, ShieldCheck, Sparkles } from 'lucide-react';
import { fetchApi } from '../../../lib/api';
import { useFeatureFlags } from '../../../lib/use-feature-flags';

type Subscription = {
  status: string;
  currency: 'USD' | 'INR';
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  product: { name: string };
};

type Checkout = {
  provider: 'STRIPE' | 'RAZORPAY';
  checkoutUrl?: string;
  subscriptionId?: string;
  keyId?: string;
};

export default function BillingPage() {
  const flags = useFeatureFlags();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [currency, setCurrency] = useState<'USD' | 'INR'>('USD');
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    void fetchApi<Subscription | null>('/blog-studio/subscription').then((response) => {
      if (response.success) setSubscription(response.data || null);
      setLoading(false);
    });
  }, []);

  async function checkout() {
    setStarting(true);
    setNotice('');
    const origin = window.location.origin;
    const response = await fetchApi<Checkout>('/blog-studio/subscription/checkout', {
      method: 'POST',
      body: JSON.stringify({
        currency,
        successUrl: `${origin}/app/billing?checkout=success`,
        cancelUrl: `${origin}/app/billing?checkout=cancelled`,
      }),
    });
    setStarting(false);
    if (!response.success || !response.data) {
      setNotice(response.error?.message || 'Checkout could not be started.');
      return;
    }
    if (response.data.checkoutUrl) {
      window.location.assign(response.data.checkoutUrl);
      return;
    }
    setNotice(
      response.data.provider === 'RAZORPAY'
        ? `Razorpay subscription ${response.data.subscriptionId} is ready, but hosted checkout is unavailable. Contact support before paying.`
        : 'Checkout was created without a provider URL.',
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <header>
        <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-indigo-500">
          <CreditCard className="h-4 w-4" />
          Billing & entitlements
        </span>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
          Manage Blog Studio access
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Provider webhooks—not browser redirects—activate your workspace entitlement.
        </p>
      </header>

      {subscription && (
        <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-emerald-600">
                Current add-on
              </span>
              <h2 className="mt-2 text-xl font-black text-slate-950 dark:text-white">
                {subscription.product.name}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Status: {subscription.status.replaceAll('_', ' ').toLowerCase()} ·{' '}
                {subscription.currency}
              </p>
            </div>
            <div className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
              Period ends {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-7 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:grid-cols-[1fr_300px] lg:p-9">
        <div>
          <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-indigo-500">
            <Sparkles className="h-4 w-4" />
            Blog Studio add-on
          </span>
          <h2 className="mt-3 text-3xl font-black text-slate-950 dark:text-white">
            40 blogs and 800 AI credits monthly
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
            The add-on replaces your base Blog Studio allowance for the active billing window.
            Failed and cancelled generations release their reservations.
          </p>
          <ul className="mt-6 grid gap-3 text-sm font-semibold text-slate-700 dark:text-slate-300 sm:grid-cols-2">
            {[
              'Checkpointed 10-stage generation',
              'Rich editor and autosave',
              'SEO metadata and source panel',
              'Markdown, HTML, DOCX and PDF exports',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-950">
          <div className="grid grid-cols-2 rounded-xl bg-slate-200/60 p-1 dark:bg-slate-800">
            {(['USD', 'INR'] as const).map((item) => (
              <button
                key={item}
                onClick={() => setCurrency(item)}
                className={`rounded-lg py-2 text-xs font-bold ${currency === item ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-900' : 'text-slate-500'}`}
              >
                {item}
              </button>
            ))}
          </div>
          <strong className="mt-6 block text-4xl text-slate-950 dark:text-white">
            {currency === 'INR' ? '₹1,599' : '$19'}
          </strong>
          <span className="text-sm text-slate-500">per month</span>
          {loading ? (
            <p className="mt-6 text-xs text-slate-500">Checking entitlement…</p>
          ) : flags.blogStudioCheckout ? (
            <button
              onClick={() => void checkout()}
              disabled={starting || subscription?.status === 'ACTIVE'}
              className="mt-6 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-500 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {subscription?.status === 'ACTIVE'
                ? 'Add-on active'
                : starting
                  ? 'Opening checkout…'
                  : 'Add Blog Studio'}
            </button>
          ) : (
            <p className="mt-6 rounded-xl border border-slate-200 p-3 text-xs font-semibold leading-5 text-slate-500 dark:border-slate-700">
              Checkout stays hidden until Stripe and Razorpay sandbox lifecycle tests pass.
            </p>
          )}
          {notice && <p className="mt-3 text-xs font-semibold text-amber-600">{notice}</p>}
        </aside>
      </section>
    </div>
  );
}
