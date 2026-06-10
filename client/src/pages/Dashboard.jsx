// client/src/pages/Dashboard.jsx
import { CheckSquare, TrendingUp, BookOpen, GraduationCap } from 'lucide-react';
import api from '../lib/api';
import { useApi } from '../hooks/useApi';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { formatIdr } from '../lib/formatIdr';
import { Card, CardBody } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { ErrorState } from '../components/ui/ErrorState';
import { RecentTodos } from '../components/dashboard/RecentTodos';
import { RecentTransactions } from '../components/dashboard/RecentTransactions';
import { RecentResearch } from '../components/dashboard/RecentResearch';
import { RecentLearning } from '../components/dashboard/RecentLearning';

// ─── Inline skeleton for a single StatCard slot ─────────────────────────────
function StatCardSkeleton() {
  return (
    <Card>
      <CardBody>
        <div className="h-3 w-24 rounded bg-stone-200 dark:bg-gray-700 animate-pulse mb-3" />
        <div className="h-7 w-16 rounded bg-stone-200 dark:bg-gray-700 animate-pulse mb-1" />
        <div className="h-3 w-32 rounded bg-stone-100 dark:bg-gray-700/50 animate-pulse" />
      </CardBody>
    </Card>
  );
}

// ─── Todo summary stat row ───────────────────────────────────────────────────
/**
 * @param {{ loading: boolean, error: string|null, data: object|null, refetch: function }} props
 */
function TodoStatsRow({ loading, error, data, refetch }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }, (_, i) => <StatCardSkeleton key={i} />)}
      </div>
    );
  }
  if (error) {
    return (
      <Card>
        <CardBody>
          <ErrorState message={error} onRetry={refetch} />
        </CardBody>
      </Card>
    );
  }
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      <StatCard label="Total Tasks"   value={data?.total       ?? 0} icon={CheckSquare} />
      <StatCard label="Pending"       value={data?.pending     ?? 0} />
      <StatCard label="In Progress"   value={data?.in_progress ?? 0} />
      <StatCard label="Done"          value={data?.done        ?? 0} />
      <StatCard label="Overdue"       value={data?.overdue     ?? 0} />
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  useDocumentTitle('Dashboard');
  // Dedicated stats call — no per_page=100 workaround
  const {
    data: todoStats,
    loading: todoStatsLoading,
    error: todoStatsError,
    refetch: refetchTodoStats,
  } = useApi(() => api.get('/api/todos/stats'));

  // Finance summary (existing endpoint used by Finance.jsx)
  const {
    data: financeSummary,
    loading: financeLoading,
    error: financeError,
    refetch: refetchFinance,
  } = useApi(() => api.get('/api/finances/summary'));

  // Learning stats (existing endpoint used by Learning.jsx)
  const {
    data: learningStats,
    loading: learningLoading,
    error: learningError,
    refetch: refetchLearning,
  } = useApi(() => api.get('/api/learning/stats'));

  // Research stats (existing endpoint used by Research.jsx)
  const {
    data: researchStats,
    loading: researchLoading,
    error: researchError,
    refetch: refetchResearch,
  } = useApi(() => api.get('/api/research/stats'));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-stone-900 dark:text-gray-50 tracking-[-0.02em]">
          Dashboard
        </h1>
        <p className="text-sm text-stone-500 dark:text-gray-400 mt-1">
          Overview of all modules.
        </p>
      </div>

      {/* ── To-Do Stats ─────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-stone-400 dark:text-gray-500 tracking-widest uppercase">
          Tasks
        </h2>
        <TodoStatsRow
          loading={todoStatsLoading}
          error={todoStatsError}
          data={todoStats}
          refetch={refetchTodoStats}
        />
      </section>

      {/* ── Finance Stats ────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-stone-400 dark:text-gray-500 tracking-widest uppercase">
          Finance
        </h2>
        {financeLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }, (_, i) => <StatCardSkeleton key={i} />)}
          </div>
        ) : financeError ? (
          <Card><CardBody><ErrorState message={financeError} onRetry={refetchFinance} /></CardBody></Card>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              label="Total Income"
              value={formatIdr(financeSummary?.total_income)}
              icon={TrendingUp}
            />
            <StatCard
              label="Total Expenses"
              value={formatIdr(financeSummary?.total_expense)}
            />
            <StatCard
              label="Net Worth"
              value={formatIdr(financeSummary?.net_worth)}
              delta={financeSummary?.net_worth != null
                ? (Number(financeSummary.net_worth) >= 0 ? 0 : -1)
                : null}
            />
          </div>
        )}
      </section>

      {/* ── Learning Stats ───────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-stone-400 dark:text-gray-500 tracking-widest uppercase">
          Learning
        </h2>
        {learningLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }, (_, i) => <StatCardSkeleton key={i} />)}
          </div>
        ) : learningError ? (
          <Card><CardBody><ErrorState message={learningError} onRetry={refetchLearning} /></CardBody></Card>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Items"   value={learningStats?.total       ?? 0} icon={GraduationCap} />
            <StatCard label="In Progress"   value={learningStats?.in_progress ?? 0} />
            <StatCard label="Completed"     value={learningStats?.completed   ?? 0} />
            <StatCard label="Hours Logged"  value={learningStats?.total_spent_hours ?? 0} />
          </div>
        )}
      </section>

      {/* ── Research Stats ───────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-stone-400 dark:text-gray-500 tracking-widest uppercase">
          Research
        </h2>
        {researchLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }, (_, i) => <StatCardSkeleton key={i} />)}
          </div>
        ) : researchError ? (
          <Card><CardBody><ErrorState message={researchError} onRetry={refetchResearch} /></CardBody></Card>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Entries" value={researchStats?.total     ?? 0} icon={BookOpen} />
            <StatCard label="Journal"       value={researchStats?.journal   ?? 0} />
            <StatCard label="Citations"     value={researchStats?.citation  ?? 0} />
            <StatCard label="Notes"         value={researchStats?.note      ?? 0} />
          </div>
        )}
      </section>

      {/* ── Recent Activity Grid ─────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-stone-400 dark:text-gray-500 tracking-widest uppercase">
          Recent Activity
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentTodos />
          <RecentTransactions />
          <RecentResearch />
          <RecentLearning />
        </div>
      </section>

    </div>
  );
}
