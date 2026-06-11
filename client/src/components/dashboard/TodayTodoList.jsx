// client/src/components/dashboard/TodayTodoList.jsx
// Today Dashboard action list (Roadmap Wave 2): tasks due today or overdue.
// Reuses the existing GET /api/todos endpoint and filters client-side, since
// that endpoint has no date filter. Priority is an integer (1=High..3=Low) and
// the open status set excludes 'done' (TODO_STATUSES, not 'completed').

import { useEffect } from 'react';
import { ListTodo } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import api from '../../lib/api';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { ListSkeleton } from '../ui/Skeleton';
import { ErrorState } from '../ui/ErrorState';
import { EmptyState } from '../ui/EmptyState';

const PRIORITY_VARIANT = { 1: 'red', 2: 'amber', 3: 'gray' };
const PRIORITY_LABEL   = { 1: 'High', 2: 'Medium', 3: 'Low' };

// Normalize a date-ish value (serialized timestamp or YYYY-MM-DD) to a local
// YYYY-MM-DD string so comparisons line up with the local "today".
function toDateStr(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function TodayTodoList() {
  // Pull a generous page sorted by due date, then filter to due-today/overdue.
  const { data: todos, loading, error, refetch } = useApi(
    () => api.get('/api/todos?sort=due_date&order=asc&per_page=100'),
    []
  );

  // Refresh when something is captured via Cmd+K.
  useEffect(() => {
    window.addEventListener('quick-capture-created', refetch);
    return () => window.removeEventListener('quick-capture-created', refetch);
  }, [refetch]);

  const today = todayStr();
  const items = (todos ?? []).filter((t) => {
    if (t.status === 'done') return false;
    const due = toDateStr(t.due_date);
    return due != null && due <= today;
  });

  return (
    <Card>
      <CardHeader title="Today's Tasks" subtitle="Due today or overdue" />
      <CardBody className="p-0">
        {loading && <ListSkeleton rows={4} />}

        {error && !loading && <ErrorState message={error} onRetry={refetch} />}

        {!loading && !error && items.length === 0 && (
          <EmptyState
            icon={ListTodo}
            title="Nothing due today"
            message="Capture a task with Cmd+K or head to the To-Do page."
          />
        )}

        {!loading && !error && items.length > 0 && (
          <ul className="divide-y divide-stone-100 dark:divide-gray-700">
            {items.map((todo) => {
              const due = toDateStr(todo.due_date);
              const overdue = due != null && due < today;
              return (
                <li
                  key={todo.id}
                  className="flex items-center justify-between gap-3 px-6 py-3 hover:bg-moss-50/30 dark:hover:bg-moss-950/20 transition-colors duration-100"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        todo.status === 'in_progress' ? 'bg-ember-500' : 'bg-stone-300 dark:bg-gray-600'
                      }`}
                    />
                    <span className="text-sm text-stone-900 dark:text-gray-50 truncate">{todo.title}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {overdue && <Badge variant="red">Overdue</Badge>}
                    <Badge variant={PRIORITY_VARIANT[todo.priority] ?? 'gray'}>
                      {PRIORITY_LABEL[todo.priority] ?? '—'}
                    </Badge>
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

export default TodayTodoList;
