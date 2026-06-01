// client/src/components/ui/Skeleton.jsx
// Skeleton placeholders (§5.11). NEVER a centered spinner as the primary
// loading state (§10 NEVER #14).

/**
 * @param {Object} props
 * @param {string} [props.className='']
 * @returns {JSX.Element}
 */
export function Skeleton({ className = '' }) {
  return <div className={`bg-stone-200 dark:bg-gray-700 rounded animate-pulse ${className}`} />;
}

/**
 * Row-shaped skeleton for list/table loading states.
 * @param {Object} props
 * @param {number} [props.rows=5]
 * @returns {JSX.Element}
 */
export function ListSkeleton({ rows = 5 }) {
  return (
    <div className="p-6 space-y-4">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="w-4 h-4 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className={i % 2 === 0 ? 'h-4 w-3/4' : 'h-4 w-full'} />
            <div className="h-3 rounded bg-stone-100 dark:bg-gray-700/50 animate-pulse w-1/3" />
          </div>
          <Skeleton className="w-16 h-6 rounded-md" />
        </div>
      ))}
    </div>
  );
}
