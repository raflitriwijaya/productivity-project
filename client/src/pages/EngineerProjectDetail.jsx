// client/src/pages/EngineerProjectDetail.jsx
// Project detail at /engineer/:id. A header with status/type badges and repo link,
// then tabbed sections (Overview, Documents, Check-ins, Issues). The nested tabs
// show a compact embedded list with a "Manage" link to the dedicated scoped page.

import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, FileText, ClipboardCheck, Bug, ExternalLink, Layers, Cpu, Wallet, Plus,
} from 'lucide-react';

import api from '../lib/api';
import { useApi } from '../hooks/useApi';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { formatIdr } from '../lib/formatIdr';

import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ListSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { LinkedItems } from '../components/shared/LinkedItems';
import { LinkPickerModal } from '../components/shared/LinkPickerModal';
import { Timer } from '../components/shared/Timer';

import {
  TYPE_VARIANT, TYPE_LABEL, STATUS_VARIANT, STATUS_LABEL, splitTags, RepoLink,
} from '../components/engineer/ProjectRow';
import {
  SEVERITY_VARIANT, SEVERITY_LABEL, STATUS_VARIANT as ISSUE_STATUS_VARIANT,
  STATUS_LABEL as ISSUE_STATUS_LABEL,
} from '../components/engineer/IssueRow';

const TABS = [
  { key: 'overview',  label: 'Overview',  icon: Layers },
  { key: 'documents', label: 'Documents', icon: FileText },
  { key: 'checkins',  label: 'Check-ins', icon: ClipboardCheck },
  { key: 'issues',    label: 'Issues',    icon: Bug },
  { key: 'budget',    label: 'Budget',    icon: Wallet },
];

/** Spend ratio → tone for the Budget vs Actual bars. */
function budgetTone(spent, amount) {
  if (amount <= 0) return { bar: 'bg-stone-400', text: 'text-stone-500 dark:text-gray-400' };
  const ratio = spent / amount;
  if (ratio >= 1)   return { bar: 'bg-red-500',   text: 'text-red-600 dark:text-red-400' };
  if (ratio >= 0.8) return { bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' };
  return { bar: 'bg-moss-500', text: 'text-moss-600 dark:text-moss-400' };
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** A labelled chip row (platforms / stack) rendered as gray badges. */
function TagRow({ icon: Icon, label, value }) {
  const items = splitTags(value);
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon size={13} className="text-stone-400 dark:text-gray-500" />
        <p className="text-[10px] font-semibold text-stone-400 dark:text-gray-500 tracking-widest uppercase">
          {label}
        </p>
      </div>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map(i => <Badge key={i} variant="gray">{i}</Badge>)}
        </div>
      ) : (
        <p className="text-sm text-stone-400 dark:text-gray-500">—</p>
      )}
    </div>
  );
}

export default function EngineerProjectDetail() {
  useDocumentTitle('Engineering — Project');
  const { id } = useParams();
  const [tab, setTab] = useState('overview');

  // ── Data fetching ───────────────────────────────────────────────────────────
  const { data: project, loading, error, refetch } =
    useApi(() => api.get(`/api/engineer/${id}`), [id]);

  // Nested resources load lazily by tab — but useApi runs on mount; these are
  // cheap list reads scoped to the project, so we fetch them up front and show
  // counts in the tab labels.
  const { data: docs } = useApi(() => api.get(`/api/engineer/projects/${id}/documents`), [id]);
  const { data: checkins } = useApi(() => api.get(`/api/engineer/projects/${id}/checkins`), [id]);
  const { data: issues } = useApi(() => api.get(`/api/engineer/projects/${id}/issues`), [id]);
  const { data: budget, refetch: refetchBudget } = useApi(() => api.get(`/api/engineer/projects/${id}/budget`), [id]);

  const [showBudgetLink, setShowBudgetLink] = useState(false);

  const counts = useMemo(() => ({
    documents: docs?.length ?? 0,
    checkins:  checkins?.length ?? 0,
    issues:    issues?.length ?? 0,
    budget:    budget?.budgets?.length ?? 0,
  }), [docs, checkins, issues, budget]);

  // ── Loading / error gate for the whole page ──────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        <Card><CardBody className="p-0"><ListSkeleton rows={6} /></CardBody></Card>
      </div>
    );
  }
  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        <Card><CardBody className="p-0"><ErrorState message={error} onRetry={refetch} /></CardBody></Card>
      </div>
    );
  }
  if (!project) return null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">

      {/* BACK + HEADER */}
      <div>
        <Link
          to="/engineer"
          className="inline-flex items-center gap-1.5 text-sm text-stone-500 dark:text-gray-400 hover:text-stone-700 dark:hover:text-gray-200 transition-colors duration-150 mb-3"
        >
          <ArrowLeft size={15} />
          All projects
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-stone-900 dark:text-gray-50 tracking-[-0.02em] truncate">
              {project.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge variant={TYPE_VARIANT[project.project_type] ?? 'gray'}>
                {TYPE_LABEL[project.project_type] ?? project.project_type}
              </Badge>
              <Badge variant={STATUS_VARIANT[project.status] ?? 'gray'}>
                {STATUS_LABEL[project.status] ?? project.status}
              </Badge>
              <span className="text-[11px] text-stone-400 dark:text-gray-500">
                Updated {formatDate(project.updated_at)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="flex items-center gap-2 flex-wrap border-b border-stone-200 dark:border-gray-700 pb-px">
        {TABS.map(({ key, label, icon: Icon }) => {
          const isActive = tab === key;
          const count = counts[key];
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-t-lg text-sm font-medium transition-colors duration-150 border-b-2 -mb-px
                ${isActive
                  ? 'border-moss-500 dark:border-moss-400 text-moss-700 dark:text-moss-400'
                  : 'border-transparent text-stone-500 dark:text-gray-400 hover:text-stone-700 dark:hover:text-gray-200'}`}
            >
              <Icon size={15} />
              {label}
              {key !== 'overview' && (
                <span className="text-[11px] text-stone-400 dark:text-gray-500">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB: OVERVIEW */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <Card>
            <CardHeader title="Description" />
            <CardBody className="pt-0">
              {project.description
                ? <p className="text-sm text-stone-700 dark:text-gray-300 whitespace-pre-wrap">{project.description}</p>
                : <p className="text-sm text-stone-400 dark:text-gray-500">No description yet.</p>}
            </CardBody>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardBody className="space-y-5">
                <TagRow icon={Cpu} label="Platforms" value={project.platforms} />
                <TagRow icon={Layers} label="Stack" value={project.stack} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Repository" />
              <CardBody className="pt-0">
                <RepoLink url={project.repo_url} />
              </CardBody>
            </Card>
          </div>

          {/* TIME TRACKING (Roadmap Wave 5) */}
          <Card>
            <CardHeader title="Time Tracking" />
            <CardBody className="pt-0">
              <Timer entityType="engineer_project" entityId={project.id} />
            </CardBody>
          </Card>

          {/* UNIVERSAL LINKS (Roadmap Wave 1) */}
          <Card>
            <CardHeader title="Linked Items" />
            <CardBody className="pt-0">
              <LinkedItems entityType="engineer_project" entityId={project.id} />
            </CardBody>
          </Card>
        </div>
      )}

      {/* TAB: DOCUMENTS */}
      {tab === 'documents' && (
        <Card>
          <CardHeader
            title="Documents"
            subtitle={counts.documents > 0 ? `${counts.documents} total` : undefined}
            action={
              <Link to={`/engineer/docs?project=${id}`}>
                <Button variant="secondary" size="sm">
                  <ExternalLink size={14} /> Manage
                </Button>
              </Link>
            }
          />
          <CardBody className="p-0">
            {(!docs || docs.length === 0) ? (
              <EmptyState
                icon={FileText}
                title="No documents"
                message="Add design notes, runbooks, and references for this project."
                action={
                  <Link to={`/engineer/docs?project=${id}`}>
                    <Button variant="primary" size="sm">Open Docs</Button>
                  </Link>
                }
              />
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-gray-700">
                {docs.map(doc => (
                  <Link
                    key={doc.id}
                    to={`/engineer/docs?project=${id}`}
                    className="flex items-center justify-between px-6 py-4 hover:bg-moss-50/30 dark:hover:bg-moss-950/20 transition-colors duration-100"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-stone-900 dark:text-gray-50 truncate">{doc.title}</p>
                      <p className="text-[11px] text-stone-400 dark:text-gray-500 mt-0.5">
                        Updated {formatDate(doc.updated_at)}
                      </p>
                    </div>
                    {doc.doc_type && <Badge variant="gray">{doc.doc_type}</Badge>}
                  </Link>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* TAB: CHECK-INS */}
      {tab === 'checkins' && (
        <Card>
          <CardHeader
            title="Check-ins"
            subtitle={counts.checkins > 0 ? `${counts.checkins} logged` : undefined}
            action={
              <Link to={`/engineer/checkins?project=${id}`}>
                <Button variant="secondary" size="sm">
                  <ExternalLink size={14} /> Manage
                </Button>
              </Link>
            }
          />
          <CardBody className="p-0">
            {(!checkins || checkins.length === 0) ? (
              <EmptyState
                icon={ClipboardCheck}
                title="No check-ins"
                message="Log weekly progress, plans, and blockers."
                action={
                  <Link to={`/engineer/checkins?project=${id}`}>
                    <Button variant="primary" size="sm">Open Check-ins</Button>
                  </Link>
                }
              />
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-gray-700">
                {checkins.map(c => {
                  const blocked = !!(c.blockers && c.blockers.trim());
                  return (
                    <div key={c.id} className="flex items-center gap-3 px-6 py-4">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${blocked ? 'bg-red-500 dark:bg-red-400' : 'bg-moss-500 dark:bg-moss-400'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-stone-900 dark:text-gray-50">
                          Week of {formatDate(c.week_start)}
                        </p>
                        <p className="text-xs text-stone-500 dark:text-gray-400 truncate">
                          {c.achievements?.trim() || 'No achievements logged'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* TAB: ISSUES */}
      {tab === 'issues' && (
        <Card>
          <CardHeader
            title="Issues"
            subtitle={counts.issues > 0 ? `${counts.issues} total` : undefined}
            action={
              <Link to={`/engineer/issues?project=${id}`}>
                <Button variant="secondary" size="sm">
                  <ExternalLink size={14} /> Manage
                </Button>
              </Link>
            }
          />
          <CardBody className="p-0">
            {(!issues || issues.length === 0) ? (
              <EmptyState
                icon={Bug}
                title="No issues"
                message="Track bugs and tasks, triaged by severity."
                action={
                  <Link to={`/engineer/issues?project=${id}`}>
                    <Button variant="primary" size="sm">Open Issues</Button>
                  </Link>
                }
              />
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-gray-700">
                {issues.map(issue => (
                  <Link
                    key={issue.id}
                    to={`/engineer/issues?project=${id}`}
                    className="flex items-center justify-between gap-3 px-6 py-4 hover:bg-moss-50/30 dark:hover:bg-moss-950/20 transition-colors duration-100"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-stone-900 dark:text-gray-50 truncate">{issue.title}</p>
                      {issue.component && (
                        <p className="text-[11px] text-stone-400 dark:text-gray-500 mt-0.5">{issue.component}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Badge variant={SEVERITY_VARIANT[issue.severity] ?? 'gray'}>
                        {SEVERITY_LABEL[issue.severity] ?? issue.severity}
                      </Badge>
                      <Badge variant={ISSUE_STATUS_VARIANT[issue.status] ?? 'gray'}>
                        {ISSUE_STATUS_LABEL[issue.status] ?? issue.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* TAB: BUDGET (Roadmap Wave 4 — Budget vs Actual) */}
      {tab === 'budget' && (
        <Card>
          <CardHeader
            title="Budget vs Actual"
            subtitle={budget?.budgets?.length ? `${budget.budgets.length} linked budget${budget.budgets.length === 1 ? '' : 's'}` : undefined}
            action={
              <Button variant="secondary" size="sm" onClick={() => setShowBudgetLink(true)}>
                <Plus size={14} /> Link Budget
              </Button>
            }
          />
          <CardBody className="pt-0">
            {(!budget || budget.budgets.length === 0) ? (
              <EmptyState
                icon={Wallet}
                title="No budgets linked"
                message="Link a Finance budget to track this project's spend against plan."
                action={
                  <Button variant="primary" size="sm" onClick={() => setShowBudgetLink(true)}>
                    <Plus size={14} /> Link Budget
                  </Button>
                }
              />
            ) : (
              <div className="space-y-5">
                {/* Totals */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 rounded-lg bg-stone-50 dark:bg-gray-700/40">
                    <p className="text-xs text-stone-500 dark:text-gray-400 mb-1">Budget</p>
                    <p className="text-sm font-bold text-stone-900 dark:text-gray-50 truncate">{formatIdr(budget.total_budget)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-stone-50 dark:bg-gray-700/40">
                    <p className="text-xs text-stone-500 dark:text-gray-400 mb-1">Spent (this month)</p>
                    <p className="text-sm font-bold text-stone-900 dark:text-gray-50 truncate">{formatIdr(budget.total_spent)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-stone-50 dark:bg-gray-700/40">
                    <p className="text-xs text-stone-500 dark:text-gray-400 mb-1">Remaining</p>
                    <p className={`text-sm font-bold truncate ${budget.total_budget - budget.total_spent < 0 ? 'text-red-600 dark:text-red-400' : 'text-moss-600 dark:text-moss-400'}`}>
                      {formatIdr(budget.total_budget - budget.total_spent)}
                    </p>
                  </div>
                </div>

                {/* Per-budget bars */}
                <div className="space-y-4">
                  {budget.budgets.map((b) => {
                    const pct = b.budget_amount > 0 ? Math.min(100, Math.round((b.spent / b.budget_amount) * 100)) : 0;
                    const tone = budgetTone(b.spent, b.budget_amount);
                    return (
                      <div key={b.budget_id}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium text-stone-800 dark:text-gray-200">{b.category_name}</span>
                          <span className={`text-xs font-medium tabular-nums ${tone.text}`}>
                            {formatIdr(b.spent)} / {formatIdr(b.budget_amount)}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-stone-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-[11px] text-stone-400 dark:text-gray-500">{pct}% used</span>
                          <span className={`text-[11px] ${b.remaining < 0 ? 'text-red-500 dark:text-red-400' : 'text-stone-400 dark:text-gray-500'}`}>
                            {b.remaining < 0 ? `${formatIdr(Math.abs(b.remaining))} over` : `${formatIdr(b.remaining)} left`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Budget link picker (constrained to the Budgets module) */}
      {showBudgetLink && (
        <LinkPickerModal
          isOpen={showBudgetLink}
          onClose={() => setShowBudgetLink(false)}
          entityType="engineer_project"
          entityId={project.id}
          lockedType="budget"
          onLinked={() => { setShowBudgetLink(false); refetchBudget(); }}
        />
      )}
    </div>
  );
}
