// client/src/components/goals/GoalDetailModal.jsx
// Goal detail (Roadmap Wave 5): meta, description, progress bar, dates, the
// LinkedItems section (link the goal to books/projects/etc), and actions —
// "Recalculate" re-derives current_value from completed linked entities
// (POST /api/goals/:id/recalc), plus Complete / Edit / Delete.

import { useState } from 'react';
import { Calendar, Target, RefreshCw, CheckCircle2, Trash2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { LinkedItems } from '../shared/LinkedItems';
import api from '../../lib/api';
import { useToast } from '../../hooks/useToast';
import {
  PRIORITY_VARIANT, PRIORITY_LABEL, STATUS_VARIANT, STATUS_LABEL, TYPE_LABEL, goalProgress,
} from './GoalCard';

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * @param {{ isOpen: boolean, onClose: () => void, goal: object, onEdit: () => void, onChanged?: () => void }} props
 */
export function GoalDetailModal({ isOpen, onClose, goal, onEdit, onChanged }) {
  const { addToast } = useToast();
  const [busy, setBusy] = useState(false);
  // Local copy so a recalc updates the displayed progress without a full refetch.
  const [current, setCurrent] = useState(goal?.current_value);

  if (!goal) return null;

  const view = { ...goal, current_value: current ?? goal.current_value };
  const pct = goalProgress(view);
  const target = parseFloat(view.target_value);
  const currentVal = parseFloat(view.current_value) || 0;

  const handleRecalc = async () => {
    setBusy(true);
    try {
      const res = await api.post(`/api/goals/${goal.id}/recalc`);
      setCurrent(res.data.current_value);
      addToast({ type: 'success', title: 'Progress recalculated', message: `Now ${res.data.current_value}${goal.unit ? ` ${goal.unit}` : ''}` });
      onChanged?.();
    } catch (err) {
      addToast({ type: 'error', title: 'Recalculation failed', message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const handleComplete = async () => {
    setBusy(true);
    try {
      await api.patch(`/api/goals/${goal.id}`, { status: 'completed' });
      addToast({ type: 'success', title: 'Goal completed 🎉' });
      onChanged?.();
      onClose();
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to complete goal', message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this goal? This cannot be undone.')) return;
    setBusy(true);
    try {
      await api.delete(`/api/goals/${goal.id}`);
      addToast({ type: 'success', title: 'Goal deleted' });
      onChanged?.();
      onClose();
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to delete goal', message: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={goal.title}
      size="lg"
      footer={
        <>
          <Button variant="ghost" size="md" onClick={handleDelete} disabled={busy} aria-label="Delete goal">
            <Trash2 size={14} /> Delete
          </Button>
          <div className="flex-1" />
          <Button variant="secondary" size="md" onClick={onClose}>Close</Button>
          {goal.status !== 'completed' && (
            <Button variant="secondary" size="md" onClick={handleComplete} disabled={busy}>
              <CheckCircle2 size={14} /> Complete
            </Button>
          )}
          <Button variant="primary" size="md" onClick={onEdit}>Edit</Button>
        </>
      }
    >
      {/* Meta */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={PRIORITY_VARIANT[goal.priority] ?? 'gray'}>{PRIORITY_LABEL[goal.priority] ?? goal.priority}</Badge>
        <Badge variant={STATUS_VARIANT[goal.status] ?? 'gray'}>{STATUS_LABEL[goal.status] ?? goal.status}</Badge>
        <Badge variant="gray">{TYPE_LABEL[goal.goal_type] ?? goal.goal_type}</Badge>
        {goal.category && <span className="text-sm text-stone-500 dark:text-gray-400">{goal.category}</span>}
      </div>

      {/* Description */}
      {goal.description ? (
        <p className="text-sm text-stone-600 dark:text-gray-400 whitespace-pre-wrap">{goal.description}</p>
      ) : (
        <p className="text-sm text-stone-400 dark:text-gray-500 italic">No description.</p>
      )}

      {/* Progress */}
      {pct != null ? (
        <div className="rounded-lg border border-stone-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium text-stone-700 dark:text-gray-300">Progress</span>
            <button
              type="button"
              onClick={handleRecalc}
              disabled={busy}
              className="inline-flex items-center gap-1 text-xs text-moss-600 dark:text-moss-400 hover:text-moss-700 dark:hover:text-moss-300 disabled:opacity-50 transition-colors duration-150"
            >
              <RefreshCw size={13} className={busy ? 'animate-spin' : ''} /> Recalculate from links
            </button>
          </div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-stone-600 dark:text-gray-400 tabular-nums">
              {currentVal}{goal.unit ? ` ${goal.unit}` : ''} / {target}{goal.unit ? ` ${goal.unit}` : ''}
            </span>
            <span className="font-semibold text-moss-600 dark:text-moss-400 tabular-nums">{pct}%</span>
          </div>
          <div className="w-full h-2.5 bg-stone-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${pct >= 100 ? 'bg-moss-500' : 'bg-gradient-to-r from-moss-500 to-ember-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-sm text-stone-400 dark:text-gray-500">
          <Target size={14} /> No numeric target set for this {TYPE_LABEL[goal.goal_type]?.toLowerCase() ?? goal.goal_type} goal.
        </div>
      )}

      {/* Dates */}
      {(goal.start_date || goal.target_date) && (
        <div className="flex flex-wrap gap-4 text-sm text-stone-500 dark:text-gray-400">
          {goal.start_date && (
            <div className="flex items-center gap-1.5"><Calendar size={14} /> Started: {formatDate(goal.start_date)}</div>
          )}
          {goal.target_date && (
            <div className="flex items-center gap-1.5"><Calendar size={14} /> Target: {formatDate(goal.target_date)}</div>
          )}
        </div>
      )}

      {/* Linked items (Universal Links, Wave 1) — link entities so Recalculate can count them */}
      <div className="border-t border-stone-200 dark:border-gray-700 pt-4">
        <LinkedItems entityType="goal" entityId={goal.id} />
      </div>
    </Modal>
  );
}

export default GoalDetailModal;
