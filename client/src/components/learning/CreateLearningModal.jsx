// client/src/components/learning/CreateLearningModal.jsx
// mode: item === null → Create   |   item === object → Edit (PATCH)
// Parent is responsible for calling onSubmit(formData) and closing on success.

import { useState, useEffect } from 'react';
import { Modal }   from '../ui/Modal';
import { Button }  from '../ui/Button';
import { Input, Textarea, Select } from '../ui/Input';

const EMPTY_FORM = {
  title:        '',
  type:         'course',
  source:       '',
  status:       'not_started',
  priority:     2,
  progress:     0,
  total_hours:  '',
  spent_hours:  '',
  started_at:   '',
  completed_at: '',
  notes:        '',
  url:          '',
};

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   onSubmit: (data: object) => Promise<void>,
 *   item?: object | null,
 * }} props
 */
export function CreateLearningModal({ isOpen, onClose, onSubmit, item = null }) {
  const isEdit = item !== null;

  const [form,       setForm]       = useState(EMPTY_FORM);
  const [errors,     setErrors]     = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Populate form when editing
  useEffect(() => {
    if (isOpen) {
      /* Phase 4: setState here is intentional modal-open sync */
      /* eslint-disable react-hooks/set-state-in-effect */
      if (isEdit && item) {
        setForm({
          title:        item.title        ?? '',
          type:         item.type         ?? 'course',
          source:       item.source       ?? '',
          status:       item.status       ?? 'not_started',
          priority:     item.priority     ?? 2,
          progress:     item.progress     ?? 0,
          total_hours:  item.total_hours  != null ? String(item.total_hours) : '',
          spent_hours:  item.spent_hours  != null ? String(item.spent_hours) : '',
          started_at:   item.started_at   ?? '',
          completed_at: item.completed_at ?? '',
          notes:        item.notes        ?? '',
          url:          item.url          ?? '',
        });
      } else {
        setForm(EMPTY_FORM);
      }
      setErrors({});
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [isOpen, item, isEdit]);

  const set = (field) => (e) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.title.trim())                              errs.title = 'Title is required.';
    if (form.progress < 0 || form.progress > 100)       errs.progress = 'Must be 0–100.';
    if (form.url && !/^https?:\/\/.+/.test(form.url))   errs.url = 'Must be a valid URL (https://…).';
    if (form.total_hours !== '' && isNaN(parseFloat(form.total_hours)))
      errs.total_hours = 'Must be a number.';
    if (form.spent_hours !== '' && isNaN(parseFloat(form.spent_hours)))
      errs.spent_hours = 'Must be a number.';
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSubmitting(true);
    try {
      // Build payload — strip empty optional strings to null so backend gets clean data
      const payload = {
        title:        form.title.trim(),
        type:         form.type,
        status:       form.status,
        priority:     Number(form.priority),
        progress:     Number(form.progress),
        source:       form.source.trim()       || null,
        url:          form.url.trim()          || null,
        notes:        form.notes.trim()        || null,
        started_at:   form.started_at          || null,
        completed_at: form.completed_at        || null,
        total_hours:  form.total_hours !== ''  ? parseFloat(form.total_hours)  : null,
        spent_hours:  form.spent_hours !== ''  ? parseFloat(form.spent_hours)  : null,
      };
      await onSubmit(payload);
    } catch {
      // Parent surfaces toast errors; modal stays open so user can retry
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Learning Item' : 'Add Learning Item'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" size="md" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (isEdit ? 'Saving…' : 'Adding…') : (isEdit ? 'Save Changes' : 'Add Item')}
          </Button>
        </>
      }
    >
      {/* Row 1: Title + Type */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <Input
            id="learn-title"
            label="Title"
            placeholder="e.g. Deep Learning Specialization"
            value={form.title}
            onChange={set('title')}
            error={errors.title}
          />
        </div>
        <Select
          id="learn-type"
          label="Type"
          value={form.type}
          onChange={set('type')}
        >
          <option value="course">Course</option>
          <option value="book">Book</option>
          <option value="video">Video</option>
          <option value="article">Article</option>
          <option value="other">Other</option>
        </Select>
      </div>

      {/* Row 2: Source + URL */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          id="learn-source"
          label="Source (optional)"
          placeholder="e.g. Coursera, O'Reilly"
          value={form.source}
          onChange={set('source')}
        />
        <Input
          id="learn-url"
          label="URL (optional)"
          placeholder="https://"
          value={form.url}
          onChange={set('url')}
          error={errors.url}
        />
      </div>

      {/* Row 3: Status + Priority + Progress */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Select id="learn-status" label="Status" value={form.status} onChange={set('status')}>
          <option value="not_started">Not Started</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="on_hold">On Hold</option>
        </Select>
        <Select id="learn-priority" label="Priority" value={form.priority} onChange={set('priority')}>
          <option value={1}>High</option>
          <option value={2}>Medium</option>
          <option value={3}>Low</option>
        </Select>
        <Input
          id="learn-progress"
          label="Progress (%)"
          type="number"
          min={0}
          max={100}
          value={form.progress}
          onChange={set('progress')}
          error={errors.progress}
        />
      </div>

      {/* Row 4: Hours */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          id="learn-total-hours"
          label="Total Hours (optional)"
          type="number"
          min={0}
          step="0.5"
          placeholder="e.g. 40"
          value={form.total_hours}
          onChange={set('total_hours')}
          error={errors.total_hours}
        />
        <Input
          id="learn-spent-hours"
          label="Hours Spent (optional)"
          type="number"
          min={0}
          step="0.5"
          placeholder="e.g. 12"
          value={form.spent_hours}
          onChange={set('spent_hours')}
          error={errors.spent_hours}
        />
      </div>

      {/* Row 5: Dates */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          id="learn-started-at"
          label="Started (optional)"
          type="date"
          value={form.started_at}
          onChange={set('started_at')}
        />
        <Input
          id="learn-completed-at"
          label="Completed (optional)"
          type="date"
          value={form.completed_at}
          onChange={set('completed_at')}
        />
      </div>

      {/* Row 6: Notes */}
      <Textarea
        id="learn-notes"
        label="Notes (optional)"
        rows={3}
        placeholder="Key takeaways, reminders, or context…"
        value={form.notes}
        onChange={set('notes')}
      />
    </Modal>
  );
}
