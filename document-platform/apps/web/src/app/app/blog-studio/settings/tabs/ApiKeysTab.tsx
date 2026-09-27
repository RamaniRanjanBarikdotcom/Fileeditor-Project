import { useState, useEffect } from 'react';
import { Plus, Trash2, Key } from 'lucide-react';
import { fetchApi } from '../../../../../lib/api';
import { GENERATION_PROVIDERS } from '../constants';

export default function ApiKeysTab() {
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // For adding a new key
  const [newProviderType, setNewProviderType] = useState('OPENAI');
  const [newLabel, setNewLabel] = useState('');
  const [newKey, setNewKey] = useState('');

  useEffect(() => {
    loadProviders();
  }, []);

  async function loadProviders() {
    setLoading(true);
    const res = await fetchApi<any[]>('/blog-studio/providers');
    if (res.success && res.data) {
      setProviders(res.data);
    }
    setLoading(false);
  }

  async function handleAdd() {
    if (!newKey) {
      setError('API Key is required');
      return;
    }
    setError('');
    
    // Check if standard provider label is missing, give it a default label
    const defaultLabel = GENERATION_PROVIDERS.find(p => p.id.toUpperCase() === newProviderType)?.name || newProviderType;
    const labelToUse = newLabel || defaultLabel;

    const res = await fetchApi('/blog-studio/providers', {
      method: 'POST',
      body: JSON.stringify({
        providerType: newProviderType,
        label: labelToUse,
        apiKey: newKey
      })
    });

    if (res.success) {
      setNewKey('');
      setNewLabel('');
      setSuccess('API Key added successfully');
      setTimeout(() => setSuccess(''), 3000);
      loadProviders();
    } else {
      setError(res.error?.message || 'Failed to add API key');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this key?')) return;
    
    const res = await fetchApi(`/blog-studio/providers/${id}`, {
      method: 'DELETE'
    });

    if (res.success) {
      setSuccess('API Key deleted');
      setTimeout(() => setSuccess(''), 3000);
      loadProviders();
    } else {
      setError(res.error?.message || 'Failed to delete API key');
    }
  }

  if (loading) return <div className="text-slate-400">Loading API keys...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold">API Keys</h2>
        <p className="mt-1 text-sm text-slate-400">Bring your own keys to use external AI providers</p>
      </div>

      {error && <div className="text-red-400 text-sm">{error}</div>}
      {success && <div className="text-green-400 text-sm">{success}</div>}

      <div className="rounded-xl border border-slate-700 bg-slate-800 p-6 space-y-4">
        <h3 className="font-semibold text-white">Add New Key</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400">Provider</label>
            <select
              value={newProviderType}
              onChange={(e) => setNewProviderType(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-white outline-none focus:border-blue-500"
            >
              {GENERATION_PROVIDERS.map(p => (
                <option key={p.id} value={p.id.toUpperCase()}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400">Label (Optional)</label>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. My OpenAI Key"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-white outline-none focus:border-blue-500"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400">API Key</label>
            <input
              type="password"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="sk-..."
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-white outline-none focus:border-blue-500 font-mono"
            />
          </div>
        </div>
        <button
          onClick={handleAdd}
          className="mt-2 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 transition"
        >
          <Plus className="h-4 w-4" /> Add Key
        </button>
      </div>

      <div className="space-y-4 pt-4">
        <h3 className="font-semibold text-white">Configured Keys</h3>
        {providers.length === 0 ? (
          <div className="text-sm text-slate-500 italic">No API keys configured yet.</div>
        ) : (
          <div className="grid gap-3">
            {providers.map((provider) => (
              <div key={provider.id} className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700">
                    <Key className="h-5 w-5 text-slate-400" />
                  </div>
                  <div>
                    <div className="font-medium text-white">{provider.label}</div>
                    <div className="text-xs text-slate-400">
                      {provider.providerType} • {provider.maskedIdentifier}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(provider.id)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-red-400 transition"
                  title="Delete Key"
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
