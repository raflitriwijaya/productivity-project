// client/src/pages/AnnualReport.jsx
// Reflection & Growth (Roadmap Wave 5). The yearly "Polymath Report": books read,
// papers written, projects shipped, skills learned, hours invested, money flowed.
// Year selector (arrows) drives GET /api/review/annual?year=. A hero band of the
// headline numbers, then per-module breakdown sections.

import { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, BookMarked, GraduationCap, Wrench,
  CheckSquare, Clock, DollarSign, BookOpen, Trophy,
} from 'lucide-react';

import api from '../lib/api';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { formatIdr } from '../lib/formatIdr';

import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ErrorState } from '../components/ui/ErrorState';

const CURRENT_YEAR = new Date().getFullYear();

/** A single labelled metric inside a section card. */
function Metric({ label, value, accent = false }) {
  return (
    <div>
      <p className={`text-2xl font-bold tracking-[-0.02em] ${accent ? 'text-moss-600 dark:text-moss-400' : 'text-stone-900 dark:text-gray-50'}`}>
        {value}
      </p>
      <p className="text-xs text-stone-400 dark:text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

/** A module section: icon + title header, then a metric grid. */
function Section({ icon: Icon, title, children }) {
  return (
    <Card>
      <CardHeader title={<span className="flex items-center gap-2"><Icon size={15} className="text-moss-500 dark:text-moss-400" />{title}</span>} />
      <CardBody>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">{children}</div>
      </CardBody>
    </Card>
  );
}

function HeroSkeleton() {
  return <div className="h-40 rounded-2xl bg-stone-100 dark:bg-gray-800 animate-pulse" />;
}

function SectionsSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-44 rounded-xl bg-stone-100 dark:bg-gray-800 animate-pulse" />
      ))}
    </div>
  );
}

export default function AnnualReport() {
  useDocumentTitle('Annual Report');

  const [year, setYear] = useState(CURRENT_YEAR);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/review/annual?year=${year}`);
      setReport(res.data);
    } catch (err) {
      setError(err.message || 'Failed to load annual report');
    } finally {
      setLoading(false);
    }
  }, [year]);

  /* Fetch on mount / year change — intentional setState-in-effect (data load) */
  /* eslint-disable-next-line react-hooks/set-state-in-effect */
  useEffect(() => { fetchReport(); }, [fetchReport]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">

      {/* HEADER + YEAR NAV */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-gray-50 tracking-[-0.02em]">Annual Report</h1>
          <p className="text-sm text-stone-500 dark:text-gray-400 mt-1">Your year as a polymath, in numbers.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setYear(y => y - 1)} aria-label="Previous year">
            <ChevronLeft size={16} />
          </Button>
          <span className="px-3 py-1.5 text-sm font-semibold text-stone-900 dark:text-gray-50 tabular-nums">{year}</span>
          <Button variant="secondary" size="sm" onClick={() => setYear(y => y + 1)} disabled={year >= CURRENT_YEAR} aria-label="Next year">
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      {/* ERROR */}
      {error && !loading && (
        <Card><CardBody><ErrorState message={error} onRetry={fetchReport} /></CardBody></Card>
      )}

      {/* HERO */}
      {!error && (loading || !report ? (
        <HeroSkeleton />
      ) : (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-moss-600 to-moss-800 dark:from-moss-800 dark:to-gray-900 px-8 py-10 text-white">
          <span className="absolute top-4 right-6 w-2.5 h-2.5 rounded-full bg-ember-400" />
          <p className="text-sm uppercase tracking-widest text-moss-100/80">{year}</p>
          <h2 className="text-2xl sm:text-3xl font-bold mt-1 mb-6 tracking-[-0.02em]">Your Year as a Polymath</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <div>
              <p className="text-3xl font-bold tabular-nums">{report.reading.books_finished}</p>
              <p className="text-xs text-moss-100/80 mt-1">Books finished</p>
            </div>
            <div>
              <p className="text-3xl font-bold tabular-nums">{report.research.total}</p>
              <p className="text-xs text-moss-100/80 mt-1">Research entries</p>
            </div>
            <div>
              <p className="text-3xl font-bold tabular-nums">{report.engineering.deployed}</p>
              <p className="text-xs text-moss-100/80 mt-1">Projects shipped</p>
            </div>
            <div>
              <p className="text-3xl font-bold tabular-nums">{report.time.total_hours}h</p>
              <p className="text-xs text-moss-100/80 mt-1">Hours invested</p>
            </div>
          </div>
        </div>
      ))}

      {/* SECTIONS */}
      {!error && (loading || !report ? (
        <SectionsSkeleton />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Section icon={BookMarked} title="Reading">
            <Metric label="Books finished" value={report.reading.books_finished} accent />
            <Metric label="Pages read" value={report.reading.pages_read.toLocaleString()} />
            <Metric label="Avg rating" value={report.reading.avg_rating ? `${report.reading.avg_rating}★` : '—'} />
          </Section>

          <Section icon={BookOpen} title="Research">
            <Metric label="Total entries" value={report.research.total} accent />
            <Metric label="Journals" value={report.research.journals} />
            <Metric label="Citations" value={report.research.citations} />
          </Section>

          <Section icon={GraduationCap} title="Learning">
            <Metric label="Completed" value={report.learning.completed} accent />
            <Metric label="Hours" value={`${report.learning.hours}h`} />
          </Section>

          <Section icon={Wrench} title="Engineering">
            <Metric label="Projects started" value={report.engineering.total_projects} />
            <Metric label="Deployed" value={report.engineering.deployed} accent />
          </Section>

          <Section icon={CheckSquare} title="Tasks">
            <Metric label="Completed" value={report.tasks.completed} accent />
          </Section>

          <Section icon={Clock} title="Time">
            <Metric label="Total hours" value={`${report.time.total_hours}h`} accent />
            <Metric label="Sessions" value={report.time.sessions} />
          </Section>

          <Section icon={DollarSign} title="Finance">
            <Metric label="Income" value={formatIdr(report.finance.income)} />
            <Metric label="Expense" value={formatIdr(report.finance.expense)} />
            <Metric label="Net" value={formatIdr(report.finance.net)} accent={report.finance.net >= 0} />
          </Section>

          <Section icon={Trophy} title="Goals">
            <Metric label="Achieved this year" value={report.goals?.achieved ?? 0} accent />
          </Section>
        </div>
      ))}
    </div>
  );
}
