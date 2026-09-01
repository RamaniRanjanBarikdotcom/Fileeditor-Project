import React from 'react';
import Link from 'next/link';
import { Layers, Zap, Code2, ShieldCheck, ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';

export default function SaasPlatformPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
          <Layers className="w-3.5 h-3.5" />
          <span>Cloud Document Studio & Conversion Engine</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Enterprise SaaS Document Infrastructure
        </h1>
        <p className="text-base text-slate-600 dark:text-slate-300">
          Everything your organization needs for rich document creation, batch exports, and high-throughput REST API conversions.
        </p>
      </div>

      {/* 3 Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg">
            1
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Document Studio</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            WYSIWYG rich text editor with markdown shortcuts, table formatting, and real-time exports to 20+ file formats.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg">
            2
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">High-Speed API</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            REST API endpoints with webhook completion callbacks, SDKs, and isolated worker sandboxes for production reliability.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-lg">
            3
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Team Workspaces</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Share templates, organize conversion history, and invite team members with granular role-based permissions.
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="text-center pt-8">
        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-500/25 transition-all hover:scale-105"
        >
          <span>View SaaS Subscription Plans</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
