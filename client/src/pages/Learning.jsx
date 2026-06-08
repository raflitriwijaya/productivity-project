// client/src/pages/Learning.jsx
// /learning — Personal learning tracker for courses, books, and skill development.

import { useState, useMemo } from 'react';
import { Plus, GraduationCap, BookOpen, Clock, CheckCircle2 } from 'lucide-react';

import api              from '../lib/api';
import { useApi }       from '../hooks/useApi';
import { useToast }     from '../hooks/useToast';

import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button }      from '../components/ui/Button';
import { Badge }       from '../components/ui/Badge';
import { StatCard }    from '../components/ui/StatCard';
import { DataTable }   from '../components/ui/DataTable';
import { ListSkeleton } from '../components/ui/Skeleton';
import { ErrorState }  from '../components/ui/ErrorState';
import { EmptyState }  from '../components/ui/EmptyState';
import { Modal }       from '../components/ui/Modal';

import { CreateLearningModal } from '../components/learning/CreateLearningModal';
import {
  TitleCell,
  ProgressCell,
  ActionsCell,
  STATUS_VARIANT,
  STATUS_LABEL,
  TYPE_VARIANT,
  PRIORITY_VARIANT,
  PRIORITY_LABEL,
} from '../components/learning/LearningRow';

// ─── Filter pill config ──────────────────────────────────────────────────────

const FILTERS = [
  { key: 'all',         label: 'All' },
  { key: 'not_started', label: 'Not Started' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed',   label: 'Completed' },
  { key: 'on_hold',     label: 'On Hold' },
];

// ─── Stat cards skeleton ─────────────────────────────────────────────────────

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardBody>
            <div className="h-3 w-24 rounded bg-stone-200 dark:bg-gray-700 animate-pulse mb-3" />
            <div className="h-7 w-16 rounded bg-stone-200 dark:bg-gray-700 animate-pulse mb-1" />
            <div className="h-3 w-32 rounded bg-stone-100 dark:bg-gray-700/50 animate-pulse" />
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Learning() {
  const { addToast } = useToast();

  // ── State ──────────────────────────────────────────────────────────────────
  const [activeFilter, setActiveFilter] = useState('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editItem,     setEditItem]     = useState(null);   // null = no edit modal
  const [deleteTarget, setDeleteTarget] = useState(null);   // item to delete
  const [deleting,     setDeleting]     = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const {
    data: items,
    loading: itemsLoading,
    error:   itemsError,
    refetch: refetchItems,
  } = useApi(() => api.get('/api/learning?per_page=100&sort=created_at&order=desc'));

  const {
    data: stats,
    loading: statsLoading,
    refetch: refetchStats,
  } = useApi(() => api.get('/api/learning/stats'));

  const refetchAll = () => { refetchItems(); refetchStats(); };

  // ── Derived: filtered items ────────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    if (!items) return [];
    if (activeFilter === 'all') return items;
    return items.filter(i => i.status === activeFilter);
  }, [items, activeFilter]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleCreate = async (payload) => {
    try {
      await api.post('/api/learning', payload);
      addToast({ type: 'success', title: 'Item added', message: `"${payload.title}" has been added.` });
      setIsCreateOpen(false);
      refetchAll();
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to add item', message: err.message });
      throw err; // re-throw so modal stays open
    }
  };

  const handleEdit = async (payload) => {
    try {
      await api.patch(`/api/learning/${editItem.id}`, payload);
      addToast({ type: 'success', title: 'Item updated', message: `"${payload.title}" has been saved.` });
      setEditItem(null);
      refetchAll();
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to update item', message: err.message });
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/learning/${deleteTarget.id}`);
      addToast({ type: 'success', title: 'Item deleted', message: `"${deleteTarget.title}" has been removed.` });
      setDeleteTarget(null);
      refetchAll();
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to delete item', message: err.message });
    } finally {
      setDeleting(false);
    }
  };

  // ── DataTable columns ──────────────────────────────────────────────────────
  const columns = [
    {
      key:      'title',
      header:   'Resource',
      sortable: true,
      render:   (row) => <TitleCell item={row} />,
    },
    {
      key:    'type',
      header: 'Type',
      render: (row) => (
        <Badge variant={TYPE_VARIANT[row.type] ?? 'gray'}>
          {row.type.charAt(0).toUpperCase() + row.type.slice(1)}
        </Badge>
      ),
    },
    {
      key:    'status',
      header: 'Status',
      sortable: true,
      render: (row) => (
        <Badge variant={STATUS_VARIANT[row.status] ?? 'gray'}>
          {STATUS_LABEL[row.status] ?? row.status}
        </Badge>
      ),
    },
    {
      key:    'priority',
      header: 'Priority',
      sortable: true,
      render: (row) => (
        <Badge variant={PRIORITY_VARIANT[row.priority] ?? 'gray'}>
          {PRIORITY_LABEL[row.priority] ?? row.priority}
        </Badge>
      ),
    },
    {
      key:    'progress',
      header: 'Progress',
      sortable: true,
      render: (row) => <ProgressCell item={row} />,
    },
    {
      key:     'actions',
      header:  '',
      align:   'right',
      render:  (row) => (
        <ActionsCell
          item={row}
          onEdit={setEditItem}
          onDelete={setDeleteTarget}
        />
      ),
    },
  ];

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">

      {/* PAGE HEADER */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-gray-50 tracking-[-0.02em]">
            Learning
          </h1>
          <p className="text-sm text-stone-500 dark:text-gray-400 mt-1">
            Track courses, books, and skill development.
          </p>
        </div>
        <Button variant="primary" size="md" onClick={() => setIsCreateOpen(true)}>
          <Plus size={16} />
          Add Item
        </Button>
      </div>

      {/* STAT CARDS */}
      {statsLoading ? (
        <StatsSkeleton />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total"
            value={stats?.total ?? 0}
            icon={GraduationCap}
          />
          <StatCard
            label="In Progress"
            value={stats?.in_progress ?? 0}
            icon={BookOpen}
          />
          <StatCard
            label="Completed"
            value={stats?.completed ?? 0}
            icon={CheckCircle2}
          />
          <StatCard
            label="Hours Spent"
            value={stats ? `${parseFloat(stats.total_spent_hours).toFixed(1)}h` : '0h'}
            icon={Clock}
          />
        </div>
      )}

      {/* FILTER PILLS */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map(f => {
          const isActive = activeFilter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setActiveFilter(f.key)}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150
                focus:outline-none focus:ring-2 focus:ring-moss-500 dark:focus:ring-moss-400
                focus:ring-offset-2 ring-offset-white dark:ring-offset-gray-900
                ${isActive
                  ? 'bg-moss-50 dark:bg-moss-950/50 text-moss-700 dark:text-moss-400 border border-moss-200 dark:border-moss-800'
                  : 'bg-white dark:bg-gray-800 text-stone-600 dark:text-gray-400 border border-stone-200 dark:border-gray-700 hover:bg-stone-50 dark:hover:bg-gray-700 hover:text-stone-900 dark:hover:text-gray-100'
                }
              `}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* MAIN TABLE */}
      <Card>
        <CardHeader
          title="Learning Items"
          subtitle={`${filteredItems.length} item${filteredItems.length !== 1 ? 's' : ''}`}
        />
        <CardBody className="p-0">
          {itemsLoading && <ListSkeleton rows={5} />}
          {itemsError && !itemsLoading && (
            <ErrorState message={itemsError} onRetry={refetchAll} />
          )}
          {!itemsLoading && !itemsError && filteredItems.length === 0 && (
            <EmptyState
              icon={GraduationCap}
              title={activeFilter === 'all' ? 'No learning items yet' : `No items with status "${STATUS_LABEL[activeFilter] ?? activeFilter}"`}
              message={activeFilter === 'all' ? 'Add your first course, book, or resource to start tracking.' : 'Try a different filter or add a new item.'}
              action={
                activeFilter === 'all'
                  ? <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}><Plus size={14} />Add Item</Button>
                  : <Button variant="secondary" size="sm" onClick={() => setActiveFilter('all')}>Clear filter</Button>
              }
            />
          )}
          {!itemsLoading && !itemsError && filteredItems.length > 0 && (
            <DataTable columns={columns} items={filteredItems} initialSortKey="created_at" />
          )}
        </CardBody>
      </Card>

      {/* CREATE MODAL */}
      <CreateLearningModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
        item={null}
      />

      {/* EDIT MODAL */}
      <CreateLearningModal
        isOpen={editItem !== null}
        onClose={() => setEditItem(null)}
        onSubmit={handleEdit}
        item={editItem}
      />

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete Learning Item"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-stone-700 dark:text-gray-300">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-stone-900 dark:text-gray-50">
            "{deleteTarget?.title}"
          </span>
          ? This action cannot be undone.
        </p>
      </Modal>

    </div>
  );
}
