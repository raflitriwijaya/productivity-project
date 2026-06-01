// client/src/components/learning/LearningRow.jsx
// Renders a single learning item as a DataTable row via column render functions.
// Exported as named render helpers consumed by the columns array in Learning.jsx.

import { ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { Badge }  from '../ui/Badge';
import { Button } from '../ui/Button';

// ─── Badge mapping (§5.8 canonical) ─────────────────────────────────────────

const STATUS_VARIANT = {
  completed:   'emerald',
  in_progress: 'blue',
  not_started: 'gray',
  on_hold:     'amber',
};

const STATUS_LABEL = {
  completed:   'Completed',
  in_progress: 'In Progress',
  not_started: 'Not Started',
  on_hold:     'On Hold',
};

const TYPE_VARIANT = {
  course:  'blue',
  book:    'emerald',
  video:   'amber',
  article: 'gray',
  other:   'gray',
};

const PRIORITY_VARIANT = { 1: 'red', 2: 'amber', 3: 'gray' };
const PRIORITY_LABEL   = { 1: 'High', 2: 'Medium', 3: 'Low' };

// ─── Sub-components used as `render` functions in DataTable columns ──────────

/**
 * @param {{ item: object }} props
 */
export function TitleCell({ item }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <p className="text-sm text-stone-900 dark:text-gray-50 truncate font-medium max-w-xs">
          {item.title}
        </p>
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-stone-400 dark:text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors duration-150 flex-shrink-0"
            aria-label="Open resource"
          >
            <ExternalLink size={13} />
          </a>
        )}
      </div>
      {item.source && (
        <p className="text-xs text-stone-500 dark:text-gray-400 mt-0.5 truncate max-w-xs">
          {item.source}
        </p>
      )}
    </div>
  );
}

/**
 * @param {{ item: object }} props
 */
export function ProgressCell({ item }) {
  const pct = item.progress ?? 0;
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 bg-stone-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
        <div
          className="bg-emerald-500 dark:bg-emerald-400 rounded-full h-1.5 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] text-stone-400 dark:text-gray-500 w-7 text-right flex-shrink-0">
        {pct}%
      </span>
    </div>
  );
}

/**
 * @param {{ item: object, onEdit: (item: object) => void, onDelete: (item: object) => void }} props
 */
export function ActionsCell({ item, onEdit, onDelete }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onEdit(item)}
        aria-label="Edit item"
      >
        <Pencil size={14} />
        Edit
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onDelete(item)}
        aria-label="Delete item"
        className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30"
      >
        <Trash2 size={14} />
      </Button>
    </div>
  );
}

// Re-export badge maps so Learning.jsx can use them without re-declaring
export { STATUS_VARIANT, STATUS_LABEL, TYPE_VARIANT, PRIORITY_VARIANT, PRIORITY_LABEL };
