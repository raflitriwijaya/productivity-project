// client/src/pages/FinanceOverview.jsx → route /finance/overview
// One-screen financial review (V6 §13.2). Consolidates Transactions / Accounts /
// Receivables / Payables / Portfolio / Budget into a single command center so a
// monthly review no longer means hopping between pages. Additive — every detail
// page stays reachable. Reads GET /api/finances/overview?month&year and follows
// the four-state pattern. Reuses MonthYearSelector, ProgressBar, and the
// TransactionRow type badge so nothing is duplicated.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Scale, ArrowDownLeft, ArrowUpRight, PieChart, Wallet,
} from 'lucide-react';

import api from '../lib/api';
import { useApi } from '../hooks/useApi';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { formatIdr } from '../lib/formatIdr';

import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { Badge } from '../components/ui/Badge';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { Button } from '../components/ui/Button';

import { MonthYearSelector } from '../components/finance/MonthYearSelector';
import { ProgressBar } from '../components/finance/ProgressBar';
import { TypeBadge } from '../components/finance/TransactionRow';

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
}

// ─── Signed stat card (value colour flips on sign) ─────────────────────────────
function SignedStatCard({ label, value, icon: Icon }) {
  const n = parseFloat(value ?? 0);
  const color = n >= 0 ? 'text-moss-600 dark:text-moss-400' : 'text-red-600 dark:text-red-400';
  return (
    <Card className="relative overflow-hidden">
      <CardBody>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-stone-500 dark:text-gray-400 tracking-wide uppercase">{label}</p>
          {Icon && <Icon className="w-4 h-4 text-stone-400 dark:text-gray-500" />}
        </div>
        <p className={`text-2xl font-bold tracking-[-0.02em] ${color}`}>{formatIdr(value)}</p>
      </CardBody>
      <span className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-moss-500 to-ember-500" />
    </Card>
  );
}

// ─── Aging panel (receivables / payables) ──────────────────────────────────────
const AGING_META = {
  overdue:  { label: 'Overdue',   variant: 'red',  to: 'overdue' },
  due_soon: { label: 'This Week', variant: 'amber' },
  upcoming: { label: 'Upcoming',  variant: 'gray' },
};

function AgingPanel({ title, data, linkTo, emptyMessage }) {
  const { items, aging } = data;
  return (
    <Card>
      <CardHeader
        title={title}
        subtitle={aging.total > 0 ? formatIdr(aging.total) + ' outstanding' : undefined}
        action={<Link to={linkTo} className="text-xs font-medium text-moss-600 dark:text-moss-400 hover:underline">View all →</Link>}
      />
      <CardBody className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-stone-400 dark:text-gray-500 py-2">{emptyMessage}</p>
        ) : (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              {['overdue', 'due_soon', 'upcoming'].map(bucket => (
                aging[bucket] > 0 && (
                  <Badge key={bucket} variant={AGING_META[bucket].variant}>
                    {AGING_META[bucket].label}: {formatIdr(aging[bucket])}
                  </Badge>
                )
              ))}
            </div>
            <ul className="divide-y divide-stone-100 dark:divide-gray-700">
              {items.slice(0, 6).map(item => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900 dark:text-gray-50 truncate">{item.person}</p>
                    <p className="text-[11px] text-stone-400 dark:text-gray-500">
                      {item.due_date ? `Due ${fmtDate(item.due_date)}` : 'No due date'}
                    </p>
                  </div>
                  <span className={`text-sm font-medium tabular-nums flex-shrink-0 ${
                    item.aging === 'overdue' ? 'text-red-600 dark:text-red-400' : 'text-stone-700 dark:text-gray-200'
                  }`}>
                    {formatIdr(item.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardBody>
    </Card>
  );
}

// ─── Loading skeleton ──────────────────────────────────────────────────────────
function OverviewSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i}><CardBody>
            <div className="h-3 w-24 rounded bg-stone-200 dark:bg-gray-700 animate-pulse mb-3" />
            <div className="h-7 w-28 rounded bg-stone-200 dark:bg-gray-700 animate-pulse" />
          </CardBody></Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }, (_, i) => (
          <Card key={i}><CardBody>
            <div className="h-40 rounded-lg bg-stone-100 dark:bg-gray-700/50 animate-pulse" />
          </CardBody></Card>
        ))}
      </div>
    </>
  );
}

export default function FinanceOverview() {
  useDocumentTitle('Finance — Overview');
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());

  const { data, loading, error, refetch } =
    useApi(() => api.get(`/api/finances/overview?month=${month}&year=${year}`), [month, year]);

  const budget       = data?.budget_vs_actual ?? [];
  const receivables  = data?.receivables ?? { items: [], aging: { total: 0 } };
  const payables     = data?.payables ?? { items: [], aging: { total: 0 } };
  const portfolio    = data?.portfolio ?? { holdings: [], total: 0 };
  const recent       = data?.recent_transactions ?? [];

  const isEmpty = !loading && !error && data &&
    budget.length === 0 && recent.length === 0 &&
    receivables.items.length === 0 && payables.items.length === 0 &&
    portfolio.holdings.length === 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-gray-50 tracking-[-0.02em]">Overview</h1>
          <p className="text-sm text-stone-500 dark:text-gray-400 mt-1">
            Your whole financial picture — income, dues, budget, and investments — on one screen.
          </p>
        </div>
        <MonthYearSelector month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
      </div>

      {/* ERROR */}
      {error && !loading && (
        <Card><CardBody><ErrorState message={error} onRetry={refetch} /></CardBody></Card>
      )}

      {/* LOADING */}
      {!error && loading && <OverviewSkeleton />}

      {/* EMPTY */}
      {isEmpty && (
        <Card>
          <CardBody>
            <EmptyState
              icon={Wallet}
              title="Nothing to review yet"
              message="Add your first transaction, set a budget, or log a receivable to see your overview."
              action={
                <Link to="/finance">
                  <Button variant="primary" size="sm">Go to Transactions</Button>
                </Link>
              }
            />
          </CardBody>
        </Card>
      )}

      {/* DATA */}
      {!error && !loading && data && !isEmpty && (
        <>
          {/* STAT CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SignedStatCard label="Net (month)" value={data.summary.net} icon={Scale} />
            <StatCard
              label="Receivables Out"
              value={formatIdr(receivables.aging.total)}
              subtitle={receivables.aging.overdue > 0 ? `${formatIdr(receivables.aging.overdue)} overdue` : 'owed to you'}
              icon={ArrowDownLeft}
            />
            <StatCard
              label="Payables Due"
              value={formatIdr(payables.aging.total)}
              subtitle={payables.aging.overdue > 0 ? `${formatIdr(payables.aging.overdue)} overdue` : 'you owe'}
              icon={ArrowUpRight}
            />
            <StatCard label="Portfolio Value" value={formatIdr(portfolio.total)} icon={PieChart} />
          </div>

          {/* BUDGET vs ACTUAL + AGING */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            <Card>
              <CardHeader
                title="Budget vs Actual"
                subtitle="This month's spend against budget"
                action={<Link to="/finance/budget" className="text-xs font-medium text-moss-600 dark:text-moss-400 hover:underline">Edit →</Link>}
              />
              <CardBody className="space-y-4">
                {budget.length === 0 ? (
                  <p className="text-sm text-stone-400 dark:text-gray-500 py-2">
                    No budgets set. <Link to="/finance/budget" className="text-moss-600 dark:text-moss-400 hover:underline">Set one →</Link>
                  </p>
                ) : (
                  budget.map(b => (
                    <div key={b.category_id}>
                      <div className="flex items-center justify-between gap-3 mb-1.5">
                        <span className="text-sm font-medium text-stone-700 dark:text-gray-200 truncate">{b.category_name}</span>
                        <span className="text-xs text-stone-500 dark:text-gray-400 tabular-nums flex-shrink-0">
                          {formatIdr(b.spent)}{b.budgeted > 0 ? ` / ${formatIdr(b.budgeted)}` : ''}
                        </span>
                      </div>
                      {b.budgeted > 0 ? (
                        <ProgressBar value={b.spent} max={b.budgeted} />
                      ) : (
                        <p className="text-[11px] text-stone-400 dark:text-gray-500">No budget set · {formatIdr(b.spent)} spent</p>
                      )}
                    </div>
                  ))
                )}
              </CardBody>
            </Card>

            <div className="space-y-6">
              <AgingPanel
                title="Receivables Aging"
                data={receivables}
                linkTo="/finance/receivables"
                emptyMessage="No outstanding receivables."
              />
              <AgingPanel
                title="Payables Aging"
                data={payables}
                linkTo="/finance/payables"
                emptyMessage="No outstanding payables."
              />
            </div>
          </div>

          {/* PORTFOLIO + RECENT TRANSACTIONS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            <Card>
              <CardHeader
                title="Portfolio"
                subtitle={portfolio.total > 0 ? formatIdr(portfolio.total) + ' total value' : undefined}
                action={<Link to="/finance/portfolio" className="text-xs font-medium text-moss-600 dark:text-moss-400 hover:underline">Manage →</Link>}
              />
              <CardBody className="p-0">
                {portfolio.holdings.length === 0 ? (
                  <div className="px-6 py-4">
                    <p className="text-sm text-stone-400 dark:text-gray-500">No holdings tracked.</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-stone-100 dark:divide-gray-700">
                    {portfolio.holdings.map(h => (
                      <li key={h.id} className="flex items-center justify-between gap-3 px-6 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-stone-900 dark:text-gray-50 truncate">
                            {h.name}{h.symbol ? ` · ${h.symbol}` : ''}
                          </p>
                          <p className="text-[11px] text-stone-400 dark:text-gray-500 tabular-nums">
                            {h.gain >= 0 ? '+' : ''}{formatIdr(h.gain)} gain/loss
                          </p>
                        </div>
                        <span className="text-sm font-medium text-stone-700 dark:text-gray-200 tabular-nums flex-shrink-0">
                          {formatIdr(h.market_value)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Recent Transactions"
                subtitle="Last 10 across all accounts"
                action={<Link to="/finance" className="text-xs font-medium text-moss-600 dark:text-moss-400 hover:underline">View all →</Link>}
              />
              <CardBody className="p-0">
                {recent.length === 0 ? (
                  <div className="px-6 py-4">
                    <p className="text-sm text-stone-400 dark:text-gray-500">No transactions yet.</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-stone-100 dark:divide-gray-700">
                    {recent.map(tx => (
                      <li key={tx.id} className="flex items-center justify-between gap-3 px-6 py-3">
                        <div className="min-w-0 flex items-center gap-3">
                          <TypeBadge row={tx} />
                          <div className="min-w-0">
                            <p className="text-sm text-stone-900 dark:text-gray-50 truncate">
                              {tx.description || tx.category_name || tx.type}
                            </p>
                            <p className="text-[11px] text-stone-400 dark:text-gray-500">{fmtDate(tx.date)}</p>
                          </div>
                        </div>
                        <span className="text-sm font-medium text-stone-700 dark:text-gray-200 tabular-nums flex-shrink-0">
                          {formatIdr(tx.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
