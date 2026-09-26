'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Bot,
  BrainCircuit,
  FolderPlus,
  Loader2,
  MessageSquarePlus,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { fetchApi } from '../../../lib/api';

interface Project {
  id: string;
  name: string;
  description?: string | null;
  summary?: string | null;
  _count?: { conversations: number; memories: number };
}

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
  _count?: { messages: number };
}

interface Message {
  id: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';
  content: string;
  createdAt: string;
}

export default function AssistantPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');

  const activeProject = useMemo(
    () => projects.find((project) => project.id === projectId),
    [projectId, projects],
  );

  const visibleConversations = useMemo(
    () => (projectId ? conversations : []),
    [projectId, conversations],
  );
  const visibleMessages = useMemo(
    () => (conversationId ? messages : []),
    [conversationId, messages],
  );

  useEffect(() => {
    void loadProjects();
  }, []);

  useEffect(() => {
    if (projectId) void loadConversations(projectId);
  }, [projectId]);

  useEffect(() => {
    if (conversationId) void loadConversation(conversationId);
  }, [conversationId]);

  async function loadProjects() {
    setLoading(true);
    const response = await fetchApi<Project[]>('/ai/projects');
    if (response.success && response.data) {
      setProjects(response.data);
      setProjectId((current) => current || response.data?.[0]?.id || '');
    } else setNotice(response.error?.message || 'Project memory could not be loaded.');
    setLoading(false);
  }

  async function loadConversations(selectedProjectId: string) {
    const response = await fetchApi<Conversation[]>(
      `/ai/projects/${selectedProjectId}/conversations`,
    );
    if (response.success && response.data) {
      setConversations(response.data);
      setConversationId((current) =>
        response.data?.some((item) => item.id === current)
          ? current
          : response.data?.[0]?.id || '',
      );
    } else setNotice(response.error?.message || 'Conversations could not be loaded.');
  }

  async function loadConversation(selectedConversationId: string) {
    const response = await fetchApi<{ messages: Message[] }>(
      `/ai/conversations/${selectedConversationId}`,
    );
    if (response.success && response.data) setMessages(response.data.messages || []);
    else setNotice(response.error?.message || 'Conversation could not be loaded.');
  }

  async function createProject(event: FormEvent) {
    event.preventDefault();
    if (!newProjectName.trim()) return;
    const response = await fetchApi<Project>('/ai/projects', {
      method: 'POST',
      body: JSON.stringify({ name: newProjectName.trim() }),
    });
    if (response.success && response.data) {
      setProjects((current) => [response.data!, ...current]);
      setProjectId(response.data.id);
      setNewProjectName('');
      setNotice('Project created. Its conversations and memory are isolated from other projects.');
    } else setNotice(response.error?.message || 'Project could not be created.');
  }

  async function createConversation() {
    if (!projectId) return;
    const response = await fetchApi<Conversation>(`/ai/projects/${projectId}/conversations`, {
      method: 'POST',
      body: JSON.stringify({ title: 'New conversation' }),
    });
    if (response.success && response.data) {
      setConversations((current) => [response.data!, ...current]);
      setConversationId(response.data.id);
      setMessages([]);
    } else setNotice(response.error?.message || 'Conversation could not be created.');
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const content = message.trim();
    if (!content || !conversationId || sending) return;
    setSending(true);
    setNotice('');
    setMessage('');
    const temporary: Message = {
      id: `pending-${Date.now()}`,
      role: 'USER',
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, temporary]);
    const response = await fetchApi<{
      userMessage: Message;
      assistantMessage: Message;
    }>(`/ai/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
    if (response.success && response.data) {
      setMessages((current) => [
        ...current.filter((item) => item.id !== temporary.id),
        response.data!.userMessage,
        response.data!.assistantMessage,
      ]);
      await loadConversations(projectId);
    } else {
      setNotice(
        response.error?.message ||
          'The message was saved, but an AI response could not be generated.',
      );
      await loadConversation(conversationId);
    }
    setSending(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading project assistant…
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-9rem)] max-w-7xl flex-col gap-5">
      <header className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400">
            <BrainCircuit className="h-4 w-4" /> Persistent project intelligence
          </div>
          <h1 className="text-2xl font-black text-slate-950 dark:text-white md:text-3xl">
            Project-aware AI assistant
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Conversations stay scoped to the selected project. Only ranked, relevant memory enters
            each request.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          <ShieldCheck className="h-4 w-4" /> Organization-isolated memory
        </div>
      </header>

      {notice && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          {notice}
        </div>
      )}

      {!projects.length ? (
        <section className="grid flex-1 place-items-center rounded-3xl border border-dashed border-slate-300 bg-white p-8 dark:border-slate-700 dark:bg-slate-900">
          <form onSubmit={createProject} className="w-full max-w-lg text-center">
            <FolderPlus className="mx-auto h-12 w-12 text-indigo-500" />
            <h2 className="mt-4 text-xl font-bold text-slate-950 dark:text-white">
              Create your first AI project
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Each project gets independent conversations, summaries, decisions, tasks, and known
              issues.
            </p>
            <div className="mt-6 flex gap-2">
              <input
                value={newProjectName}
                onChange={(event) => setNewProjectName(event.target.value)}
                placeholder="Example: AppToolkitLab Platform"
                className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-950"
                required
              />
              <button className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-500">
                Create
              </button>
            </div>
          </form>
        </section>
      ) : (
        <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Project</label>
            <select
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950"
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
              <span>{activeProject?._count?.memories || 0} memories</span>
              <span>{activeProject?._count?.conversations || 0} conversations</span>
            </div>
            <button
              onClick={createConversation}
              className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-2.5 text-sm font-bold text-white hover:bg-indigo-600 dark:bg-indigo-600"
            >
              <MessageSquarePlus className="h-4 w-4" /> New conversation
            </button>
            <div className="mt-3 space-y-1 overflow-y-auto">
              {visibleConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => setConversationId(conversation.id)}
                  className={`w-full rounded-xl px-3 py-3 text-left text-sm transition ${
                    conversation.id === conversationId
                      ? 'bg-indigo-50 font-bold text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="block truncate">{conversation.title}</span>
                  <span className="mt-1 block text-[11px] font-normal text-slate-400">
                    {conversation._count?.messages || 0} messages
                  </span>
                </button>
              ))}
            </div>
          </aside>

          <section className="flex min-h-[620px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            {!conversationId ? (
              <div className="grid flex-1 place-items-center p-8 text-center">
                <div>
                  <Bot className="mx-auto h-12 w-12 text-indigo-500" />
                  <h2 className="mt-4 text-lg font-bold text-slate-950 dark:text-white">
                    Start a project conversation
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Create a conversation to use recent context and persistent memory together.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 space-y-4 overflow-y-auto p-5 md:p-7">
                  {!visibleMessages.length && (
                    <div className="mx-auto mt-20 max-w-md text-center text-sm text-slate-500">
                      Ask about architecture, requirements, bugs, tasks, or recent decisions. Durable
                      information can be extracted after the response.
                    </div>
                  )}
                  {visibleMessages.map((item) => (
                    <article
                      key={item.id}
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 whitespace-pre-wrap ${
                        item.role === 'USER'
                          ? 'ml-auto bg-indigo-600 text-white'
                          : 'border border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
                      }`}
                    >
                      {item.content}
                    </article>
                  ))}
                  {sending && (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" /> Building scoped context…
                    </div>
                  )}
                </div>
                <form onSubmit={sendMessage} className="border-t border-slate-200 p-4 dark:border-slate-800">
                  <div className="flex items-end gap-3 rounded-2xl border border-slate-300 bg-white p-2 focus-within:border-indigo-500 dark:border-slate-700 dark:bg-slate-950">
                    <textarea
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      rows={3}
                      placeholder="Ask with this project’s context…"
                      className="min-h-20 flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none"
                    />
                    <button
                      disabled={!message.trim() || sending}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Send message"
                    >
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </div>
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

