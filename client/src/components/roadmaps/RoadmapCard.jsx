// client/src/components/roadmaps/RoadmapCard.jsx
// Custom Learning Roadmaps — a single roadmap as a grid card: icon, title, category
// + status badges, auto-calculated progress bar, milestone count (done/total), and
// track count. The left edge is tinted with the roadmap's user-chosen color.
// Clicking navigates to the detail view (/roadmaps/:id).

import { Layers, CheckSquare } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { ROADMAP_STATUS_VARIANT, ROADMAP_STATUS_LABEL, pct } from '../../lib/roadmapEnums';

/**
 * @param {{ roadmap: object, onClick: () => void }} props
 */
export function RoadmapCard({ roadmap, onClick }) {
  const progress = pct(roadmap.progress);
  const done  = roadmap.milestone_done ?? 0;
  const total = roadmap.milestone_total ?? 0;
  const tracks = roadmap.track_count ?? 0;
  const color = roadmap.color || '#4A7C59';

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left w-full relative overflow-hidden bg-white dark:bg-gray-800 rounded-xl border border-stone-200 dark:border-gray-700 shadow-sm p-5 pl-6 hover:border-moss-400 dark:hover:border-moss-500 hover:shadow-md transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-moss-500 dark:focus:ring-moss-400"
    >
      {/* Color edge — the roadmap's user-chosen hex */}
      <span className="absolute left-0 inset-y-0 w-1.5" style={{ backgroundColor: color }} aria-hidden="true" />

      {/* Header: icon + title, status badge */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {roadmap.icon && <span className="text-xl leading-none flex-shrink-0" aria-hidden="true">{roadmap.icon}</span>}
          <h3 className="text-sm font-semibold text-stone-900 dark:text-gray-50 line-clamp-2">{roadmap.title}</h3>
        </div>
        <Badge variant={ROADMAP_STATUS_VARIANT[roadmap.status] ?? 'gray'}>
          {ROADMAP_STATUS_LABEL[roadmap.status] ?? roadmap.status}
        </Badge>
      </div>

      {/* Category */}
      {roadmap.category && (
        <p className="text-xs text-stone-400 dark:text-gray-500 mb-3 capitalize">{roadmap.category}</p>
      )}

      {/* Progress */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-stone-600 dark:text-gray-400">Progress</span>
          <span className="font-medium text-moss-600 dark:text-moss-400 tabular-nums">{progress}%</span>
        </div>
        <div className="w-full h-2 bg-stone-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${progress >= 100 ? 'bg-moss-500' : 'bg-gradient-to-r from-moss-500 to-ember-500'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Counts */}
      <div className="mt-3 flex items-center gap-4 text-xs text-stone-500 dark:text-gray-400">
        <span className="inline-flex items-center gap-1.5">
          <CheckSquare size={13} className="text-stone-400" />
          <span className="tabular-nums">{done}/{total}</span> milestones
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Layers size={13} className="text-stone-400" />
          <span className="tabular-nums">{tracks}</span> {tracks === 1 ? 'track' : 'tracks'}
        </span>
      </div>
    </button>
  );
}

export default RoadmapCard;
