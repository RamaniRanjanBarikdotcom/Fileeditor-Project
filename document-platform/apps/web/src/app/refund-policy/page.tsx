import React from 'react';

export default function RefundPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 space-y-8 text-slate-800 dark:text-slate-200">
      <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Refund Policy</h1>
      <p className="text-xs text-slate-500">Last updated: August 31, 2026</p>

      <div className="space-y-6 text-sm leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">1. SaaS Subscriptions</h2>
          <p>We offer a 14-day money-back guarantee for initial Pro and Business subscription purchases if you are unsatisfied with the conversion performance or quota limits.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">2. Downloadable Software & Digital Assets</h2>
          <p>Digital software products and CLI tools that come with lifetime license keys can be refunded within 30 days of purchase if the license has not been permanently activated or if technical defects cannot be resolved by support.</p>
        </section>
      </div>
    </div>
  );
}
