// client/src/components/ui/Card.jsx
// Primary content container (§5.2). Card / CardHeader / CardBody.

/**
 * @param {Object} props
 * @param {'default'|'flat'|'highlight'} [props.variant='default']
 * @param {string} [props.className='']
 * @param {React.ReactNode} props.children
 * @returns {JSX.Element}
 */
export function Card({ variant = 'default', className = '', children }) {
  const variants = {
    default:   'bg-white dark:bg-gray-800 rounded-xl border border-stone-200 dark:border-gray-700 shadow-sm',
    flat:      'bg-stone-50 dark:bg-gray-700 rounded-xl border border-stone-200 dark:border-gray-600',
    highlight: 'bg-white dark:bg-gray-800 rounded-xl border-2 border-moss-500 dark:border-moss-400 shadow-sm',
  };
  return (
    <div className={`${variants[variant]} ${className}`}>
      {children}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {string} props.title
 * @param {string} [props.subtitle]
 * @param {React.ReactNode} [props.action]
 * @param {string} [props.className='']
 * @returns {JSX.Element}
 */
export function CardHeader({ title, subtitle, action, className = '' }) {
  return (
    <div className={`flex items-start justify-between p-6 pb-0 ${className}`}>
      <div>
        <h3 className="text-sm font-semibold text-stone-900 dark:text-gray-50">{title}</h3>
        {subtitle && <p className="text-xs text-stone-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0 ml-4">{action}</div>}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {string} [props.className='']
 * @param {React.ReactNode} props.children
 * @returns {JSX.Element}
 */
export function CardBody({ className = '', children }) {
  return (
    <div className={`p-6 ${className}`}>
      {children}
    </div>
  );
}
