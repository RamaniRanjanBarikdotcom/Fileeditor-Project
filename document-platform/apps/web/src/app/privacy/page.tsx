import React from 'react';

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 space-y-8 text-slate-800 dark:text-slate-200">
      <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Privacy Policy</h1>
      <p className="text-xs text-slate-500">Last updated: August 31, 2026</p>

      <div className="space-y-6 text-sm leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">1. File Processing & Zero Storage Retention</h2>
          <p>Files uploaded for conversion are processed in ephemeral worker sandboxes. Converted files are automatically deleted after the retention window (24h for Free, 30 days for Pro, 90 days for Business).</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">2. Privacy-Safe Anonymous Tracking</h2>
          <p>For anonymous users, we do not store raw IP addresses. Quotas are enforced using a cryptographic HMAC hash of the IP address with a rotating server salt combined with a signed first-party cookie.</p>
        </section>
      </div>
    </div>
  );
}
