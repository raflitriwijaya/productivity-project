// client/src/components/ui/Modal.jsx
// Portal-rendered modal (§5.6). Renders to document.body so z-index/overflow on
// ancestors can't trap it (§10 ALWAYS #10). Esc and backdrop-click close it.
// Phase 12: traps Tab focus within the dialog and restores focus on close.

import { useEffect, useRef, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// All elements that can receive keyboard focus.
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const sizeMap = {
  sm: 'max-w-[400px]',
  md: 'max-w-[560px]',
  lg: 'max-w-[720px]',
  xl: 'max-w-[960px]',
};

/**
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {string} props.title
 * @param {'sm'|'md'|'lg'|'xl'} [props.size='md']
 * @param {boolean} [props.showClose=true]
 * @param {React.ReactNode} props.children
 * @param {React.ReactNode} [props.footer]
 * @returns {JSX.Element|null}
 */
export function Modal({ isOpen, onClose, title, size = 'md', showClose = true, children, footer }) {
  const modalRef = useRef(null);
  const previousActiveElement = useRef(null);
  const titleId = useId();

  // Focus trap: cycle Tab/Shift+Tab within focusable elements inside the dialog.
  const trapFocus = useCallback((e) => {
    if (!modalRef.current || e.key !== 'Tab') return;

    const focusable = modalRef.current.querySelectorAll(FOCUSABLE);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  // On open: save the opener, lock body scroll, auto-focus first element, attach trap.
  // On close: restore scroll, remove trap, restore focus to opener.
  useEffect(() => {
    if (!isOpen) return;

    previousActiveElement.current = document.activeElement;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Small delay so the portal has rendered before we query focusable children.
    const timer = setTimeout(() => {
      if (!modalRef.current) return;
      const focusable = modalRef.current.querySelectorAll(FOCUSABLE);
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        modalRef.current.focus();
      }
    }, 50);

    document.addEventListener('keydown', trapFocus);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', trapFocus);
      clearTimeout(timer);

      if (previousActiveElement.current && typeof previousActiveElement.current.focus === 'function') {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen, trapFocus]);

  // Escape key closes the modal.
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      {/* Backdrop — click closes the modal; hidden from AT */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog panel */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative z-10 w-full ${sizeMap[size] ?? sizeMap.md} max-h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-xl flex flex-col overflow-hidden focus:outline-none focus:ring-2 focus:ring-moss-500`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 dark:border-gray-700 flex-shrink-0">
          <h2
            id={titleId}
            className="text-lg font-semibold text-stone-900 dark:text-gray-50 tracking-[-0.01em]"
          >
            {title}
          </h2>
          {showClose && (
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className="p-1 rounded-md text-stone-400 hover:text-stone-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-stone-100 dark:hover:bg-gray-700 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-moss-500"
            >
              <X size={18} />
            </button>
          )}
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
