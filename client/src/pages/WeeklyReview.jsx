// client/src/pages/WeeklyReview.jsx
// Reflection & Growth (Roadmap Wave 5). Auto-generated summary of everything
// accomplished in a given week, across every module. Defaults to the current
// Monday→Sunday week; left/right arrows step between weeks. Pulls GET
// /api/review/weekly and GET /api/time/summary for the same range.

import { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, CheckSquare, DollarSign, BookOpen,
  GraduationCap, BookMarked, Bug, Clock, Calendar,
} from 'lucide-react';

import api from '../lib/api';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { formatIdr } from '../lib/formatIdr';

import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { Button } from '../components/ui/Button';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';

// Friendly labels for time-summary rows (entity_type → label).
const TIME_TYPE_LABELS = {
  todo: 'To-Dos',
  research_entry: 'Research',
  learning_item: 'Learning',
  engineer_project: 'Engineering',
  book: 'Reading',
};

/** Local YYYY-MM-DD (avoids the UTC off-by-one toISOString would introduce). */
function toLocalISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Monday (start) and Sunday (end) of the week containing `ref`. */
function weekBounds(ref) {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  const monday = new Date(d);
  monday.setDate(d.getDate() - dow);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: toLocalISO(monday), to: toLocalISO(sunday) };
}

function formatRange(from, to) {
  const f = new Date(`${from}T00:00:00`);
  const t = new Date(`${to}T00:00:00`);
  const opts = { month: 'short', day: 'numeric' };
  const sameYear = f.getFullYear() === t.getFullYear();
  return `${f.toLocaleDateString('en-US', opts)} – ${t.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}${sameYear ? '' : ''}`;
}

function formatHours(h) {
  return `${h}h`;
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(8)].map((_, i) => (
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

export default function WeeklyReview() {
  useDocumentTitle('Weekly Review');

  // `anchor` is any date inside the displayed week; navigation shifts it ±7 days.
  const [anchor, setAnchor] = useState(() => new Date());
  const { from, to } = weekBounds(anchor);

  const [review, setReview] = useState(null);
  const [timeSummary, setTimeSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchReview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reviewRes, timeRes] = await Promise.all([
        api.get(`/api/review/weekly?from=${from}&to=${to}`),
        api.get(`/api/time/summary?from=${from}&to=${to}`),
      ]);
      setReview(reviewRes.data);
      setTimeSummary(timeRes.data?.summary ?? []);
    } catch (err) {
      setError(err.message || 'Failed to load weekly review');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  /* Fetch on mount / week change — intentional setState-in-effect (data load) */
  /* eslint-disable-next-line react-hooks/set-state-in-effect */
  useEffect(() => { fetchReview(); }, [fetchReview]);

  const shiftWeek = (deltaDays) => {
    setAnchor(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + deltaDays);
      return d;
    });
  };

  const isCurrentWeek = weekBounds(new Date()).from === from;

  // Are there any accomplishments at all this week?
  const hasActivity = review && (
    review.tasks.completed > 0 ||
    review.finance.income > 0 || review.finance.expense > 0 ||
    review.research.entries_created > 0 ||
    review.learning.hours_spent > 0 || review.learning.in_progress > 0 ||
    review.reading.books_finished > 0 ||
    review.time.sessions > 0 ||
    review.engineering.issues_resolved > 0
  );

  const totalTimeSeconds = timeSummary.reduce((acc, r) => acc + r.total_seconds, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">

      {/* HEADER + WEEK NAV */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-gray-50 tracking-[-0.02em]">Weekly Review</h1>
          <p className="text-sm text-stone-500 dark:text-gray-400 mt-1 flex items-center gap-1.5">
            <Calendar size={14} />
            Week of {formatRange(from, to)}{isCurrentWeek && <span className="text-moss-600 dark:text-moss-400 font-medium">· This week</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => shiftWeek(-7)} aria-label="Previous week">
            <ChevronLeft size={16} />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setAnchor(new Date())} disabled={isCurrentWeek}>
            Today
          </Button>
          <Button variant="secondary" size="sm" onClick={() => shiftWeek(7)} disabled={isCurrentWeek} aria-label="Next week">
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      {/* ERROR */}
      {error && !loading && (
        <Card><CardBody><ErrorState message={error} onRetry={fetchReview} /></CardBody></Card>
      )}

      {/* STAT CARDS */}
      {!error && (loading || !review ? (
        <StatsSkeleton />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Tasks Done"     value={review.tasks.completed}            icon={CheckSquare} />
          <StatCard label="Net Finance"    value={formatIdr(review.finance.net)}     icon={DollarSign}
            subtitle={`+${formatIdr(review.finance.income)} / −${formatIdr(review.finance.expense)}`}
            delta={review.finance.net >= 0 ? 0 : -1} />
          <StatCard label="Research"       value={review.research.entries_created}   icon={BookOpen} subtitle="entries created" />
          <StatCard label="Learning"       value={formatHours(review.learning.hours_spent)} icon={GraduationCap}
            subtitle={`${review.learning.in_progress} items active`} />
          <StatCard label="Books Finished" value={review.reading.books_finished}     icon={BookMarked} />
          <StatCard label="Issues Resolved" value={review.engineering.issues_resolved} icon={Bug} />
          <StatCard label="Time Logged"    value={formatHours(review.time.total_hours)} icon={Clock}
            subtitle={`${review.time.sessions} session${review.time.sessions === 1 ? '' : 's'}`} />
        </div>
      ))}

      {/* TIME BREAKDOWN */}
      {!error && !loading && review && (
        <Card>
          <CardHeader title="Time Breakdown" subtitle="Where your tracked hours went this week" />
          <CardBody>
            {timeSummary.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="No time tracked this week"
                message="Start a timer from any Book, Research entry, or Project to see your hours here."
              />
            ) : (
              <div className="space-y-3">
                {timeSummary.map((row) => {
                  const pct = totalTimeSeconds > 0 ? Math.round((row.total_seconds / totalTimeSeconds) * 100) : 0;
                  const hours = Math.round((row.total_seconds / 3600) * 10) / 10;
                  return (
                    <div key={row.entity_type}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-stone-700 dark:text-gray-300 font-medium">
                          {TIME_TYPE_LABELS[row.entity_type] ?? row.entity_type}
                        </span>
                        <span className="text-stone-500 dark:text-gray-400 tabular-nums">
                          {hours}h · {row.session_count} session{row.session_count === 1 ? '' : 's'}
                          {row.active_timers > 0 && <span className="text-ember-500 ml-1">· running</span>}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-stone-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-moss-500 to-ember-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* EMPTY (no activity at all) */}
      {!error && !loading && review && !hasActivity && (
        <Card>
          <CardBody>
            <EmptyState
              icon={Calendar}
              title="A quiet week"
              message="Nothing was logged across your modules this week. Complete a task, log some time, or finish a book — it'll show up here."
            />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
