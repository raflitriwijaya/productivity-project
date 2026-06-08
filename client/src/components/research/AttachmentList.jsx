// client/src/components/research/AttachmentList.jsx
// Lists an entry's attachments with a download link + delete action.
// Files are served statically by the API at /uploads/<filename> (the random
// stored name, not original_name). Four-state (loading/error/empty/data).

import { Download, Trash2, Paperclip } from 'lucide-react';

import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { Button } from '../ui/Button';
import { ListSkeleton } from '../ui/Skeleton';
import { useToast } from '../../hooks/useToast';

// Base URL for static file links — mirrors lib/api.js's baseURL resolution.
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/** Human-readable byte size. */
function formatSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * @param {{ entryId: number, refreshKey?: number, onChanged?: () => void }} props
 *   `refreshKey` lets a parent force a re-fetch after an upload.
 */
export function AttachmentList({ entryId, refreshKey = 0, onChanged }) {
  const { addToast } = useToast();
  const { data: attachments, loading, error, refetch } = useApi(
    () => api.get(`/api/research/${entryId}/attachments`),
    [entryId, refreshKey]
  );

  const handleDelete = async (att) => {
    try {
      await api.delete(`/api/research/attachments/${att.id}`);
      addToast({ type: 'success', title: 'Attachment deleted' });
      refetch();
      onChanged?.();
    } catch (err) {
      addToast({ type: 'error', title: 'Delete failed', message: err.message });
    }
  };

  if (loading) return <ListSkeleton rows={2} />;

  if (error) {
    return <p className="text-xs text-red-600 dark:text-red-400">Could not load attachments.</p>;
  }

  if (!attachments || attachments.length === 0) {
    return (
      <p className="text-xs text-stone-400 dark:text-gray-500 flex items-center gap-1.5">
        <Paperclip size={13} /> No attachments yet.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {attachments.map(att => (
        <li
          key={att.id}
          className="flex items-center gap-3 px-3 py-2 rounded-lg border border-stone-200 dark:border-gray-700 bg-stone-50 dark:bg-gray-700/50"
        >
          <Paperclip size={14} className="flex-shrink-0 text-stone-400 dark:text-gray-500" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-stone-900 dark:text-gray-50 truncate">{att.original_name}</p>
            <p className="text-[11px] text-stone-400 dark:text-gray-500">{formatSize(att.size)}</p>
          </div>
          <a
            href={`${API_BASE}/uploads/${att.filename}`}
            target="_blank"
            rel="noopener noreferrer"
            download={att.original_name}
            className="p-1.5 rounded-md text-stone-400 hover:text-moss-600 dark:text-gray-500 dark:hover:text-moss-400 hover:bg-stone-200/60 dark:hover:bg-gray-600"
            aria-label={`Download ${att.original_name}`}
          >
            <Download size={15} />
          </a>
          <button
            type="button"
            onClick={() => handleDelete(att)}
            className="p-1.5 rounded-md text-stone-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 hover:bg-stone-200/60 dark:hover:bg-gray-600"
            aria-label={`Delete ${att.original_name}`}
          >
            <Trash2 size={15} />
          </button>
        </li>
      ))}
    </ul>
  );
}
