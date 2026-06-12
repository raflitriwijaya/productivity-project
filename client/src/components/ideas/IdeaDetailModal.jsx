// client/src/components/ideas/IdeaDetailModal.jsx
// Read-only idea detail (Roadmap Wave 4): full description, status, tags, source,
// date, a LinkedItems section (projects/research/contacts/…), and a "Convert to…"
// action that spawns the target entity, links it back, and marks the idea converted.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, ArrowRight, Sparkles, ChevronDown, Bot } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { LinkedItems } from '../shared/LinkedItems';
import api from '../../lib/api';
import { useToast } from '../../hooks/useToast';

const STATUS_VARIANTS = {
  new: 'ember', developing: 'blue', validated: 'moss', archived: 'gray', converted: 'moss',
};
const STATUS_LABELS = {
  new: 'New', developing: 'Developing', validated: 'Validated', archived: 'Archived', converted: 'Converted',
};

// Each convert target: the create endpoint, the body builder (from the idea title),
// and the entity_links type to record + link.
const CONVERT_TARGETS = [
  { key: 'engineer_project', label: 'Project',      endpoint: '/api/engineer', body: (idea) => ({ name: idea.title, description: idea.description || undefined }) },
  { key: 'research_entry',   label: 'Research Note', endpoint: '/api/research', body: (idea) => ({ title: idea.title, type: 'note', content: idea.description || undefined }) },
  { key: 'todo',             label: 'Todo',          endpoint: '/api/todos',    body: (idea) => ({ title: idea.title, description: idea.description || undefined }) },
  { key: 'learning_item',    label: 'Learning Item', endpoint: '/api/learning', body: (idea) => ({ title: idea.title }) },
];

/**
 * @param {{ isOpen: boolean, onClose: () => void, idea: object, onEdit: () => void, onConverted?: () => void }} props
 */
export function IdeaDetailModal({ isOpen, onClose, idea, onEdit, onConverted }) {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [converting, setConverting] = useState(false);

  if (!idea) return null;

  const handleConvert = async (target) => {
    setMenuOpen(false);
    setConverting(true);
    try {
      // 1. Create the target entity.
      const created = await api.post(target.endpoint, target.body(idea));
      const newId = created.data?.id;

      // 2. Record the conversion + flip status on the idea.
      await api.patch(`/api/ideas/${idea.id}`, {
        status: 'converted',
        converted_to: target.key,
        converted_id: newId ?? null,
      });

      // 3. Link the idea to the new entity so it shows under Linked Items (best-effort).
      if (newId) {
        try {
          await api.post('/api/links', {
            from_type: 'idea', from_id: idea.id, to_type: target.key, to_id: newId,
          });
        } catch { /* link is a nicety; conversion already succeeded */ }
      }

      addToast({ type: 'success', title: `Converted to ${target.label}` });
      onConverted?.();
    } catch (err) {
      addToast({ type: 'error', title: 'Conversion failed', message: err.message });
    } finally {
      setConverting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={idea.title}
      size="lg"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>Close</Button>
          <Button variant="secondary" size="md" onClick={() => navigate(`/ai-chat?context=idea&id=${idea.id}`)}>
            <Bot size={14} />
            Ask AI
          </Button>
          <div className="relative">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setMenuOpen((o) => !o)}
              disabled={converting}
            >
              <Sparkles size={14} />
              {converting ? 'Converting…' : 'Convert to'}
              <ChevronDown size={14} />
            </Button>
            {menuOpen && (
              <div className="absolute right-0 bottom-full mb-1 w-48 bg-white dark:bg-gray-800 border border-stone-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden z-10">
                {CONVERT_TARGETS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => handleConvert(t)}
                    className="w-full text-left px-4 py-2.5 text-sm text-stone-700 dark:text-gray-300 hover:bg-stone-50 dark:hover:bg-gray-700/60 transition-colors duration-100"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button variant="primary" size="md" onClick={onEdit}>Edit</Button>
        </>
      }
    >
      {/* Meta */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={STATUS_VARIANTS[idea.status] ?? 'gray'}>{STATUS_LABELS[idea.status] ?? idea.status}</Badge>
        {idea.source && (
          <span className="text-sm text-stone-500 dark:text-gray-400 flex items-center gap-1">
            <ArrowRight size={13} /> {idea.source}
          </span>
        )}
        <span className="text-sm text-stone-400 dark:text-gray-500 flex items-center gap-1 ml-auto">
          <Calendar size={13} /> {new Date(idea.created_at).toLocaleDateString()}
        </span>
      </div>

      {/* Tags */}
      {idea.tags && idea.tags.split(',').filter(t => t.trim()).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {idea.tags.split(',').filter(t => t.trim()).map((tag) => (
            <span key={tag.trim()} className="text-xs px-2 py-0.5 rounded-md bg-stone-100 dark:bg-gray-700 text-stone-600 dark:text-gray-300">
              #{tag.trim()}
            </span>
          ))}
        </div>
      )}

      {/* Description */}
      {idea.description ? (
        <p className="text-sm text-stone-600 dark:text-gray-400 whitespace-pre-wrap">{idea.description}</p>
      ) : (
        <p className="text-sm text-stone-400 dark:text-gray-500 italic">No description yet.</p>
      )}

      {/* Converted note */}
      {idea.status === 'converted' && idea.converted_to && (
        <div className="text-xs text-moss-600 dark:text-moss-400 flex items-center gap-1.5">
          <Sparkles size={12} /> Converted to {idea.converted_to.replace(/_/g, ' ')}{idea.converted_id ? ` #${idea.converted_id}` : ''}
        </div>
      )}

      {/* Linked items (Universal Links, Wave 1) */}
      <div className="border-t border-stone-200 dark:border-gray-700 pt-4">
        <LinkedItems entityType="idea" entityId={idea.id} />
      </div>
    </Modal>
  );
}

export default IdeaDetailModal;
