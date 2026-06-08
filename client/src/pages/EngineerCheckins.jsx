// client/src/pages/EngineerCheckins.jsx
// Project-scoped weekly check-ins. The active project comes from ?project=<id>.
// Shows a DataTable of check-ins (week, health dot, achievements preview), a
// "New Check-in" modal (CheckinForm), and a read modal for the full entry.
//
// Health rule (per spec): if the latest check-in has blockers text → red dot;
// otherwise → green dot.

import { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Plus, ClipboardCheck, Bug } from 'lucide-react';

import api from '../lib/api';
import { useApi } from '../hooks/useApi';

import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { ListSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';

import { ProjectScopePicker } from '../components/engineer/ProjectScopePicker';
import { CheckinForm } from '../components/engineer/CheckinForm';

/** A labelled block of check-in prose, shown in the read modal. */
function DetailBlock({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-stone-400 dark:text-gray-500 tracking-widest uppercase mb-1">
        {label}
      </p>
      {value
        ? <p className="text-sm text-stone-700 dark:text-gray-300 whitespace-pre-wrap">{value}</p>
        : <p className="text-sm text-stone-400 dark:text-gray-500">—</p>}
    </div>
  );
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function EngineerCheckins() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const projectId = searchParams.get('project') ?? '';

  // ── UI state ──────────────────────────────────────────────────────────────
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewing, setViewing] = useState(null);

  // ── Data fetching ───────────────────────────────────────────────────────────
  const { data: projects } = useApi(() => api.get('/api/engineer'), []);

  const { data: checkins, loading, error, refetch } = useApi(
    () => projectId
      ? api.get(`/api/engineer/projects/${projectId}/checkins`)
      : Promise.resolve({ data: [] }),
    [projectId]
  );

  const activeProject = useMemo(
    () => projects?.find(p => String(p.id) === String(projectId)) ?? null,
    [projects, projectId]
  );

  // Latest check-in (list is week_start DESC) drives the health indicator.
  const latest = checkins?.[0] ?? null;
  const isBlocked = !!(latest?.blockers && latest.blockers.trim());

  // ── Handlers ──────────────────────────────────────────────────────────────
  const setProject = (id) => {
    if (id) setSearchParams({ project: id });
    else setSearchParams({});
  };

  const handleCreate = async (data) => {
    await api.post(`/api/engineer/projects/${projectId}/checkins`, data);
    refetch();
    setIsCreateOpen(false);
  };

  // Promote a check-in's discovered bugs into the issue tracker (pre-filled).
  const promoteToIssue = (checkin) => {
    navigate(`/engineer/issues?project=${projectId}`, {
      state: {
        prefill: {
          title: `Bug from check-in (${formatDate(checkin.week_start)})`,
          description: checkin.bugs_discovered ?? '',
        },
      },
    });
  };

  // ── DataTable column contract (§5.4) ─────────────────────────────────────────
  const columns = [
    {
      key: 'week_start', header: 'Week', sortable: true,
      render: (row) => (
        <span className="text-sm font-medium text-stone-900 dark:text-gray-50">
          {formatDate(row.week_start)}
        </span>
      ),
    },
    {
      key: 'health', header: 'Health',
      render: (row) => {
        const blocked = !!(row.blockers && row.blockers.trim());
        return (
          <span className="inline-flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${blocked ? 'bg-red-500 dark:bg-red-400' : 'bg-moss-500 dark:bg-moss-400'}`} />
            <span className="text-sm text-stone-500 dark:text-gray-400">{blocked ? 'Blocked' : 'On track'}</span>
          </span>
        );
      },
    },
    {
      key: 'achievements', header: 'Achievements',
      render: (row) => (
        <span className="text-sm text-stone-600 dark:text-gray-400 truncate block max-w-xs">
          {row.achievements?.trim() || '—'}
        </span>
      ),
    },
    {
      key: 'actions', header: '', align: 'right',
      render: (row) => (
        <>
          <Button variant="ghost" size="sm" onClick={() => setViewing(row)}>View</Button>
          {row.bugs_discovered?.trim() && (
            <Button variant="ghost" size="sm" onClick={() => promoteToIssue(row)}>
              <Bug size={14} />
              To Issue
            </Button>
          )}
        </>
      ),
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">

      {/* PAGE HEADER */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-stone-900 dark:text-gray-50 tracking-[-0.02em]">
              Check-ins
            </h1>
            <p className="text-sm text-stone-500 dark:text-gray-400 mt-1">
              Weekly progress logs — achievements, plans, and blockers.
            </p>
          </div>
          {projectId && checkins?.length > 0 && (
            <Badge variant={isBlocked ? 'red' : 'moss'}>
              {isBlocked ? 'Blocked' : 'Healthy'}
            </Badge>
          )}
        </div>
        {projectId && (
          <Button variant="primary" size="md" onClick={() => setIsCreateOpen(true)}>
            <Plus size={16} />
            New Check-in
          </Button>
        )}
      </div>

      {/* PROJECT SCOPE */}
      {!projectId ? (
        <ProjectScopePicker projects={projects} selectedId={projectId} onSelect={setProject} />
      ) : (
        <Card>
          <CardBody>
            <Select
              id="checkins-project"
              label="Project"
              value={projectId}
              onChange={(e) => setProject(e.target.value)}
            >
              <option value="">Select a project…</option>
              {(projects ?? []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </CardBody>
        </Card>
      )}

      {/* TABLE */}
      {projectId && (
        <Card>
          <CardHeader
            title={activeProject ? `${activeProject.name} · Check-ins` : 'Check-ins'}
            subtitle={checkins?.length > 0 ? `${checkins.length} logged` : undefined}
          />
          <CardBody className="p-0">
            {loading && <ListSkeleton rows={4} />}
            {error && !loading && <ErrorState message={error} onRetry={refetch} />}
            {!loading && !error && (!checkins || checkins.length === 0) && (
              <EmptyState
                icon={ClipboardCheck}
                title="No check-ins yet"
                message="Log your first weekly check-in for this project."
                action={
                  <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
                    <Plus size={14} />
                    New Check-in
                  </Button>
                }
              />
            )}
            {!loading && !error && checkins && checkins.length > 0 && (
              <DataTable columns={columns} items={checkins} initialSortKey="week_start" />
            )}
          </CardBody>
        </Card>
      )}

      {/* NEW CHECK-IN MODAL */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="New Check-in"
        size="lg"
      >
        {/* key forces a fresh form each open */}
        <CheckinForm
          key={isCreateOpen ? 'open' : 'closed'}
          onSubmit={handleCreate}
          onCancel={() => setIsCreateOpen(false)}
        />
      </Modal>

      {/* READ MODAL */}
      <Modal
        isOpen={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing ? `Check-in · ${formatDate(viewing.week_start)}` : 'Check-in'}
        size="md"
        footer={
          <Button variant="secondary" size="md" onClick={() => setViewing(null)}>Close</Button>
        }
      >
        {viewing && (
          <>
            <DetailBlock label="Achievements" value={viewing.achievements} />
            <DetailBlock label="Plans for next week" value={viewing.plans_next} />
            <DetailBlock label="Blockers" value={viewing.blockers} />
            <DetailBlock label="Bugs discovered" value={viewing.bugs_discovered} />
            <DetailBlock label="Concerns" value={viewing.concerns} />
          </>
        )}
      </Modal>
    </div>
  );
}
