import { Link } from 'react-router-dom';
import { BookOpen, Plus, ArrowRight } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import api from '../../lib/api';
import { Card, CardHeader, CardBody } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ListSkeleton } from '../ui/Skeleton';
import { ErrorState } from '../ui/ErrorState';
import { EmptyState } from '../ui/EmptyState';

// Mirrors the canonical maps in ResearchEntryRow.jsx — do not import from there
// to avoid pulling in DataTable render-helper dependencies into a lightweight widget.
const TYPE_VARIANT = {
  journal: 'blue',
  citation: 'emerald',
  note: 'amber',
};
const TYPE_LABEL = {
  journal: 'Journal',
  citation: 'Citation',
  note: 'Note',
};
const STATUS_VARIANT = {
  draft: 'gray',
  active: 'emerald',
  archived: 'red',
};
const STATUS_LABEL = {
  draft: 'Draft',
  active: 'Active',
  archived: 'Archived',
};

/**
 * RecentResearch widget — shows up to 5 most recent research entries.
 * Fetches independently; handles all 4 data states.
 */
export function RecentResearch() {
  const { data: entries, loading, error, refetch } = useApi(
    () => api.get('/api/research?per_page=5&sort=created_at&order=desc'),
    []
  );

  return (
    <Card>
      <CardHeader
        title="Recent Research"
        subtitle="Latest entries"
        action={
          <Link to="/research">
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

        {!loading && !error && (!entries || entries.length === 0) && (
          <EmptyState
            icon={BookOpen}
            title="No research entries yet"
            message="Head to the Research module to log your first entry."
            action={
              <Link to="/research">
                <Button variant="primary" size="sm">
                  <Plus size={14} />
                  New Entry
                </Button>
              </Link>
            }
          />
        )}

        {!loading && !error && entries && entries.length > 0 && (
          <ul className="divide-y divide-stone-100 dark:divide-gray-700">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center gap-3 px-6 py-3 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors duration-100"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-stone-900 dark:text-gray-50 truncate">
                    {entry.title}
                  </p>
                  {entry.source && (
                    <p className="text-[11px] text-stone-400 dark:text-gray-500 mt-0.5 truncate">
                      {entry.source}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant={TYPE_VARIANT[entry.type] ?? 'gray'}>
                    {TYPE_LABEL[entry.type] ?? entry.type}
                  </Badge>
                  <Badge variant={STATUS_VARIANT[entry.status] ?? 'gray'}>
                    {STATUS_LABEL[entry.status] ?? entry.status}
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
