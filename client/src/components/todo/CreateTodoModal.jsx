// client/src/components/todo/CreateTodoModal.jsx
// Renders via React portal (Modal component handles that internally — §5.6).
// edit mode: receives an existing `todo` object → form is pre-filled, submits PATCH.
// create mode: `todo` is null → empty form, submits POST.

import { useState, useEffect } from 'react';
import { Modal }   from '../ui/Modal';
import { Button }  from '../ui/Button';
import { Input, Textarea, Select } from '../ui/Input';

/**
 * @param {Object}   props
 * @param {boolean}  props.isOpen
 * @param {Function} props.onClose
 * @param {Function} props.onSubmit  - async (formData) => void; parent calls api + refetch
 * @param {import('../../pages/Todo').Todo|null} props.todo  - null = create, object = edit
 */
export function CreateTodoModal({ isOpen, onClose, onSubmit, todo = null }) {
  const isEdit = todo !== null;

  const emptyForm = {
    title:       '',
    description: '',
    status:      'pending',
    priority:    '2',
    due_date:    '',
    due_time:    '',
  };

  const [form,       setForm]       = useState(emptyForm);
  const [errors,     setErrors]     = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Populate form when editing or reset when opening for create
  useEffect(() => {
    if (isOpen) {
      /* Phase 4: setState here is intentional modal-open sync */
      /* eslint-disable react-hooks/set-state-in-effect */
      if (isEdit) {
        setForm({
          title:       todo.title       ?? '',
          description: todo.description ?? '',
          status:      todo.status      ?? 'pending',
          priority:    String(todo.priority ?? 2),
          due_date:    todo.due_date    ?? '',
          // due_time comes back as 'HH:MM:SS'; the <input type="time"> wants 'HH:MM'.
          due_time:    todo.due_time ? todo.due_time.slice(0, 5) : '',
        });
      } else {
        setForm(emptyForm);
      }
      setErrors({});
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  /** @param {React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>} e */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    if (errors[name]) setErrors(e => ({ ...e, [name]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (!form.title.trim())            next.title    = 'Title is required.';
    if (form.title.trim().length > 255) next.title   = 'Title must be 255 characters or fewer.';
    if (form.due_date && !/^\d{4}-\d{2}-\d{2}$/.test(form.due_date))
                                       next.due_date = 'Date must be YYYY-MM-DD.';
    return next;
  };

  const handleSubmit = async () => {
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        title:       form.title.trim(),
        description: form.description.trim() || null,
        status:      form.status,
        priority:    parseInt(form.priority, 10),
        due_date:    form.due_date || null,
        due_time:    form.due_time || null,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Task' : 'New Task'}
      size="md"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" size="md" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save Changes' : 'Create Task')}
          </Button>
        </>
      }
    >
      {/* Title */}
      <Input
        id="todo-title"
        name="title"
        label="Title"
        placeholder="What needs to be done?"
        value={form.title}
        onChange={handleChange}
        error={errors.title}
        disabled={submitting}
      />

      {/* Description */}
      <Textarea
        id="todo-description"
        name="description"
        label="Description"
        placeholder="Optional — add context or notes."
        rows={3}
        value={form.description}
        onChange={handleChange}
        disabled={submitting}
      />

      {/* Status + Priority side by side */}
      <div className="grid grid-cols-2 gap-4">
        <Select
          id="todo-status"
          name="status"
          label="Status"
          value={form.status}
          onChange={handleChange}
          disabled={submitting}
        >
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
          <option value="overdue">Overdue</option>
        </Select>

        <Select
          id="todo-priority"
          name="priority"
          label="Priority"
          value={form.priority}
          onChange={handleChange}
          disabled={submitting}
        >
          <option value="1">High</option>
          <option value="2">Medium</option>
          <option value="3">Low</option>
        </Select>
      </div>

      {/* Due date + time side by side */}
      <div className="grid grid-cols-2 gap-4">
        <Input
          id="todo-due-date"
          name="due_date"
          label="Due Date"
          type="date"
          value={form.due_date}
          onChange={handleChange}
          error={errors.due_date}
          helperText="Optional"
          disabled={submitting}
        />
        <Input
          id="todo-due-time"
          name="due_time"
          label="Due Time"
          type="time"
          value={form.due_time}
          onChange={handleChange}
          helperText="Optional — sends a Telegram reminder"
          disabled={submitting}
        />
      </div>
    </Modal>
  );
}
