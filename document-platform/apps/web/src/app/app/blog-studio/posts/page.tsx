'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Clock,
  Eye,
  ExternalLink,
  FileEdit,
  Globe,
  RefreshCw,
  Send,
  Wifi,
} from 'lucide-react';
import { fetchApi } from '../../../../lib/api';

type Destination = { id: string; label: string; type: string; endpointUrl: string; isActive: boolean };
type Analytics = {
  totalPublished: number;
  totalDrafts: number;
  totalViews: number;
  avgViewsPerPost: number;
  avgTimeOnPage: number;
  byMonth: { month: string; count: number }[];
  byPlatform: { platform: string; count: number }[];
  topTopics: { topic: string; views: number }[];
  topPosts: { title: string; views: number; remoteUrl?: string }[];
};
type Publication = {
  id: string;
  destination?: { label: string; type: string };
  blog?: { title: string };
  status: string;
  createdAt: string;
  remoteUrl?: string;
};
type RemotePost = {
  id: string;
  remoteId: string;
  title: string;
  remoteUrl?: string;
  destination?: { label: string; type: string };
  syncedAt: string;
};

type ActiveTab = 'overview' | 'history' | 'remote';

export default function PublishingAnalyticsPage() {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [selectedDestId, setSelectedDestId] = useState<string>('');
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [remotePosts, setRemotePosts] = useState<RemotePost[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [destOpen, setDestOpen] = useState(false);

  const selectedDest = useMemo(
    () => destinations.find(d => d.id === selectedDestId) ?? destinations[0],
    [destinations, selectedDestId],
  );

  const loadData = useCallback(async (destId?: string) => {
    setLoading(true);
    setSyncMessage('');
    const id = destId ?? selectedDestId;

    const [destRes, pubRes] = await Promise.all([
      fetchApi<Destination[]>('/blog-studio/destinations'),
      fetchApi<Publication[]>(`/blog-studio/publishing${id ? `?destinationId=${id}` : ''}`),
    ]);

    if (destRes.success && destRes.data) {
      setDestinations(destRes.data);
      if (!selectedDestId && destRes.data.length > 0) {
        setSelectedDestId(destRes.data[0].id);
      }
    }
    if (pubRes.success && pubRes.data) setPublications(pubRes.data);

    // Try to load analytics if endpoint exists
    const analyticsRes = await fetchApi<Analytics>(
      `/blog-studio/analytics${id ? `?destinationId=${id}` : ''}`,
    );
    if (analyticsRes.success && analyticsRes.data) setAnalytics(analyticsRes.data);
    else {
      // Build analytics from publication data
      const pubs = pubRes.data ?? [];
      const published = pubs.filter(p => p.status === 'PUBLISHED');
      const byMonth: Record<string, number> = {};
      const byPlatform: Record<string, number> = {};
      published.forEach(p => {
        const month = new Date(p.createdAt).toISOString().slice(0, 7);
        byMonth[month] = (byMonth[month] ?? 0) + 1;
        const plat = p.destination?.type?.toLowerCase() ?? 'unknown';
        byPlatform[plat] = (byPlatform[plat] ?? 0) + 1;
      });
      setAnalytics({
        totalPublished: published.length,
        totalDrafts: pubs.filter(p => p.status !== 'PUBLISHED').length,
        totalViews: 0,
        avgViewsPerPost: 0,
        avgTimeOnPage: 0,
        byMonth: Object.entries(byMonth).sort().map(([month, count]) => ({ month, count })),
        byPlatform: Object.entries(byPlatform).map(([platform, count]) => ({ platform, count })),
        topTopics: [],
        topPosts: published.slice(0, 6).map(p => ({ title: p.blog?.title ?? '—', views: 0, remoteUrl: p.remoteUrl })),
      });
    }

    // Load remote posts
    if (id) {
      const rpRes = await fetchApi<RemotePost[]>(`/blog-studio/remote-posts?destinationId=${id}`);
      if (rpRes.success && rpRes.data) setRemotePosts(rpRes.data);
    }

    setLoading(false);
  }, [selectedDestId]);

  useEffect(() => {
    const timer = setTimeout(() => void loadData(), 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  async function handleSync() {
    if (!selectedDest) return;
    setSyncing(true);
    setSyncMessage('');
    const res = await fetchApi<{ count: number }>(
      `/blog-studio/destinations/${selectedDest.id}/sync`,
      { method: 'POST' },
    );
    setSyncing(false);
    if (res.success && res.data) {
      setSyncMessage(`Synced ${res.data.count} posts from destination.`);
      await loadData(selectedDest.id);
    } else {
      setSyncMessage(res.error?.message ?? 'Sync failed.');
    }
  }

  async function handleTestConnection() {
    if (!selectedDest) return;
    setTesting(true);
    const res = await fetchApi<{ success: boolean; message?: string }>(
      `/blog-studio/destinations/${selectedDest.id}/test`,
      { method: 'POST' },
    );
    setTesting(false);
    setSyncMessage(
      res.success && res.data?.success
        ? 'Connection successful!'
        : res.data?.message ?? 'Connection test failed.',
    );
  }

  // Simple bar chart using CSS
  const maxBarValue = useMemo(
    () => Math.max(...(analytics?.byMonth.map(m => m.count) ?? [1]), 1),
    [analytics],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-indigo-500">
            <BarChart3 className="h-4 w-4" />
            Posts
          </span>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
            Publishing Analytics
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Track your published content performance
          </p>
        </div>

        {/* Controls: destination picker + test + sync */}
        <div className="flex flex-wrap items-center gap-2">
          {destinations.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setDestOpen(!destOpen)}
                className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:border-indigo-400 transition"
              >
                <Globe className="h-4 w-4 text-indigo-500" />
                {selectedDest?.label ?? 'Select destination'}
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>
              {destOpen && (
                <div className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg overflow-hidden">
                  {destinations.map(d => (
                    <button
                      key={d.id}
                      onClick={() => { setSelectedDestId(d.id); setDestOpen(false); void loadData(d.id); }}
                      className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 text-left ${d.id === selectedDestId ? 'font-bold text-indigo-600' : 'text-slate-700 dark:text-slate-200'}`}
                    >
                      <Globe className="h-3.5 w-3.5 shrink-0" />
                      {d.label}
                    </button>
                  ))}
                  <div className="border-t border-slate-100 dark:border-slate-800">
                    <Link
                      href="/app/blog-studio/settings"
                      onClick={() => setDestOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      Manage destinations →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
          <button
            onClick={handleTestConnection}
            disabled={testing || !selectedDest}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition"
          >
            <Wifi className="h-4 w-4" />
            {testing ? 'Testing…' : 'Test Connection'}
          </button>
          <button
            onClick={handleSync}
            disabled={syncing || !selectedDest}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Sync'}
          </button>
        </div>
      </header>

      {/* Sync/test message */}
      {syncMessage && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
          syncMessage.toLowerCase().includes('fail') || syncMessage.toLowerCase().includes('error')
            ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300'
            : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300'
        }`}>
          {syncMessage}
        </div>
      )}

      {destinations.length === 0 && !loading && (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center">
          <Send className="mx-auto h-8 w-8 text-slate-400" />
          <h3 className="mt-4 font-bold text-slate-900 dark:text-white">No publishing destinations configured</h3>
          <p className="mt-2 text-sm text-slate-500">Add a WordPress or Shopify destination in Settings to start publishing.</p>
          <Link href="/app/blog-studio/settings" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-indigo-500">
            Go to Settings →
          </Link>
        </div>
      )}

      {/* Stats Cards */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Published', value: analytics.totalPublished, icon: CheckCircle2, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' },
            { label: 'Drafts', value: analytics.totalDrafts, icon: FileEdit, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/30' },
            { label: 'Total Views', value: analytics.totalViews.toLocaleString(), icon: Eye, color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/30' },
            { label: 'Avg Views/Post', value: analytics.avgViewsPerPost.toFixed(1), icon: BarChart3, color: 'text-fuchsia-500 bg-fuchsia-50 dark:bg-fuchsia-950/30' },
            { label: 'Avg Time/Post', value: analytics.avgTimeOnPage > 0 ? `${analytics.avgTimeOnPage}s` : '0s', icon: Clock, color: 'text-sky-500 bg-sky-50 dark:bg-sky-950/30' },
          ].map(card => (
            <div key={card.label} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.color}`}>
                <card.icon className="h-4 w-4" />
              </div>
              <p className="text-xs font-semibold text-slate-500">{card.label}</p>
              <strong className="text-2xl font-black text-slate-950 dark:text-white">{card.value}</strong>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex border-b border-slate-100 dark:border-slate-800">
          {(['overview', 'history', 'remote'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3.5 text-sm font-semibold capitalize transition ${
                activeTab === tab
                  ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {tab === 'history' ? 'Publishing History' : tab === 'remote' ? 'Remote Posts' : 'Overview'}
            </button>
          ))}
        </div>

        {/* ── Overview Tab ── */}
        {activeTab === 'overview' && analytics && (
          <div className="p-6 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Publishes by Month bar chart */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-indigo-500" />
                  Publishes by Month
                </h3>
                {analytics.byMonth.length === 0 ? (
                  <p className="text-sm text-slate-400">No data yet.</p>
                ) : (
                  <div className="flex items-end gap-2 h-40">
                    {analytics.byMonth.map(m => (
                      <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{m.count}</span>
                        <div
                          className="w-full rounded-t bg-indigo-500 dark:bg-indigo-600 transition-all"
                          style={{ height: `${Math.max(4, (m.count / maxBarValue) * 120)}px` }}
                        />
                        <span className="text-[10px] text-slate-400 rotate-45 origin-left mt-1 whitespace-nowrap">{m.month}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* By Platform donut */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Globe className="h-4 w-4 text-indigo-500" />
                  By Platform
                </h3>
                {analytics.byPlatform.length === 0 ? (
                  <p className="text-sm text-slate-400">No data yet.</p>
                ) : (
                  <div className="space-y-3">
                    {analytics.byPlatform.map(p => {
                      const total = analytics.byPlatform.reduce((sum, x) => sum + x.count, 0);
                      const pct = total > 0 ? Math.round((p.count / total) * 100) : 0;
                      return (
                        <div key={p.platform}>
                          <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                            <span className="capitalize">{p.platform}</span>
                            <span>{p.count} ({pct}%)</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-indigo-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Top Topics */}
              {analytics.topTopics.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Top Topics by Views</h3>
                  <div className="space-y-2">
                    {analytics.topTopics.map(t => (
                      <div key={t.topic} className="flex justify-between items-center text-sm">
                        <span className="text-slate-600 dark:text-slate-300 truncate">{t.topic}</span>
                        <span className="font-bold text-slate-900 dark:text-white ml-2">{t.views}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Posts */}
              {analytics.topPosts.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Top posts</h3>
                  <ol className="space-y-2">
                    {analytics.topPosts.map((post, i) => (
                      <li key={post.title} className="flex items-center gap-3 text-sm">
                        <span className="text-xs font-bold text-slate-400 w-4 shrink-0">{i + 1}.</span>
                        <span className="text-slate-700 dark:text-slate-200 flex-1 truncate">{post.title}</span>
                        <span className="font-bold text-slate-900 dark:text-white">{post.views}</span>
                        {post.remoteUrl && (
                          <a href={post.remoteUrl} target="_blank" rel="noreferrer" className="text-indigo-500 hover:text-indigo-600">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>

            {/* Recent Publishes */}
            {publications.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Send className="h-4 w-4 text-indigo-500" />
                  Recent Publishes
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs font-semibold text-slate-500 border-b border-slate-100 dark:border-slate-800">
                        <th className="text-left pb-2 pr-4">Destination</th>
                        <th className="text-left pb-2 pr-4">Platform</th>
                        <th className="text-left pb-2 pr-4">Status</th>
                        <th className="text-left pb-2 pr-4">Date</th>
                        <th className="text-left pb-2">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                      {publications.slice(0, 10).map(pub => (
                        <tr key={pub.id} className="text-slate-600 dark:text-slate-300">
                          <td className="py-2.5 pr-4 font-medium">{pub.destination?.label ?? '—'}</td>
                          <td className="py-2.5 pr-4">
                            <span className="rounded px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 capitalize">
                              {pub.destination?.type?.toLowerCase() ?? '—'}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4">
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${pub.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400'}`}>
                              {pub.status === 'PUBLISHED' ? 'Publish' : pub.status}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4 text-xs">
                            {new Date(pub.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-2.5">
                            {pub.remoteUrl ? (
                              <a
                                href={pub.remoteUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-xs font-bold text-indigo-500 hover:text-indigo-600"
                              >
                                <ExternalLink className="h-3 w-3" />
                                View
                              </a>
                            ) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Publishing History Tab ── */}
        {activeTab === 'history' && (
          <div>
            {loading ? (
              <div className="p-10 text-center text-sm text-slate-500">Loading publication history…</div>
            ) : publications.length === 0 ? (
              <div className="p-10 text-center">
                <Send className="mx-auto h-8 w-8 text-slate-400" />
                <h3 className="mt-4 font-bold text-slate-900 dark:text-white">No publications yet</h3>
                <p className="mt-2 text-sm text-slate-500">Go to History to publish an article.</p>
                <Link href="/app/blog-studio/history" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-indigo-500">
                  Go to History →
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {publications.map(pub => (
                  <div key={pub.id} className="grid md:grid-cols-[minmax(0,1fr)_180px_130px_120px] gap-4 p-5 items-center hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white">{pub.blog?.title ?? '—'}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">{pub.destination?.label ?? 'Unknown destination'}</p>
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(pub.createdAt).toLocaleString()}
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold w-fit ${pub.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400'}`}>
                      {pub.status === 'PUBLISHED' ? <CheckCircle2 className="h-3 w-3" /> : null}
                      {pub.status}
                    </span>
                    {pub.remoteUrl ? (
                      <a href={pub.remoteUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-bold text-indigo-500">
                        <ExternalLink className="h-3 w-3" />
                        View
                      </a>
                    ) : <span />}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Remote Posts Tab ── */}
        {activeTab === 'remote' && (
          <div>
            {loading ? (
              <div className="p-10 text-center text-sm text-slate-500">Loading remote posts…</div>
            ) : remotePosts.length === 0 ? (
              <div className="p-10 text-center">
                <Globe className="mx-auto h-8 w-8 text-slate-400" />
                <h3 className="mt-4 font-bold text-slate-900 dark:text-white">No remote posts synced</h3>
                <p className="mt-2 text-sm text-slate-500">Click "Sync" above to pull posts from your destination.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {remotePosts.map(post => (
                  <div key={post.id} className="grid md:grid-cols-[minmax(0,1fr)_160px_120px] gap-4 p-5 items-center hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white">{post.title}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Remote ID: {post.remoteId}</p>
                    </div>
                    <div className="text-xs text-slate-500">
                      Synced {new Date(post.syncedAt).toLocaleDateString()}
                    </div>
                    {post.remoteUrl ? (
                      <a href={post.remoteUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-bold text-indigo-500">
                        <ExternalLink className="h-3 w-3" />
                        Open post
                      </a>
                    ) : <span />}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
