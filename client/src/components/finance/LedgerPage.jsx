// client/src/components/finance/LedgerPage.jsx
// Shared page body for Receivables and Payables — identical CRUD + settle flow,
// parameterized by `kind`. Money colour leans emerald for receivables (incoming)
// and red for payables (outgoing).

import { useState, useMemo } from 'react';
import { Plus, HandCoins, CheckCircle2, Pencil, Trash2 } from 'lucide-react';

import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../hooks/useToast';

import { Card, CardHeader, CardBody } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { StatCard } from '../ui/StatCard';
import { DataTable } from '../ui/DataTable';
import { ListSkeleton } from '../ui/Skeleton';
import { ErrorState } from '../ui/ErrorState';
import { EmptyState } from '../ui/EmptyState';
import { Modal } from '../ui/Modal';

import { LedgerModal } from './LedgerModal';
import { SettleModal } from './SettleModal';
import { formatIdr } from '../../lib/formatIdr';

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

const isOverdue = (row) => row.status === 'outstanding' && row.due_date && new Date(row.due_date) < new Date(new Date().toDateString());

/**
 * @param {{
 *   kind: 'receivable'|'payable',
 *   endpoint: 'receivables'|'payables',
 *   title: string,
 *   description: string
 * }} props
 */
export function LedgerPage({ kind, endpoint, title, description }) {
  const isReceivable = kind === 'receivable';
  const moneyColor = isReceivable ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [settling, setSettling] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const { addToast } = useToast();

  const { data: rows, loading, error, refetch } = useApi(() => api.get(`/api/finances/${endpoint}`), []);
  const { data: accounts } = useApi(() => api.get('/api/finances/accounts'), []);

  const totals = useMemo(() => {
    const list = rows ?? [];
    const outstanding = list.filter(r => r.status === 'outstanding');
    return {
      outstandingAmount: outstanding.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0),
      outstandingCount: outstanding.length,
      settledCount: list.length - outstanding.length,
    };
  }, [rows]);

  async function handleCreate(formData) {
    await api.post(`/api/finances/${endpoint}`, formData);
    refetch();
    setIsCreateOpen(false);
    addToast({ type: 'success', title: `${title.slice(0, -1)} added` });
  }

  async function handleEdit(formData) {
    await api.patch(`/api/finances/${endpoint}/${editing.id}`, formData);
    refetch();
    setEditing(null);
    addToast({ type: 'success', title: 'Updated' });
  }

  async function handleSettle(data) {
    await api.post(`/api/finances/${endpoint}/${settling.id}/settle`, data);
    refetch();
    setSettling(null);
    addToast({ type: 'success', title: 'Settled', message: `${isReceivable ? 'Income' : 'Expense'} posted.` });
  }

  async function handleDeleteConfirm() {
    setDeleteSubmitting(true);
    try {
      await api.delete(`/api/finances/${endpoint}/${deleting.id}`);
      refetch();
      setDeleting(null);
      addToast({ type: 'success', title: 'Deleted' });
    } catch (err) {
      addToast({ type: 'error', title: 'Delete failed', message: err.message });
    } finally {
      setDeleteSubmitting(false);
    }
  }

  const columns = [
    { key: 'person', header: isReceivable ? 'Owed By' : 'Owed To', sortable: true, render: (row) => (
      <div className="min-w-0">
        <p className="text-sm font-medium text-stone-900 dark:text-gray-50 truncate">{row.person}</p>
        {row.description && <p className="text-xs text-stone-500 dark:text-gray-400 truncate max-w-[220px]">{row.description}</p>}
      </div>
    ) },
    { key: 'amount', header: 'Amount', sortable: true, align: 'right', render: (row) => (
      <span className={`text-sm font-medium tabular-nums ${moneyColor}`}>{formatIdr(row.amount)}</span>
    ) },
    { key: 'due_date', header: 'Due', sortable: true, render: (row) => (
      <span className={`text-sm ${isOverdue(row) ? 'text-red-600 dark:text-red-400 font-medium' : 'text-stone-500 dark:text-gray-400'}`}>
        {fmtDate(row.due_date)}{isOverdue(row) ? ' · overdue' : ''}
      </span>
    ) },
    { key: 'status', header: 'Status', render: (row) => (
      <Badge variant={row.status === 'settled' ? 'emerald' : 'amber'}>{row.status}</Badge>
    ) },
    { key: 'account_name', header: 'Account', render: (row) => (
      <span className="text-sm text-stone-500 dark:text-gray-400">{row.account_name || '—'}</span>
    ) },
    { key: 'actions', header: '', align: 'right', render: (row) => (
      <div className="flex items-center justify-end gap-1">
        {row.status === 'outstanding' && (
          <Button variant="ghost" size="sm" onClick={() => setSettling(row)} aria-label="Settle">
            <CheckCircle2 size={14} />
            Settle
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => setEditing(row)} aria-label="Edit"><Pencil size={14} /></Button>
        <Button variant="ghost" size="sm" onClick={() => setDeleting(row)} aria-label="Delete"
          className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30">
          <Trash2 size={14} />
        </Button>
      </div>
    ) },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-gray-50 tracking-[-0.02em]">{title}</h1>
          <p className="text-sm text-stone-500 dark:text-gray-400 mt-1">{description}</p>
        </div>
        <Button variant="primary" size="md" onClick={() => setIsCreateOpen(true)}>
          <Plus size={16} />
          <span className="hidden sm:inline">Add</span>
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Outstanding" value={formatIdr(totals.outstandingAmount)} icon={HandCoins} />
        <StatCard label="Open Items" value={totals.outstandingCount} />
        <StatCard label="Settled" value={totals.settledCount} />
      </div>

      <Card>
        <CardHeader title={title} subtitle={!loading && !error ? `${(rows ?? []).length} total` : undefined} />
        <CardBody className="p-0">
          {loading && <ListSkeleton rows={5} />}
          {error && !loading && <ErrorState message={error} onRetry={refetch} />}
          {!loading && !error && (rows ?? []).length === 0 && (
            <EmptyState
              icon={HandCoins}
              title={`No ${title.toLowerCase()} yet`}
              message={isReceivable ? 'Track money people owe you.' : 'Track money you owe others.'}
              action={<Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}><Plus size={14} />Add</Button>}
            />
          )}
          {!loading && !error && (rows ?? []).length > 0 && (
            <DataTable columns={columns} items={rows} initialSortKey="due_date" />
          )}
        </CardBody>
      </Card>

      <LedgerModal
        isOpen={isCreateOpen || editing != null}
        onClose={() => { setIsCreateOpen(false); setEditing(null); }}
        onSubmit={editing ? handleEdit : handleCreate}
        record={editing}
        accounts={accounts ?? []}
        kind={kind}
      />

      <SettleModal
        isOpen={settling != null}
        onClose={() => setSettling(null)}
        onSettle={handleSettle}
        record={settling}
        accounts={accounts ?? []}
        kind={kind}
      />

      <Modal
        isOpen={deleting != null}
        onClose={() => setDeleting(null)}
        title={`Delete ${title.slice(0, -1)}`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="md" onClick={() => setDeleting(null)} disabled={deleteSubmitting}>Cancel</Button>
            <Button variant="danger" size="md" onClick={handleDeleteConfirm} disabled={deleteSubmitting}>
              {deleteSubmitting ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-stone-700 dark:text-gray-300">Delete this record? This cannot be undone.</p>
        {deleting && (
          <div className="mt-3 p-3 rounded-lg bg-stone-50 dark:bg-gray-700 border border-stone-200 dark:border-gray-600">
            <p className="text-sm font-medium text-stone-900 dark:text-gray-50">{deleting.person}</p>
            <p className="text-xs text-stone-500 dark:text-gray-400 mt-0.5">{formatIdr(deleting.amount)}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
