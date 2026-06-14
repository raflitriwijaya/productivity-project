// client/src/components/roadmaps/CreateTrackModal.jsx
// Add / Edit a track (lane) within a roadmap. track === null → Create (POST
// /api/roadmaps/:roadmapId/tracks), else Edit (PATCH /api/roadmaps/tracks/:id).
// Small companion to CreateRoadmapModal; the detail view owns it.

import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import api from '../../lib/api';
import { useToast } from '../../hooks/useToast';
import { COLOR_PRESETS } from '../../lib/roadmapEnums';

/**
 * @param {{ isOpen: boolean, onClose: () => void, onSaved: () => void, roadmapId: number, track?: object|null }} props
 */
export function CreateTrackModal({ isOpen, onClose, onSaved, roadmapId, track = null }) {
  const isEdit = track !== null;
  const { addToast } = useToast();

  const [form, setForm] = useState({ title: '', description: '', color: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    if (isEdit && track) {
      setForm({ title: track.title ?? '', description: track.description ?? '', color: track.color ?? '' });
    } else {
      setForm({ title: '', description: '', color: '' });
    }
    setError('');
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, track, isEdit]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.title.trim()) { setError('Title is required.'); return; }
    setSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        color: form.color || null,
      };
      if (isEdit) {
        await api.patch(`/api/roadmaps/tracks/${track.id}`, payload);
        addToast({ type: 'success', title: 'Track updated' });
      } else {
        await api.post(`/api/roadmaps/${roadmapId}/tracks`, payload);
        addToast({ type: 'success', title: 'Track added' });
      }
      onSaved();
    } catch (err) {
      addToast({ type: 'error', title: isEdit ? 'Failed to update track' : 'Failed to add track', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Track' : 'New Track'}
      size="md"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" size="md" onClick={handleSubmit} disabled={submitting || !form.title.trim()}>
            {submitting ? 'Saving…' : (isEdit ? 'Save Changes' : 'Add Track')}
          </Button>
        </>
      }
    >
      <Input
        id="track-title"
        label="Title"
        placeholder="e.g. Peripherals & Buses"
        value={form.title}
        onChange={set('title')}
        error={error}
      />
      <Textarea
        id="track-description"
        label="Description (optional)"
        rows={2}
        placeholder="What this lane covers…"
        value={form.description}
        onChange={set('description')}
      />
      <div>
        <p className="block text-xs font-medium text-stone-700 dark:text-gray-300 tracking-wide uppercase mb-1.5">Color (optional)</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, color: '' }))}
            className={`w-8 h-8 rounded-full border-2 bg-stone-100 dark:bg-gray-700 text-[10px] text-stone-500 flex items-center justify-center ${
              !form.color ? 'border-stone-900 dark:border-white' : 'border-transparent'
            }`}
            aria-label="No color"
          >
            —
          </button>
          {COLOR_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setForm((f) => ({ ...f, color: c }))}
              className={`w-8 h-8 rounded-full border-2 transition-transform duration-150 hover:scale-110 ${
                form.color === c ? 'border-stone-900 dark:border-white' : 'border-transparent'
              }`}
              style={{ backgroundColor: c }}
              aria-label={`Use color ${c}`}
            />
          ))}
        </div>
      </div>
    </Modal>
  );
}

export default CreateTrackModal;
