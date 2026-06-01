// client/src/pages/Portfolio.jsx  → route /finance/portfolio
// Investment holdings with an inline-editable current price, derived market value /
// gain, and an allocation donut. Reads GET /api/finances/portfolio.

import { useState, useMemo } from 'react';
import { Plus, PieChart as PieIcon, Pencil, Trash2 } from 'lucide-react';

import api from '../lib/api';
import { useApi } from '../hooks/useApi';
import { useToast } from '../hooks/useToast';

import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatCard } from '../components/ui/StatCard';
import { DataTable } from '../components/ui/DataTable';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { ListSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';

import { PortfolioModal } from '../components/finance/PortfolioModal';
import { DonutChart } from '../components/finance/charts/DonutChart';
import { formatIdr, parseIdrInput, formatIdrInput } from '../lib/formatIdr';

/** Inline-editable current price cell — commits on blur or Enter when changed. */
function CurrentPriceCell({ row, onSave }) {
  const [value, setValue] = useState(formatIdrInput(String(row.current_price ?? '')));
  const [saving, setSaving] = useState(false);

  async function commit() {
    const parsed = parseIdrInput(value || '0');
    if (Number.isNaN(parsed) || parsed === (parseFloat(row.current_price) || 0)) {
      setValue(formatIdrInput(String(row.current_price ?? '')));
      return;
    }
    setSaving(true);
    try {
      await onSave(row.id, parsed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-32 ml-auto">
      <Input
        id={`pf-price-${row.id}`}
        inputMode="numeric"
        value={value}
        disabled={saving}
        onChange={(e) => setValue(formatIdrInput(e.target.value.replace(/-/g, '')))}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        className="text-right py-1.5"
      />
    </div>
  );
}

export default function Portfolio() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const { addToast } = useToast();
  const { data: holdings, loading, error, refetch } = useApi(() => api.get('/api/finances/portfolio'), []);

  const totals = useMemo(() => {
    const list = holdings ?? [];
    const market = list.reduce((s, h) => s + (parseFloat(h.market_value) || 0), 0);
    const cost = list.reduce((s, h) => s + (parseFloat(h.cost_basis) || 0), 0);
    return { market, cost, gain: market - cost };
  }, [holdings]);

  async function handleCreate(formData) {
    await api.post('/api/finances/portfolio', formData);
    refetch();
    setIsCreateOpen(false);
    addToast({ type: 'success', title: 'Holding added' });
  }

  async function handleEdit(formData) {
    await api.patch(`/api/finances/portfolio/${editing.id}`, formData);
    refetch();
    setEditing(null);
    addToast({ type: 'success', title: 'Holding updated' });
  }

  async function handleInlinePrice(id, current_price) {
    await api.patch(`/api/finances/portfolio/${id}`, { current_price });
    refetch();
    addToast({ type: 'success', title: 'Price updated' });
  }

  async function handleDeleteConfirm() {
    setDeleteSubmitting(true);
    try {
      await api.delete(`/api/finances/portfolio/${deleting.id}`);
      refetch();
      setDeleting(null);
      addToast({ type: 'success', title: 'Holding removed' });
    } catch (err) {
      addToast({ type: 'error', title: 'Delete failed', message: err.message });
    } finally {
      setDeleteSubmitting(false);
    }
  }

  const columns = [
    { key: 'name', header: 'Holding', sortable: true, render: (row) => (
      <div className="min-w-0">
        <p className="text-sm font-medium text-stone-900 dark:text-gray-50 truncate">{row.name}</p>
        {row.symbol && <p className="text-xs text-stone-500 dark:text-gray-400 font-mono">{row.symbol}</p>}
      </div>
    ) },
    { key: 'quantity', header: 'Qty', align: 'right', sortable: true, render: (row) => (
      <span className="text-sm text-stone-700 dark:text-gray-200 tabular-nums">{Number(row.quantity).toLocaleString('id-ID')}</span>
    ) },
    { key: 'avg_price', header: 'Avg Price', align: 'right', render: (row) => (
      <span className="text-sm text-stone-500 dark:text-gray-400 tabular-nums">{formatIdr(row.avg_price)}</span>
    ) },
    { key: 'current_price', header: 'Current Price', align: 'right', render: (row) => (
      <CurrentPriceCell row={row} onSave={handleInlinePrice} />
    ) },
    { key: 'market_value', header: 'Value', align: 'right', sortable: true, render: (row) => (
      <span className="text-sm font-medium text-stone-900 dark:text-gray-50 tabular-nums">{formatIdr(row.market_value)}</span>
    ) },
    { key: 'gain', header: 'Gain/Loss', align: 'right', sortable: true, render: (row) => {
      const g = parseFloat(row.gain) || 0;
      const color = g >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
      return <span className={`text-sm font-medium tabular-nums ${color}`}>{g >= 0 ? '+' : '-'}{formatIdr(Math.abs(g))}</span>;
    } },
    { key: 'actions', header: '', align: 'right', render: (row) => (
      <div className="flex items-center justify-end gap-1">
        <Button variant="ghost" size="sm" onClick={() => setEditing(row)} aria-label="Edit holding"><Pencil size={14} /></Button>
        <Button variant="ghost" size="sm" onClick={() => setDeleting(row)} aria-label="Delete holding"
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
          <h1 className="text-2xl font-bold text-stone-900 dark:text-gray-50 tracking-[-0.02em]">Portfolio</h1>
          <p className="text-sm text-stone-500 dark:text-gray-400 mt-1">Holdings, market value, and allocation.</p>
        </div>
        <Button variant="primary" size="md" onClick={() => setIsCreateOpen(true)}>
          <Plus size={16} />
          <span className="hidden sm:inline">Add Holding</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Market Value" value={formatIdr(totals.market)} icon={PieIcon} />
        <StatCard label="Cost Basis" value={formatIdr(totals.cost)} />
        <Card>
          <CardBody>
            <p className="text-xs font-medium text-stone-500 dark:text-gray-400 tracking-wide uppercase mb-3">Unrealized Gain</p>
            <p className={`text-2xl font-bold tracking-[-0.02em] ${totals.gain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {totals.gain >= 0 ? '+' : '-'}{formatIdr(Math.abs(totals.gain))}
            </p>
          </CardBody>
        </Card>
      </div>

      {!loading && !error && (holdings ?? []).length > 0 && (
        <Card>
          <CardHeader title="Allocation" subtitle="By market value" />
          <CardBody>
            <DonutChart data={holdings.map(h => ({ label: h.symbol || h.name, value: h.market_value }))} />
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Holdings" subtitle={!loading && !error ? `${(holdings ?? []).length} total` : undefined} />
        <CardBody className="p-0">
          {loading && <ListSkeleton rows={5} />}
          {error && !loading && <ErrorState message={error} onRetry={refetch} />}
          {!loading && !error && (holdings ?? []).length === 0 && (
            <EmptyState
              icon={PieIcon}
              title="No holdings yet"
              message="Add an investment to start tracking its value."
              action={<Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}><Plus size={14} />Add Holding</Button>}
            />
          )}
          {!loading && !error && (holdings ?? []).length > 0 && (
            <DataTable columns={columns} items={holdings} initialSortKey="market_value" />
          )}
        </CardBody>
      </Card>

      <PortfolioModal
        isOpen={isCreateOpen || editing != null}
        onClose={() => { setIsCreateOpen(false); setEditing(null); }}
        onSubmit={editing ? handleEdit : handleCreate}
        holding={editing}
      />

      <Modal
        isOpen={deleting != null}
        onClose={() => setDeleting(null)}
        title="Remove Holding"
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="md" onClick={() => setDeleting(null)} disabled={deleteSubmitting}>Cancel</Button>
            <Button variant="danger" size="md" onClick={handleDeleteConfirm} disabled={deleteSubmitting}>
              {deleteSubmitting ? 'Removing…' : 'Remove'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-stone-700 dark:text-gray-300">Remove this holding from your portfolio?</p>
        {deleting && (
          <div className="mt-3 p-3 rounded-lg bg-stone-50 dark:bg-gray-700 border border-stone-200 dark:border-gray-600">
            <p className="text-sm font-medium text-stone-900 dark:text-gray-50">{deleting.name}</p>
            <p className="text-xs text-stone-500 dark:text-gray-400 mt-0.5">{formatIdr(deleting.market_value)}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
