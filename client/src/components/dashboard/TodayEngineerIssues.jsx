// client/src/components/dashboard/TodayEngineerIssues.jsx
// Today Dashboard action list (Roadmap Wave 2): open critical/high issues across
// all projects, plus this week's check-in status (from the parent's stats data).

import { AlertTriangle, CheckCircle } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import api from '../../lib/api';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { ListSkeleton } from '../ui/Skeleton';
import { ErrorState } from '../ui/ErrorState';
import { EmptyState } from '../ui/EmptyState';
import { SEVERITY_VARIANT, SEVERITY_LABEL } from '../engineer/IssueRow';

export function TodayEngineerIssues({ data: stats }) {
  const { data: issues, loading, error, refetch } = useApi(
    () => api.get('/api/engineer/issues?severity=P0-Critical,P1-High&status=open,in_progress&per_page=5'),
    []
  );

  const checkin = stats?.this_week_checkin_exists
    ? (
      <span className="flex items-center gap-1 text-moss-600 dark:text-moss-400">
        <CheckCircle size={12} /> Check-in done
      </span>
    )
    : (
      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
        <AlertTriangle size={12} /> Check-in needed
      </span>
    );

  return (
    <Card>
      <CardHeader
        title="Engineering"
        subtitle="Critical & high issues"
        action={stats ? <div className="text-xs">{checkin}</div> : null}
      />
      <CardBody className="p-0">
        {loading && <ListSkeleton rows={3} />}

        {error && !loading && <ErrorState message={error} onRetry={refetch} />}

        {!loading && !error && (!issues || issues.length === 0) && (
          <EmptyState
            icon={CheckCircle}
            title="No open critical issues"
            message="All clear on the engineering front."
          />
        )}

        {!loading && !error && issues && issues.length > 0 && (
          <ul className="divide-y divide-stone-100 dark:divide-gray-700">
            {issues.map((issue) => (
              <li
                key={issue.id}
                className="flex items-center justify-between gap-3 px-6 py-3 hover:bg-moss-50/30 dark:hover:bg-moss-950/20 transition-colors duration-100"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant={SEVERITY_VARIANT[issue.severity] ?? 'gray'}>
                    {SEVERITY_LABEL[issue.severity] ?? issue.severity}
                  </Badge>
                  <span className="text-sm text-stone-900 dark:text-gray-50 truncate">{issue.title}</span>
                </div>
                <span className="text-xs text-stone-400 dark:text-gray-500 flex-shrink-0 truncate max-w-[40%]">
                  {issue.component || issue.project_name}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

export default TodayEngineerIssues;
