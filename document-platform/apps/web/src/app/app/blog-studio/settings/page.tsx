'use client';

import { useState } from 'react';
import { Settings } from 'lucide-react';
import AiTab from './tabs/AiTab';
import ResearchTab from './tabs/ResearchTab';
import ApiKeysTab from './tabs/ApiKeysTab';
import PublishingTab from './tabs/PublishingTab';
import StorageTab from './tabs/StorageTab';
import PromptsTab from './tabs/PromptsTab';
import UsageTab from './tabs/UsageTab';
import UpdatesTab from './tabs/UpdatesTab';
import AdminTab from './tabs/AdminTab';

export default function BlogStudioSettingsPage() {
  const [activeTab, setActiveTab] = useState('AI');

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-12">
      <header>
        <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-indigo-500">
          <Settings className="h-4 w-4" />
          Settings
        </span>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white">
          Settings
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Configure your Blog Studio preferences
        </p>
      </header>

      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex gap-6 overflow-x-auto">
          {['AI', 'Research', 'API Keys', 'Publishing', 'Storage', 'Prompts', 'Usage', 'Updates', 'Admin'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2 text-sm font-semibold transition whitespace-nowrap ${
                activeTab === tab
                  ? 'border-b-2 border-blue-500 text-slate-900 dark:text-white'
                  : 'border-b-2 border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#0f172a] shadow-sm text-white p-8 min-h-[400px]">
        {activeTab === 'AI' && <AiTab />}
        {activeTab === 'Research' && <ResearchTab />}
        {activeTab === 'API Keys' && <ApiKeysTab />}
        {activeTab === 'Publishing' && <PublishingTab />}
        {activeTab === 'Storage' && <StorageTab />}
        {activeTab === 'Prompts' && <PromptsTab />}
        {activeTab === 'Usage' && <UsageTab />}
        {activeTab === 'Updates' && <UpdatesTab />}
        {activeTab === 'Admin' && <AdminTab />}
      </section>
    </div>
  );
}
