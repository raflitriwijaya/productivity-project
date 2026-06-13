// client/src/components/goals/GoalCard.jsx
// Goals/OKRs (Roadmap Wave 5). A single goal as a card: title, priority/status
// badges, progress bar (current/target), target date, and category. Clicking opens
// the detail modal. Also exports the canonical badge variant/label maps + the
// goalProgress helper, reused by GoalDetailModal (mirrors ResearchEntryRow pattern).
/* eslint-disable react-refresh/only-export-components */

import { Target, Calendar, Flag, Flame } from 'lucide-react';
import { Badge } from '../ui/Badge';

export const PRIORITY_VARIANT = { low: 'gray', medium: 'blue', high: 'amber', critical: 'red' };
export const PRIORITY_LABEL   = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };
export const STATUS_VARIANT   = { active: 'moss', completed: 'ember', paused: 'gray', abandoned: 'red' };
export const STATUS_LABEL     = { active: 'Active', completed: 'Completed', paused: 'Paused', abandoned: 'Abandoned' };
export const TYPE_LABEL       = { target: 'Target', milestone: 'Milestone', habit: 'Habit', learning: 'Learning' };

/** Progress percentage (0–100), or null when there's no numeric target. */
export function goalProgress(goal) {
  const target = parseFloat(goal.target_value);
  if (!Number.isFinite(target) || target <= 0) return null;
  const current = parseFloat(goal.current_value) || 0;
  return Math.min(100, Math.round((current / target) * 100));
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * @param {{ goal: object, onClick: () => void }} props
 */
export function GoalCard({ goal, onClick }) {
  const pct = goalProgress(goal);
  const target = parseFloat(goal.target_value);
  const current = parseFloat(goal.current_value) || 0;
  const overdue = goal.target_date && goal.status === 'active' &&
    new Date(`${goal.target_date}T23:59:59`) < new Date();

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left w-full bg-white dark:bg-gray-800 rounded-xl border border-stone-200 dark:border-gray-700 shadow-sm p-5 hover:border-moss-400 dark:hover:border-moss-500 hover:shadow-md transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-moss-500 dark:focus:ring-moss-400"
    >
      {/* Header: priority + status */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <Badge variant={PRIORITY_VARIANT[goal.priority] ?? 'gray'}>
          <Flag size={11} className="inline mr-1 -mt-0.5" />
          {PRIORITY_LABEL[goal.priority] ?? goal.priority}
        </Badge>
        <Badge variant={STATUS_VARIANT[goal.status] ?? 'gray'}>{STATUS_LABEL[goal.status] ?? goal.status}</Badge>
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold text-stone-900 dark:text-gray-50 line-clamp-2 mb-1">{goal.title}</h3>

      {/* Category */}
      {goal.category && (
        <p className="text-xs text-stone-400 dark:text-gray-500 mb-3">{goal.category}</p>
      )}

      {/* Progress — habits show a streak; numeric goals show a bar */}
      {goal.goal_type === 'habit' ? (
        <div className="mt-3 flex items-center gap-1.5 text-xs">
          <Flame size={13} className={current > 0 ? 'text-ember-500' : 'text-stone-300 dark:text-gray-600'} />
          <span className={current > 0 ? 'text-stone-600 dark:text-gray-300 font-medium' : 'text-stone-400 dark:text-gray-500'}>
            {current > 0 ? `${current} day${current === 1 ? '' : 's'} streak` : 'No streak yet'}
          </span>
        </div>
      ) : pct != null ? (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-stone-600 dark:text-gray-400 tabular-nums">
              {current}{goal.unit ? ` ${goal.unit}` : ''} / {target}{goal.unit ? ` ${goal.unit}` : ''}
            </span>
            <span className="font-medium text-moss-600 dark:text-moss-400 tabular-nums">{pct}%</span>
          </div>
          <div className="w-full h-2 bg-stone-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${pct >= 100 ? 'bg-moss-500' : 'bg-gradient-to-r from-moss-500 to-ember-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-stone-400 dark:text-gray-500">
          <Target size={13} />
          {TYPE_LABEL[goal.goal_type] ?? goal.goal_type} goal
        </div>
      )}

      {/* Target date */}
      {goal.target_date && (
        <div className={`mt-3 flex items-center gap-1.5 text-xs ${overdue ? 'text-red-500 dark:text-red-400' : 'text-stone-400 dark:text-gray-500'}`}>
          <Calendar size={13} />
          {overdue ? 'Overdue: ' : 'Target: '}{formatDate(goal.target_date)}
        </div>
      )}
    </button>
  );
}

export default GoalCard;
