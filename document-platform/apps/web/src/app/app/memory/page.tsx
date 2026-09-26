'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Loader2,
  Pin,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { fetchApi } from '../../../lib/api';

interface Project {
  id: string;
  name: string;
  description?: string | null;
  summary?: string | null;
  summaryUpdatedAt?: string | null;
  memoryEnabled: boolean;
  autoExtractionEnabled: boolean;
}

interface MemoryItem {
  id: string;
  projectId: string;
  type: string;
  title: string;
  content: string;
  conceptKey?: string | null;
  status: string;
  sourceType: string;
  sourceTrust: string;
  importance: number;
  confidence: number;
  pinned: boolean;
  updatedAt: string;
  sourceConversation?: { id: string; title?: string } | null;
  supersededBy?: { id: string; title: string } | null;
}

const MEMORY_TYPES = [
  'FACT',
  'ARCHITECTURE',
  'DECISION',
  'REQUIREMENT',
  'PREFERENCE',
  'CONSTRAINT',
  'TASK',
  'BUG',
  'STATUS',
  'INTEGRATION',
  'CODE_KNOWLEDGE',
];

export default function MemoryPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [selected, setSelected] = useState<MemoryItem | null>(null);
  const [editDraft, setEditDraft] = useState({ type: 'DECISION', title: '', content: '' });
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ type: 'DECISION', title: '', content: '' });

  const project = useMemo(
    () => projects.find((item) => item.id === projectId),
    [projectId, projects],
  );

  async function fetchMemories(search = query) {
    if (!projectId) return;
    const params = new URLSearchParams({ projectId, status, pageSize: '100' });
    if (type) params.set('type', type);
    if (search.trim()) params.set('query', search.trim());
    const response = await fetchApi<MemoryItem[]>(`/ai/memories?${params.toString()}`);
    if (response.success) {
      const items = (response as unknown as { items?: MemoryItem[] }).items || response.data || [];
      setMemories(items);
      setSelected((prev) => (prev && !items.some((item) => item.id === prev.id) ? null : prev));
    } else setNotice(response.error?.message || 'Memory could not be loaded.');
  }

  useEffect(() => {
    let active = true;
    (async () => {
      const response = await fetchApi<Project[]>('/ai/projects');
      if (!active) return;
      if (response.success && response.data) {
        setProjects(response.data);
        setProjectId((current) => current || response.data?.[0]?.id || '');
      } else {
        setNotice(response.error?.message || 'Projects could not be loaded.');
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!projectId) return;
    (async () => {
      const params = new URLSearchParams({ projectId, status, pageSize: '100' });
      if (type) params.set('type', type);
      if (query.trim()) params.set('query', query.trim());
      const response = await fetchApi<MemoryItem[]>(`/ai/memories?${params.toString()}`);
      if (!active) return;
      if (response.success) {
        const items = (response as unknown as { items?: MemoryItem[] }).items || response.data || [];
        setMemories(items);
        setSelected((prev) => (prev && !items.some((item) => item.id === prev.id) ? null : prev));
      } else {
        setNotice(response.error?.message || 'Memory could not be loaded.');
      }
    })();
    return () => {
      active = false;
    };
  }, [projectId, type, status, query]);

  async function createMemory(event: FormEvent) {
    event.preventDefault();
    if (!projectId || !draft.title.trim() || !draft.content.trim()) return;
    const response = await fetchApi<MemoryItem>('/ai/memories', {
      method: 'POST',
      body: JSON.stringify({
        projectId,
        type: draft.type,
        title: draft.title.trim(),
        content: draft.content.trim(),
        importance: 0.9,
      }),
    });
    if (response.success && response.data) {
      setDraft({ type: 'DECISION', title: '', content: '' });
      setCreating(false);
      setNotice('Memory saved with explicit-user trust and project provenance.');
      await fetchMemories('');
    } else setNotice(response.error?.message || 'Memory could not be saved.');
  }

  async function updateMemory(memory: MemoryItem, data: Record<string, unknown>) {
    const response = await fetchApi<MemoryItem>(`/ai/memories/${memory.id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    if (response.success && response.data) {
      setMemories((current) =>
        current.map((item) => (item.id === response.data!.id ? response.data! : item)),
      );
      setSelected((current) => (current?.id === response.data!.id ? response.data! : current));
      setNotice('Memory updated. The revised record is now used for future retrieval.');
    } else setNotice(response.error?.message || 'Memory could not be updated.');
  }

  function openMemory(memory: MemoryItem) {
    setSelected(memory);
    setEditDraft({ type: memory.type, title: memory.title, content: memory.content });
  }

  async function saveSelected(event: FormEvent) {
    event.preventDefault();
    if (!selected || !editDraft.title.trim() || !editDraft.content.trim()) return;
    await updateMemory(selected, {
      type: editDraft.type,
      title: editDraft.title.trim(),
      content: editDraft.content.trim(),
    });
  }

  async function archiveMemory(memory: MemoryItem) {
    const response = await fetchApi(`/ai/memories/${memory.id}/archive`, { method: 'POST' });
    if (response.success) {
      setNotice('Memory archived. It will no longer enter AI context.');
      await fetchMemories();
    } else setNotice(response.error?.message || 'Memory could not be archived.');
  }

  async function deleteMemory(memory: MemoryItem) {
    const response = await fetchApi(`/ai/memories/${memory.id}`, { method: 'DELETE' });
    if (response.success) {
      setNotice('Memory soft-deleted and excluded from retrieval.');
      setSelected(null);
      await fetchMemories();
    } else setNotice(response.error?.message || 'Memory could not be deleted.');
  }

  async function rebuildSummary() {
    if (!projectId) return;
    const response = await fetchApi(`/ai/projects/${projectId}/summary/rebuild`, {
      method: 'POST',
    });
    if (response.success) setNotice('Project summary refresh queued.');
    else setNotice(response.error?.message || 'Summary refresh could not be queued.');
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading memory controls…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400">
              <BrainCircuit className="h-4 w-4" /> Transparent persistent memory
            </div>
            <h1 className="text-2xl font-black text-slate-950 dark:text-white md:text-3xl">
              Project context and memory
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Inspect what the assistant remembers, why it remembers it, and whether it may be
              retrieved. Archived, superseded, and deleted records never enter normal context.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">Choose a project</option>
              {projects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setCreating((value) => !value)}
              disabled={!projectId}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
            >
              <Plus className="h-4 w-4" /> Remember
            </button>
          </div>
        </div>
      </header>

      {notice && (
        <div className="flex items-start gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {notice}
        </div>
      )}

      {project && (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-950 dark:text-white">Canonical project summary</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {project.summaryUpdatedAt
                    ? `Updated ${new Date(project.summaryUpdatedAt).toLocaleString()}`
                    : 'Not generated yet'}
                </p>
              </div>
              <button
                onClick={rebuildSummary}
                className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-700"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </button>
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">
              {project.summary ||
                'The summary will be generated from active project memories and completed session summaries when an AI provider is configured.'}
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-950 dark:text-white">
              <ShieldCheck className="h-4 w-4 text-emerald-500" /> Memory policy
            </div>
            <dl className="mt-4 space-y-3 text-xs">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Retrieval</dt>
                <dd className="font-bold">{project.memoryEnabled ? 'Enabled' : 'Disabled'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Auto extraction</dt>
                <dd className="font-bold">{project.autoExtractionEnabled ? 'Enabled' : 'Disabled'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Scope</dt>
                <dd className="font-bold">Organization + project</dd>
              </div>
            </dl>
          </div>
        </section>
      )}

      {creating && (
        <form
          onSubmit={createMemory}
          className="rounded-3xl border border-indigo-200 bg-indigo-50/60 p-5 dark:border-indigo-900 dark:bg-indigo-950/20"
        >
          <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
            <select
              value={draft.type}
              onChange={(event) => setDraft((current) => ({ ...current, type: event.target.value }))}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              {MEMORY_TYPES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <input
              value={draft.title}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              placeholder="Memory title"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
              required
            />
          </div>
          <textarea
            value={draft.content}
            onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
            placeholder="What should the assistant remember? Do not enter passwords, keys, or tokens."
            rows={4}
            className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
            required
          />
          <div className="mt-3 flex justify-end">
            <button className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white">
              Save explicit memory
            </button>
          </div>
        </form>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 border-b border-slate-200 p-4 dark:border-slate-800 md:grid-cols-[minmax(0,1fr)_180px_160px]">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void fetchMemories();
            }}
            className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 dark:border-slate-700"
          >
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, content, or concept"
              className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none"
            />
          </form>
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">All types</option>
            {MEMORY_TYPES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
          >
            {['ACTIVE', 'SUPERSEDED', 'ARCHIVED', 'DELETED'].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>

        {!projectId ? (
          <div className="p-12 text-center text-sm text-slate-500">Choose a project to inspect memory.</div>
        ) : !memories.length ? (
          <div className="p-12 text-center text-sm text-slate-500">No matching memory records.</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {memories.map((memory) => (
              <article key={memory.id} className="p-5 hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                  <button onClick={() => openMemory(memory)} className="min-w-0 flex-1 text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-black tracking-wide text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                        {memory.type.replaceAll('_', ' ')}
                      </span>
                      <span className="text-[11px] font-medium text-slate-400">
                        {memory.sourceType.replaceAll('_', ' ').toLowerCase()}
                      </span>
                      {memory.pinned && <Pin className="h-3.5 w-3.5 text-amber-500" />}
                    </div>
                    <h3 className="mt-2 font-bold text-slate-950 dark:text-white">{memory.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {memory.content}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-slate-400">
                      <span>importance {Math.round(memory.importance * 100)}%</span>
                      <span>confidence {Math.round(memory.confidence * 100)}%</span>
                      <span className="flex items-center gap-1">
                        <Clock3 className="h-3 w-3" /> {new Date(memory.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateMemory(memory, { pinned: !memory.pinned })}
                      className="rounded-lg p-2 text-slate-400 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950/30"
                      title={memory.pinned ? 'Unpin memory' : 'Pin memory'}
                    >
                      <Pin className="h-4 w-4" />
                    </button>
                    {memory.status === 'ACTIVE' && (
                      <button
                        onClick={() => archiveMemory(memory)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                        title="Archive memory"
                      >
                        <Archive className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteMemory(memory)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                      title="Delete memory"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {selected && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Why this is remembered</p>
              <h2 className="mt-1 text-xl font-bold text-slate-950 dark:text-white">{selected.title}</h2>
            </div>
            <button onClick={() => setSelected(null)} className="text-sm font-semibold text-slate-500">
              Close
            </button>
          </div>
          <form onSubmit={saveSelected} className="mt-5 space-y-3">
            <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
              <select
                value={editDraft.type}
                onChange={(event) =>
                  setEditDraft((current) => ({ ...current, type: event.target.value }))
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {MEMORY_TYPES.map((item) => <option key={item}>{item}</option>)}
              </select>
              <input
                value={editDraft.title}
                onChange={(event) =>
                  setEditDraft((current) => ({ ...current, title: event.target.value }))
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950"
                required
              />
            </div>
            <textarea
              value={editDraft.content}
              onChange={(event) =>
                setEditDraft((current) => ({ ...current, content: event.target.value }))
              }
              rows={5}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm leading-6 dark:border-slate-700 dark:bg-slate-950"
              required
            />
            <div className="flex justify-end">
              <button className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white">
                Save changes
              </button>
            </div>
          </form>
          <dl className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 text-xs dark:bg-slate-950 sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-slate-400">Source</dt><dd className="mt-1 font-bold">{selected.sourceType}</dd></div>
            <div><dt className="text-slate-400">Trust</dt><dd className="mt-1 font-bold">{selected.sourceTrust}</dd></div>
            <div><dt className="text-slate-400">Status</dt><dd className="mt-1 font-bold">{selected.status}</dd></div>
            <div><dt className="text-slate-400">Conversation</dt><dd className="mt-1 truncate font-bold">{selected.sourceConversation ? selected.sourceConversation.title || `ID ${selected.sourceConversation.id.slice(0, 8)}…` : 'Manual entry'}</dd></div>
          </dl>
        </section>
      )}
    </div>
  );
}
