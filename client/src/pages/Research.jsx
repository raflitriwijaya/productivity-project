// client/src/pages/Research.jsx
// Personal research hub — manages journal entries, citations, and notes.
// Follows §8 Module Page Template exactly.

import { useState, useMemo } from 'react';
import { Plus, BookOpen } from 'lucide-react';

import api from '../lib/api';
import { useApi } from '../hooks/useApi';

import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { ListSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';

import { ResearchSummaryCards } from '../components/research/ResearchSummaryCards';
import { CreateResearchModal } from '../components/research/CreateResearchModal';
import {
  TitleCell,
  TypeCell,
  StatusCell,
  SourceCell,
  ActionsCell,
  TYPE_VARIANT,
  TYPE_LABEL,
} from '../components/research/ResearchEntryRow';

// ─── Filter options ───────────────────────────────────────────────────────────

const TYPE_FILTERS = [
  { value: 'all',      label: 'All' },
  { value: 'journal',  label: 'Journal' },
  { value: 'citation', label: 'Citation' },
  { value: 'note',     label: 'Note' },
];

// ─── Page component ───────────────────────────────────────────────────────────

export default function Research() {
  // ── UI state ────────────────────────────────────────────────────────────────
  const [typeFilter,      setTypeFilter]      = useState('all');
  const [isCreateOpen,    setIsCreateOpen]    = useState(false);
  const [editingEntry,    setEditingEntry]    = useState(null);   // null = create mode
  const [deletingEntry,   setDeletingEntry]   = useState(null);   // entry to confirm-delete
  const [deleteLoading,   setDeleteLoading]   = useState(false);

  // ── Data fetching ────────────────────────────────────────────────────────────
  const { data: entries, loading, error, refetch } =
    useApi(() => api.get('/api/research'), []);

  const { data: stats, loading: statsLoading, refetch: refetchStats } =
    useApi(() => api.get('/api/research/stats'), []);

  // ── Derived: client-side type filter ─────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!entries) return [];
    if (typeFilter === 'all') return entries;
    return entries.filter(e => e.type === typeFilter);
  }, [entries, typeFilter]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleCreate = async (data) => {
    await api.post('/api/research', data);
    refetch();
    refetchStats();
  };

  const handleEdit = async (data) => {
    await api.patch(`/api/research/${editingEntry.id}`, data);
    refetch();
    refetchStats();
  };

  const openEdit = (entry) => {
    setEditingEntry(entry);
    setIsCreateOpen(true);
  };

  const closeModal = () => {
    setIsCreateOpen(false);
    setEditingEntry(null);
  };

  const confirmDelete = async () => {
    if (!deletingEntry) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/api/research/${deletingEntry.id}`);
      setDeletingEntry(null);
      refetch();
      refetchStats();
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── DataTable column contract (§5.4) ─────────────────────────────────────────

  const columns = [
    {
      key:      'title',
      header:   'Title',
      sortable: true,
      render:   TitleCell,
    },
    {
      key:    'type',
      header: 'Type',
      render: TypeCell,
    },
    {
      key:    'status',
      header: 'Status',
      render: StatusCell,
    },
    {
      key:    'source',
      header: 'Source',
      render: SourceCell,
    },
    {
      key:      'created_at',
      header:   'Created',
      sortable: true,
      render:   (row) => (
        <span className="text-sm text-stone-500 dark:text-gray-400">
          {new Date(row.created_at).toLocaleDateString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric',
          })}
        </span>
      ),
    },
    {
      key:    'actions',
      header: '',
      align:  'right',
      render: (row) => ActionsCell(row, openEdit, (r) => setDeletingEntry(r)),
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">

      {/* PAGE HEADER */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-gray-50 tracking-[-0.02em]">
            Research
          </h1>
          <p className="text-sm text-stone-500 dark:text-gray-400 mt-1">
            Journal entries, citations, and notes — all in one place.
          </p>
        </div>
        <Button variant="primary" size="md" onClick={() => { setEditingEntry(null); setIsCreateOpen(true); }}>
          <Plus size={16} />
          New Entry
        </Button>
      </div>

      {/* SUMMARY STATS */}
      <ResearchSummaryCards stats={statsLoading ? null : stats} />

      {/* FILTER PILLS */}
      <div className="flex items-center gap-2 flex-wrap">
        {TYPE_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setTypeFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150
              ${typeFilter === f.value
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
                : 'bg-white dark:bg-gray-800 border border-stone-200 dark:border-gray-700 text-stone-600 dark:text-gray-400 hover:bg-stone-50 dark:hover:bg-gray-700'
              }`}
          >
            {f.label}
            {f.value !== 'all' && entries && (
              <span className="ml-1.5 text-[11px] text-stone-400 dark:text-gray-500">
                ({entries.filter(e => e.type === f.value).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* MAIN TABLE — four-state switch (§7) */}
      <Card>
        <CardHeader
          title="All Entries"
          subtitle={filtered.length > 0 ? `${filtered.length} ${typeFilter === 'all' ? 'total' : TYPE_LABEL[typeFilter]?.toLowerCase() ?? typeFilter}` : undefined}
        />
        <CardBody className="p-0">
          {loading && <ListSkeleton rows={5} />}
          {error && !loading && <ErrorState message={error} onRetry={refetch} />}
          {!loading && !error && filtered.length === 0 && (
            <EmptyState
              icon={BookOpen}
              title={typeFilter === 'all' ? 'No entries yet' : `No ${TYPE_LABEL[typeFilter]?.toLowerCase() ?? typeFilter} entries`}
              message={
                typeFilter === 'all'
                  ? 'Create your first journal entry, citation, or note to get started.'
                  : `Switch to "All" or create a new ${TYPE_LABEL[typeFilter]?.toLowerCase() ?? typeFilter} entry.`
              }
              action={
                typeFilter === 'all' && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => { setEditingEntry(null); setIsCreateOpen(true); }}
                  >
                    <Plus size={14} />
                    New Entry
                  </Button>
                )
              }
            />
          )}
          {!loading && !error && filtered.length > 0 && (
            <DataTable
              columns={columns}
              items={filtered}
              initialSortKey="created_at"
            />
          )}
        </CardBody>
      </Card>

      {/* CREATE / EDIT MODAL */}
      <CreateResearchModal
        isOpen={isCreateOpen}
        onClose={closeModal}
        onSubmit={editingEntry ? handleEdit : handleCreate}
        entry={editingEntry}
      />

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={!!deletingEntry}
        onClose={() => setDeletingEntry(null)}
        title="Delete Entry"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setDeletingEntry(null)}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={confirmDelete}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-stone-600 dark:text-gray-400">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-stone-900 dark:text-gray-50">
            "{deletingEntry?.title}"
          </span>
          ? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
