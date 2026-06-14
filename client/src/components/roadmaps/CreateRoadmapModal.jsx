// client/src/components/roadmaps/CreateRoadmapModal.jsx
// Create / Edit a Learning Roadmap. roadmap === null → Create (optionally with up to
// 5 inline starter tracks), else Edit (PATCH metadata only — tracks are managed in
// the detail view). Mirrors CreateGoalModal: action buttons live in the Modal footer,
// the component does its own API call and then calls onSaved() so the parent refetches.

import { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Textarea, Select } from '../ui/Input';
import api from '../../lib/api';
import { useToast } from '../../hooks/useToast';
import {
  ROADMAP_STATUS_LABEL, CATEGORY_SUGGESTIONS, COLOR_PRESETS, ICON_PRESETS,
} from '../../lib/roadmapEnums';

const EMPTY_FORM = {
  title: '', description: '', category: '', status: 'active',
  icon: '', color: COLOR_PRESETS[0],
};

/**
 * @param {{ isOpen: boolean, onClose: () => void, onSaved: () => void, roadmap?: object|null }} props
 */
export function CreateRoadmapModal({ isOpen, onClose, onSaved, roadmap = null }) {
  const isEdit = roadmap !== null;
  const { addToast } = useToast();

  const [form, setForm] = useState(EMPTY_FORM);
  const [tracks, setTracks] = useState([]); // inline starter tracks (create only)
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    /* setState here is intentional modal-open sync (mirrors CreateGoalModal) */
    /* eslint-disable react-hooks/set-state-in-effect */
    if (isEdit && roadmap) {
      setForm({
        title:       roadmap.title       ?? '',
        description: roadmap.description ?? '',
        category:    roadmap.category    ?? '',
        status:      roadmap.status      ?? 'active',
        icon:        roadmap.icon        ?? '',
        color:       roadmap.color       ?? COLOR_PRESETS[0],
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setTracks([]);
    setErrors({});
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, roadmap, isEdit]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const addTrack = () => { if (tracks.length < 5) setTracks((t) => [...t, '']); };
  const setTrack = (i, value) => setTracks((t) => t.map((v, idx) => (idx === i ? value : v)));
  const removeTrack = (i) => setTracks((t) => t.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    if (!form.title.trim()) { setErrors({ title: 'Title is required.' }); return; }

    setSubmitting(true);
    try {
      const payload = {
        title:       form.title.trim(),
        description: form.description.trim() || null,
        category:    form.category.trim() || null,
        status:      form.status,
        icon:        form.icon.trim() || null,
        color:       form.color || null,
      };

      if (isEdit) {
        await api.patch(`/api/roadmaps/${roadmap.id}`, payload);
        addToast({ type: 'success', title: 'Roadmap updated' });
      } else {
        const cleanTracks = tracks.map((t) => t.trim()).filter(Boolean).map((title) => ({ title }));
        if (cleanTracks.length > 0) payload.tracks = cleanTracks;
        await api.post('/api/roadmaps', payload);
        addToast({ type: 'success', title: 'Roadmap created' });
      }
      onSaved();
    } catch (err) {
      addToast({ type: 'error', title: isEdit ? 'Failed to update roadmap' : 'Failed to create roadmap', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Roadmap' : 'New Learning Roadmap'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" size="md" onClick={handleSubmit} disabled={submitting || !form.title.trim()}>
            {submitting ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save Changes' : 'Create Roadmap')}
          </Button>
        </>
      }
    >
      <Input
        id="roadmap-title"
        label="Title"
        placeholder="e.g. ESP32-S3 with ESP-IDF"
        value={form.title}
        onChange={set('title')}
        error={errors.title}
      />

      <Textarea
        id="roadmap-description"
        label="Description (optional)"
        rows={2}
        placeholder="What you'll learn and why it matters…"
        value={form.description}
        onChange={set('description')}
      />

      <div>
        <Input
          id="roadmap-category"
          label="Category (optional)"
          placeholder="e.g. embedded, robotics, gardening"
          value={form.category}
          onChange={set('category')}
        />
        <div className="flex flex-wrap gap-1.5 mt-2">
          {CATEGORY_SUGGESTIONS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setForm((f) => ({ ...f, category: c }))}
              className="px-2 py-0.5 rounded-md text-xs capitalize border border-stone-200 dark:border-gray-600 text-stone-600 dark:text-gray-400 hover:border-moss-400 hover:text-moss-700 dark:hover:text-moss-400 transition-colors duration-150"
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Icon (emoji) */}
      <div>
        <Input
          id="roadmap-icon"
          label="Icon (emoji, optional)"
          placeholder="🔌"
          value={form.icon}
          onChange={set('icon')}
          maxLength={8}
        />
        <div className="flex flex-wrap gap-1.5 mt-2">
          {ICON_PRESETS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => setForm((f) => ({ ...f, icon: emoji }))}
              className={`w-8 h-8 rounded-md text-lg leading-none flex items-center justify-center border transition-colors duration-150 ${
                form.icon === emoji
                  ? 'border-moss-500 bg-moss-50 dark:bg-moss-950/40'
                  : 'border-stone-200 dark:border-gray-600 hover:border-stone-400 dark:hover:border-gray-500'
              }`}
              aria-label={`Use ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Color */}
      <div>
        <p className="block text-xs font-medium text-stone-700 dark:text-gray-300 tracking-wide uppercase mb-1.5">Card color</p>
        <div className="flex flex-wrap gap-2">
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

      {isEdit ? (
        <Select id="roadmap-status" label="Status" value={form.status} onChange={set('status')}>
          {Object.entries(ROADMAP_STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
      ) : (
        /* Inline starter tracks — create only */
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-medium text-stone-700 dark:text-gray-300 tracking-wide uppercase">
              Starter tracks (optional)
            </p>
            <button
              type="button"
              onClick={addTrack}
              disabled={tracks.length >= 5}
              className="inline-flex items-center gap-1 text-xs text-moss-600 dark:text-moss-400 hover:text-moss-700 disabled:opacity-40 transition-colors duration-150"
            >
              <Plus size={13} /> Add track
            </button>
          </div>
          {tracks.length === 0 ? (
            <p className="text-xs text-stone-400 dark:text-gray-500">
              Add up to 5 lanes now (e.g. “Fundamentals”, “Peripherals”, “Projects”) — or add them later.
            </p>
          ) : (
            <div className="space-y-2">
              {tracks.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    id={`track-${i}`}
                    placeholder={`Track ${i + 1} title`}
                    value={t}
                    onChange={(e) => setTrack(i, e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => removeTrack(i)}
                    className="p-1.5 text-stone-400 hover:text-red-500 transition-colors duration-150 flex-shrink-0"
                    aria-label={`Remove track ${i + 1}`}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

export default CreateRoadmapModal;
