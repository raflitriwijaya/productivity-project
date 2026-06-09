// client/src/components/engineer/CreateIssueModal.jsx
// Create & edit modal for project issues — mode toggled via `issue` prop:
//   null   → create mode
//   object → edit mode (pre-fills fields)
//
// In create mode, an optional `prefill` object (e.g. { title, description } from
// a check-in's "bugs discovered") seeds the initial fields. Success/error toast.

import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Textarea, Select } from '../ui/Input';
import { useToast } from '../../hooks/useToast';

const SEVERITY_OPTIONS = [
  { value: 'P0-Critical', label: 'P0 · Critical' },
  { value: 'P1-High',     label: 'P1 · High' },
  { value: 'P2-Medium',   label: 'P2 · Medium' },
  { value: 'P3-Low',      label: 'P3 · Low' },
];

const STATUS_OPTIONS = [
  { value: 'open',        label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved',    label: 'Resolved' },
];

const SEVERITIES = SEVERITY_OPTIONS.map(o => o.value);
const STATUSES = STATUS_OPTIONS.map(o => o.value);

const baseForm = () => ({
  title:       '',
  description: '',
  severity:    'P2-Medium',
  status:      'open',
  component:   '',
  assignee:    '',
});

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   onSubmit: (data: Object) => Promise<void>,
 *   issue?: Object | null,
 *   prefill?: { title?: string, description?: string } | null,
 * }} props
 */
export function CreateIssueModal({ isOpen, onClose, onSubmit, issue = null, prefill = null }) {
  const isEdit = issue !== null;
  const { addToast } = useToast();

  const [form, setForm] = useState(baseForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    /* Phase 4: setState calls here are intentional modal-open resets, not loops */
    /* eslint-disable react-hooks/set-state-in-effect */
    setErrors({});
    if (isEdit) {
      setForm({
        title:       issue.title       ?? '',
        description: issue.description  ?? '',
        severity:    issue.severity     ?? 'P2-Medium',
        status:      issue.status       ?? 'open',
        component:   issue.component    ?? '',
        assignee:    issue.assignee     ?? '',
      });
    } else {
      setForm({ ...baseForm(), title: prefill?.title ?? '', description: prefill?.description ?? '' });
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, issue, isEdit, prefill]);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.title.trim()) errs.title = 'Title is required.';
    if (!SEVERITIES.includes(form.severity)) errs.severity = 'Select a valid severity.';
    if (!STATUSES.includes(form.status)) errs.status = 'Select a valid status.';
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSubmitting(true);
    try {
      const payload = {
        title:       form.title.trim(),
        description: form.description.trim() || undefined,
        severity:    form.severity,
        status:      form.status,
        component:   form.component.trim() || undefined,
        assignee:    form.assignee.trim() || undefined,
      };
      await onSubmit(payload);
      addToast({ type: 'success', title: isEdit ? 'Issue updated' : 'Issue created' });
      onClose();
    } catch (err) {
      setErrors({ _global: err.message });
      addToast({ type: 'error', title: isEdit ? 'Update failed' : 'Create failed', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Issue' : 'New Issue'}
      size="md"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" size="md" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save Changes' : 'Create Issue')}
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
        id="issue-title"
        label="Title"
        placeholder="e.g. LoRa uplink drops after ~1h uptime"
        value={form.title}
        onChange={set('title')}
        error={errors.title}
      />

      <div className="grid grid-cols-2 gap-4">
        <Select
          id="issue-severity"
          label="Severity"
          value={form.severity}
          onChange={set('severity')}
          error={errors.severity}
        >
          {SEVERITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>

        <Select
          id="issue-status"
          label="Status"
          value={form.status}
          onChange={set('status')}
          error={errors.status}
        >
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          id="issue-component"
          label="Component"
          placeholder="e.g. firmware, radio, power"
          value={form.component}
          onChange={set('component')}
        />
        <Input
          id="issue-assignee"
          label="Assignee"
          placeholder="e.g. Rafli"
          value={form.assignee}
          onChange={set('assignee')}
        />
      </div>

      <Textarea
        id="issue-description"
        label="Description"
        placeholder="Steps to reproduce, expected vs actual, logs…"
        value={form.description}
        onChange={set('description')}
        rows={5}
      />
    </Modal>
  );
}
