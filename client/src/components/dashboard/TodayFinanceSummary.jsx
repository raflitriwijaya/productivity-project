// client/src/components/dashboard/TodayFinanceSummary.jsx
// Presentational summary of today's cash flow plus receivables/payables coming
// due this week. Data is supplied by the parent (the unified /api/dashboard/today
// payload) — this component does not fetch.
//
// Wave 4: surfaces today's Revenue alongside Income/Expense, and lists the actual
// receivables/payables due this week (person + amount + due date), not just counts.

import { ArrowUp, ArrowDown, Clock, TrendingUp } from 'lucide-react';
import { formatIdr } from '../../lib/formatIdr';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Badge } from '../ui/Badge';

// A single "due this week" row. Falls back to the person's name; shows the due date
// when present.
function DueRow({ item, tone }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-stone-600 dark:text-gray-400 truncate">
        {item.person}
        {item.due_date && (
          <span className="text-stone-400 dark:text-gray-500 ml-1.5 text-xs">
            · {new Date(item.due_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
          </span>
        )}
      </span>
      <span className={`font-medium tabular-nums ${tone}`}>{formatIdr(item.amount)}</span>
    </div>
  );
}

export function TodayFinanceSummary({ data }) {
  if (!data) return null;

  const income = data.today_income ?? 0;
  const revenue = data.today_revenue ?? 0;
  const expense = data.today_expense ?? 0;
  const net = income + revenue - expense;
  const positive = net >= 0;

  const recv = data.receivables_due_this_week;
  const pay = data.payables_due_this_week;
  const recvList = data.receivables_due ?? [];
  const payList = data.payables_due ?? [];
  const hasDue = (recv?.count > 0) || (pay?.count > 0) || recvList.length > 0 || payList.length > 0;

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
              {formatIdr(income)}
            </div>
          </div>
          <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
            <div className="flex items-center justify-center gap-1 text-red-500 dark:text-red-400 mb-1">
              <ArrowDown size={14} />
              <span className="text-xs font-medium">Expense</span>
            </div>
            <div className="text-sm font-bold text-red-600 dark:text-red-400 truncate">
              {formatIdr(expense)}
            </div>
          </div>
          <div className={`p-3 rounded-lg ${positive ? 'bg-ember-50 dark:bg-ember-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}>
            <div className="text-xs font-medium text-stone-500 dark:text-gray-400 mb-1">Net</div>
            <div className={`text-sm font-bold truncate ${positive ? 'text-ember-700 dark:text-ember-300' : 'text-red-600 dark:text-red-400'}`}>
              {formatIdr(net)}
            </div>
          </div>
        </div>

        {/* Revenue (Wave 4) — shown when the founder logged startup revenue today */}
        {revenue > 0 && (
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-ember-50 dark:bg-ember-950/30">
            <div className="flex items-center gap-1.5 text-ember-600 dark:text-ember-400">
              <TrendingUp size={14} />
              <span className="text-xs font-medium">Revenue today</span>
            </div>
            <span className="text-sm font-bold text-ember-700 dark:text-ember-300">{formatIdr(revenue)}</span>
          </div>
        )}

        {/* Receivables / Payables due this week */}
        {hasDue && (
          <div className="pt-3 border-t border-stone-200 dark:border-gray-700 space-y-3">
            <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-gray-400">
              <Clock size={12} />
              <span>Due this week</span>
            </div>

            {recvList.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-stone-600 dark:text-gray-400">Receivables</span>
                  <Badge variant="moss">{recv?.count ?? recvList.length}</Badge>
                </div>
                {recvList.map((r) => (
                  <DueRow key={r.id} item={r} tone="text-moss-600 dark:text-moss-400" />
                ))}
              </div>
            )}

            {payList.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-stone-600 dark:text-gray-400">Payables</span>
                  <Badge variant="red">{pay?.count ?? payList.length}</Badge>
                </div>
                {payList.map((p) => (
                  <DueRow key={p.id} item={p} tone="text-red-600 dark:text-red-400" />
                ))}
              </div>
            )}

            {/* Fallback for the legacy aggregate-only shape (counts without itemized lists) */}
            {recvList.length === 0 && recv?.count > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-stone-600 dark:text-gray-400">Receivables</span>
                <div className="flex items-center gap-2">
                  <Badge variant="moss">{recv.count}</Badge>
                  <span className="text-stone-900 dark:text-gray-50 font-medium">{formatIdr(recv.total)}</span>
                </div>
              </div>
            )}
            {payList.length === 0 && pay?.count > 0 && (
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
