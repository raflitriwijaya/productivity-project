// client/src/components/research/ResearchEntryRow.jsx
// Exports DataTable render-helper functions and badge variant maps.
// Follows the same pattern as LearningRow.jsx (see PROJECT_STATE.md).

import { useState, useRef, useEffect } from 'react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ExternalLink, Copy, Pin, Clipboard, ChevronDown } from 'lucide-react';
import { TopicBadge } from './TopicBadge';
import { CITATION_STYLES } from '../../lib/generateCitation';

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
  active:   'moss',
  archived: 'red',
};

/** @type {Record<string, string>} */
export const STATUS_LABEL = {
  draft:    'Draft',
  active:   'Active',
  archived: 'Archived',
};

// ─── DataTable render helpers ─────────────────────────────────────────────────

/** Split a comma-separated tag string into a clean array. */
export function splitTags(tags) {
  return (tags ?? '').split(',').map(t => t.trim()).filter(Boolean);
}

/**
 * Renders the title cell.
 * @param {Object} row
 */
export function TitleCell(row) {
  return (
    <div className="min-w-0">
      <p className="text-sm text-stone-900 dark:text-gray-50 truncate max-w-xs">{row.title}</p>
    </div>
  );
}

/**
 * Renders the tags cell — each tag as a clickable Badge that calls `onTagClick`.
 * Higher-order helper (mirrors ActionsCell): `render: TagsCell(onTagClick)`.
 * @param {(tag: string) => void} onTagClick
 * @returns {(row: Object) => JSX.Element}
 */
export function TagsCell(onTagClick) {
  return function TagsCellInner(row) {
    const tags = splitTags(row.tags);
    if (tags.length === 0) {
      return <span className="text-sm text-stone-400 dark:text-gray-500">—</span>;
    }
    return (
      <div className="flex flex-wrap gap-1 max-w-[200px]">
        {tags.map(t => (
          <button
            key={t}
            type="button"
            onClick={() => onTagClick(t)}
            aria-label={`Filter by tag ${t}`}
            className="focus:outline-none focus:ring-2 focus:ring-moss-500 dark:focus:ring-moss-400 rounded-md"
          >
            <Badge variant="gray" className="hover:bg-moss-50 hover:text-moss-700 dark:hover:bg-moss-950/40 dark:hover:text-moss-400 transition-colors cursor-pointer">
              {t}
            </Badge>
          </button>
        ))}
      </div>
    );
  };
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
        className="inline-flex items-center gap-1 text-sm text-moss-600 dark:text-moss-400 hover:underline truncate max-w-[180px]"
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
 * Renders the topics cell — a wrapped list of TopicBadge chips, or an em-dash
 * when the entry has no topics. `row.topics` is `[{ id, name, color }]`.
 * @param {Object} row
 */
export function TopicsCell(row) {
  if (!row.topics || row.topics.length === 0) {
    return <span className="text-sm text-stone-400 dark:text-gray-500">—</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 max-w-[220px]">
      {row.topics.map(t => (
        <TopicBadge key={t.id} name={t.name} color={t.color} />
      ))}
    </div>
  );
}

/**
 * Renders the actions cell. Higher-order over an `actions` object so call sites
 * don't depend on positional argument order: `render: (row) => ActionsCell(row, actions)`.
 *
 * @param {Object} row
 * @param {{
 *   onEdit: (row: Object) => void,
 *   onDelete: (row: Object) => void,
 *   onDuplicate: (row: Object) => void,
 *   onTogglePin: (row: Object) => void,
 *   onCopyCitation: (row: Object, style: string) => void,
 * }} actions
 */
export function ActionsCell(row, actions) {
  return <RowActions row={row} actions={actions} />;
}

/** Citation-eligible entry types. */
const CITABLE_TYPES = new Set(['journal', 'citation']);

function RowActions({ row, actions }) {
  const { onEdit, onDelete, onDuplicate, onTogglePin, onCopyCitation } = actions;
  const [citeOpen, setCiteOpen] = useState(false);
  const citeRef = useRef(null);

  useEffect(() => {
    if (!citeOpen) return;
    const onDoc = (e) => { if (citeRef.current && !citeRef.current.contains(e.target)) setCiteOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [citeOpen]);

  const pinned = !!row.is_pinned;

  return (
    <div className="inline-flex items-center gap-0.5 justify-end">
      {/* PIN toggle */}
      <button
        type="button"
        onClick={() => onTogglePin(row)}
        aria-label={pinned ? 'Unpin entry' : 'Pin entry'}
        title={pinned ? 'Unpin' : 'Pin'}
        className={`p-1.5 rounded-md transition-colors duration-150
          ${pinned
            ? 'text-moss-600 dark:text-moss-400 hover:bg-moss-50 dark:hover:bg-moss-950/40'
            : 'text-stone-400 dark:text-gray-500 hover:text-stone-600 dark:hover:text-gray-300 hover:bg-stone-100 dark:hover:bg-gray-700'}`}
      >
        <Pin size={15} className={pinned ? 'fill-current' : ''} />
      </button>

      {/* COPY CITATION (journal/citation only) */}
      {CITABLE_TYPES.has(row.type) && (
        <div className="relative" ref={citeRef}>
          <div className="inline-flex items-center">
            <button
              type="button"
              onClick={() => { onCopyCitation(row, 'apa'); setCiteOpen(false); }}
              aria-label="Copy APA citation"
              title="Copy APA citation"
              className="p-1.5 rounded-md text-stone-400 dark:text-gray-500 hover:text-stone-600 dark:hover:text-gray-300 hover:bg-stone-100 dark:hover:bg-gray-700 transition-colors duration-150"
            >
              <Clipboard size={15} />
            </button>
            <button
              type="button"
              onClick={() => setCiteOpen(o => !o)}
              aria-label="Choose citation style"
              className="p-0.5 rounded-md text-stone-400 dark:text-gray-500 hover:text-stone-600 dark:hover:text-gray-300 hover:bg-stone-100 dark:hover:bg-gray-700 transition-colors duration-150"
            >
              <ChevronDown size={12} />
            </button>
          </div>
          {citeOpen && (
            <div className="absolute right-0 mt-1 w-32 z-40 rounded-lg border border-stone-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1">
              {CITATION_STYLES.map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => { onCopyCitation(row, s.value); setCiteOpen(false); }}
                  className="w-full text-left px-3 py-1.5 text-sm text-stone-700 dark:text-gray-300 hover:bg-moss-50 dark:hover:bg-moss-950/30 hover:text-moss-700 dark:hover:text-moss-400 transition-colors duration-100"
                >
                  Copy {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DUPLICATE */}
      <button
        type="button"
        onClick={() => onDuplicate(row)}
        aria-label="Duplicate entry"
        title="Duplicate"
        className="p-1.5 rounded-md text-stone-400 dark:text-gray-500 hover:text-stone-600 dark:hover:text-gray-300 hover:bg-stone-100 dark:hover:bg-gray-700 transition-colors duration-150"
      >
        <Copy size={15} />
      </button>

      {/* EDIT / DELETE */}
      <Button variant="ghost" size="sm" onClick={() => onEdit(row)}>Edit</Button>
      <Button variant="ghost" size="sm" onClick={() => onDelete(row)}>Delete</Button>
    </div>
  );
}
