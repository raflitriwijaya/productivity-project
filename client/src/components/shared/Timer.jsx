// client/src/components/shared/Timer.jsx
// Time Tracking (Roadmap Wave 5). A reusable timer embedded in any detail modal or
// page. Shows a live-ticking elapsed display with start/stop. Only one timer runs
// at a time per user (server enforces this) — when a timer is running for a
// different entity, Start is disabled and a hint is shown.
//
// Conventions: fetches via the shared `api` (envelope unwrapped to res.data), uses
// the named useToast() hook with the { type, title } addToast signature.

import { useState, useEffect, useCallback } from 'react';
import { Play, Square, Clock } from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../hooks/useToast';

/**
 * @param {{ entityType: string, entityId: number }} props
 */
export function Timer({ entityType, entityId }) {
  const [running, setRunning] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { addToast } = useToast();

  const isThisEntity = running && running.entity_type === entityType && running.entity_id === entityId;
  const isOtherEntity = running && !isThisEntity;

  const fetchRunning = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/time/running');
      const timer = res.data;
      setRunning(timer);
      if (timer && timer.entity_type === entityType && timer.entity_id === entityId) {
        setElapsed(Math.max(0, Math.floor((Date.now() - new Date(timer.started_at).getTime()) / 1000)));
      } else {
        setElapsed(0);
      }
    } catch {
      setRunning(null);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  /* Initial fetch on mount / entity change — intentional setState-in-effect (data load) */
  /* eslint-disable-next-line react-hooks/set-state-in-effect */
  useEffect(() => { fetchRunning(); }, [fetchRunning]);

  // Tick every second while a timer is running for THIS entity.
  useEffect(() => {
    if (!isThisEntity) return undefined;
    const interval = setInterval(() => setElapsed(prev => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [isThisEntity]);

  const handleStart = async () => {
    setSubmitting(true);
    try {
      const res = await api.post('/api/time/start', { entity_type: entityType, entity_id: entityId });
      setRunning(res.data);
      setElapsed(0);
      addToast({ type: 'success', title: 'Timer started' });
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to start timer', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStop = async () => {
    setSubmitting(true);
    try {
      await api.post('/api/time/stop');
      setRunning(null);
      setElapsed(0);
      addToast({ type: 'success', title: 'Timer stopped' });
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to stop timer', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  if (loading) {
    return <div className="h-10 bg-stone-100 dark:bg-gray-800 rounded-lg animate-pulse" />;
  }

  return (
    <div className="flex items-center gap-3 py-2 px-3 bg-stone-50 dark:bg-gray-800/50 rounded-lg border border-stone-200 dark:border-gray-700">
      <Clock size={16} className="text-stone-400 dark:text-gray-500 flex-shrink-0" />

      {isThisEntity ? (
        <>
          <span className="text-sm font-mono text-moss-600 dark:text-moss-400 font-medium tabular-nums">
            {formatTime(elapsed)}
          </span>
          <button
            type="button"
            onClick={handleStop}
            disabled={submitting}
            className="ml-auto flex items-center gap-1 px-3 py-1 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            <Square size={12} /> Stop
          </button>
        </>
      ) : (
        <>
          <span className="text-sm text-stone-500 dark:text-gray-400 truncate">
            {isOtherEntity
              ? `Timer running elsewhere (${running.entity_type} #${running.entity_id})`
              : 'Track time'}
          </span>
          <button
            type="button"
            onClick={handleStart}
            disabled={submitting || isOtherEntity}
            className="ml-auto flex items-center gap-1 px-3 py-1 bg-moss-500 text-white text-xs font-medium rounded-lg hover:bg-moss-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-moss-400"
          >
            <Play size={12} /> Start
          </button>
        </>
      )}
    </div>
  );
}

export default Timer;
