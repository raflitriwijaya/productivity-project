// client/src/hooks/useSettings.js
// Server-side user preferences (Post-V5; addresses V5 §12.2/§13.4). Loads the
// user's settings once and exposes an `update`. Falls back to sane defaults if the
// request fails so the UI never blocks on preferences.
//
// The axios client unwraps the response envelope (§6.7), so api.get/api.put resolve
// to { success, data }; `.data` is the settings object.

import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';

const DEFAULTS = { theme: 'system', default_model: 'deepseek-chat', notifications_enabled: true };

export default function useSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await api.get('/api/settings');
      setSettings(res.data ?? DEFAULTS);
    } catch {
      setSettings(DEFAULTS);
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const update = useCallback(async (data) => {
    const res = await api.put('/api/settings', data);
    setSettings(res.data);
    return res.data;
  }, []);

  return { settings, loading, update, refetch: fetchSettings };
}
