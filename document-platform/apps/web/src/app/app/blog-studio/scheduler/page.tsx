'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AlertCircle, Calendar, Pencil, RefreshCw, Trash2, X } from 'lucide-react';
import { fetchApi } from '../../../../lib/api';

export default function BlogStudioSchedulerPage() {
  const [activeTab, setActiveTab] = useState('scheduled');
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    topic: '',
    scheduledAt: '',
    targetLength: 1200,
    language: 'English',
    writingStyle: 'Educational',
    tone: 'Professional',
  });

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchApi('/blog-studio/schedules');
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to load schedules');
      }
      setJobs(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      setError(err.message || 'An error occurred loading schedules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadSchedules, 0);
    return () => window.clearTimeout(timer);
  }, [loadSchedules]);

  const displayedJobs = useMemo(() => jobs.filter(job => {
    const correctTab = activeTab === 'scheduled' ? job.status !== 'COMPLETED' : job.status === 'COMPLETED';
    const correctStatus = statusFilter === 'ALL' || job.status === statusFilter;
    const haystack = `${job.inputJson?.topic || ''} ${job.status || ''}`.toLowerCase();
    return correctTab && correctStatus && haystack.includes(query.trim().toLowerCase());
  }), [jobs, activeTab, statusFilter, query]);

  async function createSchedule(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const result = await fetchApi('/blog-studio/schedules', {
      method: 'POST',
      body: JSON.stringify({
        jobType: 'generate',
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        inputJson: {
          topic: form.topic,
          keywords: [],
          targetLength: form.targetLength,
          language: form.language,
          writingStyle: form.writingStyle,
          tone: form.tone,
        },
      }),
    });
    setSaving(false);
    if (!result.success) return setError(result.error?.message || 'Schedule could not be created.');
    setShowCreate(false);
    setMessage('Generation scheduled successfully.');
    setForm({ ...form, topic: '', scheduledAt: '' });
    await loadSchedules();
  }

  async function cancelSchedule(id: string) {
    const result = await fetchApi(`/blog-studio/schedules/${id}/cancel`, { method: 'POST' });
    if (!result.success) return setError(result.error?.message || 'Schedule could not be cancelled.');
    setMessage('Schedule cancelled.');
    await loadSchedules();
  }

  async function reschedule(job: any) {
    const current = new Date(job.scheduledAt);
    const suggested = new Date(current.getTime() - current.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 16);
    const next = window.prompt('Enter a new local date and time (YYYY-MM-DDTHH:mm)', suggested)?.trim();
    if (!next) return;
    const scheduledAt = new Date(next);
    if (Number.isNaN(scheduledAt.getTime())) return setError('Enter a valid date and time.');
    const result = await fetchApi(`/blog-studio/schedules/${job.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ scheduledAt: scheduledAt.toISOString() }),
    });
    if (!result.success) return setError(result.error?.message || 'Schedule could not be updated.');
    setMessage('Schedule updated.');
    await loadSchedules();
  }

  async function deleteSchedule(id: string) {
    if (!window.confirm('Permanently delete this schedule and its run history?')) return;
    const result = await fetchApi(`/blog-studio/schedules/${id}`, { method: 'DELETE' });
    if (!result.success) return setError(result.error?.message || 'Schedule could not be deleted.');
    setMessage('Schedule deleted.');
    await loadSchedules();
  }

  function exportSchedules() {
    const rows = [
      ['topic', 'scheduledAt', 'status', 'language', 'targetLength'],
      ...jobs.map((job) => [
        job.inputJson?.topic || '',
        job.scheduledAt,
        job.status,
        job.inputJson?.language || '',
        job.inputJson?.targetLength || '',
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `blog-schedules-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importSchedules(file: File) {
    const lines = (await file.text()).split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return setError('The CSV file contains no schedule rows.');
    const headers = lines[0]!.split(',').map((value) => value.replace(/^"|"$/g, '').trim());
    const rows = lines.slice(1).map((line) => {
      const values = line.split(',').map((value) => value.replace(/^"|"$/g, '').trim());
      return Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
    });
    const result = await fetchApi<{ validCount: number; errorCount: number }>('/blog-studio/schedules/import', {
      method: 'POST',
      body: JSON.stringify({ rows, filename: file.name }),
    });
    if (!result.success || !result.data) return setError(result.error?.message || 'CSV import failed.');
    setMessage(`Imported ${result.data.validCount} schedules; ${result.data.errorCount} rows were skipped.`);
    await loadSchedules();
  }

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
      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">{message}</div>}

      <div className="flex flex-wrap items-center gap-3">
        <input 
          placeholder="Search schedules by topic, keyword, destination..." 
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="flex-1 min-w-[300px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-[#0f172a] dark:text-white"
        />
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-[#0f172a] dark:text-white">
          <option value="ALL">All status</option>
          {['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'].map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
        
        <div className="ml-auto flex items-center gap-2">
          <button 
            onClick={loadSchedules}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={exportSchedules} className="flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
            Export schedules
          </button>
          <input ref={importRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importSchedules(file); event.target.value = ''; }} />
          <button onClick={() => importRef.current?.click()} className="flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
            + Import
          </button>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 transition">
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
                      <div className="flex flex-wrap gap-2">
                        {job.status === 'PENDING' && <button onClick={() => void reschedule(job)} className="rounded bg-slate-800 p-2 text-slate-300 transition hover:bg-indigo-900 hover:text-indigo-200" title="Reschedule"><Pencil className="h-3.5 w-3.5" /></button>}
                        {['PENDING', 'RUNNING'].includes(job.status) && <button onClick={() => void cancelSchedule(job.id)} className="rounded bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-red-900 hover:text-red-200 transition">Cancel</button>}
                        {job.status !== 'RUNNING' && <button onClick={() => void deleteSchedule(job.id)} className="rounded bg-slate-800 p-2 text-slate-400 transition hover:bg-red-900 hover:text-red-200" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      {showCreate && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <form onSubmit={createSchedule} className="w-full max-w-xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between"><div><h2 className="text-xl font-black text-slate-950 dark:text-white">Create generation schedule</h2><p className="text-sm text-slate-500">The job runs in the Blog Studio queue at the selected time.</p></div><button type="button" onClick={() => setShowCreate(false)} aria-label="Close"><X className="h-5 w-5 text-slate-500" /></button></div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Topic<input required maxLength={300} value={form.topic} onChange={(event) => setForm({ ...form, topic: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-300 bg-transparent px-4 py-3 dark:border-slate-700" /></label>
            <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Run at<input required type="datetime-local" value={form.scheduledAt} onChange={(event) => setForm({ ...form, scheduledAt: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-300 bg-transparent px-4 py-3 dark:border-slate-700" /></label><label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Target words<input required type="number" min={300} max={10000} value={form.targetLength} onChange={(event) => setForm({ ...form, targetLength: Number(event.target.value) })} className="mt-2 w-full rounded-xl border border-slate-300 bg-transparent px-4 py-3 dark:border-slate-700" /></label></div>
            <div className="grid gap-4 sm:grid-cols-3">{(['language', 'writingStyle', 'tone'] as const).map((field) => <label key={field} className="block text-sm font-semibold capitalize text-slate-700 dark:text-slate-200">{field.replace(/([A-Z])/g, ' $1')}<input required value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2.5 dark:border-slate-700" /></label>)}</div>
            <div className="flex justify-end gap-3"><button type="button" onClick={() => setShowCreate(false)} className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-bold dark:border-slate-700">Cancel</button><button disabled={saving} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? 'Scheduling…' : 'Schedule generation'}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
