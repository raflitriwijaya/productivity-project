// client/src/components/shared/QuickCapture.jsx
// Global command palette (Roadmap Wave 2 capture + Wave 3 unified search). Mounted
// once in AppLayout so a single Cmd/Ctrl+K listener owns the shortcut app-wide
// (mounting twice would double-toggle and cancel out).
//
// Four modes (Tab cycles): 'todo', 'research', and 'idea' capture without leaving
// the page; 'search' queries GET /api/search across every module and navigates to
// the chosen result. Capture still dispatches 'quick-capture-created' on success.
//
// Open via:  Cmd/Ctrl+K  OR  window.dispatchEvent(new Event('open-quick-capture'))

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Search, CheckSquare, BookOpen, Lightbulb, Plus } from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../hooks/useToast';

const MODE_ORDER = ['todo', 'research', 'idea', 'search'];

// Where each searchable entity type lives. Most modules don't deep-link to a single
// item yet, so we route to the module's list page; engineer projects have a detail
// route, so we link straight to it.
const ENTITY_ROUTES = {
  todo:             () => '/todo',
  research_entry:   () => '/research',
  learning_item:    () => '/learning',
  transaction:      () => '/finance',
  engineer_project: (id) => `/engineer/${id}`,
  book:             () => '/reading',
};

const ENTITY_LABELS = {
  todo: 'Task',
  research_entry: 'Research',
  learning_item: 'Learning',
  transaction: 'Finance',
  engineer_project: 'Project',
  book: 'Book',
};

const COLOR_TEXT = {
  moss: 'text-moss-600 dark:text-moss-400',
  ember: 'text-ember-600 dark:text-ember-400',
  terracotta: 'text-terracotta-600 dark:text-terracotta-400',
  blue: 'text-blue-600 dark:text-blue-400',
};

export function QuickCapture() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('todo'); // 'todo' | 'research' | 'search'
  const [submitting, setSubmitting] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const { addToast } = useToast();

  // ── Global open/close wiring ───────────────────────────────────────────────
  useEffect(() => {
    const open = () => { setInput(''); setMode('todo'); setSearchResults([]); setIsOpen(true); };

    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsOpen((prev) => {
          if (!prev) { setInput(''); setMode('todo'); setSearchResults([]); }
          return !prev;
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-quick-capture', open);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-quick-capture', open);
    };
  }, []);

  // Focus the input shortly after opening (after the portal mounts).
  useEffect(() => {
    if (!isOpen) return undefined;
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // Debounced unified search — only while in search mode with a non-empty query.
  useEffect(() => {
    if (mode !== 'search' || !input.trim()) {
      /* clearing the stale result list when leaving search mode is intentional */
      /* eslint-disable react-hooks/set-state-in-effect */
      setSearchResults([]);
      setSearchLoading(false);
      /* eslint-enable react-hooks/set-state-in-effect */
      return undefined;
    }
    let cancelled = false;
    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/api/search?q=${encodeURIComponent(input.trim())}`);
        if (!cancelled) setSearchResults(res.data ?? []);
      } catch {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [input, mode]);

  const close = () => { setIsOpen(false); setInput(''); setSearchResults([]); };

  const goToResult = (result) => {
    const make = ENTITY_ROUTES[result.entity_type];
    if (!make) return;
    navigate(make(result.id));
    close();
  };

  const handleCapture = async () => {
    const title = input.trim();
    if (!title || submitting) return;

    setSubmitting(true);
    try {
      if (mode === 'todo') {
        await api.post('/api/todos', { title });
        addToast({ type: 'success', title: 'Task created' });
      } else if (mode === 'idea') {
        await api.post('/api/ideas', { title });
        addToast({ type: 'success', title: 'Idea captured' });
      } else {
        await api.post('/api/research', { title, type: 'note' });
        addToast({ type: 'success', title: 'Research note created' });
      }
      window.dispatchEvent(new Event('quick-capture-created'));
      close();
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to capture', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // Enter: in search mode open the first result; otherwise capture.
  // Tab cycles modes. Escape closes.
  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (mode === 'search') {
        if (searchResults.length > 0) goToResult(searchResults[0]);
      } else {
        handleCapture();
      }
    } else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      setMode((prev) => MODE_ORDER[(MODE_ORDER.indexOf(prev) + 1) % MODE_ORDER.length]);
      inputRef.current?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  if (!isOpen) return null;

  const placeholder =
    mode === 'todo' ? 'Capture a task…' :
    mode === 'research' ? 'Capture a research idea…' :
    mode === 'idea' ? 'Capture an idea before it evaporates…' :
    'Search across everything…';

  const modeBtn = (value, Icon, label) => (
    <button
      type="button"
      onClick={() => { setMode(value); inputRef.current?.focus(); }}
      className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
        mode === value
          ? 'bg-moss-100 dark:bg-moss-950/40 text-moss-700 dark:text-moss-400'
          : 'hover:text-stone-600 dark:hover:text-gray-300'
      }`}
    >
      <Icon size={12} />
      {label}
    </button>
  );

  return createPortal(
    <div className="fixed inset-0 z-[55] flex items-start justify-center pt-[20vh] px-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={close} aria-hidden="true" />

      {/* Palette panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quick capture and search"
        className="relative z-10 w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-stone-200 dark:border-gray-700 overflow-hidden"
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <Search size={18} className="text-stone-400 dark:text-gray-500 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent border-none outline-none text-stone-800 dark:text-gray-100 placeholder-stone-400 dark:placeholder-gray-500 text-sm"
            disabled={submitting}
          />
          {mode !== 'search' && (
            <button
              type="button"
              onClick={handleCapture}
              disabled={!input.trim() || submitting}
              className="flex items-center gap-1 px-3 py-1.5 bg-moss-600 text-white text-xs font-medium rounded-lg hover:bg-moss-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Plus size={14} />
              {submitting ? 'Saving…' : 'Capture'}
            </button>
          )}
        </div>

        {/* Search results (search mode only) */}
        {mode === 'search' && input.trim() && (
          <div className="max-h-72 overflow-y-auto border-t border-stone-200 dark:border-gray-700">
            {searchLoading && (
              <p className="px-4 py-3 text-xs text-stone-400 dark:text-gray-500">Searching…</p>
            )}
            {!searchLoading && searchResults.length === 0 && (
              <p className="px-4 py-3 text-xs text-stone-400 dark:text-gray-500">No matches found.</p>
            )}
            {!searchLoading && searchResults.map((r) => (
              <button
                key={`${r.entity_type}-${r.id}`}
                type="button"
                onClick={() => goToResult(r)}
                className="w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 border-b border-stone-100 dark:border-gray-800 last:border-b-0 hover:bg-stone-50 dark:hover:bg-gray-800/60 transition-colors"
              >
                <span className="min-w-0">
                  <span className="block text-sm text-stone-800 dark:text-gray-100 truncate">{r.title || `#${r.id}`}</span>
                  {r.subtitle && <span className="block text-xs text-stone-400 dark:text-gray-500 truncate">{r.subtitle}</span>}
                </span>
                <span className={`text-[10px] font-semibold uppercase tracking-wide flex-shrink-0 ${COLOR_TEXT[r.color] ?? 'text-stone-400'}`}>
                  {ENTITY_LABELS[r.entity_type] ?? r.entity_type}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Footer: mode toggle + shortcut hints */}
        <div className="flex items-center justify-between px-4 py-2 bg-stone-50 dark:bg-gray-800/60 border-t border-stone-200 dark:border-gray-700 text-xs text-stone-400 dark:text-gray-500">
          <div className="flex items-center gap-2">
            {modeBtn('todo', CheckSquare, 'Task')}
            {modeBtn('research', BookOpen, 'Research')}
            {modeBtn('idea', Lightbulb, 'Idea')}
            {modeBtn('search', Search, 'Search')}
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 bg-stone-200 dark:bg-gray-700 rounded">Tab</kbd>
            <span>switch</span>
            <span className="mx-0.5">·</span>
            <kbd className="px-1.5 py-0.5 bg-stone-200 dark:bg-gray-700 rounded">Enter</kbd>
            <span>{mode === 'search' ? 'open' : 'save'}</span>
            <span className="mx-0.5">·</span>
            <kbd className="px-1.5 py-0.5 bg-stone-200 dark:bg-gray-700 rounded">Esc</kbd>
            <span>close</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default QuickCapture;
