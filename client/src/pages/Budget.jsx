// client/src/pages/Budget.jsx  → route /finance/budget
// Per-category monthly budgets with inline editing and spend color-coding. Reads
// GET /api/finances/budgets?month&year; saves via PUT /api/finances/budgets.

import { useState, useMemo } from 'react';
import { Target } from 'lucide-react';

import api from '../lib/api';
import { useApi } from '../hooks/useApi';
import { useToast } from '../hooks/useToast';
import useDocumentTitle from '../hooks/useDocumentTitle';

import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { DataTable } from '../components/ui/DataTable';
import { Input } from '../components/ui/Input';
import { ListSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';

import { MonthYearSelector } from '../components/finance/MonthYearSelector';
import { ProgressBar } from '../components/finance/ProgressBar';
import { formatIdr, toAmountInput, parseIdrInput } from '../lib/formatIdr';

/** Inline-editable budget amount — commits on blur or Enter when changed. */
function BudgetAmountCell({ row, onSave }) {
  const [value, setValue] = useState(toAmountInput(row.amount));
  const [saving, setSaving] = useState(false);

  async function commit() {
    const parsed = parseIdrInput(value);
    if (Number.isNaN(parsed) || parsed < 0 || parsed === (Number(row.amount) || 0)) {
      setValue(toAmountInput(row.amount));
      return;
    }
    setSaving(true);
    try {
      await onSave(row.category_id, parsed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-32 ml-auto">
      <Input
        id={`budget-${row.category_id}`}
        inputMode="numeric"
        value={value}
        disabled={saving}
        onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        className="text-right py-1.5"
      />
    </div>
  );
}

export default function Budget() {
  useDocumentTitle('Finance — Budget');
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { addToast } = useToast();
  const { data: rows, loading, error, refetch } =
    useApi(() => api.get(`/api/finances/budgets?month=${month}&year=${year}`), [month, year]);

  // DataTable keys rows by `row.id`; budget rows are keyed by category, so alias it.
  const items = useMemo(() => (rows ?? []).map(r => ({ ...r, id: r.category_id })), [rows]);

  const totals = useMemo(() => {
    const budget = items.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const spent = items.reduce((s, r) => s + (parseFloat(r.spent) || 0), 0);
    return { budget, spent, remaining: budget - spent };
  }, [items]);

  async function handleSave(categoryId, amount) {
    await api.put('/api/finances/budgets', { category_id: categoryId, amount });
    refetch();
    addToast({ type: 'success', title: 'Budget saved' });
  }

  const columns = [
    { key: 'category_name', header: 'Category', sortable: true, render: (row) => (
      <span className="text-sm font-medium text-stone-900 dark:text-gray-50">{row.category_name}</span>
    ) },
    { key: 'amount', header: 'Budget', align: 'right', render: (row) => (
      <BudgetAmountCell row={row} onSave={handleSave} />
    ) },
    { key: 'spent', header: 'Spent', align: 'right', sortable: true, render: (row) => (
      <span className="text-sm text-stone-700 dark:text-gray-200 tabular-nums">{formatIdr(row.spent)}</span>
    ) },
    { key: 'remaining', header: 'Remaining', align: 'right', render: (row) => {
      const remaining = (parseFloat(row.amount) || 0) - (parseFloat(row.spent) || 0);
      const color = remaining < 0 ? 'text-red-600 dark:text-red-400' : 'text-stone-700 dark:text-gray-200';
      return <span className={`text-sm font-medium tabular-nums ${color}`}>{formatIdr(remaining)}</span>;
    } },
    { key: 'progress', header: 'Usage', render: (row) => {
      const budget = parseFloat(row.amount) || 0;
      const spent = parseFloat(row.spent) || 0;
      if (budget === 0) {
        return <span className="text-xs text-stone-400 dark:text-gray-500">No budget set</span>;
      }
      return (
        <div className="min-w-[140px]">
          <ProgressBar value={spent} max={budget} />
          <p className="text-[11px] text-stone-400 dark:text-gray-500 mt-1 text-right tabular-nums">
            {Math.round((spent / budget) * 100)}%
          </p>
        </div>
      );
    } },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-gray-50 tracking-[-0.02em]">Budget</h1>
          <p className="text-sm text-stone-500 dark:text-gray-400 mt-1">Set a monthly limit per category and track spend.</p>
        </div>
        <MonthYearSelector month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Budget" value={formatIdr(totals.budget)} icon={Target} />
        <StatCard label="Total Spent" value={formatIdr(totals.spent)} />
        <Card>
          <CardBody>
            <p className="text-xs font-medium text-stone-500 dark:text-gray-400 tracking-wide uppercase mb-3">Remaining</p>
            <p className={`text-2xl font-bold tracking-[-0.02em] ${totals.remaining < 0 ? 'text-red-600 dark:text-red-400' : 'text-moss-600 dark:text-moss-400'}`}>
              {formatIdr(totals.remaining)}
            </p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Category Budgets" subtitle="Click a budget amount to edit it" />
        <CardBody className="p-0">
          {loading && <ListSkeleton rows={6} />}
          {error && !loading && <ErrorState message={error} onRetry={refetch} />}
          {!loading && !error && items.length > 0 && (
            <DataTable columns={columns} items={items} initialSortKey="category_name" />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
