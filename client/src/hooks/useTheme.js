// client/src/hooks/useTheme.js
// Dark mode toggle (§5.5). Persists to localStorage key "theme" and adds/removes
// the `.dark` class on <html> (document.documentElement) — required because the
// Tailwind config uses darkMode: 'class' (§3).

import { useState, useEffect } from 'react';

/**
 * @returns {{ isDark: boolean, toggle: () => void }}
 */
export function useTheme() {
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem('theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  return { isDark, toggle: () => setIsDark(d => !d) };
}
