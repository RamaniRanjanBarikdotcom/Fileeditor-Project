import { Shield } from 'lucide-react';

export default function AdminTab() {
  return (
    <div className="space-y-6 max-w-4xl py-12 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20 text-red-400">
        <Shield className="h-8 w-8" />
      </div>
      <h2 className="text-xl font-bold">Admin Controls</h2>
      <p className="text-slate-400 max-w-md mx-auto">
        User management, permissions, and billing are handled at the Platform level. Please navigate to your Organization Settings to manage these items.
      </p>
    </div>
  );
}
