// client/src/components/finance/FinanceSummaryCards.jsx
// Four stat cards for the Finance page: Income, Expense and Net for the selected
// month, plus all-time Net Worth. Income/Expense reuse StatCard; Net and Net Worth
// are inline so their value colour can flip moss/red on sign. All money is IDR.

import { TrendingUp, TrendingDown, Scale, Landmark } from 'lucide-react';
import { StatCard } from '../ui/StatCard';
import { Card, CardBody } from '../ui/Card';
import { Skeleton } from '../ui/Skeleton';
import { formatIdr } from '../../lib/formatIdr';

function SignedValueCard({ label, value, icon: Icon }) {
  const n = parseFloat(value ?? 0);
  const color = n >= 0 ? 'text-moss-600 dark:text-moss-400' : 'text-red-600 dark:text-red-400';
  return (
    <Card>
      <CardBody>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-stone-500 dark:text-gray-400 tracking-wide uppercase">{label}</p>
          <Icon className="w-4 h-4 text-stone-400 dark:text-gray-500" />
        </div>
        <p className={`text-2xl font-bold tracking-[-0.02em] ${color}`}>{formatIdr(value)}</p>
      </CardBody>
    </Card>
  );
}

/**
 * @param {{
 *   loading: boolean,
 *   error: string|null,
 *   summary: {
 *     total_income: string, total_expense: string, net_balance: string,
 *     net_worth: string, total_receivables: string, total_payables: string
 *   }|null
 * }} props
 */
export function FinanceSummaryCards({ loading, error, summary }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => (
          <Card key={i}>
            <CardBody>
              <div className="flex items-center justify-between mb-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-4" />
              </div>
              <Skeleton className="h-7 w-28 mb-1" />
            </CardBody>
          </Card>
        ))}
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => (
          <Card key={i}>
            <CardBody>
              <p className="text-xs text-stone-400 dark:text-gray-500 tracking-wide uppercase">—</p>
            </CardBody>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard label="Income (month)" value={formatIdr(summary.total_income)} icon={TrendingUp} />
      <StatCard label="Expense (month)" value={formatIdr(summary.total_expense)} icon={TrendingDown} />
      <SignedValueCard label="Net (month)" value={summary.net_balance} icon={Scale} />
      <SignedValueCard label="Net Worth" value={summary.net_worth} icon={Landmark} />
    </div>
  );
}
