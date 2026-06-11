// client/src/components/dashboard/TodayLearningList.jsx
// Today Dashboard action list (Roadmap Wave 2): active (in-progress) learning
// items with an hours-progress bar.

import { BookOpen } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import api from '../../lib/api';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { ListSkeleton } from '../ui/Skeleton';
import { ErrorState } from '../ui/ErrorState';
import { EmptyState } from '../ui/EmptyState';

export function TodayLearningList() {
  const { data: items, loading, error, refetch } = useApi(
    () => api.get('/api/learning?status=in_progress&sort=updated_at&order=desc&per_page=5'),
    []
  );

  return (
    <Card>
      <CardHeader title="Active Learning" subtitle="In progress right now" />
      <CardBody className="p-0">
        {loading && <ListSkeleton rows={3} />}

        {error && !loading && <ErrorState message={error} onRetry={refetch} />}

        {!loading && !error && (!items || items.length === 0) && (
          <EmptyState
            icon={BookOpen}
            title="No active learning"
            message="Start a course or book in the Learning module."
          />
        )}

        {!loading && !error && items && items.length > 0 && (
          <ul className="divide-y divide-stone-100 dark:divide-gray-700">
            {items.map((item) => {
              const total = Number(item.total_hours) || 0;
              const spent = Number(item.spent_hours) || 0;
              const pct = total > 0 ? Math.min(100, Math.round((spent / total) * 100)) : 0;
              return (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 px-6 py-3 hover:bg-moss-50/30 dark:hover:bg-moss-950/20 transition-colors duration-100"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-stone-900 dark:text-gray-50 truncate">{item.title}</p>
                    <p className="text-[11px] text-stone-400 dark:text-gray-500 capitalize">{item.type}</p>
                  </div>
                  {total > 0 && (
                    <div className="flex-shrink-0 w-20">
                      <div className="w-full h-2 bg-stone-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-moss-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[11px] text-stone-400 dark:text-gray-500 text-right mt-0.5">
                        {spent}h / {total}h
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

export default TodayLearningList;
