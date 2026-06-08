// client/src/components/engineer/CreateSnippetModal.jsx
// Create & edit modal for code snippets — mode toggled via `snippet` prop:
//   null   → create mode
//   object → edit mode (pre-fills fields)
//
// The code field is a monospace Textarea (the one approved use of font-mono per
// §3.1 / §10 ALWAYS #5). Success/error surface through useToast.

import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Textarea, Select } from '../ui/Input';
import { SNIPPET_CATEGORIES, SNIPPET_LANGUAGES } from './snippetConstants';
import { useToast } from '../../hooks/useToast';

const EMPTY_FORM = {
  title:    '',
  category: SNIPPET_CATEGORIES[0],
  language: 'cpp',
  tags:     '',
  code:     '',
};

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   onSubmit: (data: Object) => Promise<void>,
 *   snippet?: Object | null,
 * }} props
 */
export function CreateSnippetModal({ isOpen, onClose, onSubmit, snippet = null }) {
  const isEdit = snippet !== null;
  const { addToast } = useToast();

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setErrors({});
    if (isEdit) {
      setForm({
        title:    snippet.title    ?? '',
        category: snippet.category ?? SNIPPET_CATEGORIES[0],
        language: snippet.language ?? 'cpp',
        tags:     snippet.tags     ?? '',
        code:     snippet.code     ?? '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [isOpen, snippet, isEdit]);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.title.trim()) errs.title = 'Title is required.';
    if (!form.category.trim()) errs.category = 'Category is required.';
    if (!form.code.trim()) errs.code = 'Code is required.';
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSubmitting(true);
    try {
      const payload = {
        title:    form.title.trim(),
        category: form.category.trim(),
        language: form.language,
        tags:     form.tags.trim() || undefined,
        code:     form.code,
      };
      await onSubmit(payload);
      addToast({ type: 'success', title: isEdit ? 'Snippet updated' : 'Snippet saved' });
      onClose();
    } catch (err) {
      setErrors({ _global: err.message });
      addToast({ type: 'error', title: isEdit ? 'Update failed' : 'Save failed', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Snippet' : 'New Snippet'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" size="md" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (isEdit ? 'Saving…' : 'Saving…') : (isEdit ? 'Save Changes' : 'Save Snippet')}
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
        id="snippet-title"
        label="Title"
        placeholder="e.g. Debounced button read"
        value={form.title}
        onChange={set('title')}
        error={errors.title}
      />

      <div className="grid grid-cols-2 gap-4">
        <Select
          id="snippet-category"
          label="Category"
          value={form.category}
          onChange={set('category')}
          error={errors.category}
        >
          {SNIPPET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </Select>

        <Select
          id="snippet-language"
          label="Language"
          value={form.language}
          onChange={set('language')}
        >
          {SNIPPET_LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
        </Select>
      </div>

      <Input
        id="snippet-tags"
        label="Tags"
        placeholder="e.g. gpio, interrupt, esp32"
        value={form.tags}
        onChange={set('tags')}
        helperText="Comma-separated tags for search and filtering."
      />

      <Textarea
        id="snippet-code"
        label="Code"
        placeholder="Paste your code here…"
        value={form.code}
        onChange={set('code')}
        error={errors.code}
        rows={12}
        className="font-mono text-[13px]"
        spellCheck={false}
      />
    </Modal>
  );
}
