// client/src/pages/LearningRoadmaps.jsx
// Custom Learning Roadmaps — the grid of user-defined learning paths for any
// discipline (replaces the hardcoded 12-month engineer roadmap; that one still
// lives at /engineer/roadmap). Stat cards, category filter pills derived from the
// user's own data, a responsive card grid, and the create modal. All four states.

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Map, PlayCircle, CheckCircle2, ListChecks } from 'lucide-react';

import api from '../lib/api';
import useDocumentTitle from '../hooks/useDocumentTitle';

import { Card, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatCard } from '../components/ui/StatCard';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';

import { RoadmapCard } from '../components/roadmaps/RoadmapCard';
import { CreateRoadmapModal } from '../components/roadmaps/CreateRoadmapModal';

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
        <div key={i} className="h-44 rounded-xl bg-stone-100 dark:bg-gray-800 animate-pulse" />
      ))}
    </div>
  );
}

export default function LearningRoadmaps() {
  useDocumentTitle('Learning Roadmaps');
  const navigate = useNavigate();

  const [roadmaps, setRoadmaps] = useState([]);
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const [activeCategory, setActiveCategory] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listRes, statsRes] = await Promise.all([
        api.get('/api/roadmaps'),
        api.get('/api/roadmaps/stats'),
      ]);
      setRoadmaps(listRes.data ?? []);
      setStats(statsRes.data);
    } catch (err) {
      setError(err.message || 'Failed to load roadmaps');
    } finally {
      setLoading(false);
    }
  }, []);

  /* Fetch on mount — intentional setState-in-effect (data load) */
  /* eslint-disable-next-line react-hooks/set-state-in-effect */
  useEffect(() => { fetchData(); }, [fetchData]);

  // Category filter pills derived from the user's own roadmaps (truly custom-friendly).
  const categories = [...new Set(roadmaps.map((r) => r.category).filter(Boolean))].sort();
  const visible = activeCategory
    ? roadmaps.filter((r) => r.category === activeCategory)
    : roadmaps;

  const handleSaved = () => { setShowCreate(false); fetchData(); };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-gray-50 tracking-[-0.02em]">Learning Roadmaps</h1>
          <p className="text-sm text-stone-500 dark:text-gray-400 mt-1">
            Build a path for anything — ESP32-S3, ROS2, gardening, a car. Track every milestone.
          </p>
        </div>
        <Button variant="primary" size="md" onClick={() => setShowCreate(true)}>
          <Plus size={16} />
          New Roadmap
        </Button>
      </div>

      {/* STAT CARDS */}
      {loading && !stats ? (
        <StatsSkeleton />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Roadmaps"        value={stats?.total ?? 0}            icon={Map} />
          <StatCard label="Active"          value={stats?.active ?? 0}           icon={PlayCircle} />
          <StatCard label="Completed"       value={stats?.completed ?? 0}        icon={CheckCircle2} />
          <StatCard label="Milestones Done" value={stats?.milestones_done ?? 0}  icon={ListChecks} subtitle={`of ${stats?.total_milestones ?? 0}`} />
        </div>
      )}

      {/* CATEGORY FILTER PILLS */}
      {categories.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {[{ key: '', label: 'All' }, ...categories.map((c) => ({ key: c, label: c }))].map((tab) => {
            const isActive = activeCategory === tab.key;
            return (
              <button
                key={tab.key || 'all'}
                onClick={() => setActiveCategory(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border capitalize transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-moss-500 dark:focus:ring-moss-400 ${
                  isActive
                    ? 'bg-moss-50 dark:bg-moss-950/50 text-moss-700 dark:text-moss-400 border-moss-200 dark:border-moss-800'
                    : 'bg-white dark:bg-gray-800 text-stone-600 dark:text-gray-400 border-stone-200 dark:border-gray-700 hover:bg-stone-50 dark:hover:bg-gray-700 hover:text-stone-900 dark:hover:text-gray-100'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* GRID / STATES */}
      {error && roadmaps.length === 0 ? (
        <ErrorState message={error} onRetry={fetchData} />
      ) : loading && roadmaps.length === 0 ? (
        <GridSkeleton />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Map}
          title={activeCategory ? 'No roadmaps in this category' : 'No roadmaps yet'}
          message="Create a learning path for any discipline — add tracks (lanes) and milestones, then check them off as you go."
          action={<Button variant="primary" size="sm" onClick={() => setShowCreate(true)}><Plus size={14} /> New Roadmap</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((roadmap) => (
            <RoadmapCard key={roadmap.id} roadmap={roadmap} onClick={() => navigate(`/roadmaps/${roadmap.id}`)} />
          ))}
        </div>
      )}

      {/* CREATE MODAL */}
      <CreateRoadmapModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSaved={handleSaved}
        roadmap={null}
      />
    </div>
  );
}
