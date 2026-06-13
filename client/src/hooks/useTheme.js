// client/src/hooks/useTheme.js
// Dark mode toggle (§5.5). Persists to localStorage key "theme" and adds/removes
// the `.dark` class on <html> (document.documentElement) — required because the
// Tailwind config uses darkMode: 'class' (§3).

import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../lib/api';

/**
 * @returns {{ isDark: boolean, toggle: () => void, hydrateFromServer: (serverTheme: string) => void }}
 */
export function useTheme() {
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem('theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Tracks whether we've already hydrated from server so we only do it once per
  // session — prevents a second settings load from overriding a user's explicit toggle.
  const hydratedFromServer = useRef(false);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  // Called by AppLayout once server settings are loaded. Only acts when localStorage
  // has no stored preference (fresh device) and we haven't already hydrated.
  const hydrateFromServer = useCallback((serverTheme) => {
    if (hydratedFromServer.current) return;
    hydratedFromServer.current = true;
    if (!localStorage.getItem('theme') && serverTheme && serverTheme !== 'system') {
      setIsDark(serverTheme === 'dark');
    }
  }, []);

  // Toggle locally, then mirror the choice to the server (Post-V5 user_settings) so
  // it follows the user across devices. Fire-and-forget: it never blocks or fails the
  // UI, and persists only on an explicit user toggle (not on initial mount).
  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    api.put('/api/settings', { theme: next ? 'dark' : 'light' }).catch(() => {});
  };

  return { isDark, toggle, hydrateFromServer };
}
