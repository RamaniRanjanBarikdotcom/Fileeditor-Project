'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({ theme: 'dark', toggleTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Mount state gates persistence so an existing preference is not overwritten on first render.
    // oxlint-disable-next-line react/set-state-in-effect
    setMounted(true);
    const stored =
      localStorage.getItem('apptoolkitlab-theme') ||
      localStorage.getItem('toolsuite-theme') ||
      localStorage.getItem('docconv-theme');
    if (stored === 'light' || stored === 'dark') {
      // The saved browser preference can only be applied after client hydration.
      // oxlint-disable-next-line react/set-state-in-effect
      setTheme(stored);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem('apptoolkitlab-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme, mounted]);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
