// client/src/components/research/ResearchEntryRow.jsx
// Exports DataTable render-helper functions and badge variant maps.
// Follows the same pattern as LearningRow.jsx (see PROJECT_STATE.md).

import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ExternalLink } from 'lucide-react';

// ─── Badge variant maps (canonical — used by Research.jsx column definitions) ─

/** @type {Record<string, import('../ui/Badge').BadgeVariant>} */
export const TYPE_VARIANT = {
  journal:  'blue',
  citation: 'amber',
  note:     'gray',
};

/** @type {Record<string, string>} */
export const TYPE_LABEL = {
  journal:  'Journal',
  citation: 'Citation',
  note:     'Note',
};

/** @type {Record<string, import('../ui/Badge').BadgeVariant>} */
export const STATUS_VARIANT = {
  draft:    'gray',
  active:   'emerald',
  archived: 'red',
};

/** @type {Record<string, string>} */
export const STATUS_LABEL = {
  draft:    'Draft',
  active:   'Active',
  archived: 'Archived',
};

// ─── DataTable render helpers ─────────────────────────────────────────────────

/**
 * Renders the title cell with optional tags below.
 * @param {Object} row
 */
export function TitleCell(row) {
  return (
    <div className="min-w-0">
      <p className="text-sm text-stone-900 dark:text-gray-50 truncate max-w-xs">{row.title}</p>
      {row.tags && (
        <p className="text-[11px] text-stone-400 dark:text-gray-500 truncate max-w-xs mt-0.5">
          {row.tags}
        </p>
      )}
    </div>
  );
}

/**
 * Renders the type badge.
 * @param {Object} row
 */
export function TypeCell(row) {
  return (
    <Badge variant={TYPE_VARIANT[row.type] ?? 'gray'}>
      {TYPE_LABEL[row.type] ?? row.type}
    </Badge>
  );
}

/**
 * Renders the status badge.
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
 * Renders the source cell — a truncated link if source is a URL, plain text otherwise.
 * @param {Object} row
 */
export function SourceCell(row) {
  if (!row.source) {
    return <span className="text-sm text-stone-400 dark:text-gray-500">—</span>;
  }

  const isUrl = row.source.startsWith('http://') || row.source.startsWith('https://');
  if (isUrl) {
    return (
      <a
        href={row.source}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400 hover:underline truncate max-w-[180px]"
      >
        <ExternalLink size={12} className="flex-shrink-0" />
        <span className="truncate">{new URL(row.source).hostname}</span>
      </a>
    );
  }

  return (
    <span className="text-sm text-stone-500 dark:text-gray-400 truncate block max-w-[180px]">
      {row.source}
    </span>
  );
}

/**
 * Renders the actions cell (Edit + Delete buttons).
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
