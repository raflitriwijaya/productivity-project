// client/src/pages/Goals.jsx
// Goals/OKRs (Roadmap Wave 5). "Tools for becoming." Set cross-module goals with
// auto-calculable progress (from linked entities). Stat cards, priority/status
// filter pills, a responsive grid of goal cards, and create/edit/detail modals.

import { useState, useEffect, useCallback } from 'react';
import { Plus, Target, CheckCircle2, Flag, TrendingUp } from 'lucide-react';

import api from '../lib/api';
import useDocumentTitle from '../hooks/useDocumentTitle';

import { Card, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatCard } from '../components/ui/StatCard';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';

import { GoalCard } from '../components/goals/GoalCard';
import { CreateGoalModal } from '../components/goals/CreateGoalModal';
import { GoalDetailModal } from '../components/goals/GoalDetailModal';

const STATUS_TABS = [
  { key: '',          label: 'All' },
  { key: 'active',    label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'paused',    label: 'Paused' },
  { key: 'abandoned', label: 'Abandoned' },
];

const PRIORITY_TABS = [
  { key: '',         label: 'Any priority' },
  { key: 'critical', label: 'Critical' },
  { key: 'high',     label: 'High' },
  { key: 'medium',   label: 'Medium' },
  { key: 'low',      label: 'Low' },
];

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardBody>
            <div className="h-3 w-20 rounded bg-stone-200 dark:bg-gray-700 animate-pulse mb-3" />
            <div className="h-7 w-12 rounded bg-stone-200 dark:bg-gray-700 animate-pulse" />
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-40 rounded-xl bg-stone-100 dark:bg-gray-800 animate-pulse" />
      ))}
    </div>
  );
}

function PillRow({ tabs, active, onChange, activeColor = 'moss' }) {
  const activeCls = activeColor === 'moss'
    ? 'bg-moss-50 dark:bg-moss-950/50 text-moss-700 dark:text-moss-400 border-moss-200 dark:border-moss-800'
    : 'bg-ember-50 dark:bg-ember-950/50 text-ember-700 dark:text-ember-400 border-ember-200 dark:border-ember-800';
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        return (
          <button
            key={tab.key || 'all'}
            onClick={() => onChange(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-moss-500 dark:focus:ring-moss-400 ${
              isActive
                ? activeCls
                : 'bg-white dark:bg-gray-800 text-stone-600 dark:text-gray-400 border-stone-200 dark:border-gray-700 hover:bg-stone-50 dark:hover:bg-gray-700 hover:text-stone-900 dark:hover:text-gray-100'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export default function Goals() {
  useDocumentTitle('Goals');

  const [goals, setGoals]   = useState([]);
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const [activeStatus, setActiveStatus]     = useState('');
  const [activePriority, setActivePriority] = useState('');

  const [showCreate, setShowCreate]       = useState(false);
  const [editGoal, setEditGoal]           = useState(null);
  const [selectedGoal, setSelectedGoal]   = useState(null);

  const fetchGoals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ per_page: '100' });
      if (activeStatus)   params.set('status', activeStatus);
      if (activePriority) params.set('priority', activePriority);

      const [listRes, statsRes] = await Promise.all([
        api.get(`/api/goals?${params.toString()}`),
        api.get('/api/goals/stats'),
      ]);

      setGoals(listRes.data ?? []);
      setStats(statsRes.data);
    } catch (err) {
      setError(err.message || 'Failed to load goals');
    } finally {
      setLoading(false);
    }
  }, [activeStatus, activePriority]);

  /* Fetch on mount / filter change — intentional setState-in-effect (data load) */
  /* eslint-disable-next-line react-hooks/set-state-in-effect */
  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  const handleSaved = () => { setShowCreate(false); setEditGoal(null); fetchGoals(); };
  const openEdit = (goal) => { setSelectedGoal(null); setEditGoal(goal); setShowCreate(true); };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-gray-50 tracking-[-0.02em]">Goals</h1>
          <p className="text-sm text-stone-500 dark:text-gray-400 mt-1">
            What you&rsquo;re working toward — across every discipline.
          </p>
        </div>
        <Button variant="primary" size="md" onClick={() => { setEditGoal(null); setShowCreate(true); }}>
          <Plus size={16} />
          New Goal
        </Button>
      </div>

      {/* STAT CARDS */}
      {loading && !stats ? (
        <StatsSkeleton />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Active"    value={stats?.active ?? 0}    icon={Target} />
          <StatCard label="Completed" value={stats?.completed ?? 0} icon={CheckCircle2} />
          <StatCard label="Critical"  value={stats?.critical ?? 0}  icon={Flag} subtitle="active & critical" />
          <StatCard label="On Track"  value={stats?.on_track ?? 0}   icon={TrendingUp} subtitle="pace ≥ target" />
        </div>
      )}

      {/* FILTERS */}
      <div className="space-y-3">
        <PillRow tabs={STATUS_TABS} active={activeStatus} onChange={setActiveStatus} activeColor="moss" />
        <PillRow tabs={PRIORITY_TABS} active={activePriority} onChange={setActivePriority} activeColor="ember" />
      </div>

      {/* GRID / STATES */}
      {error && goals.length === 0 ? (
        <ErrorState message={error} onRetry={fetchGoals} />
      ) : loading && goals.length === 0 ? (
        <GridSkeleton />
      ) : goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title={activeStatus || activePriority ? 'No goals match these filters' : 'No goals yet'}
          message="Set a goal — read 50 books, ship 12 projects, log 100 hours of deep work. Link entities to it, then auto-track your progress."
          action={<Button variant="primary" size="sm" onClick={() => { setEditGoal(null); setShowCreate(true); }}><Plus size={14} /> New Goal</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {goals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} onClick={() => setSelectedGoal(goal)} />
          ))}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      <CreateGoalModal
        isOpen={showCreate}
        onClose={() => { setShowCreate(false); setEditGoal(null); }}
        onSaved={handleSaved}
        goal={editGoal}
      />

      {/* DETAIL MODAL */}
      {selectedGoal && (
        <GoalDetailModal
          isOpen={!!selectedGoal}
          onClose={() => { setSelectedGoal(null); fetchGoals(); }}
          goal={selectedGoal}
          onEdit={() => openEdit(selectedGoal)}
          onChanged={fetchGoals}
        />
      )}
    </div>
  );
}
