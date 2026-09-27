import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { GENERATION_PROVIDERS } from '../constants';
import { fetchApi } from '../../../../../lib/api';

export default function AiTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [aiProvider, setAiProvider] = useState('openai');
  const [aiModel, setAiModel] = useState('gpt-5-mini');
  const [imageProvider, setImageProvider] = useState('openai');
  const [imageModel, setImageModel] = useState('gpt-image-1');
  const [maxTokens, setMaxTokens] = useState('');
  const [temperature, setTemperature] = useState<number | string>(0.7);
  const [enableModelDiscovery, setEnableModelDiscovery] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetchApi<any>('/blog-studio/settings');
      if (res.success && res.data) {
        setAiModel(res.data.defaultTextModel || 'gpt-5-mini');
        setImageModel(res.data.defaultImageModel || 'gpt-image-1');
        setEnableModelDiscovery(res.data.enableModelDiscovery ?? true);
        
        if (res.data.settingsJson) {
          setAiProvider(res.data.settingsJson.aiProvider || 'openai');
          setImageProvider(res.data.settingsJson.imageProvider || 'openai');
          setMaxTokens(res.data.settingsJson.maxTokens ?? '');
          setTemperature(res.data.settingsJson.temperature ?? 0.7);
        }
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
        defaultTextModel: aiModel,
        defaultImageModel: imageModel,
        enableModelDiscovery,
        settingsJson: {
          aiProvider,
          imageProvider,
          maxTokens: maxTokens === '' ? null : Number(maxTokens),
          temperature: Number(temperature) || 0.7,
        },
      }),
    });
    setSaving(false);
    if (res.success) {
      setSuccess('Settings saved successfully.');
      setTimeout(() => setSuccess(''), 3000);
    } else {
      setError(res.error?.message || 'Failed to save settings.');
    }
  }

  const selectedAiProvider = GENERATION_PROVIDERS.find(p => p.id === aiProvider) || GENERATION_PROVIDERS[0];
  const selectedImageProvider = GENERATION_PROVIDERS.find(p => p.id === imageProvider) || GENERATION_PROVIDERS[0];

  if (loading) return <div className="text-slate-400">Loading AI settings...</div>;

  return (
    <div className="space-y-6 max-w-4xl relative pb-16">
      <div>
        <h2 className="text-xl font-bold">AI generation</h2>
        <p className="mt-1 text-sm text-slate-400">Configure your text and image models</p>
      </div>

      {error && <div className="text-red-400 text-sm">{error}</div>}
      {success && <div className="text-green-400 text-sm">{success}</div>}

      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-300">Text Provider</label>
            <select
              value={aiProvider}
              onChange={(e) => {
                setAiProvider(e.target.value);
                const p = GENERATION_PROVIDERS.find(x => x.id === e.target.value);
                if (p && p.models.length > 0) setAiModel(p.models[0]);
              }}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500"
            >
              {GENERATION_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-300">Text Model</label>
            <select
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500"
            >
              {selectedAiProvider?.models.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-300">Image Provider</label>
            <select
              value={imageProvider}
              onChange={(e) => {
                setImageProvider(e.target.value);
                const p = GENERATION_PROVIDERS.find(x => x.id === e.target.value);
                if (p && p.imageModels.length > 0) setImageModel(p.imageModels[0]);
              }}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500"
            >
              {GENERATION_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-300">Image Model</label>
            <select
              value={imageModel}
              onChange={(e) => setImageModel(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500"
            >
              {selectedImageProvider?.imageModels.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-300">Max tokens</label>
            <input
              type="number"
              value={maxTokens}
              onChange={(e) => setMaxTokens(e.target.value)}
              placeholder="e.g. 4000 (Optional)"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500"
            />
          </div>
          <div className="space-y-2 relative">
            <label className="text-sm font-semibold text-slate-300">Temperature ({temperature})</label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              className="w-full mt-2 accent-blue-500"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>More focused</span>
              <span>More creative</span>
            </div>
          </div>
        </div>

        <div className="flex items-center pt-4">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 cursor-pointer">
            <input 
              type="checkbox" 
              checked={enableModelDiscovery}
              onChange={(e) => setEnableModelDiscovery(e.target.checked)}
              className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-blue-500 focus:ring-blue-500" 
            />
            Enable Automatic Model Discovery
          </label>
        </div>
      </div>

      <div className="absolute -bottom-6 right-0">
        <button 
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 transition disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
