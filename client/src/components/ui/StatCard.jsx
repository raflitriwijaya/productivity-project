// client/src/components/ui/StatCard.jsx
// Metric card for dashboards and summary rows (§5.12). `delta` is optional;
// positive → emerald, negative → red.

import { Card, CardBody } from './Card';

/**
 * @param {Object} props
 * @param {string} props.label
 * @param {string|number} props.value
 * @param {number} [props.delta]  Optional percentage delta.
 * @param {React.ComponentType<{ className?: string }>} [props.icon] Lucide icon component.
 * @returns {JSX.Element}
 */
export function StatCard({ label, value, delta, icon: Icon }) {
  const deltaColor = delta == null
    ? ''
    : delta >= 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-red-600 dark:text-red-400';
  return (
    <Card>
      <CardBody>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-stone-500 dark:text-gray-400 tracking-wide uppercase">{label}</p>
          {Icon && <Icon className="w-4 h-4 text-stone-400 dark:text-gray-500" />}
        </div>
        <p className="text-2xl font-bold text-stone-900 dark:text-gray-50 tracking-[-0.02em]">{value}</p>
        {delta != null && (
          <p className={`text-xs mt-1 ${deltaColor}`}>{delta >= 0 ? '+' : ''}{delta}%</p>
        )}
      </CardBody>
    </Card>
  );
}
