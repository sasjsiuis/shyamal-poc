import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ThemeMode } from '../types/card';

const THEME_STORAGE_KEY = 'news_card_theme_mode_v1';

interface ThemeContextValue {
  themeMode: ThemeMode;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  toggleDark: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  themeMode: 'light',
  isDark: false,
  setThemeMode: () => {},
  toggleDark: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'auto') return saved;
    } catch {
      // ignore
    }
    return 'light';
  });

  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    } catch {
      // ignore
    }

    const applyTheme = () => {
      const prefersDark =
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      const shouldBeDark = themeMode === 'dark' || (themeMode === 'auto' && prefersDark);
      document.documentElement.classList.toggle('dark', shouldBeDark);
      setIsDark(shouldBeDark);
    };

    applyTheme();

    if (themeMode === 'auto' && typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applyTheme();
      if (mq.addEventListener) {
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
      }
    }
  }, [themeMode]);

  const toggleDark = () => {
    setThemeMode(isDark ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ themeMode, isDark, setThemeMode, toggleDark }}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme() {
  return useContext(ThemeContext);
}
