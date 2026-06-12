// client/src/pages/Finance.jsx
// Transactions ledger: month/year scoped, with a typed create/edit form, type
// filter tabs, colour-coded rows, and monthly income/expense/net/net-worth totals.

import { useState, useMemo } from 'react';
import { Plus, Wallet } from 'lucide-react';

import api from '../lib/api';
import { useApi } from '../hooks/useApi';
import { useToast } from '../hooks/useToast';

import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { DataTable } from '../components/ui/DataTable';
import { ListSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';

import useDocumentTitle from '../hooks/useDocumentTitle';
import { MonthYearSelector } from '../components/finance/MonthYearSelector';
import { FinanceSummaryCards } from '../components/finance/FinanceSummaryCards';
import { CreateTransactionModal } from '../components/finance/CreateTransactionModal';
import {
  AmountCell, TypeBadge, AccountFlowCell, ReconciledCell, TransactionActions,
} from '../components/finance/TransactionRow';

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

const FILTER_TABS = [
  { value: 'all',      label: 'All',      match: () => true },
  { value: 'Income',   label: 'Income',   match: (t) => t.type === 'Income' },
  { value: 'Revenue',  label: 'Revenue',  match: (t) => t.type === 'Revenue' },
  { value: 'Expense',  label: 'Expense',  match: (t) => t.type === 'Expense' },
  { value: 'Transfer', label: 'Transfer', match: (t) => t.type === 'Transfer' },
  { value: 'adjust',   label: 'Adjustments', match: (t) => t.type === 'Balance Adjustment' || t.type === 'Market Adjustment' },
];

export default function Finance() {
  useDocumentTitle('Finance — Transactions');
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTx, setEditingTx]       = useState(null);
  const [deletingTx, setDeletingTx]     = useState(null);
  const [typeFilter, setTypeFilter]     = useState('all');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const { addToast } = useToast();

  const { data: transactions, loading, error, refetch } =
    useApi(() => api.get(`/api/finances?month=${month}&year=${year}&per_page=100`), [month, year]);

  const { data: summary, loading: summaryLoading, error: summaryError, refetch: refetchSummary } =
    useApi(() => api.get(`/api/finances/summary?month=${month}&year=${year}`), [month, year]);

  const { data: accounts }   = useApi(() => api.get('/api/finances/accounts'), []);
  const { data: categories } = useApi(() => api.get('/api/finances/categories'), []);

  const activeTab = FILTER_TABS.find(t => t.value === typeFilter) ?? FILTER_TABS[0];
  const filtered = useMemo(() => (transactions ?? []).filter(activeTab.match), [transactions, activeTab]);

  function refetchAll() { refetch(); refetchSummary(); }

  async function handleCreate(formData) {
    await api.post('/api/finances', formData);
    refetchAll();
    setIsCreateOpen(false);
    addToast({ type: 'success', title: 'Transaction added', message: `${formData.type} recorded.` });
  }

  async function handleEdit(formData) {
    await api.patch(`/api/finances/${editingTx.id}`, formData);
    refetchAll();
    setEditingTx(null);
    addToast({ type: 'success', title: 'Transaction updated' });
  }

  async function handleDeleteConfirm() {
    setDeleteSubmitting(true);
    try {
      await api.delete(`/api/finances/${deletingTx.id}`);
      refetchAll();
      setDeletingTx(null);
      addToast({ type: 'success', title: 'Transaction deleted' });
    } catch (err) {
      addToast({ type: 'error', title: 'Delete failed', message: err.message });
    } finally {
      setDeleteSubmitting(false);
    }
  }

  const columns = [
    { key: 'date', header: 'Date', sortable: true, render: (row) => (
      <span className="text-sm text-stone-500 dark:text-gray-400 whitespace-nowrap">{fmtDate(row.date)}</span>
    ) },
    { key: 'type', header: 'Type', render: (row) => <TypeBadge row={row} /> },
    { key: 'category_name', header: 'Category', render: (row) => (
      <span className="text-sm text-stone-700 dark:text-gray-200">{row.category_name || '—'}</span>
    ) },
    { key: 'account', header: 'Account', render: (row) => <AccountFlowCell row={row} /> },
    { key: 'description', header: 'Description', render: (row) => (
      <span className="text-sm text-stone-500 dark:text-gray-400 max-w-[220px] truncate block">{row.description || '—'}</span>
    ) },
    { key: 'reconciled', header: 'Rec.', align: 'right', render: (row) => (
      <div className="flex justify-end"><ReconciledCell row={row} /></div>
    ) },
    { key: 'amount', header: 'Amount', sortable: true, align: 'right', render: (row) => <AmountCell row={row} /> },
    { key: 'actions', header: '', align: 'right', render: (row) => (
      <TransactionActions row={row} onEdit={setEditingTx} onDelete={setDeletingTx} />
    ) },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">

      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-gray-50 tracking-[-0.02em]">Transactions</h1>
          <p className="text-sm text-stone-500 dark:text-gray-400 mt-1">Your account ledger, one month at a time.</p>
        </div>
        <div className="flex items-center gap-3">
          <MonthYearSelector month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
          <Button variant="primary" size="md" onClick={() => setIsCreateOpen(true)}>
            <Plus size={16} />
            <span className="hidden sm:inline">Add</span>
          </Button>
        </div>
      </div>

      {/* MONTHLY TOTALS */}
      <FinanceSummaryCards loading={summaryLoading} error={summaryError} summary={summary} />

      {/* TABLE */}
      <Card>
        <CardHeader
          title="Ledger"
          subtitle={!loading && !error ? `${filtered.length} record${filtered.length !== 1 ? 's' : ''}` : undefined}
          action={
            <div className="flex items-center gap-1 flex-wrap justify-end">
              {FILTER_TABS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setTypeFilter(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 ${
                    typeFilter === opt.value
                      ? 'bg-moss-50 dark:bg-moss-950/50 text-moss-700 dark:text-moss-400'
                      : 'text-stone-500 dark:text-gray-400 hover:bg-stone-100 dark:hover:bg-gray-700 hover:text-stone-700 dark:hover:text-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          }
        />
        <CardBody className="p-0">
          {loading && <ListSkeleton rows={6} />}
          {error && !loading && <ErrorState message={error} onRetry={refetchAll} />}
          {!loading && !error && filtered.length === 0 && (
            <EmptyState
              icon={Wallet}
              title={typeFilter === 'all' ? 'No transactions this month' : `No ${activeTab.label.toLowerCase()} this month`}
              message={typeFilter === 'all'
                ? 'Add your first transaction for this period.'
                : 'Switch the filter or month, or add a new transaction.'}
              action={typeFilter === 'all'
                ? <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}><Plus size={14} />Add Transaction</Button>
                : undefined}
            />
          )}
          {!loading && !error && filtered.length > 0 && (
            <DataTable columns={columns} items={filtered} initialSortKey="date" />
          )}
        </CardBody>
      </Card>

      {/* CREATE / EDIT */}
      <CreateTransactionModal
        isOpen={isCreateOpen || editingTx != null}
        onClose={() => { setIsCreateOpen(false); setEditingTx(null); }}
        onSubmit={editingTx ? handleEdit : handleCreate}
        transaction={editingTx}
        accounts={accounts ?? []}
        categories={categories ?? []}
      />

      {/* DELETE CONFIRM */}
      <Modal
        isOpen={deletingTx != null}
        onClose={() => setDeletingTx(null)}
        title="Delete Transaction"
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="md" onClick={() => setDeletingTx(null)} disabled={deleteSubmitting}>Cancel</Button>
            <Button variant="danger" size="md" onClick={handleDeleteConfirm} disabled={deleteSubmitting}>
              {deleteSubmitting ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-stone-700 dark:text-gray-300">
          Are you sure you want to delete this transaction? This action cannot be undone.
        </p>
        {deletingTx && (
          <div className="mt-3 p-3 rounded-lg bg-stone-50 dark:bg-gray-700 border border-stone-200 dark:border-gray-600">
            <p className="text-sm font-medium text-stone-900 dark:text-gray-50">{deletingTx.type} · {deletingTx.category_name || 'Uncategorized'}</p>
            <p className="text-xs text-stone-500 dark:text-gray-400 mt-0.5">{deletingTx.description || '—'}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
