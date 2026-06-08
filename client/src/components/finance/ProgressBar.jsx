// client/src/components/finance/ProgressBar.jsx
// Thin horizontal progress meter with budget-style colour coding. The runtime
// 0-100% width has no static Tailwind equivalent, so the inline width style is the
// sanctioned §10 exception already used by LearningRow / RecentLearning.

/**
 * Tone by spend ratio (spent / budget) — "Stoic Garden" scale:
 *   < 0.8  → moss       (healthy)
 *   < 1.0  → terracotta (close to limit / warning)
 *   >= 1.0 → red        (over budget)
 * @param {number} ratio
 */
function toneForRatio(ratio) {
  if (ratio >= 1) return 'bg-red-500 dark:bg-red-400';
  if (ratio >= 0.8) return 'bg-terracotta-500 dark:bg-terracotta-400';
  return 'bg-moss-500 dark:bg-moss-400';
}

/**
 * @param {{
 *   value: number,
 *   max: number,
 *   tone?: string,        // optional explicit Tailwind bg class (overrides ratio colouring)
 *   className?: string
 * }} props
 */
export function ProgressBar({ value, max, tone, className = '' }) {
  const ratio = max > 0 ? value / max : 0;
  const pct = Math.max(0, Math.min(100, ratio * 100));
  const barTone = tone ?? toneForRatio(ratio);
  return (
    <div className={`bg-stone-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden ${className}`}>
      <div
        className={`${barTone} rounded-full h-2 transition-all duration-300`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
