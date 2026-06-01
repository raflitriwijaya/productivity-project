// client/src/pages/Todo.jsx
// Full /todo page. Follows §8 Module Page Template exactly.
// Four data states: loading → skeleton, error → retry, empty → CTA, data → list.
// Edits use api.patch (partial update) per §6.3.

import { useState, useMemo } from 'react';
import { Plus, ClipboardCheck, Trash2 } from 'lucide-react';
import api            from '../lib/api';
import { useApi }     from '../hooks/useApi';
import { useToast }   from '../hooks/useToast';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button }     from '../components/ui/Button';
import { Badge }      from '../components/ui/Badge';
import { StatCard }   from '../components/ui/StatCard';
import { ListSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal }      from '../components/ui/Modal';
import { TodoRow }    from '../components/todo/TodoRow';
import { CreateTodoModal } from '../components/todo/CreateTodoModal';

/**
 * @typedef {Object} Todo
 * @property {number} id
 * @property {number} user_id
 * @property {string} title
 * @property {string|null} description
 * @property {'pending'|'in_progress'|'done'|'overdue'} status
 * @property {1|2|3} priority
 * @property {string|null} due_date
 * @property {string} created_at
 * @property {string} updated_at
 */

/** @type {Array<{label: string, value: string|null}>} */
const STATUS_FILTERS = [
  { label: 'All',         value: null },
  { label: 'Pending',     value: 'pending' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Done',        value: 'done' },
  { label: 'Overdue',     value: 'overdue' },
];

export default function Todo() {
  // ── State ────────────────────────────────────────────────────────────────
  const [isCreateOpen,  setIsCreateOpen]  = useState(false);
  const [editingTodo,   setEditingTodo]   = useState(/** @type {Todo|null} */ (null));
  const [deletingTodo,  setDeletingTodo]  = useState(/** @type {Todo|null} */ (null));
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [statusFilter,  setStatusFilter]  = useState(/** @type {string|null} */ (null));

  // ── Data ─────────────────────────────────────────────────────────────────
  const { data: todos, loading, error, refetch } = useApi(() => api.get('/api/todos?per_page=100'));
  const { addToast } = useToast();

  // ── Derived ───────────────────────────────────────────────────────────────
  const allTodos = /** @type {Todo[]} */ (todos ?? []);

  const filtered = useMemo(() => {
    if (!statusFilter) return allTodos;
    return allTodos.filter(t => t.status === statusFilter);
  }, [allTodos, statusFilter]);

  const stats = useMemo(() => ({
    total:       allTodos.length,
    pending:     allTodos.filter(t => t.status === 'pending').length,
    in_progress: allTodos.filter(t => t.status === 'in_progress').length,
    done:        allTodos.filter(t => t.status === 'done').length,
    overdue:     allTodos.filter(t => t.status === 'overdue').length,
  }), [allTodos]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  /** Create → POST */
  const handleCreate = async (formData) => {
    try {
      await api.post('/api/todos', formData);
      addToast({ type: 'success', title: 'Task created', message: formData.title });
      refetch();
      setIsCreateOpen(false);
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to create task', message: err.message });
      throw err; // keeps modal open via finally in modal
    }
  };

  /** Edit → PATCH (partial update per §6.3) */
  const handleEdit = async (formData) => {
    if (!editingTodo) return;
    try {
      await api.patch(`/api/todos/${editingTodo.id}`, formData);
      addToast({ type: 'success', title: 'Task updated' });
      refetch();
      setEditingTodo(null);
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to update task', message: err.message });
      throw err;
    }
  };

  /** Delete → DELETE with confirmation modal */
  const handleDeleteConfirm = async () => {
    if (!deletingTodo) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/api/todos/${deletingTodo.id}`);
      addToast({ type: 'success', title: 'Task deleted', message: deletingTodo.title });
      refetch();
      setDeletingTodo(null);
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to delete task', message: err.message });
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    // Content wrapper only — sidebar offset owned by AppLayout §9.3
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">

      {/* PAGE HEADER */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-gray-50 tracking-[-0.02em]">
            To-Do
          </h1>
          <p className="text-sm text-stone-500 dark:text-gray-400 mt-1">
            Tasks, action items, and follow-ups.
          </p>
        </div>
        <Button variant="primary" size="md" onClick={() => setIsCreateOpen(true)}>
          <Plus size={16} />
          New Task
        </Button>
      </div>

      {/* STATS ROW — only rendered once data is available */}
      {!loading && !error && allTodos.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total"       value={stats.total} />
          <StatCard label="Pending"     value={stats.pending} />
          <StatCard label="In Progress" value={stats.in_progress} />
          <StatCard label="Done"        value={stats.done} />
        </div>
      )}

      {/* MAIN CARD */}
      <Card>
        <CardHeader
          title="All Tasks"
          subtitle={loading ? '' : `${filtered.length} task${filtered.length !== 1 ? 's' : ''}`}
          action={
            /* Status filter pills — only show once data exists */
            !loading && !error && allTodos.length > 0 ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                {STATUS_FILTERS.map(f => (
                  <button
                    key={f.value ?? 'all'}
                    onClick={() => setStatusFilter(f.value)}
                    className={`
                      px-2.5 py-1 rounded-md text-xs font-medium transition-colors duration-150
                      ${statusFilter === f.value
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                        : 'text-stone-500 dark:text-gray-400 hover:bg-stone-100 dark:hover:bg-gray-700 hover:text-stone-900 dark:hover:text-gray-100'
                      }
                    `}
                  >
                    {f.label}
                    {f.value === 'overdue' && stats.overdue > 0 && (
                      <Badge variant="red" className="ml-1.5">{stats.overdue}</Badge>
                    )}
                  </button>
                ))}
              </div>
            ) : null
          }
        />
        <CardBody className="p-0">

          {/* Loading */}
          {loading && <ListSkeleton rows={6} />}

          {/* Error */}
          {error && !loading && (
            <ErrorState message={error} onRetry={refetch} />
          )}

          {/* Empty — no tasks at all */}
          {!loading && !error && allTodos.length === 0 && (
            <EmptyState
              icon={ClipboardCheck}
              title="No tasks yet"
              message="Create your first task to get started tracking your work."
              action={
                <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
                  <Plus size={14} />
                  New Task
                </Button>
              }
            />
          )}

          {/* Empty filtered — tasks exist but filter yields nothing */}
          {!loading && !error && allTodos.length > 0 && filtered.length === 0 && (
            <EmptyState
              icon={ClipboardCheck}
              title={`No ${statusFilter?.replace('_', ' ')} tasks`}
              message="Try a different filter or create a new task."
              action={
                <Button variant="secondary" size="sm" onClick={() => setStatusFilter(null)}>
                  Clear filter
                </Button>
              }
            />
          )}

          {/* Data */}
          {!loading && !error && filtered.length > 0 && (
            <div className="divide-y divide-stone-100 dark:divide-gray-700">
              {filtered.map(todo => (
                <TodoRow
                  key={todo.id}
                  todo={todo}
                  onEdit={setEditingTodo}
                  onDelete={setDeletingTodo}
                />
              ))}
            </div>
          )}

        </CardBody>
      </Card>

      {/* CREATE MODAL */}
      <CreateTodoModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
        todo={null}
      />

      {/* EDIT MODAL */}
      <CreateTodoModal
        isOpen={editingTodo !== null}
        onClose={() => setEditingTodo(null)}
        onSubmit={handleEdit}
        todo={editingTodo}
      />

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={deletingTodo !== null}
        onClose={() => !deleteLoading && setDeletingTodo(null)}
        title="Delete Task"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setDeletingTodo(null)}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={handleDeleteConfirm}
              disabled={deleteLoading}
            >
              <Trash2 size={16} />
              {deleteLoading ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-stone-900 dark:text-gray-50">
          Are you sure you want to delete{' '}
          <span className="font-semibold">"{deletingTodo?.title}"</span>?
        </p>
        <p className="text-xs text-stone-500 dark:text-gray-400">
          This action cannot be undone.
        </p>
      </Modal>

    </div>
  );
}
