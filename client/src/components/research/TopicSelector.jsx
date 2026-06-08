// client/src/components/research/TopicSelector.jsx
// Multi-select topic chips for the entry create/edit modal. Renders each topic
// as a toggle chip (Badge inside a <button>): selected → moss variant,
// unselected → gray. Controlled via `selectedIds` / `onChange`.

import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { Badge } from '../ui/Badge';
import { Skeleton } from '../ui/Skeleton';

/**
 * @param {{ selectedIds: number[], onChange: (ids: number[]) => void }} props
 */
export function TopicSelector({ selectedIds = [], onChange }) {
  const { data: topics, loading, error } = useApi(() => api.get('/api/research/topics'), []);

  const toggle = (id) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(t => t !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div className="w-full">
      <label className="block text-xs font-medium text-stone-700 dark:text-gray-300 tracking-wide uppercase mb-1.5">
        Topics
      </label>

      {loading && (
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-6 w-20 rounded-md" />
          <Skeleton className="h-6 w-16 rounded-md" />
          <Skeleton className="h-6 w-24 rounded-md" />
        </div>
      )}

      {error && !loading && (
        <p className="text-xs text-red-600 dark:text-red-400">Could not load topics.</p>
      )}

      {!loading && !error && (!topics || topics.length === 0) && (
        <p className="text-xs text-stone-400 dark:text-gray-500">
          No topics yet — create one from the Research page sidebar.
        </p>
      )}

      {!loading && !error && topics && topics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {topics.map(t => {
            const selected = selectedIds.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggle(t.id)}
                className="focus:outline-none focus:ring-2 focus:ring-moss-500 dark:focus:ring-moss-400 focus:ring-offset-1 ring-offset-white dark:ring-offset-gray-800 rounded-md"
              >
                <Badge variant={selected ? 'moss' : 'gray'}>
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0 mr-1.5"
                    style={{ backgroundColor: t.color }}
                  />
                  {t.name}
                </Badge>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
