// client/src/pages/FinanceDashboard.jsx  → route /finance/dashboard
// Finance overview: monthly totals, a 12-month income/expense trend, this month's
// expense breakdown, and per-account balance bars. Reads GET /api/finances/dashboard.

import { PieChart } from 'lucide-react';
import api from '../lib/api';
import { useApi } from '../hooks/useApi';

import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { ErrorState } from '../components/ui/ErrorState';
import { Skeleton } from '../components/ui/Skeleton';

import { FinanceSummaryCards } from '../components/finance/FinanceSummaryCards';
import { TrendChart } from '../components/finance/charts/TrendChart';
import { DonutChart } from '../components/finance/charts/DonutChart';
import { ProgressBar } from '../components/finance/ProgressBar';
import { formatIdr } from '../lib/formatIdr';

function ChartSkeleton() {
  return (
    <Card>
      <CardBody>
        <Skeleton className="h-4 w-40 mb-6" />
        <Skeleton className="h-48 w-full" />
      </CardBody>
    </Card>
  );
}

export default function FinanceDashboard() {
  const { data, loading, error, refetch } = useApi(() => api.get('/api/finances/dashboard'), []);

  const balances = data?.balances ?? [];
  const maxBalance = Math.max(1, ...balances.map(b => Math.abs(parseFloat(b.balance) || 0)));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900 dark:text-gray-50 tracking-[-0.02em]">Finance Overview</h1>
        <p className="text-sm text-stone-500 dark:text-gray-400 mt-1">Trends, breakdowns, and where your money sits.</p>
      </div>

      {loading && (
        <>
          <FinanceSummaryCards loading error={null} summary={null} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartSkeleton />
            <ChartSkeleton />
          </div>
        </>
      )}

      {error && !loading && (
        <Card><CardBody><ErrorState message={error} onRetry={refetch} /></CardBody></Card>
      )}

      {!loading && !error && data && (
        <>
          <FinanceSummaryCards loading={false} error={null} summary={data.summary} />

          <Card>
            <CardHeader title="12-Month Trend" subtitle="Income vs expense" />
            <CardBody><TrendChart data={data.trends} /></CardBody>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader title="Expense Breakdown" subtitle="This month, by category" />
              <CardBody>
                {data.expense_by_category.length > 0 ? (
                  <DonutChart data={data.expense_by_category.map(c => ({ label: c.category_name, value: c.total }))} />
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="w-12 h-12 rounded-xl bg-stone-100 dark:bg-gray-700 flex items-center justify-center mb-3">
                      <PieChart className="w-6 h-6 text-stone-400 dark:text-gray-500" />
                    </div>
                    <p className="text-sm text-stone-400 dark:text-gray-500">No expenses recorded this month.</p>
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Account Balances" subtitle="Live balance per account" />
              <CardBody className="space-y-4">
                {balances.map(acc => {
                  const bal = parseFloat(acc.balance) || 0;
                  const color = bal >= 0 ? 'text-stone-900 dark:text-gray-50' : 'text-red-600 dark:text-red-400';
                  return (
                    <div key={acc.id}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm text-stone-700 dark:text-gray-200">{acc.name}</span>
                        <span className={`text-sm font-medium tabular-nums ${color}`}>{formatIdr(bal)}</span>
                      </div>
                      <ProgressBar value={Math.max(0, bal)} max={maxBalance} tone="bg-moss-500 dark:bg-moss-400" />
                    </div>
                  );
                })}
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
