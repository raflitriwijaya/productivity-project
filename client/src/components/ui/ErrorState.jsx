// client/src/components/ui/ErrorState.jsx
// Error data state (§5.10). Pair with the four-state switch — pass the
// useApi `error` string and `refetch` as onRetry.

import { AlertCircle } from 'lucide-react';
import { Button } from './Button';

/**
 * @param {Object} props
 * @param {string} [props.message]
 * @param {() => void} [props.onRetry]
 * @returns {JSX.Element}
 */
export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center mb-4">
        <AlertCircle className="w-6 h-6 text-red-500 dark:text-red-400" />
      </div>
      <h3 className="text-sm font-semibold text-stone-700 dark:text-gray-300 mb-1">Something went wrong</h3>
      {message && <p className="text-xs text-stone-400 dark:text-gray-500 mb-6 max-w-xs">{message}</p>}
      {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>Try again</Button>}
    </div>
  );
}
