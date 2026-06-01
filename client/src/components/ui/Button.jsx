// client/src/components/ui/Button.jsx
// Canonical button (§5.1). Use this for ALL clickable actions — never a raw
// <button> in page/feature components (§10 ALWAYS #12).

const variants = {
  primary:   'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-600 dark:focus:ring-emerald-400',
  secondary: 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50 hover:border-stone-300 focus:ring-emerald-500 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700 dark:focus:ring-emerald-400',
  danger:    'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 dark:bg-red-500 dark:hover:bg-red-600 dark:focus:ring-red-400',
  ghost:     'bg-transparent text-stone-600 hover:bg-stone-100 hover:text-stone-900 focus:ring-emerald-500 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100 dark:focus:ring-emerald-400',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-2.5 text-sm',
};

/**
 * @param {Object} props
 * @param {'primary'|'secondary'|'danger'|'ghost'} [props.variant='primary']
 * @param {'sm'|'md'|'lg'} [props.size='md']
 * @param {boolean} [props.disabled=false]
 * @param {React.ReactNode} props.children
 * @param {string} [props.className='']
 * @returns {JSX.Element}
 */
export function Button({ variant = 'primary', size = 'md', disabled = false, children, className = '', ...props }) {
  return (
    <button
      className={`
        inline-flex items-center gap-2 rounded-lg font-medium
        focus:outline-none focus:ring-2 focus:ring-offset-2 ring-offset-white dark:ring-offset-gray-900
        transition-colors duration-150
        ${variants[variant]}
        ${sizes[size]}
        ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}
        ${className}
      `}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
