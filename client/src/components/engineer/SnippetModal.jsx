// client/src/components/engineer/SnippetModal.jsx
// Full read-only view of a single snippet in a Modal, with a copy button and
// Edit / Delete actions in the footer. The full (unclamped) code is rendered
// with syntax highlighting and scrolls within the modal body.

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { CodeBlock } from './CodeBlock';
import { LANGUAGE_LABEL } from './snippetConstants';
import { splitTags } from './ProjectRow';
import { useToast } from '../../hooks/useToast';

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   snippet: Object | null,
 *   onEdit: (snippet: Object) => void,
 *   onDelete: (snippet: Object) => void,
 * }} props
 */
export function SnippetModal({ isOpen, onClose, snippet, onEdit, onDelete }) {
  const { addToast } = useToast();
  const [copied, setCopied] = useState(false);

  if (!snippet) return null;

  const tags = splitTags(snippet.tags);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet.code);
      setCopied(true);
      addToast({ type: 'success', title: 'Copied to clipboard' });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      addToast({ type: 'error', title: 'Copy failed', message: 'Clipboard access was denied.' });
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={snippet.title}
      size="lg"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={handleCopy}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copied' : 'Copy code'}
          </Button>
          <Button variant="ghost" size="md" onClick={() => onEdit(snippet)}>Edit</Button>
          <Button variant="danger" size="md" onClick={() => onDelete(snippet)}>Delete</Button>
        </>
      }
    >
      {/* Meta badges */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="terracotta">{snippet.category}</Badge>
        <Badge variant="gray">{LANGUAGE_LABEL[snippet.language] ?? snippet.language}</Badge>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {tags.map(t => (
            <span key={t} className="text-[11px] text-stone-400 dark:text-gray-500">#{t}</span>
          ))}
        </div>
      )}

      <CodeBlock code={snippet.code} language={snippet.language} />
    </Modal>
  );
}
