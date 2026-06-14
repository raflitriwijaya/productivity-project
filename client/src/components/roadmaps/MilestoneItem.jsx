// client/src/components/roadmaps/MilestoneItem.jsx
// Custom Learning Roadmaps — a single milestone row inside a TrackLane. A checkbox
// toggles completed/pending (PATCH status → triggers server-side progress recalc);
// the row expands to reveal description, notes, resource links, and est/actual hours,
// plus Edit / Delete. Overdue due dates show red. Does its own toggle/delete API
// calls, then calls onChanged() so the parent refetches the roadmap.

import { useState } from 'react';
import {
  Check, ChevronDown, ChevronRight, Calendar, Clock, Pencil, Trash2, ExternalLink, Flag,
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import api from '../../lib/api';
import { useToast } from '../../hooks/useToast';
import {
  MILESTONE_STATUS_VARIANT, MILESTONE_STATUS_LABEL,
  MILESTONE_PRIORITY_VARIANT, MILESTONE_PRIORITY_LABEL,
} from '../../lib/roadmapEnums';

function formatDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * @param {{ milestone: object, onEdit: (m: object) => void, onChanged: () => void }} props
 */
export function MilestoneItem({ milestone, onEdit, onChanged }) {
  const { addToast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);

  const completed = milestone.status === 'completed';
  const resources = Array.isArray(milestone.resources) ? milestone.resources : [];
  const overdue = milestone.due_date && !completed &&
    new Date(`${milestone.due_date}T23:59:59`) < new Date();
  const hasDetail = milestone.description || milestone.notes || resources.length > 0 ||
    milestone.estimated_hours != null || milestone.actual_hours != null;

  const toggle = async () => {
    setBusy(true);
    try {
      await api.patch(`/api/roadmaps/milestones/${milestone.id}`, {
        status: completed ? 'pending' : 'completed',
      });
      onChanged();
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to update milestone', message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this milestone? This cannot be undone.')) return;
    setBusy(true);
    try {
      await api.delete(`/api/roadmaps/milestones/${milestone.id}`);
      addToast({ type: 'success', title: 'Milestone deleted' });
      onChanged();
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to delete milestone', message: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-stone-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="flex items-start gap-2 p-2.5">
        {/* Checkbox */}
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          aria-label={completed ? 'Mark as not done' : 'Mark as done'}
          aria-pressed={completed}
          className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors duration-150 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-moss-500 ${
            completed
              ? 'bg-moss-500 border-moss-500 text-white'
              : 'bg-white dark:bg-gray-700 border-stone-300 dark:border-gray-500 hover:border-moss-400'
          }`}
        >
          {completed && <Check size={13} strokeWidth={3} />}
        </button>

        {/* Body */}
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => hasDetail && setExpanded((v) => !v)}
            className={`text-left w-full flex items-start gap-1 ${hasDetail ? 'cursor-pointer' : 'cursor-default'}`}
          >
            {hasDetail && (
              <span className="mt-0.5 text-stone-400 flex-shrink-0">
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            )}
            <span className={`text-sm ${completed ? 'line-through text-stone-400 dark:text-gray-500' : 'text-stone-800 dark:text-gray-100'}`}>
              {milestone.title}
            </span>
          </button>

          {/* Meta badges */}
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <Badge variant={MILESTONE_PRIORITY_VARIANT[milestone.priority] ?? 'gray'}>
              <Flag size={10} className="inline mr-1 -mt-0.5" />
              {MILESTONE_PRIORITY_LABEL[milestone.priority] ?? milestone.priority}
            </Badge>
            {milestone.status !== 'pending' && (
              <Badge variant={MILESTONE_STATUS_VARIANT[milestone.status] ?? 'gray'}>
                {MILESTONE_STATUS_LABEL[milestone.status] ?? milestone.status}
              </Badge>
            )}
            {milestone.due_date && (
              <span className={`inline-flex items-center gap-1 text-xs ${overdue ? 'text-red-500 dark:text-red-400 font-medium' : 'text-stone-400 dark:text-gray-500'}`}>
                <Calendar size={11} />
                {overdue ? 'Overdue ' : ''}{formatDate(milestone.due_date)}
              </span>
            )}
            {milestone.estimated_hours != null && (
              <span className="inline-flex items-center gap-1 text-xs text-stone-400 dark:text-gray-500">
                <Clock size={11} />{Number(milestone.estimated_hours)}h
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => onEdit(milestone)}
            className="p-1 text-stone-400 hover:text-moss-600 dark:hover:text-moss-400 transition-colors duration-150"
            aria-label="Edit milestone"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy}
            className="p-1 text-stone-400 hover:text-red-500 transition-colors duration-150 disabled:opacity-50"
            aria-label="Delete milestone"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && hasDetail && (
        <div className="px-3 pb-3 pl-9 space-y-2 text-sm">
          {milestone.description && (
            <p className="text-stone-600 dark:text-gray-400 whitespace-pre-wrap">{milestone.description}</p>
          )}
          {milestone.notes && (
            <p className="text-xs text-stone-500 dark:text-gray-400 whitespace-pre-wrap bg-stone-50 dark:bg-gray-700/40 rounded-md p-2">
              <span className="font-medium">Notes: </span>{milestone.notes}
            </p>
          )}
          {(milestone.estimated_hours != null || milestone.actual_hours != null) && (
            <div className="flex gap-4 text-xs text-stone-500 dark:text-gray-400">
              {milestone.estimated_hours != null && <span>Estimated: {Number(milestone.estimated_hours)}h</span>}
              {milestone.actual_hours != null && <span>Actual: {Number(milestone.actual_hours)}h</span>}
            </div>
          )}
          {resources.length > 0 && (
            <ul className="space-y-1">
              {resources.map((r, i) => (
                <li key={i}>
                  {r.url ? (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-moss-600 dark:text-moss-400 hover:underline"
                    >
                      <ExternalLink size={11} />
                      {r.title || r.url}
                      {r.type && <span className="text-stone-400 dark:text-gray-500">· {r.type}</span>}
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs text-stone-500 dark:text-gray-400">
                      {r.title}{r.type && <span className="text-stone-400">· {r.type}</span>}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default MilestoneItem;
