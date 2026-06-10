import { useEffect } from 'react';

const APP_NAME = "Rafli's Productivity Suite";

/**
 * Sets document.title when the component mounts.
 * Restores the previous title on unmount so nested/sequential routes
 * don't leave a stale title behind.
 *
 * @param {string} [title] - The page-level portion of the title.
 */
export default function useDocumentTitle(title) {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} — ${APP_NAME}` : APP_NAME;
    return () => { document.title = previous; };
  }, [title]);
}
