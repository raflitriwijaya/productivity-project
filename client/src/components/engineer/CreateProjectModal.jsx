// client/src/components/engineer/CreateProjectModal.jsx
// Create & edit modal for engineer projects — mode toggled via `project` prop:
//   null   → create mode (template picker available)
//   object → edit mode (pre-fills fields; template picker hidden)
//
// On submit, surfaces success/error through useToast (§5.7).

import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Textarea, Select } from '../ui/Input';
import { useToast } from '../../hooks/useToast';

const EMPTY_FORM = {
  name:         '',
  description:  '',
  project_type: 'iot',
  platforms:    '',
  stack:        '',
  status:       'idea',
  repo_url:     '',
};

const TYPE_OPTIONS = [
  { value: 'iot',      label: 'IoT' },
  { value: 'embedded', label: 'Embedded' },
  { value: 'robotics', label: 'Robotics' },
  { value: 'other',    label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: 'idea',        label: 'Idea' },
  { value: 'planning',    label: 'Planning' },
  { value: 'development', label: 'Development' },
  { value: 'testing',     label: 'Testing' },
  { value: 'deployed',    label: 'Deployed' },
  { value: 'archived',    label: 'Archived' },
];

const TYPES = TYPE_OPTIONS.map(o => o.value);
const STATUSES = STATUS_OPTIONS.map(o => o.value);

/**
 * Map a template's `domain` to a project `project_type`.
 * @param {string} domain
 * @returns {string}
 */
function domainToType(domain) {
  return TYPES.includes(domain) ? domain : 'other';
}

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   onSubmit: (data: Object) => Promise<void>,
 *   project?: Object | null,
 *   templates?: Object[],
 * }} props
 */
export function CreateProjectModal({ isOpen, onClose, onSubmit, project = null, templates = [] }) {
  const isEdit = project !== null;
  const { addToast } = useToast();

  const [form, setForm] = useState(EMPTY_FORM);
  const [templateId, setTemplateId] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Sync form state when the modal opens (fresh create or editing a project).
  useEffect(() => {
    if (!isOpen) return;
    /* Phase 4: setState calls here are intentional modal-open resets, not loops */
    /* eslint-disable react-hooks/set-state-in-effect */
    setErrors({});
    setTemplateId('');
    if (isEdit) {
      setForm({
        name:         project.name         ?? '',
        description:  project.description  ?? '',
        project_type: project.project_type ?? 'iot',
        platforms:    project.platforms    ?? '',
        stack:        project.stack        ?? '',
        status:       project.status       ?? 'idea',
        repo_url:     project.repo_url      ?? '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, project, isEdit]);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  /** Apply a template's name/description/type to the (empty) create form. */
  const applyTemplate = (e) => {
    const id = e.target.value;
    setTemplateId(id);
    if (!id) return;
    const tpl = templates.find(t => String(t.id) === String(id));
    if (!tpl) return;
    setForm(f => ({
      ...f,
      // Only fill the name if the user hasn't typed one yet.
      name:         f.name.trim() ? f.name : tpl.name,
      description:  tpl.description ?? f.description,
      project_type: domainToType(tpl.domain),
    }));
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required.';
    if (!TYPES.includes(form.project_type)) errs.project_type = 'Select a valid type.';
    if (!STATUSES.includes(form.status)) errs.status = 'Select a valid status.';
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSubmitting(true);
    try {
      const payload = {
        name:         form.name.trim(),
        description:  form.description.trim() || undefined,
        project_type: form.project_type,
        platforms:    form.platforms.trim() || undefined,
        stack:        form.stack.trim() || undefined,
        status:       form.status,
        repo_url:     form.repo_url.trim() || undefined,
      };
      await onSubmit(payload);
      addToast({ type: 'success', title: isEdit ? 'Project updated' : 'Project created' });
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
      title={isEdit ? 'Edit Project' : 'New Project'}
      size="md"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" size="md" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save Changes' : 'Create Project')}
          </Button>
        </>
      }
    >
      {errors._global && (
        <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2">
          {errors._global}
        </p>
      )}

      {/* Template picker — create mode only */}
      {!isEdit && templates.length > 0 && (
        <Select
          id="project-template"
          label="Start from a template"
          value={templateId}
          onChange={applyTemplate}
          helperText="Optional — pre-fills name, description, and type. You can edit everything after."
        >
          <option value="">No template (blank project)</option>
          {templates.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </Select>
      )}

      <Input
        id="project-name"
        label="Name"
        placeholder="e.g. Greenhouse moisture monitor"
        value={form.name}
        onChange={set('name')}
        error={errors.name}
      />

      <div className="grid grid-cols-2 gap-4">
        <Select
          id="project-type"
          label="Type"
          value={form.project_type}
          onChange={set('project_type')}
          error={errors.project_type}
        >
          {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>

        <Select
          id="project-status"
          label="Status"
          value={form.status}
          onChange={set('status')}
          error={errors.status}
        >
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </div>

      <Input
        id="project-platforms"
        label="Platforms"
        placeholder="e.g. ESP32, Raspberry Pi"
        value={form.platforms}
        onChange={set('platforms')}
        helperText="Comma-separated hardware/platform tags."
      />

      <Input
        id="project-stack"
        label="Stack"
        placeholder="e.g. Arduino, PlatformIO, MQTT"
        value={form.stack}
        onChange={set('stack')}
        helperText="Comma-separated languages, frameworks, and tools."
      />

      <Input
        id="project-repo"
        label="Repository URL"
        placeholder="https://github.com/you/project"
        value={form.repo_url}
        onChange={set('repo_url')}
      />

      <Textarea
        id="project-description"
        label="Description"
        placeholder="What does this project do, and why?"
        value={form.description}
        onChange={set('description')}
        rows={4}
      />
    </Modal>
  );
}
