// client/src/components/research/AttachmentUploader.jsx
// Single-file uploader: a Button triggers a hidden <input type="file">; the
// chosen file is POSTed as multipart/form-data to /api/research/:id/attachments.
// Axios sets the multipart boundary automatically when given a FormData body,
// overriding the client's default JSON Content-Type.
//
// The allowlist mirrors the server fileFilter (jpg/png/pdf/txt/md/cpp/py/zip,
// 10 MB) so obviously-wrong files are caught before the request; the server is
// still the source of truth and returns 400 on rejection.

import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';

import api from '../../lib/api';
import { Button } from '../ui/Button';
import { useToast } from '../../hooks/useToast';

const ACCEPT = '.jpg,.jpeg,.png,.pdf,.txt,.md,.cpp,.py,.zip';
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * @param {{ entryId: number, onUploaded?: () => void }} props
 */
export function AttachmentUploader({ entryId, onUploaded }) {
  const { addToast } = useToast();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const pick = () => inputRef.current?.click();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so the same file can be re-picked later
    if (!file) return;

    if (file.size > MAX_SIZE) {
      addToast({ type: 'error', title: 'File too large', message: 'Maximum size is 10 MB.' });
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      await api.post(`/api/research/${entryId}/attachments`, formData);
      addToast({ type: 'success', title: 'File uploaded', message: file.name });
      onUploaded?.();
    } catch (err) {
      addToast({ type: 'error', title: 'Upload failed', message: err.message });
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={handleFile}
        className="hidden"
      />
      <Button variant="secondary" size="sm" onClick={pick} disabled={uploading}>
        <Upload size={14} />
        {uploading ? 'Uploading…' : 'Upload file'}
      </Button>
    </>
  );
}
