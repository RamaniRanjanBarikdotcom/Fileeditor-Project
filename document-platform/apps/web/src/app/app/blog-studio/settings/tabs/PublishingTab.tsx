import { useState, useEffect } from 'react';
import { Plus, RefreshCw, Send, Tags, Trash2 } from 'lucide-react';
import { fetchApi } from '../../../../../lib/api';

const DESTINATION_TYPES = [
  { id: 'WORDPRESS', name: 'WordPress' },
  { id: 'SHOPIFY', name: 'Shopify' },
  { id: 'CUSTOM', name: 'Custom API' },
  { id: 'JTL', name: 'JTL-Shop' },
];

export default function PublishingTab() {
  const [loading, setLoading] = useState(true);
  const [destinations, setDestinations] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [newType, setNewType] = useState('WORDPRESS');
  const [newLabel, setNewLabel] = useState('');
  const [newEndpoint, setNewEndpoint] = useState('');
  const [newCredential, setNewCredential] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newBlogId, setNewBlogId] = useState('');
  const [categoryDestinationId, setCategoryDestinationId] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [mappings, setMappings] = useState<any[]>([]);
  const [localCategory, setLocalCategory] = useState('');
  const [remoteCategoryId, setRemoteCategoryId] = useState('');
  const [newRemoteCategory, setNewRemoteCategory] = useState('');
  const [categoryLoading, setCategoryLoading] = useState(false);

  useEffect(() => {
    loadDestinations();
  }, []);

  async function loadDestinations() {
    setLoading(true);
    const res = await fetchApi<any[]>('/blog-studio/destinations');
    if (res.success && res.data) {
      setDestinations(res.data);
    }
    setLoading(false);
  }

  async function handleAdd() {
    if (!newLabel || !newEndpoint) {
      setError('Label and Endpoint URL are required');
      return;
    }
    if (newType === 'WORDPRESS' && (!newUsername || !newCredential)) {
      setError('WordPress username and application password are required.');
      return;
    }
    if (newType === 'SHOPIFY' && (!newCredential || !newBlogId)) {
      setError('Shopify access token and blog ID are required.');
      return;
    }
    setError('');

    const res = await fetchApi('/blog-studio/destinations', {
      method: 'POST',
      body: JSON.stringify({
        type: newType,
        label: newLabel,
        endpointUrl: newEndpoint,
        credential: newCredential
          ? JSON.stringify(
              newType === 'WORDPRESS'
                ? { username: newUsername, applicationPassword: newCredential }
                : { token: newCredential },
            )
          : undefined,
        configJson: newType === 'SHOPIFY' ? { blogId: newBlogId } : undefined,
      })
    });

    if (res.success) {
      setNewLabel('');
      setNewEndpoint('');
      setNewCredential('');
      setNewUsername('');
      setNewBlogId('');
      setSuccess('Publishing destination added successfully');
      setTimeout(() => setSuccess(''), 3000);
      loadDestinations();
    } else {
      setError(res.error?.message || 'Failed to add destination');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this destination?')) return;
    
    const res = await fetchApi(`/blog-studio/destinations/${id}`, {
      method: 'DELETE'
    });

    if (res.success) {
      setSuccess('Destination deleted');
      setTimeout(() => setSuccess(''), 3000);
      loadDestinations();
    } else {
      setError(res.error?.message || 'Destination could not be deleted.');
    }
  }

  async function loadCategories(destinationId: string) {
    setCategoryDestinationId(destinationId);
    setCategoryLoading(true);
    setError('');
    const res = await fetchApi<{ categories: any[]; mappings: any[] }>(
      `/blog-studio/destinations/${destinationId}/categories`,
    );
    setCategoryLoading(false);
    if (!res.success || !res.data) {
      setError(res.error?.message || 'Categories could not be loaded.');
      return;
    }
    setCategories(res.data.categories || []);
    setMappings(res.data.mappings || []);
    setRemoteCategoryId(res.data.categories?.[0]?.id || '');
  }

  async function createRemoteCategory() {
    if (!categoryDestinationId || !newRemoteCategory.trim()) return;
    const res = await fetchApi<any>(
      `/blog-studio/destinations/${categoryDestinationId}/categories`,
      { method: 'POST', body: JSON.stringify({ name: newRemoteCategory.trim() }) },
    );
    if (!res.success || !res.data) {
      setError(res.error?.message || 'Remote category could not be created.');
      return;
    }
    setNewRemoteCategory('');
    await loadCategories(categoryDestinationId);
    setRemoteCategoryId(res.data.id);
    setSuccess('Remote category created.');
  }

  async function saveCategoryMapping() {
    const remote = categories.find((category) => category.id === remoteCategoryId);
    if (!categoryDestinationId || !localCategory.trim() || !remote) {
      setError('Enter a local category and select a remote category.');
      return;
    }
    const res = await fetchApi(
      `/blog-studio/destinations/${categoryDestinationId}/category-mappings`,
      {
        method: 'POST',
        body: JSON.stringify({
          localCategory: localCategory.trim(),
          remoteId: remote.id,
          remoteName: remote.name,
        }),
      },
    );
    if (!res.success) {
      setError(res.error?.message || 'Category mapping could not be saved.');
      return;
    }
    setLocalCategory('');
    await loadCategories(categoryDestinationId);
    setSuccess('Category mapping saved. Matching blog keywords will publish to this category.');
  }

  async function deleteCategoryMapping(mappingId: string) {
    const res = await fetchApi(
      `/blog-studio/destinations/${categoryDestinationId}/category-mappings/${mappingId}`,
      { method: 'DELETE' },
    );
    if (!res.success) return setError(res.error?.message || 'Category mapping could not be deleted.');
    await loadCategories(categoryDestinationId);
  }

  if (loading) return <div className="text-slate-400">Loading publishing settings...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold">Publishing Destinations</h2>
        <p className="mt-1 text-sm text-slate-400">Configure where your generated blogs will be published</p>
      </div>

      {error && <div className="text-red-400 text-sm">{error}</div>}
      {success && <div className="text-green-400 text-sm">{success}</div>}

      <div className="rounded-xl border border-slate-700 bg-slate-800 p-6 space-y-4">
        <h3 className="font-semibold text-white">Add New Destination</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400">Type</label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-white outline-none focus:border-blue-500"
            >
              {DESTINATION_TYPES.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400">Label</label>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. My WordPress Blog"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-white outline-none focus:border-blue-500"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400">Endpoint URL</label>
            <input
              type="url"
              value={newEndpoint}
              onChange={(e) => setNewEndpoint(e.target.value)}
              placeholder="https://my-blog.com"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-white outline-none focus:border-blue-500"
            />
          </div>
          {newType === 'WORDPRESS' && <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400">WordPress username</label>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="editor@example.com"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-white outline-none focus:border-blue-500"
            />
          </div>}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400">{newType === 'WORDPRESS' ? 'Application password' : newType === 'SHOPIFY' ? 'Admin API access token' : 'Bearer token (optional)'}</label>
            <input
              type="password"
              value={newCredential}
              onChange={(e) => setNewCredential(e.target.value)}
              placeholder={newType === 'WORDPRESS' ? 'xxxx xxxx xxxx xxxx' : 'Secret token'}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-white outline-none focus:border-blue-500"
            />
          </div>
          {newType === 'SHOPIFY' && <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400">Shopify blog ID</label>
            <input
              type="text"
              value={newBlogId}
              onChange={(e) => setNewBlogId(e.target.value)}
              placeholder="123456789"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-white outline-none focus:border-blue-500"
            />
          </div>}
        </div>
        <button
          onClick={handleAdd}
          className="mt-2 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 transition"
        >
          <Plus className="h-4 w-4" /> Add Destination
        </button>
      </div>

      <div className="space-y-4 pt-4">
        <h3 className="font-semibold text-white">Configured Destinations</h3>
        {destinations.length === 0 ? (
          <div className="text-sm text-slate-500 italic">No publishing destinations configured.</div>
        ) : (
          <div className="grid gap-3">
            {destinations.map((dest) => (
              <div key={dest.id} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700">
                    <Send className="h-5 w-5 text-slate-400" />
                  </div>
                  <div>
                    <div className="font-medium text-white">{dest.label}</div>
                    <div className="text-xs text-slate-400">
                      {dest.type} • {dest.endpointUrl}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => void loadCategories(dest.id)}
                  disabled={dest.type !== 'WORDPRESS'}
                  className="mr-2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-700 hover:text-indigo-300 disabled:cursor-not-allowed disabled:opacity-30"
                  title={dest.type === 'WORDPRESS' ? 'Manage category mappings' : 'Category mappings currently support WordPress'}
                >
                  <Tags className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(dest.id)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-red-400 transition"
                  title="Delete Destination"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {categoryDestinationId && (
        <div className="space-y-5 rounded-xl border border-slate-700 bg-slate-800 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="flex items-center gap-2 font-semibold text-white"><Tags className="h-4 w-4 text-indigo-400" /> WordPress category mapping</h3>
              <p className="mt-1 text-xs text-slate-400">Map local blog keywords to WordPress category IDs. Matching mappings are applied automatically during publishing.</p>
            </div>
            <button onClick={() => void loadCategories(categoryDestinationId)} disabled={categoryLoading} className="rounded-lg border border-slate-600 p-2 text-slate-300 hover:bg-slate-700" title="Refresh categories"><RefreshCw className={`h-4 w-4 ${categoryLoading ? 'animate-spin' : ''}`} /></button>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <input value={localCategory} onChange={(event) => setLocalCategory(event.target.value)} maxLength={120} placeholder="Local keyword or category" className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-white" />
            <select value={remoteCategoryId} onChange={(event) => setRemoteCategoryId(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-white">
              <option value="">Select WordPress category</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name} ({category.count})</option>)}
            </select>
            <button onClick={() => void saveCategoryMapping()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-500">Save mapping</button>
          </div>

          <div className="flex gap-3">
            <input value={newRemoteCategory} onChange={(event) => setNewRemoteCategory(event.target.value)} maxLength={120} placeholder="Create a new WordPress category" className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-white" />
            <button onClick={() => void createRemoteCategory()} className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-slate-700">Create category</button>
          </div>

          <div className="space-y-2">
            {mappings.length === 0 ? <p className="text-sm italic text-slate-500">No category mappings yet.</p> : mappings.map((mapping) => (
              <div key={mapping.id} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm">
                <span><strong className="text-white">{mapping.localCategory}</strong><span className="mx-2 text-slate-500">→</span><span className="text-indigo-300">{mapping.remoteName}</span></span>
                <button onClick={() => void deleteCategoryMapping(mapping.id)} className="rounded p-1.5 text-slate-500 hover:bg-slate-800 hover:text-red-400" aria-label={`Delete mapping for ${mapping.localCategory}`}><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
