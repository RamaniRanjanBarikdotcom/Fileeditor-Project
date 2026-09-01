import React from 'react';

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 space-y-8 text-slate-800 dark:text-slate-200">
      <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Terms of Service</h1>
      <p className="text-xs text-slate-500">Last updated: August 31, 2026</p>

      <div className="space-y-6 text-sm leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">1. Acceptance of Terms</h2>
          <p>By accessing or using ToolSuite, you agree to be bound by these Terms of Service and all applicable laws and regulations.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">2. Permitted Use & Quotas</h2>
          <p>You agree to use ToolSuite solely for lawful purposes. Anonymous users are granted up to 3 operations per day. Registered users receive quotas corresponding to their subscription tier.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">3. Software Licenses</h2>
          <p>Software and digital assets purchased on ToolSuite grant a perpetual, non-exclusive license subject to the activation seat limits specified at checkout.</p>
        </section>
      </div>
    </div>
  );
}
