// client/src/components/shared/LinkPickerModal.jsx
// The "Link to…" picker for Universal Links (Roadmap Wave 1). Three steps in one
// modal: pick a module → browse/search its items → pick one + optional note →
// create the link. Only modules with a list endpoint are offered; extend MODULES
// as more detail views land. The API accepts every type in LINKABLE_TYPES.

import { useState, useEffect } from 'react';
import { Loader } from 'lucide-react';

import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import api from '../../lib/api';
import { useToast } from '../../hooks/useToast';

// `searchParam` is the query key each list endpoint accepts for text search, or
// null when the module only supports browsing the most-recent items.
const MODULES = [
  { type: 'research_entry',   label: 'Research Entries',     endpoint: '/api/research',  searchParam: 'q' },
  { type: 'learning_item',    label: 'Learning Items',       endpoint: '/api/learning',  searchParam: null },
  { type: 'engineer_project', label: 'Engineering Projects', endpoint: '/api/engineer',  searchParam: null },
  { type: 'todo',             label: 'Todos',                endpoint: '/api/todos',     searchParam: null },
  { type: 'transaction',      label: 'Finance Transactions', endpoint: '/api/finances',  searchParam: 'search' },
];

export function LinkPickerModal({ isOpen, onClose, entityType, entityId, onLinked }) {
  const [selectedModule, setSelectedModule] = useState(null);
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState('');
  const [selectedItemId, setSelectedItemId] = useState(null);
  const { addToast } = useToast();

  // Fetch items when the module or search term changes (debounced).
  useEffect(() => {
    if (!selectedModule) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ per_page: '20' });
        if (selectedModule.searchParam && search.trim()) {
          params.set(selectedModule.searchParam, search.trim());
        }
        const res = await api.get(`${selectedModule.endpoint}?${params.toString()}`);
        if (!cancelled) setItems(res.data ?? []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load items');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [selectedModule, search]);

  const handleSelectModule = (mod) => {
    setSelectedModule(mod);
    setSelectedItemId(null);
    setSearch('');
    setItems([]);
  };

  const handleCreateLink = async () => {
    if (!selectedItemId || !selectedModule) return;
    setSubmitting(true);
    try {
      await api.post('/api/links', {
        from_type: entityType,
        from_id: entityId,
        to_type: selectedModule.type,
        to_id: selectedItemId,
        note: note.trim() || null,
      });
      onLinked();
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to create link', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // Reset transient state when closing.
  const handleClose = () => {
    setSelectedModule(null);
    setSearch('');
    setItems([]);
    setSelectedItemId(null);
    setNote('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Link to…"
      size="lg"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={handleClose}>Cancel</Button>
          <Button
            variant="primary"
            size="md"
            disabled={!selectedItemId || submitting}
            onClick={handleCreateLink}
          >
            {submitting ? 'Linking…' : 'Create Link'}
          </Button>
        </>
      }
    >
      {/* Step 1: module */}
      <div>
        <p className="text-xs font-medium text-stone-700 dark:text-gray-300 tracking-wide uppercase mb-2">
          Select module
        </p>
        <div className="flex flex-wrap gap-2">
          {MODULES.map((mod) => {
            const active = selectedModule?.type === mod.type;
            return (
              <button
                key={mod.type}
                type="button"
                onClick={() => handleSelectModule(mod)}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors duration-150 ${
                  active
                    ? 'bg-moss-50 dark:bg-moss-950/40 border-moss-500 text-moss-700 dark:text-moss-300'
                    : 'bg-white dark:bg-gray-800 border-stone-200 dark:border-gray-600 text-stone-600 dark:text-gray-400 hover:border-stone-400 dark:hover:border-gray-500'
                }`}
              >
                {mod.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2: browse / search */}
      {selectedModule && (
        <>
          {selectedModule.searchParam && (
            <Input
              placeholder={`Search ${selectedModule.label.toLowerCase()}…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}

          <div className="max-h-64 overflow-y-auto border border-stone-200 dark:border-gray-700 rounded-lg">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader size={20} className="animate-spin text-stone-400" />
              </div>
            )}
            {!loading && error && (
              <div className="p-4 text-center text-sm text-red-500">{error}</div>
            )}
            {!loading && !error && items.length === 0 && (
              <div className="p-4 text-center text-sm text-stone-400 dark:text-gray-500">No items found</div>
            )}
            {!loading && !error && items.map((item) => {
              const selected = selectedItemId === item.id;
              const label = item.title || item.name || item.description || `#${item.id}`;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedItemId(item.id)}
                  className={`w-full text-left px-4 py-3 border-b border-stone-100 dark:border-gray-800 last:border-b-0 transition-colors duration-100 ${
                    selected
                      ? 'bg-moss-50 dark:bg-moss-950/30'
                      : 'hover:bg-stone-50 dark:hover:bg-gray-800/50'
                  }`}
                >
                  <span className="block text-sm font-medium text-stone-800 dark:text-gray-200 truncate">
                    {label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Step 3: optional note */}
          {selectedItemId && (
            <Input
              placeholder="Add a note (optional) — e.g. 'Chapter 3', 'Related to Q2 budget'"
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </>
      )}
    </Modal>
  );
}

export default LinkPickerModal;
