// client/src/components/engineer/ProjectRow.jsx
// DataTable render-helper functions and badge variant maps for engineer projects.
// Follows the same pattern as research/ResearchEntryRow.jsx and learning/LearningRow.jsx.

import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ExternalLink } from 'lucide-react';

// ─── Project type → badge variant / label ("Stoic Garden" palette) ───────────
//     embedded leans terracotta (hardware/craft); robotics leans moss (precision
//     growth); iot stays blue; other stays gray.

/** @type {Record<string, import('../ui/Badge').BadgeVariant>} */
export const TYPE_VARIANT = {
  iot:      'blue',
  embedded: 'terracotta',
  robotics: 'moss',
  other:    'gray',
};

/** @type {Record<string, string>} */
export const TYPE_LABEL = {
  iot:      'IoT',
  embedded: 'Embedded',
  robotics: 'Robotics',
  other:    'Other',
};

// ─── Status → badge variant / label (canonical mapping, §5.8) ─────────────────
//   deployed → active → moss
//   planning/development/testing → in_progress → blue
//   idea → pending → gray
//   archived → cancelled → red

/** @type {Record<string, import('../ui/Badge').BadgeVariant>} */
export const STATUS_VARIANT = {
  idea:        'gray',
  planning:    'blue',
  development: 'blue',
  testing:     'amber',
  deployed:    'moss',
  archived:    'red',
};

/** @type {Record<string, string>} */
export const STATUS_LABEL = {
  idea:        'Idea',
  planning:    'Planning',
  development: 'Development',
  testing:     'Testing',
  deployed:    'Deployed',
  archived:    'Archived',
};

/**
 * Split a comma-separated tag string into a trimmed, non-empty array.
 * @param {string|null|undefined} value
 * @returns {string[]}
 */
export function splitTags(value) {
  if (!value) return [];
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

// ─── DataTable render helpers ─────────────────────────────────────────────────

/**
 * Title cell — project name with a truncated repo host below if present.
 * @param {Object} row
 */
export function TitleCell(row) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium text-stone-900 dark:text-gray-50 truncate max-w-xs">
        {row.name}
      </p>
      {row.description && (
        <p className="text-[11px] text-stone-400 dark:text-gray-500 truncate max-w-xs mt-0.5">
          {row.description}
        </p>
      )}
    </div>
  );
}

/**
 * Type badge cell.
 * @param {Object} row
 */
export function TypeCell(row) {
  return (
    <Badge variant={TYPE_VARIANT[row.project_type] ?? 'gray'}>
      {TYPE_LABEL[row.project_type] ?? row.project_type}
    </Badge>
  );
}

/**
 * Platforms cell — renders up to 3 platform badges, then a "+N" overflow chip.
 * @param {Object} row
 */
export function PlatformsCell(row) {
  const items = splitTags(row.platforms);
  if (items.length === 0) {
    return <span className="text-sm text-stone-400 dark:text-gray-500">—</span>;
  }
  const shown = items.slice(0, 3);
  const extra = items.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map(p => (
        <Badge key={p} variant="gray">{p}</Badge>
      ))}
      {extra > 0 && (
        <span className="text-[11px] text-stone-400 dark:text-gray-500">+{extra}</span>
      )}
    </div>
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
 * Updated-at cell — localized date.
 * @param {Object} row
 */
export function UpdatedCell(row) {
  return (
    <span className="text-sm text-stone-500 dark:text-gray-400">
      {new Date(row.updated_at).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
      })}
    </span>
  );
}

/**
 * Actions cell — View / Edit / Delete.
 * @param {Object} row
 * @param {(row: Object) => void} onView
 * @param {(row: Object) => void} onEdit
 * @param {(row: Object) => void} onDelete
 */
export function ActionsCell(row, onView, onEdit, onDelete) {
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => onView(row)}>View</Button>
      <Button variant="ghost" size="sm" onClick={() => onEdit(row)}>Edit</Button>
      <Button variant="ghost" size="sm" onClick={() => onDelete(row)}>Delete</Button>
    </>
  );
}

/**
 * Inline repo link (used on the detail page header / overview).
 * @param {string|null|undefined} url
 */
export function RepoLink({ url }) {
  if (!url) return <span className="text-sm text-stone-400 dark:text-gray-500">No repository</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-sm text-moss-600 dark:text-moss-400 hover:underline"
    >
      <ExternalLink size={14} className="flex-shrink-0" />
      <span className="truncate max-w-[260px]">{url}</span>
    </a>
  );
}
