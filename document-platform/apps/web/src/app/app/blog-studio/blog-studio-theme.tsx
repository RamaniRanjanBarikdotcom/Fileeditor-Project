'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Check, Loader2, Palette, X } from 'lucide-react';
import {
  BLOG_STUDIO_THEMES,
  DEFAULT_BLOG_STUDIO_THEME,
  isBlogStudioTheme,
  type BlogStudioTheme,
} from '@docconv/shared-types';
import { BLOG_STUDIO_THEME_CACHE_KEY, fetchApi } from '../../../lib/api';

export const BLOG_STUDIO_THEME_DETAILS: Record<
  BlogStudioTheme,
  { name: string; description: string }
> = {
  cobalt: {
    name: 'Cobalt',
    description: 'Crisp blue accents on cool slate. The AppToolkitLab default.',
  },
  forest: { name: 'Forest', description: 'Calm emerald and teal for long writing sessions.' },
  sunset: { name: 'Sunset', description: 'Warm orange and amber on soft stone neutrals.' },
  midnight: { name: 'Midnight', description: 'Deep violet and fuchsia on graphite zinc.' },
};

// BLOG_STUDIO_THEME_CACHE_KEY: browser cache of the last saved theme, tagged
// with its owner, so the page paints in the right theme before the profile
// request returns. The account (server) value always wins.

function readCache(): { userId: string; theme: BlogStudioTheme } | null {
  try {
    const value = JSON.parse(localStorage.getItem(BLOG_STUDIO_THEME_CACHE_KEY) || 'null');
    return value && isBlogStudioTheme(value.theme) ? value : null;
  } catch {
    return null;
  }
}

function writeCache(userId: string, theme: BlogStudioTheme) {
  try {
    localStorage.setItem(BLOG_STUDIO_THEME_CACHE_KEY, JSON.stringify({ userId, theme }));
  } catch {
    // Storage can be unavailable (private mode); the account copy still applies.
  }
}

type ThemeState = {
  theme: BlogStudioTheme;
  /** null while the account preference is loading. */
  hasSavedTheme: boolean | null;
  saving: BlogStudioTheme | null;
  error: string;
  pickerOpen: boolean;
  chooseTheme: (theme: BlogStudioTheme) => Promise<boolean>;
  openPicker: () => void;
  closePicker: () => void;
};

const BlogStudioThemeContext = createContext<ThemeState | null>(null);

export function useBlogStudioTheme() {
  const context = useContext(BlogStudioThemeContext);
  if (!context) throw new Error('useBlogStudioTheme must be used inside BlogStudioThemeProvider.');
  return context;
}

export function BlogStudioThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<BlogStudioTheme>(DEFAULT_BLOG_STUDIO_THEME);
  const [hasSavedTheme, setHasSavedTheme] = useState<boolean | null>(null);
  const [saving, setSaving] = useState<BlogStudioTheme | null>(null);
  const [error, setError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const userId = useRef<string | null>(null);

  // Before first paint (after hydration, so server and client markup match).
  useLayoutEffect(() => {
    const cached = readCache();
    // oxlint-disable-next-line react/set-state-in-effect
    if (cached) setTheme(cached.theme);
  }, []);

  useEffect(() => {
    let active = true;
    void fetchApi<{ id: string; blogStudioTheme: string | null }>('/users/profile').then(
      (response) => {
        if (!active || !response.success || !response.data) return;
        userId.current = response.data.id;
        const saved = response.data.blogStudioTheme;
        if (isBlogStudioTheme(saved)) {
          setTheme(saved);
          setHasSavedTheme(true);
          writeCache(response.data.id, saved);
        } else {
          // First visit on this account: show the default and ask once.
          setTheme(DEFAULT_BLOG_STUDIO_THEME);
          setHasSavedTheme(false);
          setPickerOpen(true);
        }
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const chooseTheme = useCallback(
    async (next: BlogStudioTheme) => {
      const previous = theme;
      setTheme(next); // preview immediately
      setSaving(next);
      setError('');
      const response = await fetchApi<{ blogStudioTheme: string }>('/users/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ blogStudioTheme: next }),
      });
      setSaving(null);
      if (!response.success) {
        setTheme(previous);
        setError(response.error?.message || 'Your theme could not be saved. Please try again.');
        return false;
      }
      setHasSavedTheme(true);
      if (userId.current) writeCache(userId.current, next);
      setPickerOpen(false);
      return true;
    },
    [theme],
  );

  const value: ThemeState = {
    theme,
    hasSavedTheme,
    saving,
    error,
    pickerOpen,
    chooseTheme,
    openPicker: () => setPickerOpen(true),
    // The first-run picker can only be closed by choosing (Cobalt counts).
    closePicker: () => hasSavedTheme && setPickerOpen(false),
  };

  return (
    <BlogStudioThemeContext.Provider value={value}>{children}</BlogStudioThemeContext.Provider>
  );
}

// Preview colours are explicit (not the scoped palette variables): previews
// sit inside the themed page, where "cobalt" would otherwise inherit the
// active theme's colours. Values match blog-studio-themes.css.
const PREVIEW_COLOURS: Record<BlogStudioTheme, Record<string, string>> = {
  cobalt: {
    '--p-accent': '#3451c7',
    '--p-soft': '#dce6ff',
    '--p-highlight': '#06b6d4',
    '--p-bg': '#f8fafc',
    '--p-line': '#e2e8f0',
    '--p-ink': '#cbd5e1',
    '--p-bg-dark': '#020617',
    '--p-panel-dark': '#0f172a',
    '--p-line-dark': '#1e293b',
    '--p-ink-dark': '#334155',
  },
  forest: {
    '--p-accent': '#047857',
    '--p-soft': '#d1fae5',
    '--p-highlight': '#0d9488',
    '--p-bg': '#f8fafc',
    '--p-line': '#e2e8f0',
    '--p-ink': '#cbd5e1',
    '--p-bg-dark': '#020617',
    '--p-panel-dark': '#0f172a',
    '--p-line-dark': '#1e293b',
    '--p-ink-dark': '#334155',
  },
  sunset: {
    '--p-accent': '#c2410c',
    '--p-soft': '#ffedd5',
    '--p-highlight': '#d97706',
    '--p-bg': '#fafaf9',
    '--p-line': '#e7e5e4',
    '--p-ink': '#d6d3d1',
    '--p-bg-dark': '#0c0a09',
    '--p-panel-dark': '#1c1917',
    '--p-line-dark': '#292524',
    '--p-ink-dark': '#44403c',
  },
  midnight: {
    '--p-accent': '#7c3aed',
    '--p-soft': '#ede9fe',
    '--p-highlight': '#d946ef',
    '--p-bg': '#fafafa',
    '--p-line': '#e4e4e7',
    '--p-ink': '#d4d4d8',
    '--p-bg-dark': '#09090b',
    '--p-panel-dark': '#18181b',
    '--p-line-dark': '#27272a',
    '--p-ink-dark': '#3f3f46',
  },
};

/** A miniature Blog Studio screen in the given theme (follows light/dark mode). */
function ThemePreview({ id }: { id: BlogStudioTheme }) {
  return (
    <div
      aria-hidden="true"
      style={PREVIEW_COLOURS[id] as React.CSSProperties}
      className="flex h-24 overflow-hidden rounded-xl border border-(--p-line) bg-(--p-bg) dark:border-(--p-line-dark) dark:bg-(--p-bg-dark)"
    >
      <div className="w-1/3 space-y-1.5 border-r border-(--p-line) bg-white p-2 dark:border-(--p-line-dark) dark:bg-(--p-panel-dark)">
        <div className="h-2 w-3/4 rounded bg-(--p-accent)" />
        <div className="h-1.5 w-full rounded bg-(--p-soft) dark:opacity-30" />
        <div className="h-1.5 w-2/3 rounded bg-(--p-line) dark:bg-(--p-ink-dark)" />
        <div className="h-1.5 w-3/4 rounded bg-(--p-line) dark:bg-(--p-ink-dark)" />
      </div>
      <div className="flex-1 space-y-2 p-2.5">
        <div className="h-2 w-1/2 rounded bg-(--p-ink) dark:bg-(--p-ink-dark)" />
        <div className="h-1.5 w-full rounded bg-(--p-line) dark:bg-(--p-line-dark)" />
        <div className="h-1.5 w-5/6 rounded bg-(--p-line) dark:bg-(--p-line-dark)" />
        <div className="flex gap-1.5 pt-1">
          <div className="h-4 w-12 rounded-md bg-linear-to-r from-(--p-accent) to-(--p-highlight)" />
          <div className="h-4 w-8 rounded-md border border-(--p-ink) dark:border-(--p-ink-dark)" />
        </div>
      </div>
    </div>
  );
}

/** Theme cards; used in the picker dialog and the Settings → Appearance tab. */
export function BlogStudioThemeOptions({ autoFocus = false }: { autoFocus?: boolean }) {
  const { theme, saving, chooseTheme, hasSavedTheme, error } = useBlogStudioTheme();
  return (
    <div>
      <div role="radiogroup" aria-label="Blog Studio theme" className="grid gap-4 sm:grid-cols-2">
        {BLOG_STUDIO_THEMES.map((id, index) => {
          const details = BLOG_STUDIO_THEME_DETAILS[id];
          const selected = hasSavedTheme !== false && theme === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              autoFocus={autoFocus && index === 0}
              disabled={saving !== null}
              onClick={() => void chooseTheme(id)}
              className={`group rounded-2xl border-2 p-3 text-left transition focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/30 disabled:cursor-wait ${
                selected
                  ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-500/10'
                  : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600'
              }`}
            >
              <ThemePreview id={id} />
              <span className="mt-3 flex items-center justify-between gap-2">
                <span className="text-sm font-black text-slate-950 dark:text-white">
                  {details.name}
                </span>
                {saving === id ? (
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                ) : selected ? (
                  <Check className="h-4 w-4 text-indigo-600" />
                ) : null}
              </span>
              <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                {details.description}
              </span>
            </button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm font-semibold text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

export function BlogStudioThemePicker() {
  const { pickerOpen, closePicker, hasSavedTheme } = useBlogStudioTheme();

  useEffect(() => {
    if (!pickerOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && closePicker();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pickerOpen, closePicker]);

  if (!pickerOpen) return null;
  const firstRun = hasSavedTheme === false;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onClick={closePicker}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="blog-theme-title"
        onClick={(event) => event.stopPropagation()}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-indigo-500">
              <Palette className="h-4 w-4" />
              Appearance
            </span>
            <h2
              id="blog-theme-title"
              className="mt-2 text-2xl font-black text-slate-950 dark:text-white"
            >
              {firstRun ? 'Pick your Blog Studio theme' : 'Change theme'}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {firstRun
                ? 'Saved to your account: it is applied automatically every time you sign in, on any device.'
                : 'Your choice is saved to your account and applies on every device.'}
            </p>
          </div>
          {!firstRun && (
            <button
              type="button"
              onClick={closePicker}
              aria-label="Close"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        <div className="mt-6">
          <BlogStudioThemeOptions autoFocus />
        </div>
        <p className="mt-5 text-xs text-slate-500 dark:text-slate-400">
          Light and dark mode still follow the switch in the top bar. You can change the theme later
          from the sidebar or Settings → Appearance.
        </p>
      </div>
    </div>
  );
}

/** Sidebar control showing the current theme. */
export function BlogStudioThemeButton() {
  const { theme, openPicker, hasSavedTheme } = useBlogStudioTheme();
  return (
    <button
      type="button"
      onClick={openPicker}
      disabled={hasSavedTheme === null}
      className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-60 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/50"
    >
      <Palette className="h-4 w-4 shrink-0 text-indigo-600" />
      <span className="flex-1 text-left">Theme</span>
      <span className="text-xs font-bold text-slate-900 dark:text-white">
        {BLOG_STUDIO_THEME_DETAILS[theme].name}
      </span>
    </button>
  );
}
