// client/src/components/engineer/IssueRow.jsx
// DataTable render-helper functions and badge variant maps for engineer issues.
// Follows the research/learning row helper pattern.
/* eslint-disable react-refresh/only-export-components */

import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

// ─── Severity → badge variant / label ─────────────────────────────────────────
// Canonical §5.8 mapping uses red for the highest priority and gray for the
// lowest. To keep all four severities visually distinct we map:
//   P0-Critical → red    (priority 1, danger)
//   P1-High     → amber  (priority 2, warning)
//   P2-Medium   → blue   (info)
//   P3-Low      → gray   (neutral, priority 3)

/** @type {Record<string, import('../ui/Badge').BadgeVariant>} */
export const SEVERITY_VARIANT = {
  'P0-Critical': 'red',
  'P1-High':     'amber',
  'P2-Medium':   'blue',
  'P3-Low':      'gray',
};

/** @type {Record<string, string>} */
export const SEVERITY_LABEL = {
  'P0-Critical': 'P0 · Critical',
  'P1-High':     'P1 · High',
  'P2-Medium':   'P2 · Medium',
  'P3-Low':      'P3 · Low',
};

// ─── Status → badge variant / label (canonical mapping, §5.8) ─────────────────
//   open → pending → gray
//   in_progress → blue
//   resolved → done → moss

/** @type {Record<string, import('../ui/Badge').BadgeVariant>} */
export const STATUS_VARIANT = {
  open:        'gray',
  in_progress: 'blue',
  resolved:    'moss',
};

/** @type {Record<string, string>} */
export const STATUS_LABEL = {
  open:        'Open',
  in_progress: 'In Progress',
  resolved:    'Resolved',
};

// ─── DataTable render helpers ─────────────────────────────────────────────────

/**
 * Title cell — issue title with truncated description below.
 * @param {Object} row
 */
export function TitleCell(row) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium text-stone-900 dark:text-gray-50 truncate max-w-sm">
        {row.title}
      </p>
      {row.description && (
        <p className="text-[11px] text-stone-400 dark:text-gray-500 truncate max-w-sm mt-0.5">
          {row.description}
        </p>
      )}
    </div>
  );
}

/**
 * Severity badge cell.
 * @param {Object} row
 */
export function SeverityCell(row) {
  return (
    <Badge variant={SEVERITY_VARIANT[row.severity] ?? 'gray'}>
      {SEVERITY_LABEL[row.severity] ?? row.severity}
    </Badge>
  );
}

/**
 * Status badge cell.
 * @param {Object} row
 */
export function StatusCell(row) {
  return (
    <Badge variant={STATUS_VARIANT[row.status] ?? 'gray'}>
      {STATUS_LABEL[row.status] ?? row.status}
    </Badge>
  );
}

/**
 * Plain-text cell with em-dash fallback (component, assignee).
 * @param {string|null|undefined} value
 */
export function TextCell(value) {
  if (!value) return <span className="text-sm text-stone-400 dark:text-gray-500">—</span>;
  return <span className="text-sm text-stone-600 dark:text-gray-400">{value}</span>;
}

/**
 * Actions cell — Edit / Delete.
 * @param {Object} row
 * @param {(row: Object) => void} onEdit
 * @param {(row: Object) => void} onDelete
 */
export function ActionsCell(row, onEdit, onDelete) {
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => onEdit(row)}>Edit</Button>
      <Button variant="ghost" size="sm" onClick={() => onDelete(row)}>Delete</Button>
    </>
  );
}
