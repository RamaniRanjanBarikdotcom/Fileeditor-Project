import { useState, useEffect } from 'react';
import { Save, RefreshCw } from 'lucide-react';
import { fetchApi } from '../../../../../lib/api';
import { DEFAULT_PROMPTS } from '../constants';

const STAGES = [
  { id: 'research', name: 'Web Research' },
  { id: 'sources', name: 'Source Analysis' },
  { id: 'takeaways', name: 'Takeaways' },
  { id: 'outline', name: 'Outline Generation' },
  { id: 'draft', name: 'Initial Draft' },
  { id: 'repair', name: 'Repair / Improve' },
  { id: 'humanize', name: 'Humanization' },
  { id: 'quality', name: 'Quality Check' },
  { id: 'expand', name: 'Deep Expand' },
  { id: 'finalize', name: 'Final Polish' },
];

export default function PromptsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [selectedStage, setSelectedStage] = useState('draft');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [userPrompt, setUserPrompt] = useState('');

  useEffect(() => {
    loadPrompt(selectedStage);
  }, [selectedStage]);

  async function loadPrompt(stage: string) {
    setLoading(true);
    const res = await fetchApi<any[]>(`/blog-studio/prompts?stage=${stage}`);
    if (res.success && res.data && res.data.length > 0) {
      // The backend returns them ordered by isDefault desc, version desc
      const prompt = res.data[0];
      setSystemPrompt(prompt.systemPrompt || '');
      setUserPrompt(prompt.userPrompt || '');
    } else {
      // Load fallback
      const defaultPromptsForStage = (DEFAULT_PROMPTS as any)[stage] || {};
      setSystemPrompt(defaultPromptsForStage.system || '');
      setUserPrompt(defaultPromptsForStage.user || '');
    }
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    setSuccess('');
    
    // We create a new version of the prompt template and set it as default
    const res = await fetchApi('/blog-studio/prompts', {
      method: 'POST',
      body: JSON.stringify({
        stage: selectedStage,
        name: `Custom ${selectedStage}`,
        systemPrompt,
        userPrompt,
        isDefault: true,
      })
    });

    setSaving(false);
    if (res.success) {
      setSuccess('Prompt template saved successfully.');
      setTimeout(() => setSuccess(''), 3000);
    } else {
      setError(res.error?.message || 'Failed to save prompt.');
    }
  }

  function handleReset() {
    if (!confirm('Are you sure you want to restore the default prompts for this stage? Your custom changes will be lost.')) return;
    const defaultPromptsForStage = (DEFAULT_PROMPTS as any)[selectedStage] || {};
    setSystemPrompt(defaultPromptsForStage.system || '');
    setUserPrompt(defaultPromptsForStage.user || '');
  }

  return (
    <div className="space-y-6 max-w-4xl relative pb-16">
      <div>
        <h2 className="text-xl font-bold">System Prompts</h2>
        <p className="mt-1 text-sm text-slate-400">Customize the LLM instructions for each stage of the pipeline</p>
      </div>

      {error && <div className="text-red-400 text-sm">{error}</div>}
      {success && <div className="text-green-400 text-sm">{success}</div>}

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-300">Pipeline Stage</label>
          <div className="flex flex-wrap gap-2">
            {STAGES.map(stage => (
              <button
                key={stage.id}
                onClick={() => setSelectedStage(stage.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  selectedStage === stage.id 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {stage.name}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-slate-400 text-sm animate-pulse">Loading prompt...</div>
        ) : (
          <div className="space-y-6 mt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-300">System Prompt</label>
              </div>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 p-4 text-sm text-white outline-none focus:border-blue-500 min-h-[200px] font-mono whitespace-pre-wrap"
                placeholder="You are an expert AI copywriter..."
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-300">User Prompt Template</label>
              </div>
              <textarea
                value={userPrompt}
                onChange={(e) => setUserPrompt(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 p-4 text-sm text-white outline-none focus:border-blue-500 min-h-[200px] font-mono whitespace-pre-wrap"
                placeholder="Topic: {{topic}}\nContext: {{context}}..."
              />
              <p className="text-xs text-slate-500">
                You can use variables like {'{{topic}}'}, {'{{keywords}}'}, {'{{focusKeyword}}'}, etc.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="absolute -bottom-6 right-0 flex items-center gap-4">
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition"
        >
          <RefreshCw className="h-4 w-4" /> Restore Defaults
        </button>
        <button 
          onClick={handleSave}
          disabled={saving || loading}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 transition disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Template'}
        </button>
      </div>
    </div>
  );
}
