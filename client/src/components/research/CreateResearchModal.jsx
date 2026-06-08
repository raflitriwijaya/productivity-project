// client/src/components/research/CreateResearchModal.jsx
// Create & edit modal — mode toggled via `entry` prop:
//   null  → create mode
//   object → edit mode (pre-fills form fields)

import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/Input';
import { TopicSelector } from './TopicSelector';
import { TagInput } from './TagInput';
import { MarkdownEditor } from '../engineer/MarkdownEditor';

const EMPTY_FORM = {
  title:   '',
  type:    'note',
  status:  'draft',
  content: '',
  source:  '',
  tags:    '',
  topic_ids: [],
};

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   onSubmit: (data: Object) => Promise<void>,
 *   entry: Object | null,
 * }} props
 */
export function CreateResearchModal({ isOpen, onClose, onSubmit, entry = null }) {
  const isEdit = entry !== null;

  const [form, setForm]       = useState(EMPTY_FORM);
  const [errors, setErrors]   = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Sync form state when entry changes (edit mode) or modal opens fresh (create mode)
  useEffect(() => {
    if (isOpen) {
      setErrors({});
      if (isEdit) {
        setForm({
          title:   entry.title   ?? '',
          type:    entry.type    ?? 'note',
          status:  entry.status  ?? 'draft',
          content: entry.content ?? '',
          source:  entry.source  ?? '',
          tags:    entry.tags    ?? '',
          // entry.topics is `[{ id, name, color }]` from the list/get endpoints.
          topic_ids: Array.isArray(entry.topics) ? entry.topics.map(t => t.id) : [],
        });
      } else {
        setForm(EMPTY_FORM);
      }
    }
  }, [isOpen, entry, isEdit]);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.title.trim()) errs.title = 'Title is required.';
    if (!['journal', 'citation', 'note'].includes(form.type))
      errs.type = 'Select a valid type.';
    if (!['draft', 'active', 'archived'].includes(form.status))
      errs.status = 'Select a valid status.';
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSubmitting(true);
    try {
      const payload = {
        title:   form.title.trim(),
        type:    form.type,
        status:  form.status,
        content: form.content.trim() || undefined,
        source:  form.source.trim()  || undefined,
        tags:    form.tags.trim()    || undefined,
        topic_ids: form.topic_ids,
      };
      await onSubmit(payload);
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
      title={isEdit ? 'Edit Entry' : 'New Research Entry'}
      size="md"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" size="md" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save Changes' : 'Create Entry')}
          </Button>
        </>
      }
    >
      {/* Global API error */}
      {errors._global && (
        <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2">
          {errors._global}
        </p>
      )}

      <Input
        id="research-title"
        label="Title"
        placeholder="e.g. Soil moisture sensor calibration"
        value={form.title}
        onChange={set('title')}
        error={errors.title}
      />

      <div className="grid grid-cols-2 gap-4">
        <Select
          id="research-type"
          label="Type"
          value={form.type}
          onChange={set('type')}
          error={errors.type}
        >
          <option value="note">Note</option>
          <option value="journal">Journal Entry</option>
          <option value="citation">Citation</option>
        </Select>

        <Select
          id="research-status"
          label="Status"
          value={form.status}
          onChange={set('status')}
          error={errors.status}
        >
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </Select>
      </div>

      <Input
        id="research-source"
        label="Source / URL"
        placeholder="https://doi.org/… or author, year, title"
        value={form.source}
        onChange={set('source')}
        helperText="Paste a DOI/URL or write a citation string."
      />

      <TagInput
        value={form.tags}
        onChange={(tags) => setForm(f => ({ ...f, tags }))}
      />

      <TopicSelector
        selectedIds={form.topic_ids}
        onChange={(ids) => setForm(f => ({ ...f, topic_ids: ids }))}
      />

      <div>
        <label className="block text-xs font-medium text-stone-700 dark:text-gray-300 tracking-wide uppercase mb-1.5">
          Content / Notes
        </label>
        <MarkdownEditor
          value={form.content}
          onChange={(md) => setForm(f => ({ ...f, content: md }))}
          height={300}
        />
      </div>
    </Modal>
  );
}
