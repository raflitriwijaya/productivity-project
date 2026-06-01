// client/src/components/ui/EmptyState.jsx
// Empty data state (§5.9). `icon` is a Lucide icon component (not an element);
// `action` is a <Button>.

/**
 * @param {Object} props
 * @param {React.ComponentType<{ className?: string }>} [props.icon] Lucide icon component.
 * @param {string} props.title
 * @param {string} [props.message]
 * @param {React.ReactNode} [props.action]
 * @returns {JSX.Element}
 */
export function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      {Icon && (
        <div className="w-12 h-12 rounded-xl bg-stone-100 dark:bg-gray-700 flex items-center justify-center mb-4">
          <Icon className="w-6 h-6 text-stone-400 dark:text-gray-500" />
        </div>
      )}
      <h3 className="text-sm font-semibold text-stone-700 dark:text-gray-300 mb-1">{title}</h3>
      {message && <p className="text-xs text-stone-400 dark:text-gray-500 mb-6 max-w-xs">{message}</p>}
      {action}
    </div>
  );
}
