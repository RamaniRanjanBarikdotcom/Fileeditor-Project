'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const STORAGE_KEY = 'apptoolkitlab-theme';
const LEGACY_KEYS = ['toolsuite-theme', 'docconv-theme'];

/**
 * Runs inline in <head> before first paint so the page never flashes the
 * wrong theme. An explicit saved choice wins; otherwise the operating-system
 * preference is used.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var k=${JSON.stringify(
  [STORAGE_KEY, ...LEGACY_KEYS],
)};var t=null;for(var i=0;i<k.length&&!t;i++){var v=localStorage.getItem(k[i]);if(v==='light'||v==='dark')t=v;}if(!t)t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';var d=document.documentElement;d.classList.toggle('dark',t==='dark');d.setAttribute('data-theme',t);d.style.colorScheme=t;}catch(e){}})();`;

const ThemeContext = createContext<ThemeContextType>({ theme: 'light', toggleTheme: () => {} });

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.setAttribute('data-theme', theme);
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    // The bootstrap script already applied the theme; mirror it into React state.
    // oxlint-disable-next-line react/set-state-in-effect
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
    try {
      // Only an explicit choice is persisted; otherwise the system preference applies.
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage may be unavailable in private browsing; the choice lasts for this page.
    }
  };

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
