// client/src/components/ui/Badge.jsx
// Status/priority tag (§5.8). Variant → color mapping is canonical; see the
// §5.8 status/priority → variant table for which value maps to which variant.

const variants = {
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
  red:     'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400',
  amber:   'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
  blue:    'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400',
  gray:    'bg-stone-100 text-stone-700 dark:bg-gray-700 dark:text-gray-300',
};

/**
 * @typedef {'emerald'|'red'|'amber'|'blue'|'gray'} BadgeVariant
 */

/**
 * @param {Object} props
 * @param {BadgeVariant} [props.variant='gray']
 * @param {React.ReactNode} props.children
 * @param {string} [props.className='']
 * @returns {JSX.Element}
 */
export function Badge({ variant = 'gray', children, className = '' }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
