// client/src/components/research/ResearchSummaryCards.jsx
// Displays four stat cards: total entries, journal count, citation count, note count.
// Receives pre-fetched stats to stay decoupled from data fetching.

import { BookOpen, FileText, Quote, StickyNote } from 'lucide-react';
import { StatCard } from '../ui/StatCard';

/**
 * @param {{ stats: { total: number, journal: number, citation: number, note: number } | null }} props
 */
export function ResearchSummaryCards({ stats }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Total Entries"
        value={stats?.total ?? '—'}
        icon={BookOpen}
      />
      <StatCard
        label="Journal Entries"
        value={stats?.journal ?? '—'}
        icon={FileText}
      />
      <StatCard
        label="Citations"
        value={stats?.citation ?? '—'}
        icon={Quote}
      />
      <StatCard
        label="Notes"
        value={stats?.note ?? '—'}
        icon={StickyNote}
      />
    </div>
  );
}
