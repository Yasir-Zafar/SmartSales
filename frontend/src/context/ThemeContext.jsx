import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'smartsales:theme';

function readStoredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    return null;
  }
}

function systemTheme() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const ThemeProvider = ({ children }) => {
  // `null` means "follow the OS", which is the default until someone chooses.
  const [preference, setPreference] = useState(readStoredTheme);
  const [systemValue, setSystemValue] = useState(systemTheme);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return undefined;
    const onChange = (event) => setSystemValue(event.matches ? 'dark' : 'light');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const theme = preference || systemValue;

  useEffect(() => {
    const root = document.documentElement;
    if (preference) root.setAttribute('data-theme', preference);
    else root.removeAttribute('data-theme');
    // Keeps native form controls and scrollbars in step with the theme.
    root.style.colorScheme = theme;
  }, [preference, theme]);

  const setTheme = useCallback((next) => {
    setPreference(next);
    try {
      if (next) localStorage.setItem(STORAGE_KEY, next);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* private browsing — the choice just will not persist */
    }
  }, []);

  const toggle = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme, setTheme]);

  const value = useMemo(
    () => ({ theme, preference, setTheme, toggle, isDark: theme === 'dark' }),
    [theme, preference, setTheme, toggle]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
};

export default ThemeContext;
