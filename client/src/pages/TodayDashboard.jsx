// client/src/pages/TodayDashboard.jsx
// Roadmap Wave 2 home page. Replaces the lifetime-statistics Dashboard at "/"
// with a daily briefing answering "what should I do today?". Pulls one unified
// payload from GET /api/dashboard/today and renders five date-scoped stat cards
// plus four action-item widgets. The legacy Dashboard stays available at
// /dashboard.

import { useEffect } from 'react';
import { CheckSquare, DollarSign, BookOpen, GraduationCap, Wrench, Command } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import api from '../lib/api';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { formatIdr } from '../lib/formatIdr';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardBody } from '../components/ui/Card';
import { ErrorState } from '../components/ui/ErrorState';
import { Button } from '../components/ui/Button';
import { TodayTodoList } from '../components/dashboard/TodayTodoList';
import { TodayFinanceSummary } from '../components/dashboard/TodayFinanceSummary';
import { TodayLearningList } from '../components/dashboard/TodayLearningList';
import { TodayEngineerIssues } from '../components/dashboard/TodayEngineerIssues';

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

function formatHeading(dateStr) {
  // Parse as local midnight to avoid a UTC off-by-one when rendering the weekday.
  const d = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
  return d.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

export default function TodayDashboard() {
  useDocumentTitle('Today');

  const { data, loading, error, refetch } = useApi(() => api.get('/api/dashboard/today'), []);

  // Refresh the briefing when a Quick Capture create succeeds.
  useEffect(() => {
    window.addEventListener('quick-capture-created', refetch);
    return () => window.removeEventListener('quick-capture-created', refetch);
  }, [refetch]);

  const openCapture = () => window.dispatchEvent(new Event('open-quick-capture'));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-gray-50 tracking-[-0.02em]">
            Today&rsquo;s Briefing
          </h1>
          <p className="text-sm text-stone-500 dark:text-gray-400 mt-1">
            {formatHeading(data?.date)}
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={openCapture}>
          <Command size={14} />
          Quick capture
        </Button>
      </div>

      {/* ── Error (replaces the whole body; cards/widgets need the payload) ─── */}
      {error && !loading && (
        <Card><CardBody><ErrorState message={error} onRetry={refetch} /></CardBody></Card>
      )}

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      {!error && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {loading || !data ? (
            Array.from({ length: 5 }, (_, i) => <StatCardSkeleton key={i} />)
          ) : (
            <>
              <StatCard
                label="Tasks"
                value={data.todos.pending + data.todos.in_progress}
                subtitle={`${data.todos.completed_today} done today${data.todos.overdue > 0 ? ` · ${data.todos.overdue} overdue` : ''}`}
                icon={CheckSquare}
              />
              <StatCard
                label="Today's Finance"
                value={formatIdr(data.finance.today_income - data.finance.today_expense)}
                subtitle={`+${formatIdr(data.finance.today_income)} / −${formatIdr(data.finance.today_expense)}`}
                icon={DollarSign}
                delta={data.finance.today_income - data.finance.today_expense >= 0 ? 0 : -1}
              />
              <StatCard
                label="Learning"
                value={data.learning.active_count}
                subtitle={`${data.learning.total_spent_hours}h / ${data.learning.total_target_hours}h`}
                icon={BookOpen}
              />
              <StatCard
                label="Research"
                value={data.research.total}
                subtitle="total entries"
                icon={GraduationCap}
              />
              <StatCard
                label="Engineering"
                value={data.engineer.active_projects}
                subtitle={`${data.engineer.open_p0_issues} P0 open · ${data.engineer.this_week_checkin_exists ? 'check-in done' : 'check-in needed'}`}
                icon={Wrench}
              />
            </>
          )}
        </div>
      )}

      {/* ── Action items ───────────────────────────────────────────────────── */}
      {!error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <TodayTodoList />
            <TodayLearningList />
          </div>
          <div className="space-y-6">
            <TodayFinanceSummary data={data?.finance} />
            <TodayEngineerIssues data={data?.engineer} />
          </div>
        </div>
      )}

    </div>
  );
}
