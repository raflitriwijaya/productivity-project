// client/src/components/ideas/CreateIdeaModal.jsx
// Create / Edit an idea (Roadmap Wave 4). idea === null → Create, else Edit (PATCH).
// Does its own API call, then calls onSaved() so the parent refetches and closes.
// Follows the CreateContactModal pattern: action buttons live in the Modal footer.

import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Textarea, Select } from '../ui/Input';
import api from '../../lib/api';
import { useToast } from '../../hooks/useToast';

const EMPTY_FORM = {
  title: '', description: '', status: 'new', tags: '', source: '',
};

/**
 * @param {{ isOpen: boolean, onClose: () => void, onSaved: () => void, idea?: object|null }} props
 */
export function CreateIdeaModal({ isOpen, onClose, onSaved, idea = null }) {
  const isEdit = idea !== null;
  const { addToast } = useToast();

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Sync the form when the modal opens (create → blank, edit → populated).
  useEffect(() => {
    if (!isOpen) return;
    /* setState here is intentional modal-open sync (mirrors CreateContactModal) */
    /* eslint-disable react-hooks/set-state-in-effect */
    if (isEdit && idea) {
      setForm({
        title:       idea.title       ?? '',
        description: idea.description ?? '',
        status:      idea.status      ?? 'new',
        tags:        idea.tags        ?? '',
        source:      idea.source      ?? '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setErrors({});
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, idea, isEdit]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.title.trim()) errs.title = 'Title is required.';
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSubmitting(true);
    try {
      const payload = {
        title:       form.title.trim(),
        description: form.description.trim() || null,
        status:      form.status,
        tags:        form.tags.trim() || null,
        source:      form.source.trim() || null,
      };
      if (isEdit) {
        await api.patch(`/api/ideas/${idea.id}`, payload);
        addToast({ type: 'success', title: 'Idea updated' });
      } else {
        await api.post('/api/ideas', payload);
        addToast({ type: 'success', title: 'Idea captured' });
      }
      onSaved();
    } catch (err) {
      addToast({ type: 'error', title: isEdit ? 'Failed to update idea' : 'Failed to capture idea', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Idea' : 'Capture Idea'}
      size="md"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" size="md" onClick={handleSubmit} disabled={submitting || !form.title.trim()}>
            {submitting ? (isEdit ? 'Saving…' : 'Capturing…') : (isEdit ? 'Save Changes' : 'Capture Idea')}
          </Button>
        </>
      }
    >
      <Input
        id="idea-title"
        label="Title"
        placeholder="What's the idea?"
        value={form.title}
        onChange={set('title')}
        error={errors.title}
      />

      <Textarea
        id="idea-description"
        label="Description (optional)"
        rows={4}
        placeholder="Flesh it out — the problem, the angle, why it might work…"
        value={form.description}
        onChange={set('description')}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select id="idea-status" label="Status" value={form.status} onChange={set('status')}>
          <option value="new">New</option>
          <option value="developing">Developing</option>
          <option value="validated">Validated</option>
          <option value="archived">Archived</option>
          <option value="converted">Converted</option>
        </Select>
        <Input
          id="idea-source"
          label="Source (optional)"
          placeholder="e.g. shower thought, meeting"
          value={form.source}
          onChange={set('source')}
        />
      </div>

      <Input
        id="idea-tags"
        label="Tags (optional)"
        placeholder="Comma-separated, e.g. product, growth, b2b"
        value={form.tags}
        onChange={set('tags')}
      />
    </Modal>
  );
}

export default CreateIdeaModal;
