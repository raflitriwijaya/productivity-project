// client/src/components/goals/HabitCalendar.jsx
// Habit Streaks / Calendar (Roadmap Forward Phase 1). A 90-day check-in heatmap
// plus a "Check today" toggle for a goal_type='habit' goal. The streak and
// checked-today flag are authoritative from the server (GET .../habit-logs); the
// grid only colours days the server reports as logged.

import { useState, useEffect, useCallback } from 'react';
import { Check, Flame } from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../hooks/useToast';

const pad = (n) => String(n).padStart(2, '0');
// Build a LOCAL 'YYYY-MM-DD' (never toISOString, which would shift the day for
// users east of UTC) so grid cells line up with the server's calendar dates.
const fmtLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * @param {{ goal: object, onChanged?: () => void }} props
 */
export default function HabitCalendar({ goal, onChanged }) {
  const { addToast } = useToast();
  const [logs, setLogs] = useState([]);
  const [streak, setStreak] = useState(0);
  const [checkedToday, setCheckedToday] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await api.get(`/api/goals/${goal.id}/habit-logs`);
      setLogs(res.data.logs || []);
      setStreak(res.data.current_streak || 0);
      setCheckedToday(Boolean(res.data.checked_today));
    } catch {
      /* best-effort — leave the last good state */
    } finally {
      setLoading(false);
    }
  }, [goal.id]);

  /* Load on mount — intentional setState-in-effect (data fetch) */
  /* eslint-disable-next-line react-hooks/set-state-in-effect */
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const toggleToday = async () => {
    setToggling(true);
    try {
      const res = await api.post(`/api/goals/${goal.id}/habit-log`);
      setStreak(res.data.streak);
      setCheckedToday(res.data.action === 'checked');
      addToast({ type: 'success', title: res.data.action === 'checked' ? 'Logged for today 🔥' : 'Unchecked' });
      fetchLogs();      // resync the heatmap + authoritative streak
      onChanged?.();    // let the parent refresh the goals list (current_value moved)
    } catch (err) {
      addToast({ type: 'error', title: 'Could not update habit', message: err.message });
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return <div className="h-28 bg-stone-100 dark:bg-gray-800 rounded-lg animate-pulse" />;
  }

  // 90-day grid, oldest → newest, with leading blanks so columns align Sun–Sat.
  const loggedSet = new Set(logs.map((l) => l.log_date));
  const days = [];
  const base = new Date();
  for (let i = 89; i >= 0; i -= 1) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    const dateStr = fmtLocal(d);
    days.push({
      date: dateStr,
      dayOfWeek: d.getDay(),
      dayOfMonth: d.getDate(),
      logged: loggedSet.has(dateStr),
      isToday: i === 0,
    });
  }
  const leadingBlanks = days[0]?.dayOfWeek ?? 0;

  return (
    <div className="space-y-3">
      {/* Streak + today's toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame size={18} className={streak > 0 ? 'text-ember-500' : 'text-stone-300 dark:text-gray-600'} />
          <span className="text-sm font-semibold text-stone-700 dark:text-gray-300">
            {streak} day{streak === 1 ? '' : 's'} streak
          </span>
        </div>
        <button
          type="button"
          onClick={toggleToday}
          disabled={toggling}
          aria-pressed={checkedToday}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors duration-150 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-moss-500 dark:focus:ring-moss-400 ${
            checkedToday
              ? 'bg-moss-100 dark:bg-moss-900/30 text-moss-700 dark:text-moss-300 border-moss-300 dark:border-moss-700'
              : 'bg-stone-100 dark:bg-gray-700 text-stone-600 dark:text-gray-300 border-stone-200 dark:border-gray-600 hover:bg-moss-50 dark:hover:bg-moss-900/20'
          }`}
        >
          <Check size={14} />
          {checkedToday ? 'Done today' : 'Check today'}
        </button>
      </div>

      {/* Heatmap */}
      <div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {DAY_LABELS.map((d, i) => (
            <div key={i} className="text-center text-[10px] text-stone-400 dark:text-gray-500 font-medium">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: leadingBlanks }).map((_, i) => (
            <div key={`blank-${i}`} className="aspect-square" />
          ))}
          {days.map((day) => (
            <div
              key={day.date}
              title={day.date}
              className={`aspect-square rounded-sm flex items-center justify-center text-[10px] font-medium ${
                day.logged
                  ? 'bg-moss-500 text-white'
                  : day.isToday
                    ? 'bg-stone-200 dark:bg-gray-600 text-stone-600 dark:text-gray-300 ring-1 ring-moss-400'
                    : 'bg-stone-100 dark:bg-gray-700/50 text-stone-400 dark:text-gray-500'
              }`}
            >
              {day.dayOfMonth}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
