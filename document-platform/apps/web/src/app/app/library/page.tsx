'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShoppingBag,
  Download,
  Key,
  Copy,
  Check,
  Loader2,
  Terminal,
  Code2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { fetchApi } from '../../../lib/api';

export default function CustomerLibraryPage() {
  const [library, setLibrary] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  useEffect(() => {
    async function loadLibrary() {
      setLoading(true);
      const res = await fetchApi<any[]>('/downloads/library');
      if (res.success && res.data) {
        setLibrary(res.data);
      }
      setLoading(false);
    }
    loadLibrary();
  }, []);

  const handleDownload = async (productId: string) => {
    setDownloadingId(productId);
    const res = await fetchApi<{ downloadUrl: string; fileName: string }>(
      `/downloads/${productId}/sign`,
      { method: 'POST' },
    );

    if (res.success && res.data) {
      // Trigger download
      const a = document.createElement('a');
      a.href = res.data.downloadUrl;
      a.download = res.data.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    setDownloadingId(null);
  };

  const handleCopyKey = (keyMasked: string, id: string) => {
    navigator.clipboard.writeText(keyMasked);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Customer Software Library</h1>
          <p className="text-xs text-slate-500 mt-1">
            Access your purchased lifetime licenses, product downloads, and activation keys
          </p>
        </div>
        <Link
          href="/software"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm"
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Browse Store</span>
        </Link>
      </div>

      {/* Library Grid */}
      {loading ? (
        <div className="p-16 text-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-600" />
          <p className="text-xs">Loading purchased software...</p>
        </div>
      ) : library.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-16 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center mx-auto">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Your Software Library is Empty</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            You have not purchased any downloadable CLI tools or developer kits yet. Explore our store for lifetime software deals.
          </p>
          <div className="pt-2">
            <Link
              href="/software"
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-500/20"
            >
              <span>Explore Software Store</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {library.map((item) => (
            <div
              key={item.entitlementId}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <Terminal className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        {item.productName}
                      </h3>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/50">
                        Purchased (Lifetime)
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Version: {item.release?.version || 'v1.0.0'} • Purchased on{' '}
                      {new Date(item.grantedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Download Button */}
                <button
                  onClick={() => handleDownload(item.productId)}
                  disabled={downloadingId === item.productId}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 transition-all hover:scale-105"
                >
                  {downloadingId === item.productId ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>Download Binary ({((item.release?.fileSizeBytes || 0) / (1024 * 1024)).toFixed(1)} MB)</span>
                </button>
              </div>

              {/* License Details */}
              {item.license && (
                <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                  <div className="space-y-1">
                    <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-indigo-500" />
                      Activation License Key:
                    </span>
                    <div className="flex items-center gap-2 font-mono font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 w-fit">
                      <span>{item.license.keyMasked}</span>
                      <button
                        onClick={() => handleCopyKey(item.license.keyMasked, item.license.id)}
                        className="text-slate-400 hover:text-indigo-600 ml-1"
                        title="Copy Key"
                      >
                        {copiedKeyId === item.license.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <div className="text-right">
                      <span className="text-slate-400">Seats Activated</span>
                      <p className="font-bold text-slate-800 dark:text-slate-200">
                        {item.license.activationsUsed} / {item.license.maxActivations} Devices
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
