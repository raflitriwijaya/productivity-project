// client/src/components/layout/NotificationBell.jsx
// Bell + due-today badge + dropdown of items due this week. Reads the shared
// due-items store via useDueItems, so several bells (sidebar + mobile top bar)
// stay in sync. Permission is requested only on click (a user gesture).
//
// `align` controls which way the panel opens: 'left' for the desktop sidebar
// (extends right into the content area), 'right' for the mobile top bar.

import { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import useDueItems from '../../hooks/useDueItems';
import { requestNotificationPermission, refreshDueItems, toDateStr, todayStr } from '../../lib/notifications';

const TYPE_EMOJI = { receivable: '💰', payable: '💳', goal: '🎯', checkin: '📊', todo: '📋' };

function formatDue(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * @param {{ align?: 'left' | 'right' }} props
 */
export default function NotificationBell({ align = 'right' }) {
  const items = useDueItems();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const today = todayStr();
  const dueTodayCount = items.filter((i) => toDateStr(i.due_date) === today).length;

  // Close on outside click or Escape while open.
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      // User gesture → safe to prompt; and pull fresh data on open.
      requestNotificationPermission().catch(() => {});
      refreshDueItems();
    }
  };

  const panelAlign = align === 'left' ? 'left-0' : 'right-0';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-label={dueTodayCount > 0 ? `Notifications, ${dueTodayCount} due today` : 'Notifications'}
        aria-expanded={open}
        className="relative p-2 rounded-lg text-stone-500 dark:text-gray-400 hover:bg-stone-100 dark:hover:bg-gray-700 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-moss-500 dark:focus:ring-moss-400"
      >
        <Bell size={18} />
        {dueTodayCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 bg-red-500 text-white text-[10px] leading-none rounded-full flex items-center justify-center font-bold">
            {dueTodayCount > 9 ? '9+' : dueTodayCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute ${panelAlign} top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-stone-200 dark:border-gray-700 z-50 max-h-96 overflow-y-auto`}
        >
          <div className="px-3 py-2.5 border-b border-stone-200 dark:border-gray-700">
            <h3 className="font-semibold text-sm text-stone-800 dark:text-gray-200">Due this week</h3>
          </div>

          {items.length === 0 ? (
            <div className="p-4 text-center text-sm text-stone-400 dark:text-gray-500">
              Nothing due — you&rsquo;re all clear 🎉
            </div>
          ) : (
            items.slice(0, 15).map((item) => {
              const isToday = toDateStr(item.due_date) === today;
              return (
                <div
                  key={`${item.type}-${item.id}`}
                  className="px-3 py-2.5 border-b border-stone-100 dark:border-gray-700/60 last:border-b-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm" aria-hidden="true">{TYPE_EMOJI[item.type] ?? '📋'}</span>
                    <span className="text-sm text-stone-700 dark:text-gray-300 truncate flex-1">
                      {item.title || 'Untitled'}
                    </span>
                    {item.amount != null && (
                      <span className="text-xs font-medium text-stone-500 dark:text-gray-400 tabular-nums whitespace-nowrap">
                        Rp {Number(item.amount).toLocaleString('id-ID')}
                      </span>
                    )}
                  </div>
                  <div className={`text-xs mt-0.5 ml-6 ${isToday ? 'text-red-500 font-medium' : 'text-stone-400 dark:text-gray-500'}`}>
                    {isToday ? 'Today' : formatDue(item.due_date)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
