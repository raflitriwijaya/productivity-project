// client/src/components/goals/CreateGoalModal.jsx
// Create / Edit a goal (Roadmap Wave 5). goal === null → Create, else Edit (PATCH).
// Does its own API call, then calls onSaved() so the parent refetches and closes.
// Follows the CreateIdeaModal pattern: action buttons live in the Modal footer.

import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Textarea, Select } from '../ui/Input';
import api from '../../lib/api';
import { useToast } from '../../hooks/useToast';

const EMPTY_FORM = {
  title: '', description: '', goal_type: 'target', target_value: '', unit: '',
  category: '', status: 'active', priority: 'medium', start_date: '', target_date: '',
};

/**
 * @param {{ isOpen: boolean, onClose: () => void, onSaved: () => void, goal?: object|null }} props
 */
export function CreateGoalModal({ isOpen, onClose, onSaved, goal = null }) {
  const isEdit = goal !== null;
  const { addToast } = useToast();

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    /* setState here is intentional modal-open sync (mirrors CreateIdeaModal) */
    /* eslint-disable react-hooks/set-state-in-effect */
    if (isEdit && goal) {
      setForm({
        title:        goal.title        ?? '',
        description:  goal.description  ?? '',
        goal_type:    goal.goal_type    ?? 'target',
        target_value: goal.target_value ?? '',
        unit:         goal.unit         ?? '',
        category:     goal.category     ?? '',
        status:       goal.status       ?? 'active',
        priority:     goal.priority     ?? 'medium',
        start_date:   goal.start_date   ? goal.start_date.slice(0, 10) : '',
        target_date:  goal.target_date  ? goal.target_date.slice(0, 10) : '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setErrors({});
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, goal, isEdit]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.title.trim()) errs.title = 'Title is required.';
    if (form.target_value !== '' && Number.isNaN(parseFloat(form.target_value))) {
      errs.target_value = 'Must be a number.';
    }
    if (form.start_date && form.target_date && form.target_date < form.start_date) {
      errs.target_date = 'Target date must be after the start date.';
    }
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSubmitting(true);
    try {
      const payload = {
        title:        form.title.trim(),
        description:  form.description.trim() || null,
        goal_type:    form.goal_type,
        target_value: form.target_value === '' ? null : parseFloat(form.target_value),
        unit:         form.unit.trim() || null,
        category:     form.category.trim() || null,
        status:       form.status,
        priority:     form.priority,
        start_date:   form.start_date || null,
        target_date:  form.target_date || null,
      };
      if (isEdit) {
        await api.patch(`/api/goals/${goal.id}`, payload);
        addToast({ type: 'success', title: 'Goal updated' });
      } else {
        await api.post('/api/goals', payload);
        addToast({ type: 'success', title: 'Goal created' });
      }
      onSaved();
    } catch (err) {
      addToast({ type: 'error', title: isEdit ? 'Failed to update goal' : 'Failed to create goal', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Goal' : 'New Goal'}
      size="md"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" size="md" onClick={handleSubmit} disabled={submitting || !form.title.trim()}>
            {submitting ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save Changes' : 'Create Goal')}
          </Button>
        </>
      }
    >
      <Input
        id="goal-title"
        label="Title"
        placeholder="e.g. Read 50 books this year"
        value={form.title}
        onChange={set('title')}
        error={errors.title}
      />

      <Textarea
        id="goal-description"
        label="Description (optional)"
        rows={3}
        placeholder="Why this goal matters and how you'll get there…"
        value={form.description}
        onChange={set('description')}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select id="goal-type" label="Type" value={form.goal_type} onChange={set('goal_type')}>
          <option value="target">Target</option>
          <option value="milestone">Milestone</option>
          <option value="habit">Habit</option>
          <option value="learning">Learning</option>
        </Select>
        <Input
          id="goal-category"
          label="Category (optional)"
          placeholder="e.g. Reading, Fitness"
          value={form.category}
          onChange={set('category')}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          id="goal-target"
          label="Target Value (optional)"
          type="number"
          placeholder="e.g. 50"
          value={form.target_value}
          onChange={set('target_value')}
          error={errors.target_value}
        />
        <Input
          id="goal-unit"
          label="Unit (optional)"
          placeholder="e.g. books, hours, projects"
          value={form.unit}
          onChange={set('unit')}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select id="goal-priority" label="Priority" value={form.priority} onChange={set('priority')}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </Select>
        <Select id="goal-status" label="Status" value={form.status} onChange={set('status')}>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="paused">Paused</option>
          <option value="abandoned">Abandoned</option>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          id="goal-start"
          label="Start Date (optional)"
          type="date"
          value={form.start_date}
          onChange={set('start_date')}
        />
        <Input
          id="goal-target-date"
          label="Target Date (optional)"
          type="date"
          value={form.target_date}
          onChange={set('target_date')}
          error={errors.target_date}
        />
      </div>
    </Modal>
  );
}

export default CreateGoalModal;
