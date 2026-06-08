// client/src/components/engineer/MiniProgressBar.jsx
// Generic percentage progress meter for the Engineering Toolkit (roadmap cards).
// Adapted from the finance ProgressBar but driven by a 0–100 percent value and
// always moss (it represents completion, not budget burn). The runtime width
// has no static Tailwind equivalent, so the inline width style is the sanctioned
// §10 exception already used by LearningRow / RecentLearning / ProgressBar.

/**
 * @param {{
 *   percent: number,      // 0–100, clamped
 *   className?: string,
 *   size?: 'sm' | 'md',   // bar height
 * }} props
 * @returns {JSX.Element}
 */
export function MiniProgressBar({ percent, className = '', size = 'md' }) {
  const pct = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
  const h = size === 'sm' ? 'h-1.5' : 'h-2';
  return (
    <div className={`bg-stone-200 dark:bg-gray-700 rounded-full ${h} overflow-hidden ${className}`}>
      <div
        className={`bg-moss-500 dark:bg-moss-400 rounded-full ${h} transition-all duration-300`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
