'use client';

import React, { useEffect, useState } from 'react';
import { Clock, FileText, Download, CheckCircle, XCircle, Loader2, ArrowRight } from 'lucide-react';
import { fetchWithAuth } from '../../../lib/api';

export default function WorkspaceHistoryPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetchWithAuth('/api/v1/conversions');
        const data = await res.json();
        if (data.success && data.data) {
          setJobs(data.data);
        }
      } catch {}
      setLoading(false);
    }
    loadHistory();
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Conversion History</h1>
        <p className="text-xs text-slate-500 mt-1">Past conversion jobs and output files</p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            <p className="text-xs">Loading history records...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-16 text-center text-slate-400 space-y-2">
            <Clock className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
            <p className="font-semibold text-sm text-slate-600 dark:text-slate-300">No conversions recorded yet</p>
            <p className="text-xs">Start converting files from the converter or free tools hub.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {jobs.map((job) => (
              <div key={job.id} className="p-5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-850">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {job.sourceFormat?.toUpperCase()} → {job.targetFormat?.toUpperCase()}
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Job ID: {job.id?.slice(0, 8)} • {new Date(job.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                      job.status === 'COMPLETED'
                        ? 'bg-emerald-50 text-emerald-600'
                        : job.status === 'FAILED'
                        ? 'bg-red-50 text-red-600'
                        : 'bg-amber-50 text-amber-600'
                    }`}
                  >
                    {job.status}
                  </span>
                  {job.status === 'COMPLETED' && (
                    <a
                      href={`/api/v1/files/${job.id}/download`}
                      download
                      className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 hover:bg-indigo-100"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
