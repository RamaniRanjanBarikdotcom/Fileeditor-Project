'use client';

import { useState, useEffect, useCallback } from 'react';
import { Calendar, Download, Plus, RefreshCw, Upload, AlertCircle } from 'lucide-react';
import { fetchApi } from '../../../../lib/api';

export default function BlogStudioSchedulerPage() {
  const [activeTab, setActiveTab] = useState('scheduled');
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchApi('/blog-studio/schedules');
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to load schedules');
      }
      setJobs(res.data?.schedules || []);
    } catch (err: any) {
      setError(err.message || 'An error occurred loading schedules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  const displayedJobs = jobs.filter(job => 
    activeTab === 'scheduled' ? job.status !== 'COMPLETED' : job.status === 'COMPLETED'
  );

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-12">
      <header>
        <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-indigo-500">
          <Calendar className="h-4 w-4" />
          Scheduler
        </span>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
          Scheduler
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Build full generation schedules with auto-post settings and CSV import/export.
        </p>
      </header>

      {error && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input 
          placeholder="Search schedules by topic, keyword, destination..." 
          className="flex-1 min-w-[300px] rounded-lg border border-slate-300 dark:border-slate-700 bg-[#0f172a] px-4 py-2 text-sm text-white outline-none"
        />
        <select className="rounded-lg border border-slate-300 dark:border-slate-700 bg-[#0f172a] px-4 py-2 text-sm text-white outline-none">
          <option>All status</option>
        </select>
        <select className="rounded-lg border border-slate-300 dark:border-slate-700 bg-[#0f172a] px-4 py-2 text-sm text-white outline-none">
          <option>All destinations</option>
        </select>
        <select className="rounded-lg border border-slate-300 dark:border-slate-700 bg-[#0f172a] px-4 py-2 text-sm text-white outline-none">
          <option>All platforms</option>
        </select>
        
        <div className="ml-auto flex items-center gap-2">
          <button 
            onClick={loadSchedules}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button className="flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
            Export schedules
          </button>
          <button className="flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
            + Import
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 transition">
            + Create schedule
          </button>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#0f172a] shadow-sm text-white overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800 p-4">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('scheduled')}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${activeTab === 'scheduled' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Scheduled jobs
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${activeTab === 'completed' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Completed jobs
            </button>
          </div>
          <span className="text-sm text-slate-400">{displayedJobs.length} scheduled</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-800 font-semibold text-slate-300">
              <tr>
                <th className="px-5 py-4">Run at</th>
                <th className="px-5 py-4 w-[35%]">Topic</th>
                <th className="px-5 py-4">Destination</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Post</th>
                <th className="px-5 py-4">Image</th>
                <th className="px-5 py-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading && displayedJobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                    Loading schedules...
                  </td>
                </tr>
              ) : displayedJobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                    No {activeTab} jobs found.
                  </td>
                </tr>
              ) : (
                displayedJobs.map(job => (
                  <tr key={job.id} className="hover:bg-slate-800/50">
                    <td className="px-5 py-4 align-top whitespace-nowrap text-slate-300">
                      <div>{new Date(job.scheduledAt).toLocaleDateString()}</div>
                      <div className="text-xs text-slate-500">{new Date(job.scheduledAt).toLocaleTimeString()}</div>
                    </td>
                    <td className="px-5 py-4 align-top font-medium">{job.inputJson?.topic || 'Untitled'}</td>
                    <td className="px-5 py-4 align-top text-slate-300 whitespace-pre-line">
                      {job.destinationId ? `Dest: ${job.destinationId}` : 'None'}
                    </td>
                    <td className="px-5 py-4 align-top">
                      <span className="inline-flex rounded-full bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-300">
                        {job.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-top text-slate-300 whitespace-pre-line">
                      {job.autoPublish ? 'Auto\n(publish)' : 'Manual'}
                    </td>
                    <td className="px-5 py-4 align-top text-slate-300">{job.generateImages ? 'Yes' : 'No'}</td>
                    <td className="px-5 py-4 align-top">
                      <button className="rounded bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition">
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
