import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { SERP_PROVIDERS, DEEP_RESEARCH_PROVIDERS } from '../constants';
import { fetchApi } from '../../../../../lib/api';

export default function ResearchTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [siteBaseUrl, setSiteBaseUrl] = useState('');
  const [linkPreviewApiKey, setLinkPreviewApiKey] = useState('');
  const [useWikipedia, setUseWikipedia] = useState(true);
  const [tavilyKey, setTavilyKey] = useState('');
  const [perplexityKey, setPerplexityKey] = useState('');
  
  const [serpProvider, setSerpProvider] = useState('openai');
  const [deepResearchProvider, setDeepResearchProvider] = useState('openai');
  const [deepResearchModel, setDeepResearchModel] = useState('gpt-4o-mini');

  useEffect(() => {
    async function load() {
      const res = await fetchApi<any>('/blog-studio/settings');
      if (res.success && res.data) {
        setSerpProvider(res.data.defaultSearchProvider || 'openai');
        setDeepResearchProvider(res.data.deepResearchProvider || 'openai');
        
        if (res.data.settingsJson) {
          setSiteBaseUrl(res.data.settingsJson.siteBaseUrl || '');
          setLinkPreviewApiKey(res.data.settingsJson.linkPreviewApiKey || '');
          setUseWikipedia(res.data.settingsJson.useWikipedia !== false);
          setTavilyKey(res.data.settingsJson.tavilyKey || '');
          setPerplexityKey(res.data.settingsJson.perplexityKey || '');
          setDeepResearchModel(res.data.settingsJson.deepResearchModel || 'gpt-4o-mini');
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
        defaultSearchProvider: serpProvider,
        deepResearchProvider: deepResearchProvider,
        settingsJson: {
          siteBaseUrl,
          linkPreviewApiKey,
          useWikipedia,
          tavilyKey,
          perplexityKey,
          deepResearchModel,
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

  if (loading) return <div className="text-slate-400">Loading research settings...</div>;

  return (
    <div className="space-y-6 max-w-4xl relative pb-16">
      <div>
        <h2 className="text-xl font-bold">Research & links</h2>
        <p className="mt-1 text-sm text-slate-400">Configure SERP, Wikipedia, and deep research sources</p>
      </div>

      {error && <div className="text-red-400 text-sm">{error}</div>}
      {success && <div className="text-green-400 text-sm">{success}</div>}

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-300">Website base URL for internal links</label>
          <input
            type="url"
            value={siteBaseUrl}
            onChange={(e) => setSiteBaseUrl(e.target.value)}
            placeholder="https://your-site.com"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-300">LinkPreview API key</label>
          <input
            type="password"
            value={linkPreviewApiKey}
            onChange={(e) => setLinkPreviewApiKey(e.target.value)}
            placeholder="Your API key"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500"
          />
          <p className="text-xs text-slate-500">Endpoint is fixed to https://api.linkpreview.net</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-300">SERP provider</label>
            <select 
              value={serpProvider}
              onChange={(e) => setSerpProvider(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500"
            >
              {SERP_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="flex items-center pt-8">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 cursor-pointer">
              <input 
                type="checkbox" 
                checked={useWikipedia}
                onChange={(e) => setUseWikipedia(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-blue-500 focus:ring-blue-500" 
              />
              Use Wikipedia summaries
            </label>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-300">Tavily API key</label>
            <input
              type="password"
              value={tavilyKey}
              onChange={(e) => setTavilyKey(e.target.value)}
              placeholder="tvly-..."
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500 font-mono"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-300">Perplexity API key</label>
            <input
              type="password"
              value={perplexityKey}
              onChange={(e) => setPerplexityKey(e.target.value)}
              placeholder="pplx-..."
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500 font-mono"
            />
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-300">Deep research provider</label>
            <select 
              value={deepResearchProvider}
              onChange={(e) => setDeepResearchProvider(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500"
            >
              {DEEP_RESEARCH_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-300">Deep research model</label>
            <input
              type="text"
              value={deepResearchModel}
              onChange={(e) => setDeepResearchModel(e.target.value)}
              placeholder="e.g. gpt-4o-mini"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500"
            />
          </div>
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
