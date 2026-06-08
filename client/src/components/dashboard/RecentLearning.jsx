import { Link } from 'react-router-dom';
import { GraduationCap, Plus, ArrowRight } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import api from '../../lib/api';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ListSkeleton } from '../ui/Skeleton';
import { ErrorState } from '../ui/ErrorState';
import { EmptyState } from '../ui/EmptyState';

// Mirrors the canonical maps in LearningRow.jsx — kept local to avoid
// pulling in DataTable render-helper dependencies into a lightweight widget.
const STATUS_VARIANT = {
  not_started: 'gray',
  in_progress: 'blue',
  completed: 'moss',
  on_hold: 'amber',
};
const STATUS_LABEL = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
  on_hold: 'On hold',
};
const TYPE_VARIANT = {
  course: 'blue',
  book: 'moss',
  tutorial: 'amber',
  other: 'gray',
};

/**
 * Inline progress bar — matches the visual used in LearningRow ProgressCell
 * but self-contained so there's no heavy import from the DataTable helper.
 * @param {{ value: number }} props value is 0–100
 */
function MiniProgress({ value }) {
  const pct = Math.min(100, Math.max(0, value ?? 0));
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-stone-200 dark:bg-gray-700 overflow-hidden">
        <div
          className="h-full rounded-full bg-moss-500 dark:bg-moss-400 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] text-stone-400 dark:text-gray-500 font-mono w-8 text-right">
        {pct}%
      </span>
    </div>
  );
}

/**
 * RecentLearning widget — shows up to 5 most recent learning items.
 * Fetches independently; handles all 4 data states.
 */
export function RecentLearning() {
  const { data: items, loading, error, refetch } = useApi(
    () => api.get('/api/learning?per_page=5&sort=created_at&order=desc'),
    []
  );

  return (
    <Card>
      <CardHeader
        title="Recent Learning"
        subtitle="Latest items"
        action={
          <Link to="/learning">
            <Button variant="ghost" size="sm">
              View all
              <ArrowRight size={14} />
            </Button>
          </Link>
        }
      />
      <CardBody className="p-0">
        {loading && <ListSkeleton rows={5} />}

        {error && !loading && (
          <ErrorState message={error} onRetry={refetch} />
        )}

        {!loading && !error && (!items || items.length === 0) && (
          <EmptyState
            icon={GraduationCap}
            title="No learning items yet"
            message="Head to the Learning module to track your first resource."
            action={
              <Link to="/learning">
                <Button variant="primary" size="sm">
                  <Plus size={14} />
                  New Item
                </Button>
              </Link>
            }
          />
        )}

        {!loading && !error && items && items.length > 0 && (
          <ul className="divide-y divide-stone-100 dark:divide-gray-700">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 px-6 py-3 hover:bg-moss-50/30 dark:hover:bg-moss-950/20 transition-colors duration-100"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-stone-900 dark:text-gray-50 truncate">
                    {item.title}
                  </p>
                  <div className="mt-1">
                    <MiniProgress value={item.progress} />
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant={TYPE_VARIANT[item.type] ?? 'gray'}>
                    {item.type}
                  </Badge>
                  <Badge variant={STATUS_VARIANT[item.status] ?? 'gray'}>
                    {STATUS_LABEL[item.status] ?? item.status}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
