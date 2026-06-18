import { Download, Trash2, Paperclip } from 'lucide-react';

import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { ListSkeleton } from '../ui/Skeleton';
import { useToast } from '../../hooks/useToast';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function formatSize(bytes) {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * @param {{ documentId: number, refreshKey?: number, onChanged?: () => void }} props
 */
export function DocAttachmentList({ documentId, refreshKey = 0, onChanged }) {
  const { addToast } = useToast();
  const { data: attachments, loading, error, refetch } = useApi(
    () => api.get(`/api/engineer/documents/${documentId}/attachments`),
    [documentId, refreshKey]
  );

  const handleDelete = async (att) => {
    try {
      await api.delete(`/api/engineer/documents/attachments/${att.id}`);
      addToast({ type: 'success', title: 'Attachment deleted' });
      refetch();
      onChanged?.();
    } catch (err) {
      addToast({ type: 'error', title: 'Delete failed', message: err.message });
    }
  };

  const handleDownload = async (att) => {
    try {
      const response = await fetch(
        `${BASE_URL}/api/engineer/documents/attachments/${att.id}/download`,
        { credentials: 'include' },
      );
      if (!response.ok) throw new Error(`Download failed (${response.status})`);
      const blob = await response.blob();
      if (blob.size === 0) throw new Error('File is empty');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = att.original_name || att.filename || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
    } catch (err) {
      addToast({ type: 'error', title: 'Download failed', message: err.message });
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
          <button
            type="button"
            onClick={() => handleDownload(att)}
            className="p-1.5 rounded-md text-stone-400 hover:text-moss-600 dark:text-gray-500 dark:hover:text-moss-400 hover:bg-stone-200/60 dark:hover:bg-gray-600"
            aria-label={`Download ${att.original_name}`}
          >
            <Download size={15} />
          </button>
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
