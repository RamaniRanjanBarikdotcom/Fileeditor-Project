'use client';

import React, { useEffect, useState } from 'react';
import { Settings, Key, ShieldCheck, User, Building, Lock } from 'lucide-react';
import { fetchApi } from '../../../lib/api';

export default function WorkspaceSettingsPage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetchApi('/auth/me');
      if (res.success && res.data) {
        setProfile(res.data);
      }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Account Settings</h1>
        <p className="text-xs text-slate-500 mt-1">
          Manage personal profile, organizations, and security
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm space-y-6">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">Profile Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
            <span className="text-slate-400 font-semibold">Email</span>
            <p className="font-bold text-slate-900 dark:text-white">{profile?.email || '—'}</p>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1">
            <span className="text-slate-400 font-semibold">Platform Role</span>
            <p className="font-bold text-indigo-600 dark:text-indigo-400">
              {profile?.platformRole || 'CUSTOMER'}
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Organization & Plan
          </h3>
          <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-850 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {profile?.memberships?.[0]?.organization?.name || 'Personal Workspace'}
              </span>
              <p className="text-[11px] text-slate-500">Plan: Free Starter (10 ops/day)</p>
            </div>
            <a
              href="/pricing"
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-sm"
            >
              Upgrade Plan
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
