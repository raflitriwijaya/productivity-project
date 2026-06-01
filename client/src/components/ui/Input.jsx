// client/src/components/ui/Input.jsx
// Form field primitives (§5.3): Input, Textarea, Select.
// Always wrap raw form fields in these — never a raw <input> in pages (§10 ALWAYS #6).

/**
 * @param {Object} props
 * @param {string} [props.label]
 * @param {string} [props.id]
 * @param {string} [props.error]      Inline error message (turns border/ring red).
 * @param {string} [props.helperText] Helper text shown when there is no error.
 * @param {boolean} [props.disabled=false]
 * @param {string} [props.className='']
 * @returns {JSX.Element}
 */
export function Input({ label, id, error, helperText, disabled = false, className = '', ...props }) {
  const baseClasses = `
    w-full px-4 py-2 rounded-lg text-sm
    bg-white dark:bg-gray-700
    text-stone-900 dark:text-gray-50
    placeholder-stone-400 dark:placeholder-gray-500
    focus:outline-none focus:ring-2 focus:border-transparent
    transition-colors duration-150
    ${disabled ? 'opacity-50 cursor-not-allowed bg-stone-50 dark:bg-gray-800' : ''}
  `;
  const stateClasses = error
    ? 'border border-red-300 dark:border-red-600 focus:ring-red-500 dark:focus:ring-red-400'
    : 'border border-stone-200 dark:border-gray-600 focus:ring-emerald-500 dark:focus:ring-emerald-400';

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-stone-700 dark:text-gray-300 tracking-wide uppercase mb-1.5">
          {label}
        </label>
      )}
      <input
        id={id}
        disabled={disabled}
        className={`${baseClasses} ${stateClasses} ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
      {helperText && !error && <p className="mt-1 text-xs text-stone-500 dark:text-gray-400">{helperText}</p>}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {string} [props.label]
 * @param {string} [props.id]
 * @param {string} [props.error]
 * @param {string} [props.helperText]
 * @param {boolean} [props.disabled=false]
 * @param {number} [props.rows=4]
 * @param {string} [props.className='']
 * @returns {JSX.Element}
 */
export function Textarea({ label, id, error, helperText, disabled = false, rows = 4, className = '', ...props }) {
  const baseClasses = `
    w-full px-4 py-2 rounded-lg text-sm resize-none
    bg-white dark:bg-gray-700
    text-stone-900 dark:text-gray-50
    placeholder-stone-400 dark:placeholder-gray-500
    focus:outline-none focus:ring-2 focus:border-transparent
    transition-colors duration-150
    ${disabled ? 'opacity-50 cursor-not-allowed bg-stone-50 dark:bg-gray-800' : ''}
  `;
  const stateClasses = error
    ? 'border border-red-300 dark:border-red-600 focus:ring-red-500 dark:focus:ring-red-400'
    : 'border border-stone-200 dark:border-gray-600 focus:ring-emerald-500 dark:focus:ring-emerald-400';

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-stone-700 dark:text-gray-300 tracking-wide uppercase mb-1.5">
          {label}
        </label>
      )}
      <textarea
        id={id}
        rows={rows}
        disabled={disabled}
        className={`${baseClasses} ${stateClasses} ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
      {helperText && !error && <p className="mt-1 text-xs text-stone-500 dark:text-gray-400">{helperText}</p>}
    </div>
  );
}

/**
 * @param {Object} props
 * @param {string} [props.label]
 * @param {string} [props.id]
 * @param {string} [props.error]
 * @param {string} [props.helperText]
 * @param {boolean} [props.disabled=false]
 * @param {React.ReactNode} props.children Option elements.
 * @param {string} [props.className='']
 * @returns {JSX.Element}
 */
export function Select({ label, id, error, helperText, disabled = false, children, className = '', ...props }) {
  const stateClasses = error
    ? 'border border-red-300 dark:border-red-600 focus:ring-red-500 dark:focus:ring-red-400'
    : 'border border-stone-200 dark:border-gray-600 focus:ring-emerald-500 dark:focus:ring-emerald-400';
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-stone-700 dark:text-gray-300 tracking-wide uppercase mb-1.5">
          {label}
        </label>
      )}
      <select
        id={id}
        disabled={disabled}
        className={`
          w-full px-4 py-2 rounded-lg text-sm
          bg-white dark:bg-gray-700
          text-stone-900 dark:text-gray-50
          focus:outline-none focus:ring-2 focus:border-transparent transition-colors duration-150
          ${disabled ? 'opacity-50 cursor-not-allowed bg-stone-50 dark:bg-gray-800' : ''}
          ${stateClasses}
          ${className}
        `}
        {...props}
      >
        {children}
      </select>
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
      {helperText && !error && <p className="mt-1 text-xs text-stone-500 dark:text-gray-400">{helperText}</p>}
    </div>
  );
}
