// client/src/components/research/TopicSidebar.jsx
// Topic navigation for the Research page. A second filter dimension alongside
// the type pills. Self-contained: owns its own topics fetch (four-state) and the
// create/edit topic modal.
//
// Layout: desktop → fixed-width vertical list (parent gives it w-64); mobile →
// horizontal scrollable tabs (parent decides which to render via CSS, but this
// component renders a single list that works in both because items are flex).
//
// Counts: the parent passes `topicCounts` (a { [topicId]: number } map derived
// from the loaded entries) plus `allCount`. They're optional — when absent the
// count is simply omitted rather than blocking the sidebar.

import { useState } from 'react';
import { Plus, Pencil, Trash2, FolderOpen } from 'lucide-react';

import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Skeleton } from '../ui/Skeleton';
import { ErrorState } from '../ui/ErrorState';
import { useToast } from '../../hooks/useToast';
import { CreateTopicModal } from './CreateTopicModal';

/**
 * @param {{
 *   selectedTopicId: number | null,
 *   onSelectTopic: (id: number | null) => void,
 *   topicCounts?: Record<number, number>,
 *   allCount?: number,
 *   onTopicsChanged?: () => void,
 * }} props
 */
export function TopicSidebar({
  selectedTopicId,
  onSelectTopic,
  topicCounts = {},
  allCount,
  onTopicsChanged,
}) {
  const { addToast } = useToast();
  const { data: topics, loading, error, refetch } =
    useApi(() => api.get('/api/research/topics'), []);

  const [modalOpen, setModalOpen]   = useState(false);
  const [editingTopic, setEditing]  = useState(null); // null = create mode
  const [deleting, setDeleting]     = useState(null); // topic pending delete confirm
  const [deleteLoading, setDeleteLoading] = useState(false);

  const afterChange = () => {
    refetch();
    onTopicsChanged?.();
  };

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit   = (topic) => { setEditing(topic); setModalOpen(true); };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/api/research/topics/${deleting.id}`);
      addToast({ type: 'success', title: 'Topic deleted' });
      if (selectedTopicId === deleting.id) onSelectTopic(null); // fall back to All
      setDeleting(null);
      afterChange();
    } catch (err) {
      addToast({ type: 'error', title: 'Delete failed', message: err.message });
    } finally {
      setDeleteLoading(false);
    }
  };

  // Shared item classes (active = subtle moss pill, SKILL.md §5.5).
  const itemBase =
    'group flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 w-full text-left';
  const itemActive =
    'bg-moss-50 dark:bg-moss-950/50 text-moss-700 dark:text-moss-400';
  const itemInactive =
    'text-stone-600 dark:text-gray-400 hover:bg-stone-100 dark:hover:bg-gray-700 hover:text-stone-900 dark:hover:text-gray-100';

  return (
    <div className="lg:w-64 lg:flex-shrink-0">
      {/* Section label — hidden on mobile where this is a tab strip */}
      <p className="hidden lg:block px-3 mb-2 text-[10px] font-semibold text-stone-400 dark:text-gray-500 tracking-widest uppercase">
        Topics
      </p>

      {/* LOADING — 3 skeleton pills */}
      {loading && (
        <div className="flex lg:flex-col gap-2">
          <Skeleton className="h-9 w-32 lg:w-full rounded-lg" />
          <Skeleton className="h-9 w-28 lg:w-full rounded-lg" />
          <Skeleton className="h-9 w-36 lg:w-full rounded-lg" />
        </div>
      )}

      {/* ERROR */}
      {error && !loading && (
        <div className="lg:py-4">
          <ErrorState message={error} onRetry={refetch} />
        </div>
      )}

      {/* DATA (+ empty) */}
      {!loading && !error && (
        <>
          <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0">
            {/* All Entries — always present, no color dot */}
            <button
              type="button"
              onClick={() => onSelectTopic(null)}
              className={`${itemBase} flex-shrink-0 lg:flex-shrink ${selectedTopicId === null ? itemActive : itemInactive}`}
            >
              <FolderOpen size={16} className="flex-shrink-0" />
              <span className="flex-1 truncate">All Entries</span>
              {allCount != null && (
                <span className="text-[11px] text-stone-400 dark:text-gray-500 flex-shrink-0">{allCount}</span>
              )}
            </button>

            {/* Empty state (no topics yet) */}
            {topics && topics.length === 0 && (
              <p className="hidden lg:block px-3 py-2 text-xs text-stone-400 dark:text-gray-500">
                No topics yet.
              </p>
            )}

            {/* Topic items */}
            {topics && topics.map(t => {
              const active = selectedTopicId === t.id;
              return (
                <div
                  key={t.id}
                  className={`${itemBase} flex-shrink-0 lg:flex-shrink ${active ? itemActive : itemInactive}`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectTopic(t.id)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left focus:outline-none"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: t.color }}
                    />
                    <span className="flex-1 truncate">{t.name}</span>
                    {topicCounts[t.id] != null && (
                      <span className="text-[11px] text-stone-400 dark:text-gray-500 flex-shrink-0">
                        {topicCounts[t.id]}
                      </span>
                    )}
                  </button>
                  {/* Hover actions (desktop) */}
                  <span className="hidden lg:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openEdit(t); }}
                      aria-label={`Edit ${t.name}`}
                      className="p-1 rounded-md text-stone-400 hover:text-stone-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-stone-200/60 dark:hover:bg-gray-600"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setDeleting(t); }}
                      aria-label={`Delete ${t.name}`}
                      className="p-1 rounded-md text-stone-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 hover:bg-stone-200/60 dark:hover:bg-gray-600"
                    >
                      <Trash2 size={13} />
                    </button>
                  </span>
                </div>
              );
            })}
          </div>

          {/* New Topic button */}
          <div className="mt-2 lg:mt-3 flex-shrink-0">
            <Button variant="secondary" size="sm" onClick={openCreate} className="w-full justify-center">
              <Plus size={14} />
              New Topic
            </Button>
          </div>
        </>
      )}

      {/* CREATE / EDIT TOPIC MODAL */}
      <CreateTopicModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={afterChange}
        topic={editingTopic}
      />

      {/* DELETE CONFIRM MODAL — reuse the lightweight inline confirm via Modal from CreateTopicModal?
          Use a dedicated confirm dialog here. */}
      {deleting && (
        <DeleteTopicConfirm
          topic={deleting}
          loading={deleteLoading}
          onCancel={() => setDeleting(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}

// ─── Delete confirmation (small modal) ───────────────────────────────────────

function DeleteTopicConfirm({ topic, loading, onCancel, onConfirm }) {
  return (
    <Modal
      isOpen={true}
      onClose={onCancel}
      title="Delete Topic"
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button variant="danger" size="md" onClick={onConfirm} disabled={loading}>
            {loading ? 'Deleting…' : 'Delete'}
          </Button>
        </>
      }
    >
      <p className="text-sm text-stone-600 dark:text-gray-400">
        Delete{' '}
        <span className="font-semibold text-stone-900 dark:text-gray-50">"{topic.name}"</span>?
        Entries keep existing — they're just unlinked from this topic. This cannot be undone.
      </p>
    </Modal>
  );
}
