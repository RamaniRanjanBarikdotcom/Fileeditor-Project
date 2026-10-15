'use client';

import { BlogStudioThemeOptions } from '../../blog-studio-theme';

export default function AppearanceTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Theme</h2>
        <p className="mt-1 text-sm text-slate-400">
          Saved to your account, so Blog Studio opens in this theme every time you sign in, on any
          device. Light and dark mode follow the switch in the top bar.
        </p>
      </div>
      {/* The settings panel is always dark, so render the cards in dark mode. */}
      <div className="dark rounded-2xl">
        <BlogStudioThemeOptions />
      </div>
    </div>
  );
}
