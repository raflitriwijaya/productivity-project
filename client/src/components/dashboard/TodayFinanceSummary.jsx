// client/src/components/dashboard/TodayFinanceSummary.jsx
// Presentational summary of today's cash flow plus receivables/payables coming
// due this week. Data is supplied by the parent (the unified /api/dashboard/today
// payload) — this component does not fetch.

import { ArrowUp, ArrowDown, Clock } from 'lucide-react';
import { formatIdr } from '../../lib/formatIdr';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Badge } from '../ui/Badge';

export function TodayFinanceSummary({ data }) {
  if (!data) return null;

  const net = (data.today_income ?? 0) - (data.today_expense ?? 0);
  const positive = net >= 0;
  const recv = data.receivables_due_this_week;
  const pay = data.payables_due_this_week;
  const hasDue = (recv?.count > 0) || (pay?.count > 0);

  return (
    <Card>
      <CardHeader title="Today's Finance" subtitle="Cash flow and upcoming dues" />
      <CardBody className="space-y-3">
        {/* Income / Expense / Net */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 bg-moss-50 dark:bg-moss-950/30 rounded-lg">
            <div className="flex items-center justify-center gap-1 text-moss-600 dark:text-moss-400 mb-1">
              <ArrowUp size={14} />
              <span className="text-xs font-medium">Income</span>
            </div>
            <div className="text-sm font-bold text-moss-700 dark:text-moss-300 truncate">
              {formatIdr(data.today_income)}
            </div>
          </div>
          <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
            <div className="flex items-center justify-center gap-1 text-red-500 dark:text-red-400 mb-1">
              <ArrowDown size={14} />
              <span className="text-xs font-medium">Expense</span>
            </div>
            <div className="text-sm font-bold text-red-600 dark:text-red-400 truncate">
              {formatIdr(data.today_expense)}
            </div>
          </div>
          <div className={`p-3 rounded-lg ${positive ? 'bg-ember-50 dark:bg-ember-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}>
            <div className="text-xs font-medium text-stone-500 dark:text-gray-400 mb-1">Net</div>
            <div className={`text-sm font-bold truncate ${positive ? 'text-ember-700 dark:text-ember-300' : 'text-red-600 dark:text-red-400'}`}>
              {formatIdr(net)}
            </div>
          </div>
        </div>

        {/* Receivables / Payables due this week */}
        {hasDue && (
          <div className="pt-3 border-t border-stone-200 dark:border-gray-700 space-y-2">
            <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-gray-400">
              <Clock size={12} />
              <span>Due this week</span>
            </div>
            {recv?.count > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-stone-600 dark:text-gray-400">Receivables</span>
                <div className="flex items-center gap-2">
                  <Badge variant="moss">{recv.count}</Badge>
                  <span className="text-stone-900 dark:text-gray-50 font-medium">{formatIdr(recv.total)}</span>
                </div>
              </div>
            )}
            {pay?.count > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-stone-600 dark:text-gray-400">Payables</span>
                <div className="flex items-center gap-2">
                  <Badge variant="red">{pay.count}</Badge>
                  <span className="text-stone-900 dark:text-gray-50 font-medium">{formatIdr(pay.total)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export default TodayFinanceSummary;
