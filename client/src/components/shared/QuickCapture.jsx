// client/src/components/shared/QuickCapture.jsx
// Global quick-capture palette (Roadmap Wave 2). Mounted once in AppLayout so a
// single Cmd/Ctrl+K listener owns the shortcut app-wide (mounting twice would
// double-toggle and cancel out). Captures an idea as a Todo task or a Research
// note without leaving the current page.
//
// Open via:  Cmd/Ctrl+K  OR  window.dispatchEvent(new Event('open-quick-capture'))
// On success it dispatches a 'quick-capture-created' window event so pages like
// the Today Dashboard can refetch their briefing.

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, CheckSquare, BookOpen, Plus } from 'lucide-react';
import api from '../../lib/api';
import { useToast } from '../../hooks/useToast';

export function QuickCapture() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('todo'); // 'todo' | 'research'
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);
  const { addToast } = useToast();

  // ── Global open/close wiring ───────────────────────────────────────────────
  useEffect(() => {
    const open = () => { setInput(''); setMode('todo'); setIsOpen(true); };

    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setIsOpen((prev) => {
          if (!prev) { setInput(''); setMode('todo'); }
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

  const close = () => { setIsOpen(false); setInput(''); };

  const handleSubmit = async () => {
    const title = input.trim();
    if (!title || submitting) return;

    setSubmitting(true);
    try {
      if (mode === 'todo') {
        // Defaults (status 'pending', priority 2) are applied server-side.
        await api.post('/api/todos', { title });
        addToast({ type: 'success', title: 'Task created' });
      } else {
        // Research entries require a `type`; status defaults to 'draft'.
        await api.post('/api/research', { title, type: 'note' });
        addToast({ type: 'success', title: 'Research note created' });
      }
      // Let interested pages (e.g. Today Dashboard) refresh.
      window.dispatchEvent(new Event('quick-capture-created'));
      close();
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to capture', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // Enter submits; Tab toggles mode; Escape closes.
  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      setMode((prev) => (prev === 'todo' ? 'research' : 'todo'));
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  if (!isOpen) return null;

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
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={close}
        aria-hidden="true"
      />

      {/* Capture panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quick capture"
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
            placeholder={mode === 'todo' ? 'Capture a task…' : 'Capture a research idea…'}
            className="flex-1 bg-transparent border-none outline-none text-stone-800 dark:text-gray-100 placeholder-stone-400 dark:placeholder-gray-500 text-sm"
            disabled={submitting}
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!input.trim() || submitting}
            className="flex items-center gap-1 px-3 py-1.5 bg-moss-600 text-white text-xs font-medium rounded-lg hover:bg-moss-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={14} />
            {submitting ? 'Saving…' : 'Capture'}
          </button>
        </div>

        {/* Footer: mode toggle + shortcut hints */}
        <div className="flex items-center justify-between px-4 py-2 bg-stone-50 dark:bg-gray-800/60 border-t border-stone-200 dark:border-gray-700 text-xs text-stone-400 dark:text-gray-500">
          <div className="flex items-center gap-2">
            {modeBtn('todo', CheckSquare, 'Task')}
            {modeBtn('research', BookOpen, 'Research')}
          </div>
          <div className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 bg-stone-200 dark:bg-gray-700 rounded">Tab</kbd>
            <span>switch</span>
            <span className="mx-0.5">·</span>
            <kbd className="px-1.5 py-0.5 bg-stone-200 dark:bg-gray-700 rounded">Enter</kbd>
            <span>save</span>
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
