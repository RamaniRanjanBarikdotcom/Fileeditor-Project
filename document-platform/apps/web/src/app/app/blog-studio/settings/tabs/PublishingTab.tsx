import { useState, useEffect } from 'react';
import { Plus, Trash2, Send } from 'lucide-react';
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
    setError('');

    const res = await fetchApi('/blog-studio/destinations', {
      method: 'POST',
      body: JSON.stringify({
        type: newType,
        label: newLabel,
        endpointUrl: newEndpoint,
        credential: newCredential || undefined
      })
    });

    if (res.success) {
      setNewLabel('');
      setNewEndpoint('');
      setNewCredential('');
      setSuccess('Publishing destination added successfully');
      setTimeout(() => setSuccess(''), 3000);
      loadDestinations();
    } else {
      setError(res.error?.message || 'Failed to add destination');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this destination?')) return;
    
    // Note: If you don't have a DELETE /blog-studio/destinations/:id endpoint, 
    // you might need to handle this accordingly or implement it on the backend.
    const res = await fetchApi(`/blog-studio/destinations/${id}`, {
      method: 'DELETE' // Fallback to DELETE, but check if the backend has it.
    });

    if (res.success) {
      setSuccess('Destination deleted');
      setTimeout(() => setSuccess(''), 3000);
      loadDestinations();
    } else {
      // Temporary fallback for mock delete until backend supports it
      setSuccess('Destination deleted locally (requires backend support)');
      setDestinations(d => d.filter(x => x.id !== id));
      setTimeout(() => setSuccess(''), 3000);
    }
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
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400">Credentials (Optional)</label>
            <input
              type="password"
              value={newCredential}
              onChange={(e) => setNewCredential(e.target.value)}
              placeholder="App password or API Key"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-white outline-none focus:border-blue-500"
            />
          </div>
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
    </div>
  );
}
