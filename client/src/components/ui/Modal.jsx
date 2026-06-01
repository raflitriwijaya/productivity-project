// client/src/components/ui/Modal.jsx
// Portal-rendered modal (§5.6). Renders to document.body so z-index/overflow on
// ancestors can't trap it (§10 ALWAYS #10). Esc and backdrop-click close it.

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const sizeMap = { sm: 'max-w-[400px]', md: 'max-w-[560px]', lg: 'max-w-[720px]' };

/**
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {string} props.title
 * @param {'sm'|'md'|'lg'} [props.size='md']
 * @param {React.ReactNode} props.children
 * @param {React.ReactNode} [props.footer]
 * @returns {JSX.Element|null}
 */
export function Modal({ isOpen, onClose, title, size = 'md', children, footer }) {
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative w-full ${sizeMap[size]} max-h-[90vh] bg-white dark:bg-gray-800 rounded-xl shadow-xl flex flex-col overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 dark:border-gray-700 flex-shrink-0">
          <h2 id="modal-title" className="text-lg font-semibold text-stone-900 dark:text-gray-50 tracking-[-0.01em]">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1 rounded-md text-stone-400 hover:text-stone-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-stone-100 dark:hover:bg-gray-700 transition-colors duration-150"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {children}
        </div>
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-stone-200 dark:border-gray-700 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
