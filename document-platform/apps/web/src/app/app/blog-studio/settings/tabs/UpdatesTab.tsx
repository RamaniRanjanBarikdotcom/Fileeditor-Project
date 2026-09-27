import { Settings } from 'lucide-react';

export default function UpdatesTab() {
  return (
    <div className="space-y-6 max-w-4xl py-12 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/20 text-blue-400">
        <Settings className="h-8 w-8" />
      </div>
      <h2 className="text-xl font-bold">Cloud Updates</h2>
      <p className="text-slate-400 max-w-md mx-auto">
        Since you are using the cloud version of Blog Studio, updates are applied automatically. You always have the latest features and models!
      </p>
    </div>
  );
}
