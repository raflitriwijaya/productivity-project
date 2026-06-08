// client/src/components/finance/charts/DonutChart.jsx
// Donut chart + legend, built from raw SVG (§1 Independence). The slice palette is
// drawn only from the "Stoic Garden" palette: moss, blue, amber, red, gray,
// terracotta, ember — no ad-hoc hues. Slice geometry is computed into the path `d`
// attribute; colours are Tailwind fill-* classes.

import { formatIdr } from '../../../lib/formatIdr';

// Fill + matching legend-dot bg, paired so the legend always matches the slice.
const PALETTE = [
  { fill: 'fill-moss-500 dark:fill-moss-400',             dot: 'bg-moss-500 dark:bg-moss-400' },
  { fill: 'fill-blue-500 dark:fill-blue-400',             dot: 'bg-blue-500 dark:bg-blue-400' },
  { fill: 'fill-terracotta-500 dark:fill-terracotta-400', dot: 'bg-terracotta-500 dark:bg-terracotta-400' },
  { fill: 'fill-red-500 dark:fill-red-400',               dot: 'bg-red-500 dark:bg-red-400' },
  { fill: 'fill-stone-400 dark:fill-gray-500',            dot: 'bg-stone-400 dark:bg-gray-500' },
  { fill: 'fill-moss-700 dark:fill-moss-600',             dot: 'bg-moss-700 dark:bg-moss-600' },
  { fill: 'fill-blue-700 dark:fill-blue-600',             dot: 'bg-blue-700 dark:bg-blue-600' },
  { fill: 'fill-ember-500 dark:fill-ember-400',           dot: 'bg-ember-500 dark:bg-ember-400' },
];

const SIZE = 160;
const R = 70;
const C = SIZE / 2;

function arcPath(startAngle, endAngle) {
  // Full circle can't be expressed as a single arc — draw two half arcs.
  if (endAngle - startAngle >= Math.PI * 2) {
    return `M ${C} ${C - R} A ${R} ${R} 0 1 1 ${C} ${C + R} A ${R} ${R} 0 1 1 ${C} ${C - R} Z`;
  }
  const x0 = C + R * Math.sin(startAngle);
  const y0 = C - R * Math.cos(startAngle);
  const x1 = C + R * Math.sin(endAngle);
  const y1 = C - R * Math.cos(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${C} ${C} L ${x0} ${y0} A ${R} ${R} 0 ${largeArc} 1 ${x1} ${y1} Z`;
}

/**
 * @param {{
 *   data: Array<{ label: string, value: number|string }>,
 *   formatValue?: (v: number) => string
 * }} props
 */
export function DonutChart({ data = [], formatValue = formatIdr }) {
  const slices = data
    .map(d => ({ label: d.label, value: parseFloat(d.value) || 0 }))
    .filter(d => d.value > 0);

  const total = slices.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <p className="text-sm text-stone-400 dark:text-gray-500 text-center py-12">
        Nothing to show yet.
      </p>
    );
  }

  const wedges = slices.map((d, i) => {
    // Start angle = cumulative fraction of all preceding slices (n is tiny).
    const preceding = slices.slice(0, i).reduce((sum, s) => sum + s.value, 0);
    const start = (preceding / total) * Math.PI * 2;
    const end = ((preceding + d.value) / total) * Math.PI * 2;
    return { ...d, start, end, pct: (d.value / total) * 100, ...PALETTE[i % PALETTE.length] };
  });

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-40 h-40 flex-shrink-0" role="img" aria-label="Allocation donut chart">
        {wedges.map(w => (
          <path key={w.label} d={arcPath(w.start, w.end)} className={w.fill}>
            <title>{`${w.label}: ${formatValue(w.value)} (${w.pct.toFixed(1)}%)`}</title>
          </path>
        ))}
        {/* Donut hole — matches card background */}
        <circle cx={C} cy={C} r={R * 0.58} className="fill-white dark:fill-gray-800" />
      </svg>

      <ul className="flex-1 w-full space-y-1.5">
        {wedges.map(w => (
          <li key={w.label} className="flex items-center gap-2 text-sm">
            <span className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${w.dot}`} />
            <span className="text-stone-700 dark:text-gray-300 truncate flex-1">{w.label}</span>
            <span className="text-stone-500 dark:text-gray-400 tabular-nums">{formatValue(w.value)}</span>
            <span className="text-[11px] text-stone-400 dark:text-gray-500 w-12 text-right tabular-nums">
              {w.pct.toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
