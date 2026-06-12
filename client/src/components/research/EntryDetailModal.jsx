// client/src/components/research/EntryDetailModal.jsx
// Read view of a research entry: rendered markdown content, topics, tags, source,
// and the attachment section (list + uploader). Opened from the table (title /
// View action). An "Edit" footer button hands off to the create/edit modal.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, ExternalLink, Bot } from 'lucide-react';

import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { MarkdownPreview } from '../engineer/MarkdownEditor';
import { TopicBadge } from './TopicBadge';
import { AttachmentList } from './AttachmentList';
import { AttachmentUploader } from './AttachmentUploader';
import { LinkedItems } from '../shared/LinkedItems';
import { Timer } from '../shared/Timer';
import {
  TYPE_VARIANT, TYPE_LABEL, STATUS_VARIANT, STATUS_LABEL, splitTags,
} from './ResearchEntryRow';

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   entry: Object | null,
 *   onEdit?: (entry: Object) => void,
 * }} props
 */
export function EntryDetailModal({ isOpen, onClose, entry, onEdit }) {
  // Bumped after each upload/delete so AttachmentList re-fetches.
  const [attachVersion, setAttachVersion] = useState(0);
  const bump = () => setAttachVersion(v => v + 1);
  const navigate = useNavigate();

  if (!entry) return null;

  const tags = splitTags(entry.tags);
  const isUrl = entry.source && (entry.source.startsWith('http://') || entry.source.startsWith('https://'));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={entry.title}
      size="lg"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>Close</Button>
          <Button variant="secondary" size="md" onClick={() => navigate(`/ai-chat?context=research_entry&id=${entry.id}`)}>
            <Bot size={14} />
            Ask AI
          </Button>
          {onEdit && (
            <Button variant="primary" size="md" onClick={() => onEdit(entry)}>
              <Pencil size={14} />
              Edit
            </Button>
          )}
        </>
      }
    >
      {/* META: type + status badges */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={TYPE_VARIANT[entry.type] ?? 'gray'}>{TYPE_LABEL[entry.type] ?? entry.type}</Badge>
        <Badge variant={STATUS_VARIANT[entry.status] ?? 'gray'}>{STATUS_LABEL[entry.status] ?? entry.status}</Badge>
      </div>

      {/* TOPICS */}
      {entry.topics && entry.topics.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {entry.topics.map(t => <TopicBadge key={t.id} name={t.name} color={t.color} />)}
        </div>
      )}

      {/* TAGS */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map(t => <Badge key={t} variant="gray">{t}</Badge>)}
        </div>
      )}

      {/* SOURCE */}
      {entry.source && (
        <div>
          <p className="text-xs font-medium text-stone-700 dark:text-gray-300 tracking-wide uppercase mb-1">Source</p>
          {isUrl ? (
            <a
              href={entry.source}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-moss-600 dark:text-moss-400 hover:underline break-all"
            >
              <ExternalLink size={13} className="flex-shrink-0" />
              {entry.source}
            </a>
          ) : (
            <p className="text-sm text-stone-600 dark:text-gray-400 break-words">{entry.source}</p>
          )}
        </div>
      )}

      {/* CONTENT (rendered markdown) */}
      <div>
        <p className="text-xs font-medium text-stone-700 dark:text-gray-300 tracking-wide uppercase mb-2">Content</p>
        <div className="rounded-lg border border-stone-200 dark:border-gray-700 bg-stone-50 dark:bg-gray-700/50 px-4 py-3">
          <MarkdownPreview source={entry.content} />
        </div>
      </div>

      {/* ATTACHMENTS */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-stone-700 dark:text-gray-300 tracking-wide uppercase">Attachments</p>
          <AttachmentUploader entryId={entry.id} onUploaded={bump} />
        </div>
        <AttachmentList entryId={entry.id} refreshKey={attachVersion} onChanged={bump} />
      </div>

      {/* TIME TRACKING (Roadmap Wave 5) */}
      <Timer entityType="research_entry" entityId={entry.id} />

      {/* UNIVERSAL LINKS (Roadmap Wave 1) */}
      <div className="border-t border-stone-200 dark:border-gray-700 pt-4">
        <LinkedItems entityType="research_entry" entityId={entry.id} />
      </div>
    </Modal>
  );
}
