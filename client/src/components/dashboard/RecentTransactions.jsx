import { Link } from 'react-router-dom';
import { TrendingUp, Plus, ArrowRight, ArrowUpRight, ArrowDownLeft, ArrowLeftRight } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import api from '../../lib/api';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ListSkeleton } from '../ui/Skeleton';
import { ErrorState } from '../ui/ErrorState';
import { EmptyState } from '../ui/EmptyState';
import { formatIdr } from '../../lib/formatIdr';
import { TYPE_VARIANT, TYPE_LABEL } from '../finance/TransactionRow';

/**
 * Visual treatment for a transaction in the recent list: icon, accent colour, and
 * the signed amount, derived from its type (and sign for adjustments).
 * @param {object} tx
 */
function presentation(tx) {
  const amt = parseFloat(tx.amount) || 0;
  switch (tx.type) {
    case 'Income':
      return { Icon: ArrowDownLeft, tint: 'bg-moss-50 dark:bg-moss-950/50', color: 'text-moss-600 dark:text-moss-400', sign: '+', value: amt };
    case 'Expense':
      return { Icon: ArrowUpRight, tint: 'bg-red-50 dark:bg-red-950/50', color: 'text-red-600 dark:text-red-400', sign: '-', value: amt };
    case 'Transfer':
      return { Icon: ArrowLeftRight, tint: 'bg-blue-50 dark:bg-blue-950/50', color: 'text-stone-600 dark:text-gray-300', sign: '', value: amt };
    default: // adjustments — sign follows the stored amount
      return amt < 0
        ? { Icon: ArrowUpRight, tint: 'bg-red-50 dark:bg-red-950/50', color: 'text-red-600 dark:text-red-400', sign: '-', value: Math.abs(amt) }
        : { Icon: ArrowDownLeft, tint: 'bg-moss-50 dark:bg-moss-950/50', color: 'text-moss-600 dark:text-moss-400', sign: '+', value: amt };
  }
}

/**
 * RecentTransactions widget — shows up to 5 most recent transactions.
 * Fetches independently; handles all 4 data states.
 */
export function RecentTransactions() {
  const { data: transactions, loading, error, refetch } = useApi(
    () => api.get('/api/finances?per_page=5'),
    []
  );

  return (
    <Card>
      <CardHeader
        title="Recent Transactions"
        subtitle="Latest financial activity"
        action={
          <Link to="/finance">
            <Button variant="ghost" size="sm">
              View all
              <ArrowRight size={14} />
            </Button>
          </Link>
        }
      />
      <CardBody className="p-0">
        {loading && <ListSkeleton rows={5} />}

        {error && !loading && <ErrorState message={error} onRetry={refetch} />}

        {!loading && !error && (!transactions || transactions.length === 0) && (
          <EmptyState
            icon={TrendingUp}
            title="No transactions yet"
            message="Head to the Finance module to log your first transaction."
            action={
              <Link to="/finance">
                <Button variant="primary" size="sm">
                  <Plus size={14} />
                  New Transaction
                </Button>
              </Link>
            }
          />
        )}

        {!loading && !error && transactions && transactions.length > 0 && (
          <ul className="divide-y divide-stone-100 dark:divide-gray-700">
            {transactions.map((tx) => {
              const { Icon, tint, color, sign, value } = presentation(tx);
              return (
                <li
                  key={tx.id}
                  className="flex items-center gap-3 px-6 py-3 hover:bg-moss-50/30 dark:hover:bg-moss-950/20 transition-colors duration-100"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${tint}`}>
                    <Icon size={14} className={color} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-stone-900 dark:text-gray-50 truncate">
                      {tx.description || tx.category_name || tx.type}
                    </p>
                    <p className="text-[11px] text-stone-400 dark:text-gray-500 mt-0.5">
                      {tx.category_name || tx.type} · {tx.date}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={TYPE_VARIANT[tx.type] ?? 'gray'}>{TYPE_LABEL[tx.type] ?? tx.type}</Badge>
                    <span className={`text-sm font-medium tabular-nums ${color}`}>
                      {sign}{formatIdr(value)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
