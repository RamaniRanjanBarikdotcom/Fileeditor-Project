import { useState, useEffect } from 'react';
import { Save, Database } from 'lucide-react';
import { fetchApi } from '../../../../../lib/api';

export default function StorageTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [enabled, setEnabled] = useState(false);
  const [endpointUrl, setEndpointUrl] = useState('');
  const [authToken, setAuthToken] = useState('');

  useEffect(() => {
    async function load() {
      const res = await fetchApi<any>('/blog-studio/settings');
      if (res.success && res.data && res.data.settingsJson?.imageStorage) {
        setEnabled(res.data.settingsJson.imageStorage.enabled === true);
        setEndpointUrl(res.data.settingsJson.imageStorage.endpointUrl || '');
        setAuthToken(res.data.settingsJson.imageStorage.authToken || '');
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    setError('');
    setSuccess('');
    const res = await fetchApi('/blog-studio/settings', {
      method: 'PATCH',
      body: JSON.stringify({
        settingsJson: {
          imageStorage: {
            enabled,
            endpointUrl,
            authToken
          }
        }
      }),
    });
    setSaving(false);
    if (res.success) {
      setSuccess('Storage settings saved successfully.');
      setTimeout(() => setSuccess(''), 3000);
    } else {
      setError(res.error?.message || 'Failed to save storage settings.');
    }
  }

  if (loading) return <div className="text-slate-400">Loading storage settings...</div>;

  return (
    <div className="space-y-6 max-w-4xl relative pb-16">
      <div>
        <h2 className="text-xl font-bold">Custom Image Storage</h2>
        <p className="mt-1 text-sm text-slate-400">Configure an external server to host generated images (instead of embedding base64 directly)</p>
      </div>

      {error && <div className="text-red-400 text-sm">{error}</div>}
      {success && <div className="text-green-400 text-sm">{success}</div>}

      <div className="rounded-xl border border-slate-700 bg-slate-800 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-500/20 p-2 text-blue-400">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Enable Remote Image Storage</h3>
              <p className="text-xs text-slate-400">Images will be uploaded to your server during generation</p>
            </div>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input 
              type="checkbox" 
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="peer sr-only" 
            />
            <div className="peer h-6 w-11 rounded-full bg-slate-700 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none"></div>
          </label>
        </div>

        {enabled && (
          <div className="grid gap-6 border-t border-slate-700 pt-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-300">Upload Endpoint URL</label>
              <input
                type="url"
                value={endpointUrl}
                onChange={(e) => setEndpointUrl(e.target.value)}
                placeholder="https://your-server.com/api/upload"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500"
              />
              <p className="text-xs text-slate-500">Must accept multipart/form-data POST requests</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-300">Bearer Token (Optional)</label>
              <input
                type="password"
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                placeholder="Secret authentication token"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500 font-mono"
              />
              <p className="text-xs text-slate-500">Will be sent in the Authorization header</p>
            </div>
          </div>
        )}
      </div>
      
      <div className="absolute -bottom-6 right-0">
        <button 
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 transition disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Storage Settings'}
        </button>
      </div>
    </div>
  );
}
