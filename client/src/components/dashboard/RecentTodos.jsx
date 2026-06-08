import { Link } from 'react-router-dom';
import { CheckSquare, Plus, ArrowRight } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import api from '../../lib/api';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ListSkeleton } from '../ui/Skeleton';
import { ErrorState } from '../ui/ErrorState';
import { EmptyState } from '../ui/EmptyState';

/** @param {{ status: string }} props */
const STATUS_VARIANT = {
  done: 'moss',
  completed: 'moss',
  pending: 'gray',
  in_progress: 'blue',
  overdue: 'red',
};

/** @param {{ priority: number }} props */
const PRIORITY_VARIANT = { 1: 'red', 2: 'amber', 3: 'gray' };
const PRIORITY_LABEL = { 1: 'High', 2: 'Med', 3: 'Low' };

/**
 * RecentTodos widget — shows up to 5 most recent todos.
 * Fetches independently; handles all 4 data states.
 */
export function RecentTodos() {
  const { data: todos, loading, error, refetch } = useApi(
    () => api.get('/api/todos?per_page=5&sort=created_at&order=desc'),
    []
  );

  return (
    <Card>
      <CardHeader
        title="Recent To-Dos"
        subtitle="Latest tasks"
        action={
          <Link to="/todo">
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

        {!loading && !error && (!todos || todos.length === 0) && (
          <EmptyState
            icon={CheckSquare}
            title="No tasks yet"
            message="Head to the To-Do module to create your first task."
            action={
              <Link to="/todo">
                <Button variant="primary" size="sm">
                  <Plus size={14} />
                  New Task
                </Button>
              </Link>
            }
          />
        )}

        {!loading && !error && todos && todos.length > 0 && (
          <ul className="divide-y divide-stone-100 dark:divide-gray-700">
            {todos.map((todo) => (
              <li
                key={todo.id}
                className="flex items-center gap-3 px-6 py-3 hover:bg-moss-50/30 dark:hover:bg-moss-950/20 transition-colors duration-100"
              >
                {/* Priority dot */}
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    todo.priority === 1
                      ? 'bg-red-500'
                      : todo.priority === 2
                      ? 'bg-amber-500'
                      : 'bg-stone-300 dark:bg-gray-600'
                  }`}
                />

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-stone-900 dark:text-gray-50 truncate">{todo.title}</p>
                  {todo.due_date && (
                    <p className="text-[11px] text-stone-400 dark:text-gray-500 mt-0.5">
                      Due {todo.due_date}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant={PRIORITY_VARIANT[todo.priority] ?? 'gray'}>
                    {PRIORITY_LABEL[todo.priority] ?? '—'}
                  </Badge>
                  <Badge variant={STATUS_VARIANT[todo.status] ?? 'gray'}>
                    {todo.status}
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
