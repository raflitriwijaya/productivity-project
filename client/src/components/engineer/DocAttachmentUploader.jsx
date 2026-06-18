import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';

import api from '../../lib/api';
import { Button } from '../ui/Button';
import { useToast } from '../../hooks/useToast';

const ACCEPT = '.jpg,.jpeg,.png,.pdf,.txt,.md,.cpp,.py,.zip';
const MAX_SIZE = 100 * 1024 * 1024; //100 MB

/**
 * @param {{ documentId: number, onUploaded?: () => void }} props
 */
export function DocAttachmentUploader({ documentId, onUploaded }) {
  const { addToast } = useToast();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const pick = () => inputRef.current?.click();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > MAX_SIZE) {
      addToast({ type: 'error', title: 'File too large', message: 'Maximum size is 10 MB.' });
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      await api.post(`/api/engineer/documents/${documentId}/attachments`, formData);
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
