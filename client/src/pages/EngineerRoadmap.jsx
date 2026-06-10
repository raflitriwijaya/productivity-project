// client/src/pages/EngineerRoadmap.jsx
// 12-month engineering skills roadmap. An overall progress bar sits at the top,
// followed by a grid of month cards, each with a category-grouped checklist.
// Toggling a skill PATCHes /roadmap/skills/:id and refetches.

import { useState, useMemo } from 'react';
import { Map as MapIcon } from 'lucide-react';

import api from '../lib/api';
import { useApi } from '../hooks/useApi';
import { useToast } from '../hooks/useToast';
import useDocumentTitle from '../hooks/useDocumentTitle';

import { Card, CardBody } from '../components/ui/Card';
import { ListSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';

import { RoadmapMonthCard } from '../components/engineer/RoadmapMonthCard';
import { MiniProgressBar } from '../components/engineer/MiniProgressBar';

export default function EngineerRoadmap() {
  useDocumentTitle('Engineering — Roadmap');
  const { addToast } = useToast();
  const [togglingId, setTogglingId] = useState(null);

  // ── Data fetching ───────────────────────────────────────────────────────────
  const { data: months, loading, error, refetch } =
    useApi(() => api.get('/api/engineer/roadmap'), []);

  // ── Derived: overall completion across all skills ───────────────────────────
  const overall = useMemo(() => {
    if (!months) return { done: 0, total: 0, pct: 0 };
    let done = 0, total = 0;
    for (const m of months) {
      for (const s of (m.skills ?? [])) {
        total += 1;
        if (s.completed) done += 1;
      }
    }
    return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  }, [months]);

  // ── Handler: toggle a single skill ───────────────────────────────────────────
  const handleToggle = async (skill) => {
    setTogglingId(skill.id);
    try {
      await api.patch(`/api/engineer/roadmap/skills/${skill.id}`, { completed: !skill.completed });
      await refetch();
    } catch (err) {
      addToast({ type: 'error', title: 'Could not update', message: err.message });
    } finally {
      setTogglingId(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">

      {/* PAGE HEADER */}
      <div>
        <h1 className="text-2xl font-bold text-stone-900 dark:text-gray-50 tracking-[-0.02em]">
          Engineering Roadmap
        </h1>
        <p className="text-sm text-stone-500 dark:text-gray-400 mt-1">
          A 12-month path from bench fundamentals to field-ready systems.
        </p>
      </div>

      {/* OVERALL PROGRESS */}
      {!loading && !error && months && months.length > 0 && (
        <Card>
          <CardBody>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-stone-500 dark:text-gray-400 tracking-wide uppercase">
                Overall progress
              </p>
              <p className="text-sm font-semibold text-stone-900 dark:text-gray-50">
                {overall.done}/{overall.total} · {overall.pct}%
              </p>
            </div>
            <MiniProgressBar percent={overall.pct} />
          </CardBody>
        </Card>
      )}

      {/* CONTENT — four-state switch (§7) */}
      {loading && (
        <Card><CardBody className="p-0"><ListSkeleton rows={6} /></CardBody></Card>
      )}
      {error && !loading && (
        <Card><CardBody className="p-0"><ErrorState message={error} onRetry={refetch} /></CardBody></Card>
      )}
      {!loading && !error && (!months || months.length === 0) && (
        <Card>
          <CardBody className="p-0">
            <EmptyState
              icon={MapIcon}
              title="Roadmap not available"
              message="The roadmap could not be loaded. Try again."
            />
          </CardBody>
        </Card>
      )}
      {!loading && !error && months && months.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {months.map(month => (
            <RoadmapMonthCard
              key={month.id}
              month={month}
              onToggleSkill={handleToggle}
              togglingId={togglingId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
