// client/src/components/roadmaps/CreateMilestoneModal.jsx
// Add / Edit a milestone within a track. milestone === null → Create (POST
// /api/roadmaps/tracks/:trackId/milestones), else Edit (PATCH
// /api/roadmaps/milestones/:id). Supports the JSONB `resources` array — a list of
// { title, url, type } learning links — managed inline.

import { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Textarea, Select } from '../ui/Input';
import api from '../../lib/api';
import { useToast } from '../../hooks/useToast';
import {
  MILESTONE_STATUS_LABEL, MILESTONE_PRIORITY_LABEL, RESOURCE_TYPES,
} from '../../lib/roadmapEnums';

const EMPTY_FORM = {
  title: '', description: '', status: 'pending', priority: 'medium',
  due_date: '', estimated_hours: '', actual_hours: '', notes: '',
};

const EMPTY_RESOURCE = { title: '', url: '', type: 'article' };

/**
 * @param {{ isOpen: boolean, onClose: () => void, onSaved: () => void, trackId?: number, milestone?: object|null }} props
 */
export function CreateMilestoneModal({ isOpen, onClose, onSaved, trackId, milestone = null }) {
  const isEdit = milestone !== null;
  const { addToast } = useToast();

  const [form, setForm] = useState(EMPTY_FORM);
  const [resources, setResources] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    if (isEdit && milestone) {
      setForm({
        title:           milestone.title           ?? '',
        description:     milestone.description     ?? '',
        status:          milestone.status          ?? 'pending',
        priority:        milestone.priority        ?? 'medium',
        due_date:        milestone.due_date        ? milestone.due_date.slice(0, 10) : '',
        estimated_hours: milestone.estimated_hours ?? '',
        actual_hours:    milestone.actual_hours    ?? '',
        notes:           milestone.notes           ?? '',
      });
      setResources(Array.isArray(milestone.resources) ? milestone.resources.map((r) => ({ ...EMPTY_RESOURCE, ...r })) : []);
    } else {
      setForm(EMPTY_FORM);
      setResources([]);
    }
    setErrors({});
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, milestone, isEdit]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const addResource = () => setResources((r) => [...r, { ...EMPTY_RESOURCE }]);
  const setResource = (i, field, value) => setResources((r) => r.map((res, idx) => (idx === i ? { ...res, [field]: value } : res)));
  const removeResource = (i) => setResources((r) => r.filter((_, idx) => idx !== i));

  const validate = () => {
    const errs = {};
    if (!form.title.trim()) errs.title = 'Title is required.';
    if (form.estimated_hours !== '' && Number.isNaN(parseFloat(form.estimated_hours))) errs.estimated_hours = 'Must be a number.';
    if (form.actual_hours !== '' && Number.isNaN(parseFloat(form.actual_hours))) errs.actual_hours = 'Must be a number.';
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSubmitting(true);
    try {
      // Keep only resources that have at least a title or URL.
      const cleanResources = resources
        .map((r) => ({ title: r.title.trim(), url: r.url.trim(), type: r.type || 'other' }))
        .filter((r) => r.title || r.url);

      const payload = {
        title:           form.title.trim(),
        description:     form.description.trim() || null,
        status:          form.status,
        priority:        form.priority,
        due_date:        form.due_date || null,
        estimated_hours: form.estimated_hours === '' ? null : parseFloat(form.estimated_hours),
        actual_hours:    form.actual_hours === '' ? null : parseFloat(form.actual_hours),
        notes:           form.notes.trim() || null,
        resources:       cleanResources,
      };

      if (isEdit) {
        await api.patch(`/api/roadmaps/milestones/${milestone.id}`, payload);
        addToast({ type: 'success', title: 'Milestone updated' });
      } else {
        await api.post(`/api/roadmaps/tracks/${trackId}/milestones`, payload);
        addToast({ type: 'success', title: 'Milestone added' });
      }
      onSaved();
    } catch (err) {
      addToast({ type: 'error', title: isEdit ? 'Failed to update milestone' : 'Failed to add milestone', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Milestone' : 'New Milestone'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" size="md" onClick={handleSubmit} disabled={submitting || !form.title.trim()}>
            {submitting ? (isEdit ? 'Saving…' : 'Adding…') : (isEdit ? 'Save Changes' : 'Add Milestone')}
          </Button>
        </>
      }
    >
      <Input
        id="milestone-title"
        label="Title"
        placeholder="e.g. Install ESP-IDF and flash blink"
        value={form.title}
        onChange={set('title')}
        error={errors.title}
      />

      <Textarea
        id="milestone-description"
        label="Description (optional)"
        rows={2}
        placeholder="What 'done' looks like…"
        value={form.description}
        onChange={set('description')}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select id="milestone-priority" label="Priority" value={form.priority} onChange={set('priority')}>
          {Object.entries(MILESTONE_PRIORITY_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
        <Select id="milestone-status" label="Status" value={form.status} onChange={set('status')}>
          {Object.entries(MILESTONE_STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Input id="milestone-due" label="Due Date (optional)" type="date" value={form.due_date} onChange={set('due_date')} />
        <Input
          id="milestone-est"
          label="Est. Hours"
          type="number"
          min="0"
          step="0.5"
          placeholder="e.g. 4"
          value={form.estimated_hours}
          onChange={set('estimated_hours')}
          error={errors.estimated_hours}
        />
        <Input
          id="milestone-actual"
          label="Actual Hours"
          type="number"
          min="0"
          step="0.5"
          placeholder="e.g. 5"
          value={form.actual_hours}
          onChange={set('actual_hours')}
          error={errors.actual_hours}
        />
      </div>

      <Textarea
        id="milestone-notes"
        label="Notes (optional)"
        rows={2}
        placeholder="Gotchas, decisions, links to capture later…"
        value={form.notes}
        onChange={set('notes')}
      />

      {/* Resources */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-medium text-stone-700 dark:text-gray-300 tracking-wide uppercase">Resources (optional)</p>
          <button
            type="button"
            onClick={addResource}
            className="inline-flex items-center gap-1 text-xs text-moss-600 dark:text-moss-400 hover:text-moss-700 transition-colors duration-150"
          >
            <Plus size={13} /> Add resource
          </button>
        </div>
        {resources.length === 0 ? (
          <p className="text-xs text-stone-400 dark:text-gray-500">Link videos, articles, books, or docs for this milestone.</p>
        ) : (
          <div className="space-y-2">
            {resources.map((r, i) => (
              <div key={i} className="flex flex-col sm:flex-row items-start sm:items-center gap-2 rounded-lg border border-stone-200 dark:border-gray-700 p-2">
                <Input id={`res-title-${i}`} placeholder="Title" value={r.title} onChange={(e) => setResource(i, 'title', e.target.value)} className="sm:flex-1" />
                <Input id={`res-url-${i}`} placeholder="https://…" value={r.url} onChange={(e) => setResource(i, 'url', e.target.value)} className="sm:flex-1" />
                <Select id={`res-type-${i}`} value={r.type} onChange={(e) => setResource(i, 'type', e.target.value)} className="sm:w-32">
                  {RESOURCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
                <button
                  type="button"
                  onClick={() => removeResource(i)}
                  className="p-1.5 text-stone-400 hover:text-red-500 transition-colors duration-150 flex-shrink-0"
                  aria-label={`Remove resource ${i + 1}`}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

export default CreateMilestoneModal;
