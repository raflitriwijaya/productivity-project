// client/src/hooks/useToast.jsx
// Global toast provider + hook (§5.7). <ToastProvider> wraps the app once in
// main.jsx (outside the router) and renders a single portal-based container.
// Call useToast() anywhere to get the shared addToast/removeToast.

import { createContext, useContext, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const ToastContext = createContext(null);
let toastIdCounter = 0;

// "Stoic Garden": success → moss (growth), info → ember (innovation);
// error/warning keep red/amber.
const TYPE_DOT = {
  success: 'bg-moss-500',
  error: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-ember-500',
};
const TYPE_BORDER = {
  success: 'border-moss-200 dark:border-moss-800',
  error: 'border-red-200 dark:border-red-800',
  warning: 'border-amber-200 dark:border-amber-800',
  info: 'border-ember-200 dark:border-ember-800',
};

/**
 * @param {{ children: React.ReactNode }} props
 * @returns {JSX.Element}
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]); // each: { id, type, title, message, leaving }

  const removeToast = useCallback((id) => {
    // Trigger exit animation, then unmount after it finishes (150ms, matches animate-fade-out).
    setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 150);
  }, []);

  const addToast = useCallback(({ type = 'info', title, message, duration = 4000 }) => {
    const id = ++toastIdCounter;
    setToasts(prev => [...prev.slice(-2), { id, type, title, message, leaving: false }]); // cap at 3
    setTimeout(() => removeToast(id), duration);
    return id;
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

/**
 * @returns {{ addToast: (t: { type?: string, title: string, message?: string, duration?: number }) => number, removeToast: (id: number) => void }}
 */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

/**
 * @param {{ toasts: Array<object>, onDismiss: (id: number) => void }} props
 * @returns {JSX.Element|null}
 */
function ToastContainer({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;
  return createPortal(
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm w-full">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-start gap-3 p-4 rounded-xl shadow-lg border bg-white dark:bg-gray-800
            ${TYPE_BORDER[t.type]} ${t.leaving ? 'animate-fade-out' : 'animate-slide-up'}`}
        >
          <span className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${TYPE_DOT[t.type]}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-stone-900 dark:text-gray-50">{t.title}</p>
            {t.message && <p className="text-xs text-stone-500 dark:text-gray-400 mt-0.5">{t.message}</p>}
          </div>
          <button
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss notification"
            className="p-0.5 rounded-md text-stone-400 hover:text-stone-600 dark:text-gray-500 dark:hover:text-gray-300 flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
}
