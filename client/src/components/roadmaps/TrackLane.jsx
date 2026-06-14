// client/src/components/roadmaps/TrackLane.jsx
// Custom Learning Roadmaps — one track (lane) within the detail view: a colored
// header strip, the track title + progress mini-bar, its milestones listed
// vertically (MilestoneItem), and an "Add Milestone" button. Track edit/delete live
// in the header. Delete is handled here (API + onChanged); the modals are owned by
// the parent RoadmapDetail via the on* callbacks.

import { Plus, Pencil, Trash2 } from 'lucide-react';
import { MilestoneItem } from './MilestoneItem';
import api from '../../lib/api';
import { useToast } from '../../hooks/useToast';
import { pct } from '../../lib/roadmapEnums';

/**
 * @param {{
 *   track: object,
 *   onChanged: () => void,
 *   onAddMilestone: (trackId: number) => void,
 *   onEditMilestone: (m: object) => void,
 *   onEditTrack: (t: object) => void,
 * }} props
 */
export function TrackLane({ track, onChanged, onAddMilestone, onEditMilestone, onEditTrack }) {
  const { addToast } = useToast();
  const milestones = track.milestones ?? [];
  const progress = pct(track.progress);
  const done = milestones.filter((m) => m.status === 'completed').length;
  const accent = track.color || '#94a3b8';

  const handleDeleteTrack = async () => {
    if (!window.confirm(`Delete the "${track.title}" track and all its milestones?`)) return;
    try {
      await api.delete(`/api/roadmaps/tracks/${track.id}`);
      addToast({ type: 'success', title: 'Track deleted' });
      onChanged();
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to delete track', message: err.message });
    }
  };

  return (
    <div className="flex flex-col bg-stone-50 dark:bg-gray-800/60 rounded-xl border border-stone-200 dark:border-gray-700 overflow-hidden">
      {/* Color strip */}
      <span className="h-1.5 w-full flex-shrink-0" style={{ backgroundColor: accent }} aria-hidden="true" />

      {/* Header */}
      <div className="p-3 border-b border-stone-200 dark:border-gray-700">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-stone-900 dark:text-gray-50 truncate">{track.title}</h3>
            {track.description && (
              <p className="text-xs text-stone-500 dark:text-gray-400 mt-0.5 line-clamp-2">{track.description}</p>
            )}
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => onEditTrack(track)}
              className="p-1 text-stone-400 hover:text-moss-600 dark:hover:text-moss-400 transition-colors duration-150"
              aria-label="Edit track"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={handleDeleteTrack}
              className="p-1 text-stone-400 hover:text-red-500 transition-colors duration-150"
              aria-label="Delete track"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Progress mini-bar */}
        <div className="mt-2">
          <div className="flex items-center justify-between text-[11px] mb-1 text-stone-500 dark:text-gray-400">
            <span className="tabular-nums">{done}/{milestones.length} done</span>
            <span className="tabular-nums font-medium text-moss-600 dark:text-moss-400">{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-stone-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${progress >= 100 ? 'bg-moss-500' : 'bg-gradient-to-r from-moss-500 to-ember-500'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Milestones */}
      <div className="p-3 space-y-2 flex-1">
        {milestones.length === 0 ? (
          <p className="text-xs text-stone-400 dark:text-gray-500 text-center py-4">No milestones yet.</p>
        ) : (
          milestones.map((m) => (
            <MilestoneItem key={m.id} milestone={m} onEdit={onEditMilestone} onChanged={onChanged} />
          ))
        )}

        <button
          type="button"
          onClick={() => onAddMilestone(track.id)}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-stone-500 dark:text-gray-400 border border-dashed border-stone-300 dark:border-gray-600 hover:border-moss-400 hover:text-moss-700 dark:hover:text-moss-400 transition-colors duration-150"
        >
          <Plus size={14} /> Add Milestone
        </button>
      </div>
    </div>
  );
}

export default TrackLane;
