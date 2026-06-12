// client/src/pages/PolymathDashboard.jsx
// Roadmap Wave 6 (Moonshots): the Polymath Dashboard — your growth across years.
// One GET /api/polymath call drives the whole page: a hero band, year-over-year
// stat cards with trend deltas, a year-by-year growth chart, an activity-allocation
// donut, a knowledge-tag cloud, and achievement highlights. All four data states.

import { useMemo } from 'react';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { Sparkles, BookMarked, FileText, Wrench, GraduationCap, Clock } from 'lucide-react';

import api from '../lib/api';
import { useApi } from '../hooks/useApi';

import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { ListSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { DonutChart } from '../components/finance/charts/DonutChart';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Sum a numeric field across an array of rows. */
const sumBy = (rows, key) => (rows ?? []).reduce((acc, r) => acc + (Number(r[key]) || 0), 0);

/** Percentage change of the latest year vs the previous year for a `by_year` series. */
function yoyDelta(rows, key) {
  if (!Array.isArray(rows) || rows.length < 2) return undefined;
  const sorted = [...rows].sort((a, b) => a.year - b.year);
  const latest = Number(sorted[sorted.length - 1][key]) || 0;
  const prev = Number(sorted[sorted.length - 2][key]) || 0;
  if (prev === 0) return latest > 0 ? 100 : undefined;
  return Math.round(((latest - prev) / prev) * 100);
}

const plainCount = (v) => Number(v).toLocaleString('en-US');

// ─── Year-by-year growth bars (dependency-free, like the finance SVG charts) ───
// Renders one labelled bar per year for a single metric. Dynamic bar height uses
// the sanctioned inline-style exception (mirrors MiniProgressBar/ProgressBar).
function GrowthBars({ rows, valueKey, colorClass, formatValue = plainCount }) {
  const data = useMemo(
    () => [...(rows ?? [])].sort((a, b) => a.year - b.year),
    [rows]
  );
  if (data.length === 0) {
    return <p className="text-sm text-stone-400 dark:text-gray-500 text-center py-8">No data yet.</p>;
  }
  const max = Math.max(...data.map(d => Number(d[valueKey]) || 0), 1);
  return (
    <div className="flex items-end justify-around gap-2 h-40 pt-2">
      {data.map(d => {
        const value = Number(d[valueKey]) || 0;
        const pct = Math.max((value / max) * 100, value > 0 ? 4 : 0);
        return (
          <div key={d.year} className="flex flex-col items-center justify-end flex-1 h-full">
            <span className="text-[11px] font-medium text-stone-600 dark:text-gray-300 mb-1 tabular-nums">
              {formatValue(value)}
            </span>
            <div className="w-full max-w-[2.5rem] flex-1 flex items-end">
              <div
                className={`w-full rounded-t-md ${colorClass} transition-[height] duration-300`}
                style={{ height: `${pct}%` }}
                title={`${d.year}: ${formatValue(value)}`}
              />
            </div>
            <span className="text-[11px] text-stone-400 dark:text-gray-500 mt-1.5 tabular-nums">{d.year}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function PolymathDashboard() {
  useDocumentTitle('Polymath');

  const { data, loading, error, refetch } = useApi(() => api.get('/api/polymath'), []);

  // ── Derived aggregates (always called — hooks before any early return) ────────
  const derived = useMemo(() => {
    const d = data ?? {};
    const books    = d.books_by_year ?? [];
    const research = d.research_by_year ?? [];
    const learning = d.learning_by_year ?? [];
    const projects = d.projects_by_year ?? [];
    const time     = d.time_by_year ?? [];
    const tags     = d.top_tags ?? [];

    const years = [...new Set([
      ...books.map(r => r.year),
      ...research.map(r => r.year),
      ...learning.map(r => r.year),
      ...projects.map(r => r.year),
      ...time.map(r => r.year),
    ])].sort((a, b) => a - b);

    const lifetime = {
      books:    sumBy(books, 'count'),
      pages:    sumBy(books, 'pages'),
      research: sumBy(research, 'count'),
      learning: sumBy(learning, 'count'),
      hours:    Math.round(sumBy(learning, 'hours') * 10) / 10,
      projects: sumBy(projects, 'count'),
      deployed: sumBy(projects, 'deployed'),
      timeHours: Math.round(sumBy(time, 'total_hours') * 10) / 10,
    };

    // Activity allocation — lifetime counts per discipline.
    const allocation = [
      { label: 'Reading',     value: lifetime.books },
      { label: 'Research',    value: lifetime.research },
      { label: 'Learning',    value: lifetime.learning },
      { label: 'Engineering', value: lifetime.projects },
    ];

    // Most productive year — max combined activity.
    const perYearTotal = {};
    for (const r of [...books, ...research, ...learning, ...projects]) {
      perYearTotal[r.year] = (perYearTotal[r.year] || 0) + (Number(r.count) || 0);
    }
    const topYearEntry = Object.entries(perYearTotal).sort(([, a], [, b]) => b - a)[0];
    const mostProductiveYear = topYearEntry ? Number(topYearEntry[0]) : null;
    const topTag = tags[0]?.tag ?? null;

    const hasAny = years.length > 0 || tags.length > 0 || lifetime.timeHours > 0;

    return { books, research, learning, projects, time, tags, years, lifetime, allocation, mostProductiveYear, topTag, hasAny };
  }, [data]);

  // ── Four-state switch (§7) ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        <div className="h-7 w-56 rounded bg-stone-200 dark:bg-gray-700 animate-pulse" />
        <Card><CardBody className="p-0"><ListSkeleton rows={6} /></CardBody></Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <ErrorState message={error} onRetry={refetch} />
      </div>
    );
  }

  const { lifetime, years, allocation, tags, mostProductiveYear, topTag } = derived;

  if (!derived.hasAny) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <PageHeader />
        <Card>
          <CardBody>
            <EmptyState
              icon={Sparkles}
              title="Your polymath journey starts now"
              message="Finish a book, log a research note, complete a course, or ship a project — your growth across the years will appear here."
            />
          </CardBody>
        </Card>
      </div>
    );
  }

  // Tag cloud font scaling (min 0.75rem → max 1.75rem by frequency).
  const maxTag = Math.max(...tags.map(t => t.count), 1);
  const minTag = Math.min(...tags.map(t => t.count), 1);
  const tagSize = (count) => {
    if (maxTag === minTag) return 1.1;
    const t = (count - minTag) / (maxTag - minTag);
    return 0.75 + t * 1.0; // rem
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
      <PageHeader />

      {/* HERO BAND — moss→ember gradient of headline lifetime numbers */}
      <div className="rounded-2xl bg-gradient-to-r from-moss-600 to-ember-500 p-6 sm:p-8 text-white shadow-sm">
        <p className="text-sm font-medium text-white/80 tracking-wide uppercase">Your Polymath Journey</p>
        <p className="mt-1 text-3xl font-bold tracking-[-0.02em]">
          {years.length} {years.length === 1 ? 'year' : 'years'} tracked
        </p>
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <HeroStat label="Books finished" value={plainCount(lifetime.books)} />
          <HeroStat label="Research entries" value={plainCount(lifetime.research)} />
          <HeroStat label="Projects shipped" value={plainCount(lifetime.deployed)} />
          <HeroStat label="Hours invested" value={plainCount(lifetime.timeHours)} />
        </div>
      </div>

      {/* YEAR-OVER-YEAR CARDS — value = lifetime total, delta = latest vs previous year */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Books"          value={plainCount(lifetime.books)}    icon={BookMarked}    delta={yoyDelta(derived.books, 'count')} subtitle={`${plainCount(lifetime.pages)} pages read`} />
        <StatCard label="Research"       value={plainCount(lifetime.research)} icon={FileText}      delta={yoyDelta(derived.research, 'count')} subtitle="journals, citations & notes" />
        <StatCard label="Projects"       value={plainCount(lifetime.projects)} icon={Wrench}        delta={yoyDelta(derived.projects, 'count')} subtitle={`${plainCount(lifetime.deployed)} deployed`} />
        <StatCard label="Learning Hours" value={plainCount(lifetime.hours)}    icon={GraduationCap} delta={yoyDelta(derived.learning, 'hours')} subtitle={`${plainCount(lifetime.learning)} completed`} />
      </div>

      {/* GROWTH TIMELINE + ACTIVITY ALLOCATION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader title="Growth over the years" subtitle="Research entries created each year" />
          <CardBody>
            <GrowthBars rows={derived.research} valueKey="count" colorClass="bg-moss-500 dark:bg-moss-400" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Where your energy goes" subtitle="Lifetime activity by discipline" />
          <CardBody>
            {allocation.some(a => a.value > 0)
              ? <DonutChart data={allocation} formatValue={plainCount} />
              : <p className="text-sm text-stone-400 dark:text-gray-500 text-center py-12">Nothing to show yet.</p>}
          </CardBody>
        </Card>
      </div>

      {/* TIME LOGGED + READING GROWTH */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Hours logged per year" subtitle="Focused time across all modules" />
          <CardBody>
            <GrowthBars rows={derived.time} valueKey="total_hours" colorClass="bg-ember-500 dark:bg-ember-400" formatValue={(v) => `${plainCount(v)}h`} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Books finished per year" subtitle="Your reading rhythm" />
          <CardBody>
            <GrowthBars rows={derived.books} valueKey="count" colorClass="bg-blue-500 dark:bg-blue-400" />
          </CardBody>
        </Card>
      </div>

      {/* KNOWLEDGE MAP — tag cloud */}
      <Card>
        <CardHeader title="Knowledge map" subtitle="Your most-explored topics (by tag frequency)" />
        <CardBody>
          {tags.length > 0 ? (
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
              {tags.map(t => (
                <span
                  key={t.tag}
                  className="text-moss-700 dark:text-moss-400 font-semibold leading-tight"
                  style={{ fontSize: `${tagSize(t.count)}rem` }}
                  title={`${t.tag} — ${t.count} ${t.count === 1 ? 'entry' : 'entries'}`}
                >
                  {t.tag}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-stone-400 dark:text-gray-500 text-center py-8">
              Tag your research entries to build a knowledge map.
            </p>
          )}
        </CardBody>
      </Card>

      {/* ACHIEVEMENT HIGHLIGHTS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Highlight icon={Sparkles} label="Most productive year" value={mostProductiveYear ?? '—'} />
        <Highlight icon={FileText} label="Top topic" value={topTag ?? '—'} />
        <Highlight icon={Clock} label="Lifetime focus" value={`${plainCount(lifetime.timeHours)} hours`} />
      </div>
    </div>
  );
}

// ─── Small presentational pieces (internal, not exported) ─────────────────────

function PageHeader() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-900 dark:text-gray-50 tracking-[-0.02em] flex items-center gap-2">
        <Sparkles className="w-6 h-6 text-moss-500 dark:text-moss-400" />
        Polymath
      </h1>
      <p className="text-sm text-stone-500 dark:text-gray-400 mt-1">
        Your growth as a researcher, engineer, founder, and lifelong learner — across the years.
      </p>
    </div>
  );
}

function HeroStat({ label, value }) {
  return (
    <div>
      <p className="text-2xl font-bold tracking-[-0.02em]">{value}</p>
      <p className="text-xs text-white/80 mt-0.5">{label}</p>
    </div>
  );
}

function Highlight({ icon: Icon, label, value }) {
  return (
    <Card>
      <CardBody className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-moss-50 dark:bg-moss-950/40 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-moss-500 dark:text-moss-400" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-stone-500 dark:text-gray-400 tracking-wide uppercase">{label}</p>
          <p className="text-lg font-bold text-stone-900 dark:text-gray-50 truncate">{value}</p>
        </div>
      </CardBody>
    </Card>
  );
}
