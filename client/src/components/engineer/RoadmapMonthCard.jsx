// client/src/components/engineer/RoadmapMonthCard.jsx
// One month of the engineering roadmap: header (number + title), a completion
// MiniProgressBar, and a checklist grouped by category (hardware/software/process).
//
// Each skill row is a toggle. Following the existing codebase precedent (filter
// pills in Research.jsx, the theme toggle in AppLayout), a custom checkbox-style
// toggle is a raw styled <button role="checkbox"> with full dark: variants — the
// Button component is reserved for primary/secondary/danger/ghost actions.

import { Check, Cpu, Code2, GitBranch } from 'lucide-react';
import { Card, CardBody } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { MiniProgressBar } from './MiniProgressBar';

const CATEGORY_META = {
  hardware: { label: 'Hardware', icon: Cpu },
  software: { label: 'Software', icon: Code2 },
  process:  { label: 'Process',  icon: GitBranch },
};

const CATEGORY_ORDER = ['hardware', 'software', 'process'];

/**
 * A single toggleable skill row.
 * @param {{ skill: Object, onToggle: (skill: Object) => void, disabled?: boolean }} props
 */
function SkillRow({ skill, onToggle, disabled = false }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={skill.completed}
      disabled={disabled}
      onClick={() => onToggle(skill)}
      className={`group flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left
        transition-colors duration-150
        hover:bg-stone-50 dark:hover:bg-gray-700/60
        focus:outline-none focus:ring-2 focus:ring-moss-500 dark:focus:ring-moss-400
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border
          transition-colors duration-150
          ${skill.completed
            ? 'bg-moss-600 border-moss-600 dark:bg-moss-500 dark:border-moss-500'
            : 'bg-white border-stone-300 dark:bg-gray-700 dark:border-gray-500'
          }`}
      >
        {skill.completed && <Check size={12} className="text-white" />}
      </span>
      <span
        className={`text-sm leading-snug
          ${skill.completed
            ? 'text-stone-400 line-through dark:text-gray-500'
            : 'text-stone-700 dark:text-gray-300'
          }`}
      >
        {skill.title}
      </span>
    </button>
  );
}

/**
 * @param {{
 *   month: Object,                       // { month_number, title, description, skills: [] }
 *   onToggleSkill: (skill: Object) => void,
 *   togglingId?: number | null,          // skill id currently being PATCHed
 * }} props
 */
export function RoadmapMonthCard({ month, onToggleSkill, togglingId = null }) {
  const skills = month.skills ?? [];
  const done = skills.filter(s => s.completed).length;
  const total = skills.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // Group skills by category, preserving the canonical order.
  const grouped = CATEGORY_ORDER
    .map(cat => ({ cat, items: skills.filter(s => s.category === cat) }))
    .filter(g => g.items.length > 0);

  return (
    <Card className="flex flex-col h-full">
      <CardBody className="flex flex-col gap-4 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Badge variant="gray">Month {month.month_number}</Badge>
              {pct === 100 && total > 0 && <Badge variant="moss">Complete</Badge>}
            </div>
            <h3 className="mt-1.5 text-sm font-semibold text-stone-900 dark:text-gray-50">
              {month.title}
            </h3>
          </div>
          <span className="text-xs font-medium text-stone-500 dark:text-gray-400 whitespace-nowrap">
            {done}/{total}
          </span>
        </div>

        {month.description && (
          <p className="text-xs text-stone-500 dark:text-gray-400 -mt-1">{month.description}</p>
        )}

        <MiniProgressBar percent={pct} />

        {/* Checklist grouped by category */}
        <div className="space-y-3">
          {grouped.map(({ cat, items }) => {
            const meta = CATEGORY_META[cat] ?? { label: cat, icon: Code2 };
            const Icon = meta.icon;
            return (
              <div key={cat} className="space-y-0.5">
                <div className="flex items-center gap-1.5 px-2">
                  <Icon size={12} className="text-stone-400 dark:text-gray-500" />
                  <p className="text-[10px] font-semibold text-stone-400 dark:text-gray-500 tracking-widest uppercase">
                    {meta.label}
                  </p>
                </div>
                {items.map(skill => (
                  <SkillRow
                    key={skill.id}
                    skill={skill}
                    onToggle={onToggleSkill}
                    disabled={togglingId === skill.id}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}
