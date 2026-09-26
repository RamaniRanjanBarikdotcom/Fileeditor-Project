import { useState, useEffect } from 'react';
import { Activity, Zap, FileText } from 'lucide-react';
import { fetchApi } from '../../../../../lib/api';

export default function UsageTab() {
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState<any>(null);

  useEffect(() => {
    async function load() {
      const res = await fetchApi<any>('/blog-studio/usage');
      if (res.success && res.data) {
        setUsage(res.data);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="text-slate-400">Loading usage statistics...</div>;
  if (!usage) return <div className="text-slate-400">Failed to load usage statistics.</div>;

  const blogPercent = usage.blogLimit > 0 
    ? Math.min(100, Math.round(((usage.blogsConsumed + usage.reservedBlogs) / usage.blogLimit) * 100)) 
    : 0;

  const creditPercent = usage.creditLimit > 0 
    ? Math.min(100, Math.round(((usage.creditsConsumed + usage.reservedCredits) / usage.creditLimit) * 100)) 
    : 0;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold">Usage & Limits</h2>
        <p className="mt-1 text-sm text-slate-400">Monitor your Blog Studio consumption for the current billing period</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Blogs Generated */}
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-500/20 p-2 text-blue-400">
              <FileText className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-white">Blogs Generated</h3>
          </div>
          
          <div className="flex justify-between items-end">
            <div>
              <div className="text-3xl font-bold text-white">
                {usage.blogsConsumed}
              </div>
              <div className="text-sm text-slate-400 mt-1">
                out of {usage.unlimited ? '∞' : usage.blogLimit} limit
              </div>
            </div>
            {usage.reservedBlogs > 0 && (
              <div className="text-sm text-amber-400">
                +{usage.reservedBlogs} reserved
              </div>
            )}
          </div>

          {!usage.unlimited && (
            <div className="space-y-2">
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
                <div 
                  className={`h-full rounded-full ${blogPercent > 90 ? 'bg-red-500' : blogPercent > 75 ? 'bg-amber-500' : 'bg-blue-500'}`}
                  style={{ width: `${blogPercent}%` }}
                />
              </div>
              <div className="text-right text-xs text-slate-400">
                {usage.blogsRemaining} remaining
              </div>
            </div>
          )}
        </div>

        {/* AI Credits */}
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-500/20 p-2 text-purple-400">
              <Zap className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-white">AI Credits</h3>
          </div>
          
          <div className="flex justify-between items-end">
            <div>
              <div className="text-3xl font-bold text-white">
                {Math.round(usage.creditsConsumed)}
              </div>
              <div className="text-sm text-slate-400 mt-1">
                out of {usage.unlimited ? '∞' : usage.creditLimit} limit
              </div>
            </div>
            {usage.reservedCredits > 0 && (
              <div className="text-sm text-amber-400">
                +{Math.round(usage.reservedCredits)} reserved
              </div>
            )}
          </div>

          {!usage.unlimited && (
            <div className="space-y-2">
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
                <div 
                  className={`h-full rounded-full ${creditPercent > 90 ? 'bg-red-500' : creditPercent > 75 ? 'bg-amber-500' : 'bg-purple-500'}`}
                  style={{ width: `${creditPercent}%` }}
                />
              </div>
              <div className="text-right text-xs text-slate-400">
                {Math.round(usage.creditsRemaining)} remaining
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 flex items-center justify-between">
        <div>
          <div className="font-medium text-white">Billing Period</div>
          <div className="text-sm text-slate-400 mt-1">
            {new Date(usage.windowStart).toLocaleDateString()} - {new Date(usage.windowEnd).toLocaleDateString()}
          </div>
        </div>
        <div className="text-right">
          <div className="font-medium text-white">Access Level</div>
          <div className="text-sm text-slate-400 mt-1 flex items-center gap-2 justify-end">
            <Activity className="h-4 w-4" />
            {usage.accessLevel}
          </div>
        </div>
      </div>
    </div>
  );
}
