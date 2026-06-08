// client/src/pages/EngineerProjects.jsx
// Engineering Toolkit — projects landing page. Follows §8 Module Page Template:
// stat cards, filter pills, four-state DataTable, create/edit + delete modals.

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Wrench, Rocket, Lightbulb, Hammer } from 'lucide-react';

import api from '../lib/api';
import { useApi } from '../hooks/useApi';

import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatCard } from '../components/ui/StatCard';
import { DataTable } from '../components/ui/DataTable';
import { ListSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';

import { CreateProjectModal } from '../components/engineer/CreateProjectModal';
import {
  TitleCell, TypeCell, PlatformsCell, StatusCell, UpdatedCell, ActionsCell,
  TYPE_LABEL, STATUS_LABEL,
} from '../components/engineer/ProjectRow';

// ─── Filter options ───────────────────────────────────────────────────────────

const TYPE_FILTERS = [
  { value: 'all',      label: 'All Types' },
  { value: 'iot',      label: 'IoT' },
  { value: 'embedded', label: 'Embedded' },
  { value: 'robotics', label: 'Robotics' },
  { value: 'other',    label: 'Other' },
];

const STATUS_FILTERS = [
  { value: 'all',         label: 'All Statuses' },
  { value: 'idea',        label: 'Idea' },
  { value: 'planning',    label: 'Planning' },
  { value: 'development', label: 'Development' },
  { value: 'testing',     label: 'Testing' },
  { value: 'deployed',    label: 'Deployed' },
  { value: 'archived',    label: 'Archived' },
];

// ─── Page component ───────────────────────────────────────────────────────────

export default function EngineerProjects() {
  const navigate = useNavigate();

  // ── UI state ──────────────────────────────────────────────────────────────
  const [typeFilter,    setTypeFilter]    = useState('all');
  const [statusFilter,  setStatusFilter]  = useState('all');
  const [isCreateOpen,  setIsCreateOpen]  = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [deletingProject, setDeletingProject] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Data fetching ───────────────────────────────────────────────────────────
  const { data: projects, loading, error, refetch } =
    useApi(() => api.get('/api/engineer'), []);

  const { data: stats, loading: statsLoading, refetch: refetchStats } =
    useApi(() => api.get('/api/engineer/stats'), []);

  const { data: templates } =
    useApi(() => api.get('/api/engineer/templates'), []);

  // ── Derived: client-side type + status filter ───────────────────────────────
  const filtered = useMemo(() => {
    if (!projects) return [];
    return projects.filter(p =>
      (typeFilter === 'all' || p.project_type === typeFilter) &&
      (statusFilter === 'all' || p.status === statusFilter)
    );
  }, [projects, typeFilter, statusFilter]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleCreate = async (data) => {
    await api.post('/api/engineer', data);
    refetch();
    refetchStats();
  };

  const handleEdit = async (data) => {
    await api.patch(`/api/engineer/${editingProject.id}`, data);
    refetch();
    refetchStats();
  };

  const openCreate = () => { setEditingProject(null); setIsCreateOpen(true); };
  const openEdit = (project) => { setEditingProject(project); setIsCreateOpen(true); };
  const closeModal = () => { setIsCreateOpen(false); setEditingProject(null); };
  const openDetail = (project) => navigate(`/engineer/${project.id}`);

  const confirmDelete = async () => {
    if (!deletingProject) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/api/engineer/${deletingProject.id}`);
      setDeletingProject(null);
      refetch();
      refetchStats();
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── DataTable column contract (§5.4) ─────────────────────────────────────────
  const columns = [
    { key: 'name',       header: 'Project',   sortable: true, render: TitleCell },
    { key: 'project_type', header: 'Type',                    render: TypeCell },
    { key: 'platforms',  header: 'Platforms',                 render: PlatformsCell },
    { key: 'status',     header: 'Status',    sortable: true, render: StatusCell },
    { key: 'updated_at', header: 'Updated',   sortable: true, render: UpdatedCell },
    {
      key: 'actions', header: '', align: 'right',
      render: (row) => ActionsCell(row, openDetail, openEdit, (r) => setDeletingProject(r)),
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">

      {/* PAGE HEADER */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-gray-50 tracking-[-0.02em]">
            Engineering Projects
          </h1>
          <p className="text-sm text-stone-500 dark:text-gray-400 mt-1">
            IoT, embedded, and robotics builds — from idea to deployed.
          </p>
        </div>
        <Button variant="primary" size="md" onClick={openCreate}>
          <Plus size={16} />
          New Project
        </Button>
      </div>

      {/* SUMMARY STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total" value={statsLoading ? '—' : stats?.total ?? 0} icon={Wrench} />
        <StatCard label="Active" value={statsLoading ? '—' : stats?.active ?? 0} icon={Hammer} />
        <StatCard label="Deployed" value={statsLoading ? '—' : stats?.deployed ?? 0} icon={Rocket} />
        <StatCard label="Ideas" value={statsLoading ? '—' : stats?.idea ?? 0} icon={Lightbulb} />
      </div>

      {/* FILTER PILLS */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {TYPE_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150
                ${typeFilter === f.value
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

      {/* MAIN TABLE — four-state switch (§7) */}
      <Card>
        <CardHeader
          title="All Projects"
          subtitle={filtered.length > 0 ? `${filtered.length} shown` : undefined}
        />
        <CardBody className="p-0">
          {loading && <ListSkeleton rows={5} />}
          {error && !loading && <ErrorState message={error} onRetry={refetch} />}
          {!loading && !error && filtered.length === 0 && (
            <EmptyState
              icon={Wrench}
              title={projects?.length ? 'No projects match these filters' : 'No projects yet'}
              message={
                projects?.length
                  ? 'Try clearing the type or status filter.'
                  : 'Create your first engineering project — optionally from a template.'
              }
              action={
                !projects?.length && (
                  <Button variant="primary" size="sm" onClick={openCreate}>
                    <Plus size={14} />
                    New Project
                  </Button>
                )
              }
            />
          )}
          {!loading && !error && filtered.length > 0 && (
            <DataTable columns={columns} items={filtered} initialSortKey="updated_at" />
          )}
        </CardBody>
      </Card>

      {/* CREATE / EDIT MODAL */}
      <CreateProjectModal
        isOpen={isCreateOpen}
        onClose={closeModal}
        onSubmit={editingProject ? handleEdit : handleCreate}
        project={editingProject}
        templates={templates ?? []}
      />

      {/* DELETE CONFIRMATION */}
      <Modal
        isOpen={!!deletingProject}
        onClose={() => setDeletingProject(null)}
        title="Delete Project"
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="md" onClick={() => setDeletingProject(null)} disabled={deleteLoading}>
              Cancel
            </Button>
            <Button variant="danger" size="md" onClick={confirmDelete} disabled={deleteLoading}>
              {deleteLoading ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-stone-600 dark:text-gray-400">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-stone-900 dark:text-gray-50">
            "{deletingProject?.name}"
          </span>
          ? This also deletes its documents, check-ins, and issues. This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
