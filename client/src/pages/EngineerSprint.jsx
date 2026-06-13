// client/src/pages/EngineerSprint.jsx → route /engineer/sprint
// Consolidated Sprint Board (V6 §13.2). One screen that replaces hopping between
// Projects / Issues / Check-ins / Roadmap when planning a sprint: active projects
// with their open-critical count, the P0/P1 queue, this week's check-in, and the
// next roadmap skills. Additive — every detail page stays reachable. Reads the
// single GET /api/engineer/sprint payload and follows the four-state pattern.

import { useNavigate, Link } from 'react-router-dom';
import {
  Zap, Hammer, Rocket, Archive, Bug, ClipboardCheck, Map, Plus, Code, Wrench,
} from 'lucide-react';

import api from '../lib/api';
import { useApi } from '../hooks/useApi';
import useDocumentTitle from '../hooks/useDocumentTitle';

import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';

import {
  TYPE_VARIANT, TYPE_LABEL,
  STATUS_VARIANT as PROJECT_STATUS_VARIANT, STATUS_LABEL as PROJECT_STATUS_LABEL,
} from '../components/engineer/ProjectRow';
import { SEVERITY_VARIANT, SEVERITY_LABEL } from '../components/engineer/IssueRow';

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

// ─── Loading skeleton (matches the board layout, never a spinner — §10) ────────
function StatCardSkeleton() {
  return (
    <Card>
      <CardBody>
        <div className="h-3 w-20 rounded bg-stone-200 dark:bg-gray-700 animate-pulse mb-3" />
        <div className="h-7 w-12 rounded bg-stone-200 dark:bg-gray-700 animate-pulse" />
      </CardBody>
    </Card>
  );
}

function SprintSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card><CardBody><div className="space-y-3">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-12 rounded-lg bg-stone-100 dark:bg-gray-700/50 animate-pulse" />
            ))}
          </div></CardBody></Card>
        </div>
        <div className="space-y-6">
          <Card><CardBody><div className="h-32 rounded-lg bg-stone-100 dark:bg-gray-700/50 animate-pulse" /></CardBody></Card>
        </div>
      </div>
    </>
  );
}

// ─── Active project card ───────────────────────────────────────────────────────
function ProjectCard({ project, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(project.id)}
      className="w-full flex items-center justify-between gap-3 p-3 rounded-lg border border-stone-200 dark:border-gray-700
        bg-white dark:bg-gray-800 hover:bg-stone-50 dark:hover:bg-gray-700/50 transition-colors duration-150 text-left"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-stone-900 dark:text-gray-50 truncate">{project.name}</p>
        <p className="text-[11px] text-stone-400 dark:text-gray-500 mt-0.5">
          Updated {fmtDate(project.updated_at)}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {project.open_issues > 0 && (
          <Badge variant="red">{project.open_issues} P0/P1</Badge>
        )}
        <Badge variant={TYPE_VARIANT[project.project_type] ?? 'gray'}>
          {TYPE_LABEL[project.project_type] ?? project.project_type}
        </Badge>
        <Badge variant={PROJECT_STATUS_VARIANT[project.status] ?? 'gray'}>
          {PROJECT_STATUS_LABEL[project.status] ?? project.status}
        </Badge>
      </div>
    </button>
  );
}

// ─── Critical issue row ────────────────────────────────────────────────────────
function IssueRow({ issue, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(issue.project_id)}
      className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-stone-50 dark:hover:bg-gray-700/50 transition-colors duration-150 text-left"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-stone-900 dark:text-gray-50 truncate">{issue.title}</p>
        <p className="text-[11px] text-stone-400 dark:text-gray-500 mt-0.5 truncate">
          {issue.project_name}{issue.component ? ` · ${issue.component}` : ''}
        </p>
      </div>
      <Badge variant={SEVERITY_VARIANT[issue.severity] ?? 'gray'} className="flex-shrink-0">
        {SEVERITY_LABEL[issue.severity] ?? issue.severity}
      </Badge>
    </button>
  );
}

export default function EngineerSprint() {
  useDocumentTitle('Engineering — Sprint Board');
  const navigate = useNavigate();

  const { data, loading, error, refetch } = useApi(() => api.get('/api/engineer/sprint'), []);

  const openProject = (id) => navigate(`/engineer/${id}`);
  const openIssues  = (projectId) => navigate(`/engineer/issues?project=${projectId}`);

  const stats           = data?.stats;
  const projects        = data?.projects ?? [];
  const criticalIssues  = data?.critical_issues ?? [];
  const checkin         = data?.checkin ?? null;
  const roadmapMonths   = data?.roadmap_months ?? [];

  const isEmpty = !loading && !error && data &&
    projects.length === 0 && criticalIssues.length === 0 && !checkin && roadmapMonths.length === 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">

      {/* HEADER */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-gray-50 tracking-[-0.02em]">
            Sprint Board
          </h1>
          <p className="text-sm text-stone-500 dark:text-gray-400 mt-1">
            What you&rsquo;re building now, what&rsquo;s blocking you, and what&rsquo;s next — on one screen.
          </p>
        </div>
        <Button variant="primary" size="md" onClick={() => navigate('/engineer')}>
          <Wrench size={16} />
          <span className="hidden sm:inline">Projects</span>
        </Button>
      </div>

      {/* ERROR — replaces the body (every section needs the payload) */}
      {error && !loading && (
        <Card><CardBody><ErrorState message={error} onRetry={refetch} /></CardBody></Card>
      )}

      {/* LOADING */}
      {!error && loading && <SprintSkeleton />}

      {/* EMPTY — nothing active anywhere */}
      {isEmpty && (
        <Card>
          <CardBody>
            <EmptyState
              icon={Zap}
              title="No active sprint"
              message="No active projects yet. Start one from the Projects page to populate your board."
              action={
                <Button variant="primary" size="sm" onClick={() => navigate('/engineer')}>
                  <Plus size={14} />
                  New Project
                </Button>
              }
            />
          </CardBody>
        </Card>
      )}

      {/* DATA */}
      {!error && !loading && data && !isEmpty && (
        <>
          {/* STAT BAR */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Active Projects" value={stats.active} icon={Hammer} />
            <StatCard label="Deployed" value={stats.deployed} icon={Rocket} />
            <StatCard label="Archived" value={stats.archived} icon={Archive} />
            <StatCard
              label="Open P0/P1"
              value={stats.open_critical}
              icon={Bug}
              subtitle={stats.open_critical > 0 ? 'needs triage' : 'all clear'}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* LEFT (2/3): Active projects + critical issues */}
            <div className="lg:col-span-2 space-y-6">

              <Card>
                <CardHeader
                  title="Active Projects"
                  subtitle={projects.length > 0 ? `${projects.length} in flight` : undefined}
                />
                <CardBody className={projects.length > 0 ? 'space-y-2' : 'p-0'}>
                  {projects.length > 0 ? (
                    projects.map(p => <ProjectCard key={p.id} project={p} onOpen={openProject} />)
                  ) : (
                    <EmptyState
                      icon={Wrench}
                      title="No active projects"
                      message="Projects in planning, development, or testing show up here."
                    />
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardHeader
                  title="Critical Issues"
                  subtitle={criticalIssues.length > 0 ? 'P0 / P1 · open or in progress' : undefined}
                />
                <CardBody className="p-0">
                  {criticalIssues.length > 0 ? (
                    <div className="divide-y divide-stone-100 dark:divide-gray-700">
                      {criticalIssues.map(i => <IssueRow key={i.id} issue={i} onOpen={openIssues} />)}
                    </div>
                  ) : (
                    <EmptyState
                      icon={Bug}
                      title="No critical issues"
                      message="No open P0 or P1 issues. Lower-priority items live in the Issues tracker."
                    />
                  )}
                </CardBody>
              </Card>

            </div>

            {/* RIGHT (1/3): Check-in + roadmap + quick actions */}
            <div className="space-y-6">

              <Card>
                <CardHeader title="This Week's Check-in" />
                <CardBody>
                  {checkin ? (
                    <div className="space-y-3">
                      {checkin.project_name && (
                        <Badge variant="moss">{checkin.project_name}</Badge>
                      )}
                      {checkin.achievements && (
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400 dark:text-gray-500 mb-1">Achievements</p>
                          <p className="text-sm text-stone-700 dark:text-gray-200 whitespace-pre-line line-clamp-4">{checkin.achievements}</p>
                        </div>
                      )}
                      {checkin.blockers && (
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400 dark:text-gray-500 mb-1">Blockers</p>
                          <p className="text-sm text-stone-700 dark:text-gray-200 whitespace-pre-line line-clamp-3">{checkin.blockers}</p>
                        </div>
                      )}
                      {checkin.plans_next && (
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400 dark:text-gray-500 mb-1">Plans Next</p>
                          <p className="text-sm text-stone-700 dark:text-gray-200 whitespace-pre-line line-clamp-3">{checkin.plans_next}</p>
                        </div>
                      )}
                      <Link to="/engineer/checkins" className="inline-block text-xs font-medium text-moss-600 dark:text-moss-400 hover:underline">
                        View all check-ins →
                      </Link>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <ClipboardCheck className="w-8 h-8 mx-auto text-stone-300 dark:text-gray-600 mb-3" />
                      <p className="text-sm text-stone-500 dark:text-gray-400 mb-4">No check-in logged this week.</p>
                      <Button variant="secondary" size="sm" onClick={() => navigate('/engineer/checkins')}>
                        <Plus size={14} />
                        Create check-in
                      </Button>
                    </div>
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Upcoming Skills" subtitle="Next on your roadmap" />
                <CardBody>
                  {roadmapMonths.length > 0 ? (
                    <div className="space-y-4">
                      {roadmapMonths.map(month => (
                        <div key={month.month_number}>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-terracotta-400 mb-1.5">
                            Month {month.month_number} · {month.month_title}
                          </p>
                          <ul className="space-y-1.5">
                            {month.skills.map(skill => (
                              <li key={skill.id} className="flex items-start gap-2 text-sm">
                                <span className={`mt-0.5 flex-shrink-0 ${skill.completed ? 'text-moss-500 dark:text-moss-400' : 'text-stone-300 dark:text-gray-600'}`}>
                                  {skill.completed ? '✓' : '○'}
                                </span>
                                <span className={skill.completed
                                  ? 'text-stone-400 dark:text-gray-500 line-through'
                                  : 'text-stone-700 dark:text-gray-200'}>
                                  {skill.title}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                      <Link to="/engineer/roadmap" className="inline-block text-xs font-medium text-moss-600 dark:text-moss-400 hover:underline">
                        Full roadmap →
                      </Link>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <Map className="w-8 h-8 mx-auto text-stone-300 dark:text-gray-600 mb-3" />
                      <p className="text-sm text-stone-500 dark:text-gray-400">Roadmap complete — every skill is checked off.</p>
                    </div>
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Quick Actions" />
                <CardBody className="grid grid-cols-1 gap-2">
                  <Button variant="secondary" size="md" className="justify-start" onClick={() => navigate('/engineer/issues')}>
                    <Bug size={16} />
                    New Issue
                  </Button>
                  <Button variant="secondary" size="md" className="justify-start" onClick={() => navigate('/engineer/checkins')}>
                    <ClipboardCheck size={16} />
                    New Check-in
                  </Button>
                  <Button variant="secondary" size="md" className="justify-start" onClick={() => navigate('/engineer/snippets')}>
                    <Code size={16} />
                    New Snippet
                  </Button>
                </CardBody>
              </Card>

            </div>
          </div>
        </>
      )}
    </div>
  );
}
