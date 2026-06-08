// client/src/components/ui/Badge.jsx
// Status/priority tag (§5.8). Variant → color mapping is canonical; see the
// §5.8 status/priority → variant table for which value maps to which variant.

// "Stoic Garden" category accents: moss (agritech/nature/success), terracotta
// (hardware/embedded), ember (startup/innovation), plus status red/amber/blue/gray.
const variants = {
  moss:       'bg-moss-50 text-moss-700 dark:bg-moss-950/50 dark:text-moss-400',
  terracotta: 'bg-terracotta-50 text-terracotta-700 dark:bg-terracotta-950/50 dark:text-terracotta-400',
  ember:      'bg-ember-50 text-ember-700 dark:bg-ember-950/50 dark:text-ember-400',
  red:        'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400',
  amber:      'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
  blue:       'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400',
  gray:       'bg-stone-100 text-stone-700 dark:bg-gray-700 dark:text-gray-300',
};

/**
 * @typedef {'moss'|'terracotta'|'ember'|'red'|'amber'|'blue'|'gray'} BadgeVariant
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
