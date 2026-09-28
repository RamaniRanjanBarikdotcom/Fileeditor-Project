import { useState, useEffect } from 'react';
import { RefreshCw, Save } from 'lucide-react';
import {
  GENERATION_PROVIDERS,
  IMAGE_PROVIDERS,
  mergeModelOptions,
} from '../constants';
import { fetchApi } from '../../../../../lib/api';

type ProviderCredential = {
  id: string;
  providerType: string;
  label: string;
  isActive: boolean;
};

type DiscoveredModel = { id: string; name: string };

export default function AiTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [notice, setNotice] = useState('');

  const [aiProvider, setAiProvider] = useState('openai');
  const [aiModel, setAiModel] = useState('gpt-6-luna');
  const [imageProvider, setImageProvider] = useState('openai');
  const [imageModel, setImageModel] = useState('gpt-image-2.5-flare');
  const [maxTokens, setMaxTokens] = useState('');
  const [temperature, setTemperature] = useState<number | string>(0.7);
  const [enableModelDiscovery, setEnableModelDiscovery] = useState(true);
  const [providerCredentials, setProviderCredentials] = useState<ProviderCredential[]>([]);
  const [discoveredModels, setDiscoveredModels] = useState<Record<string, string[]>>({});
  const [discovering, setDiscovering] = useState(false);

  useEffect(() => {
    async function load() {
      const [res, providers] = await Promise.all([
        fetchApi<any>('/blog-studio/settings'),
        fetchApi<ProviderCredential[]>('/blog-studio/providers'),
      ]);
      if (res.success && res.data) {
        setAiModel(res.data.defaultTextModel || 'gpt-6-luna');
        setImageModel(res.data.defaultImageModel || 'gpt-image-2.5-flare');
        setEnableModelDiscovery(res.data.enableModelDiscovery ?? true);
        
        if (res.data.settingsJson) {
          setAiProvider(res.data.settingsJson.aiProvider || 'openai');
          setImageProvider(res.data.settingsJson.imageProvider || 'openai');
          setMaxTokens(res.data.settingsJson.maxTokens ?? '');
          setTemperature(res.data.settingsJson.temperature ?? 0.7);
        }
      }
      if (providers.success && providers.data) {
        setProviderCredentials(providers.data.filter((provider) => provider.isActive));
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    setError('');
    setSuccess('');
    setNotice('');
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

  async function discoverProviderModels() {
    const credential = providerCredentials.find(
      (provider) => provider.providerType.toLowerCase() === aiProvider,
    );
    if (!credential) {
      setError('');
      setNotice(
        `The current ${selectedAiProvider.name} catalog is already available below. An API key is only needed to discover account-specific or newly released models.`,
      );
      return;
    }
    setDiscovering(true);
    setError('');
    setSuccess('');
    setNotice('');
    const result = await fetchApi<{ models?: DiscoveredModel[] }>(
      `/blog-studio/providers/${credential.id}/test`,
      { method: 'POST' },
    );
    setDiscovering(false);
    if (!result.success) {
      setError(result.error?.message || 'Could not discover models from this provider.');
      return;
    }
    const models = (result.data?.models || []).map((model) => model.id).filter(Boolean);
    setDiscoveredModels((current) => ({ ...current, [aiProvider]: models }));
    setSuccess(
      models.length
        ? `Discovered ${models.length} compatible models from ${selectedAiProvider.name}.`
        : `Connection succeeded, but ${selectedAiProvider.name} returned no text-generation models.`,
    );
  }

  const selectedAiProvider = GENERATION_PROVIDERS.find(p => p.id === aiProvider) || GENERATION_PROVIDERS[0];
  const selectedImageProvider = IMAGE_PROVIDERS.find(p => p.id === imageProvider) || IMAGE_PROVIDERS[0];
  const textModelOptions = mergeModelOptions(
    selectedAiProvider.models,
    discoveredModels[aiProvider] || [],
  );
  const imageModelOptions = mergeModelOptions(selectedImageProvider.imageModels, []);
  const textModelSelection = textModelOptions.includes(aiModel) ? aiModel : '__custom__';
  const imageModelSelection = imageModelOptions.includes(imageModel) ? imageModel : '__custom__';
  const matchingCredential = providerCredentials.find(
    (provider) => provider.providerType.toLowerCase() === aiProvider,
  );

  if (loading) return <div className="text-slate-400">Loading AI settings...</div>;

  return (
    <div className="space-y-6 max-w-4xl relative pb-16">
      <div>
        <h2 className="text-xl font-bold">AI generation</h2>
        <p className="mt-1 text-sm text-slate-400">Configure your text and image models</p>
      </div>

      {error && <div className="text-red-400 text-sm">{error}</div>}
      {success && <div className="text-green-400 text-sm">{success}</div>}
      {notice && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
          {notice}
        </div>
      )}

      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-300">Text Provider</label>
            <select
              value={aiProvider}
              onChange={(e) => {
                setAiProvider(e.target.value);
                setError('');
                setNotice('');
                const p = GENERATION_PROVIDERS.find(x => x.id === e.target.value);
                if (p && p.models.length > 0) setAiModel(p.models[0]);
              }}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500"
            >
              {GENERATION_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-semibold text-slate-300">Text model</label>
              {enableModelDiscovery && matchingCredential ? (
                <button
                  type="button"
                  onClick={discoverProviderModels}
                  disabled={discovering}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${discovering ? 'animate-spin' : ''}`} />
                  {discovering ? 'Discovering…' : 'Refresh live models'}
                </button>
              ) : enableModelDiscovery ? (
                <span className="text-xs text-slate-500">Live discovery is optional</span>
              ) : null}
            </div>
            <select
              value={textModelSelection}
              onChange={(e) => setAiModel(e.target.value === '__custom__' ? '' : e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 font-mono text-sm text-white outline-none focus:border-blue-500"
            >
              {textModelOptions.map((model) => <option key={model} value={model}>{model}</option>)}
              <option value="__custom__">Custom or future model ID…</option>
            </select>
            {textModelSelection === '__custom__' && (
              <input
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                placeholder="Enter the exact provider model ID"
                autoComplete="off"
                className="w-full rounded-lg border border-blue-500/40 bg-slate-900 px-4 py-2.5 font-mono text-sm text-white outline-none focus:border-blue-400"
              />
            )}
            <p className="text-xs text-slate-500">
              Browse and save current models without a personal API key. Generation uses the
              platform-managed AI connection; connect your own key only for account-specific live
              discovery, or enter an exact future model ID.
            </p>
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
              {IMAGE_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-300">Image Model</label>
            <select
              value={imageModelSelection}
              onChange={(e) => setImageModel(e.target.value === '__custom__' ? '' : e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 font-mono text-sm text-white outline-none focus:border-blue-500"
            >
              {imageModelOptions.map((model) => <option key={model} value={model}>{model}</option>)}
              <option value="__custom__">Custom or future model ID…</option>
            </select>
            {imageModelSelection === '__custom__' && (
              <input
                value={imageModel}
                onChange={(e) => setImageModel(e.target.value)}
                placeholder="Enter the exact image model ID"
                autoComplete="off"
                className="w-full rounded-lg border border-blue-500/40 bg-slate-900 px-4 py-2.5 font-mono text-sm text-white outline-none focus:border-blue-400"
              />
            )}
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
