// client/src/components/research/CreateTopicModal.jsx
// Create & edit modal for research topics. Mode toggled via the `topic` prop:
//   null   → create mode (POST /api/research/topics)
//   object → edit mode   (PATCH /api/research/topics/:id), pre-fills fields.
// Mirrors CreateResearchModal's shape (EMPTY_FORM, sync-on-open, validate, submit).

import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Textarea, Select } from '../ui/Input';
import api from '../../lib/api';
import { useToast } from '../../hooks/useToast';
import { TOPIC_COLORS, DEFAULT_TOPIC_COLOR } from './topicColors';

const EMPTY_FORM = {
  name:        '',
  description: '',
  color:       DEFAULT_TOPIC_COLOR,
};

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   onSaved?: () => void,
 *   topic?: Object | null,
 * }} props
 */
export function CreateTopicModal({ isOpen, onClose, onSaved, topic = null }) {
  const isEdit = topic !== null;
  const { addToast } = useToast();

  const [form, setForm]             = useState(EMPTY_FORM);
  const [errors, setErrors]         = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Sync form when the modal opens (fresh in create mode, pre-filled in edit mode).
  useEffect(() => {
    if (isOpen) {
      /* Phase 4: setState here is intentional modal-open sync */
      /* eslint-disable react-hooks/set-state-in-effect */
      setErrors({});
      if (isEdit) {
        setForm({
          name:        topic.name        ?? '',
          description: topic.description  ?? '',
          color:       topic.color        ?? DEFAULT_TOPIC_COLOR,
        });
      } else {
        setForm(EMPTY_FORM);
      }
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [isOpen, topic, isEdit]);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required.';
    if (!TOPIC_COLORS.some(c => c.value === form.color)) errs.color = 'Select a valid color.';
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSubmitting(true);
    try {
      const payload = {
        name:        form.name.trim(),
        description: form.description.trim() || undefined,
        color:       form.color,
      };
      if (isEdit) {
        await api.patch(`/api/research/topics/${topic.id}`, payload);
        addToast({ type: 'success', title: 'Topic updated' });
      } else {
        await api.post('/api/research/topics', payload);
        addToast({ type: 'success', title: 'Topic created' });
      }
      onSaved?.();
      onClose();
    } catch (err) {
      setErrors({ _global: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Topic' : 'New Topic'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" size="md" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save Changes' : 'Create Topic')}
          </Button>
        </>
      }
    >
      {errors._global && (
        <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2">
          {errors._global}
        </p>
      )}

      <Input
        id="topic-name"
        label="Name"
        placeholder="e.g. Agritech"
        value={form.name}
        onChange={set('name')}
        error={errors.name}
      />

      <Select
        id="topic-color"
        label="Color"
        value={form.color}
        onChange={set('color')}
        error={errors.color}
      >
        {TOPIC_COLORS.map(c => (
          <option key={c.value} value={c.value}>{c.label}</option>
        ))}
      </Select>

      <Textarea
        id="topic-description"
        label="Description"
        placeholder="What does this topic group together?"
        value={form.description}
        onChange={set('description')}
        rows={3}
      />
    </Modal>
  );
}
