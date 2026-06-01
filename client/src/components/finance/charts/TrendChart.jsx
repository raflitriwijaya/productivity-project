// client/src/components/finance/charts/TrendChart.jsx
// Grouped bar chart: income (emerald) vs expense (red) over up to 12 months.
// Built from raw SVG — no chart library (§1 Independence). Colours use Tailwind
// fill-* classes; only geometry (x/y/width/height) is computed into attributes.

import { formatIdr } from '../../../lib/formatIdr';

const W = 720;
const H = 240;
const PAD = { top: 16, right: 8, bottom: 26, left: 8 };

/**
 * @param {{ data: Array<{ ym: string, label: string, income: string|number, expense: string|number }> }} props
 */
export function TrendChart({ data = [] }) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-stone-400 dark:text-gray-500 text-center py-12">
        No activity to chart yet.
      </p>
    );
  }

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const baseY = PAD.top + plotH;

  const values = data.flatMap(d => [parseFloat(d.income) || 0, parseFloat(d.expense) || 0]);
  const max = Math.max(...values, 1);

  const groupW = plotW / data.length;
  const barW = Math.min(14, groupW * 0.32);

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Monthly income and expense trend">
        {/* Baseline */}
        <line x1={PAD.left} y1={baseY} x2={W - PAD.right} y2={baseY} className="stroke-stone-200 dark:stroke-gray-700" strokeWidth="1" />

        {data.map((d, i) => {
          const income = parseFloat(d.income) || 0;
          const expense = parseFloat(d.expense) || 0;
          const cx = PAD.left + i * groupW + groupW / 2;
          const incH = (income / max) * plotH;
          const expH = (expense / max) * plotH;
          return (
            <g key={d.ym}>
              <rect
                x={cx - barW - 1} y={baseY - incH} width={barW} height={incH} rx="2"
                className="fill-emerald-500 dark:fill-emerald-400"
              >
                <title>{`${d.label}: +${formatIdr(income)}`}</title>
              </rect>
              <rect
                x={cx + 1} y={baseY - expH} width={barW} height={expH} rx="2"
                className="fill-red-500 dark:fill-red-400"
              >
                <title>{`${d.label}: -${formatIdr(expense)}`}</title>
              </rect>
              <text x={cx} y={H - 8} textAnchor="middle" className="text-[10px] fill-stone-400 dark:fill-gray-500">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-2">
        <span className="inline-flex items-center gap-1.5 text-xs text-stone-500 dark:text-gray-400">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 dark:bg-emerald-400" /> Income
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs text-stone-500 dark:text-gray-400">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-500 dark:bg-red-400" /> Expense
        </span>
      </div>
    </div>
  );
}
