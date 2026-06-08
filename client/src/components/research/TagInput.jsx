// client/src/components/research/TagInput.jsx
// Tag editor with autocomplete. Works with a comma-separated string so it's a
// drop-in for the old plain tags <Input>:
//   value:    comma-separated string (e.g. "agritech, sensors")
//   onChange: (tagsString) => void   — also comma-separated
//
// Behaviour: tags render as removable Badge chips above the field; typing shows
// a client-filtered dropdown of the user's distinct tags (GET /api/research/tags,
// minus those already chosen); Enter or a comma commits the typed text as a new
// tag, clicking a suggestion adds it. Four-state dropdown (loading/empty/results).

import { useState, useMemo, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { Badge } from '../ui/Badge';

/** Parse a comma-separated string into a clean, de-duplicated tag array. */
function parseTags(str) {
  return [...new Set((str ?? '').split(',').map(t => t.trim()).filter(Boolean))];
}

/**
 * @param {{ value: string, onChange: (tags: string) => void }} props
 */
export function TagInput({ value, onChange }) {
  const tags = useMemo(() => parseTags(value), [value]);

  const [draft, setDraft]   = useState('');
  const [open, setOpen]     = useState(false);
  const wrapRef = useRef(null);

  const { data: allTags, loading } = useApi(() => api.get('/api/research/tags'), []);

  // Close the dropdown on outside click.
  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const commit = (next) => onChange(next.join(', '));

  const addTag = (tag) => {
    const clean = tag.trim();
    if (!clean) return;
    if (!tags.some(t => t.toLowerCase() === clean.toLowerCase())) {
      commit([...tags, clean]);
    }
    setDraft('');
    setOpen(false);
  };

  const removeTag = (tag) => commit(tags.filter(t => t !== tag));

  // Suggestions: user's distinct tags matching the draft, excluding already-added.
  const suggestions = useMemo(() => {
    if (!Array.isArray(allTags)) return [];
    const q = draft.trim().toLowerCase();
    const chosen = new Set(tags.map(t => t.toLowerCase()));
    return allTags
      .filter(t => !chosen.has(t.toLowerCase()))
      .filter(t => q === '' ? true : t.toLowerCase().includes(q))
      .slice(0, 8);
  }, [allTags, draft, tags]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(draft);
    } else if (e.key === 'Backspace' && draft === '' && tags.length > 0) {
      removeTag(tags[tags.length - 1]); // backspace on empty input removes last chip
    }
  };

  return (
    <div className="w-full" ref={wrapRef}>
      <label className="block text-xs font-medium text-stone-700 dark:text-gray-300 tracking-wide uppercase mb-1.5">
        Tags
      </label>

      {/* Selected chips */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map(t => (
            <Badge key={t} variant="gray" className="gap-1 pr-1">
              {t}
              <button
                type="button"
                onClick={() => removeTag(t)}
                aria-label={`Remove ${t}`}
                className="rounded-full p-0.5 text-stone-400 hover:text-stone-700 dark:text-gray-500 dark:hover:text-gray-200 hover:bg-stone-200/70 dark:hover:bg-gray-600"
              >
                <X size={11} />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Input + dropdown */}
      <div className="relative">
        <input
          type="text"
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Type a tag, then Enter…"
          className="w-full px-4 py-2 rounded-lg text-sm
            bg-white dark:bg-gray-700
            text-stone-900 dark:text-gray-50
            placeholder-stone-400 dark:placeholder-gray-500
            border border-stone-200 dark:border-gray-600
            focus:outline-none focus:ring-2 focus:ring-moss-500 dark:focus:ring-moss-400 focus:border-transparent
            transition-colors duration-150"
        />

        {open && (
          <div className="absolute z-40 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-stone-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1">
            {loading && (
              <p className="px-4 py-2 text-xs text-stone-400 dark:text-gray-500">Loading tags…</p>
            )}
            {!loading && suggestions.length === 0 && (
              <p className="px-4 py-2 text-xs text-stone-400 dark:text-gray-500">
                {draft.trim() ? `Press Enter to add "${draft.trim()}"` : 'No tags yet — type to create one.'}
              </p>
            )}
            {!loading && suggestions.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => addTag(t)}
                className="w-full text-left px-4 py-2 text-sm text-stone-700 dark:text-gray-300 hover:bg-moss-50 dark:hover:bg-moss-950/30 hover:text-moss-700 dark:hover:text-moss-400 transition-colors duration-100"
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="mt-1 text-xs text-stone-500 dark:text-gray-400">
        Press Enter or comma to add. Click a chip's × to remove.
      </p>
    </div>
  );
}
