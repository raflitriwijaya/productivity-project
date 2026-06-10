// client/src/pages/EngineerIssues.jsx
// Project-scoped issue tracker. The active project comes from the ?project=<id>
// query param; without it, a project picker is shown. Supports create/edit/delete
// and pre-filling a new issue from navigation state (e.g. a check-in's bugs).

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { Plus, Bug } from 'lucide-react';

import api from '../lib/api';
import { useApi } from '../hooks/useApi';
import useDocumentTitle from '../hooks/useDocumentTitle';

import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Input';
import { DataTable } from '../components/ui/DataTable';
import { ListSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';

import { ProjectScopePicker } from '../components/engineer/ProjectScopePicker';
import { CreateIssueModal } from '../components/engineer/CreateIssueModal';
import {
  TitleCell, SeverityCell, StatusCell, TextCell, ActionsCell,
} from '../components/engineer/IssueRow';

const SEVERITY_FILTERS = [
  { value: 'all',         label: 'All' },
  { value: 'P0-Critical', label: 'P0' },
  { value: 'P1-High',     label: 'P1' },
  { value: 'P2-Medium',   label: 'P2' },
  { value: 'P3-Low',      label: 'P3' },
];

const STATUS_FILTERS = [
  { value: 'all',         label: 'All' },
  { value: 'open',        label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved',    label: 'Resolved' },
];

export default function EngineerIssues() {
  useDocumentTitle('Engineering — Issues');
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const projectId = searchParams.get('project') ?? '';

  // ── UI state ──────────────────────────────────────────────────────────────
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter,   setStatusFilter]   = useState('all');
  const [isCreateOpen,   setIsCreateOpen]   = useState(false);
  const [editingIssue,   setEditingIssue]   = useState(null);
  const [prefill,        setPrefill]        = useState(null);
  const [deletingIssue,  setDeletingIssue]  = useState(null);
  const [deleteLoading,  setDeleteLoading]  = useState(false);

  // ── Data fetching ───────────────────────────────────────────────────────────
  const { data: projects } = useApi(() => api.get('/api/engineer'), []);

  const { data: issues, loading, error, refetch } = useApi(
    () => projectId
      ? api.get(`/api/engineer/projects/${projectId}/issues`)
      : Promise.resolve({ data: [] }),
    [projectId]
  );

  // ── Open the create modal pre-filled when arriving from a check-in ───────────
  useEffect(() => {
    if (location.state?.prefill && projectId) {
      /* Phase 4: setState here is intentional navigation-state-driven modal trigger */
      /* eslint-disable react-hooks/set-state-in-effect */
      setPrefill(location.state.prefill);
      setEditingIssue(null);
      setIsCreateOpen(true);
      /* eslint-enable react-hooks/set-state-in-effect */
      // Clear the navigation state so a refresh/back doesn't reopen the modal.
      navigate(location.pathname + location.search, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, location.search, projectId, navigate]);

  const activeProject = useMemo(
    () => projects?.find(p => String(p.id) === String(projectId)) ?? null,
    [projects, projectId]
  );

  const filtered = useMemo(() => {
    if (!issues) return [];
    return issues.filter(i =>
      (severityFilter === 'all' || i.severity === severityFilter) &&
      (statusFilter === 'all' || i.status === statusFilter)
    );
  }, [issues, severityFilter, statusFilter]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const setProject = (id) => {
    if (id) setSearchParams({ project: id });
    else setSearchParams({});
  };

  const handleCreate = async (data) => {
    await api.post(`/api/engineer/projects/${projectId}/issues`, data);
    refetch();
  };

  const handleEdit = async (data) => {
    await api.patch(`/api/engineer/issues/${editingIssue.id}`, data);
    refetch();
  };

  const openCreate = () => { setEditingIssue(null); setPrefill(null); setIsCreateOpen(true); };
  const openEdit = (issue) => { setEditingIssue(issue); setPrefill(null); setIsCreateOpen(true); };
  const closeModal = () => { setIsCreateOpen(false); setEditingIssue(null); setPrefill(null); };

  const confirmDelete = async () => {
    if (!deletingIssue) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/api/engineer/issues/${deletingIssue.id}`);
      setDeletingIssue(null);
      refetch();
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── DataTable column contract (§5.4) ─────────────────────────────────────────
  const columns = [
    { key: 'title',     header: 'Issue',    sortable: true, render: TitleCell },
    { key: 'severity',  header: 'Severity',                 render: SeverityCell },
    { key: 'status',    header: 'Status',   sortable: true, render: StatusCell },
    { key: 'component', header: 'Component',                render: (row) => TextCell(row.component) },
    { key: 'assignee',  header: 'Assignee',                 render: (row) => TextCell(row.assignee) },
    {
      key: 'actions', header: '', align: 'right',
      render: (row) => ActionsCell(row, openEdit, (r) => setDeletingIssue(r)),
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">

      {/* PAGE HEADER */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-gray-50 tracking-[-0.02em]">
            Issues
          </h1>
          <p className="text-sm text-stone-500 dark:text-gray-400 mt-1">
            Track bugs and tasks per project, triaged by severity.
          </p>
        </div>
        {projectId && (
          <Button variant="primary" size="md" onClick={openCreate}>
            <Plus size={16} />
            New Issue
          </Button>
        )}
      </div>

      {/* PROJECT SCOPE — picker when none selected, compact switcher when set */}
      {!projectId ? (
        <ProjectScopePicker projects={projects} selectedId={projectId} onSelect={setProject} />
      ) : (
        <Card>
          <CardBody>
            <Select
              id="issues-project"
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

      {/* FILTERS + TABLE — only when a project is selected */}
      {projectId && (
        <>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {SEVERITY_FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setSeverityFilter(f.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150
                    ${severityFilter === f.value
                      ? 'bg-moss-50 dark:bg-moss-950/50 text-moss-700 dark:text-moss-400'
                      : 'bg-white dark:bg-gray-800 border border-stone-200 dark:border-gray-700 text-stone-600 dark:text-gray-400 hover:bg-stone-50 dark:hover:bg-gray-700'
                    }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {STATUS_FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150
                    ${statusFilter === f.value
                      ? 'bg-moss-50 dark:bg-moss-950/50 text-moss-700 dark:text-moss-400'
                      : 'bg-white dark:bg-gray-800 border border-stone-200 dark:border-gray-700 text-stone-600 dark:text-gray-400 hover:bg-stone-50 dark:hover:bg-gray-700'
                    }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <Card>
            <CardHeader
              title={activeProject ? `${activeProject.name} · Issues` : 'Issues'}
              subtitle={filtered.length > 0 ? `${filtered.length} shown` : undefined}
            />
            <CardBody className="p-0">
              {loading && <ListSkeleton rows={5} />}
              {error && !loading && <ErrorState message={error} onRetry={refetch} />}
              {!loading && !error && filtered.length === 0 && (
                <EmptyState
                  icon={Bug}
                  title={issues?.length ? 'No issues match these filters' : 'No issues yet'}
                  message={
                    issues?.length
                      ? 'Try clearing the severity or status filter.'
                      : 'Log the first bug or task for this project.'
                  }
                  action={
                    !issues?.length && (
                      <Button variant="primary" size="sm" onClick={openCreate}>
                        <Plus size={14} />
                        New Issue
                      </Button>
                    )
                  }
                />
              )}
              {!loading && !error && filtered.length > 0 && (
                <DataTable columns={columns} items={filtered} initialSortKey="severity" />
              )}
            </CardBody>
          </Card>
        </>
      )}

      {/* CREATE / EDIT MODAL */}
      <CreateIssueModal
        isOpen={isCreateOpen}
        onClose={closeModal}
        onSubmit={editingIssue ? handleEdit : handleCreate}
        issue={editingIssue}
        prefill={prefill}
      />

      {/* DELETE CONFIRMATION */}
      <Modal
        isOpen={!!deletingIssue}
        onClose={() => setDeletingIssue(null)}
        title="Delete Issue"
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="md" onClick={() => setDeletingIssue(null)} disabled={deleteLoading}>
              Cancel
            </Button>
            <Button variant="danger" size="md" onClick={confirmDelete} disabled={deleteLoading}>
              {deleteLoading ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-stone-600 dark:text-gray-400">
          Delete{' '}
          <span className="font-semibold text-stone-900 dark:text-gray-50">
            "{deletingIssue?.title}"
          </span>
          ? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
