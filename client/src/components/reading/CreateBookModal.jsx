// client/src/components/reading/CreateBookModal.jsx
// Create / Edit a book (Roadmap Wave 3). book === null → Create, else Edit (PATCH).
// Does its own API call, then calls onSaved() so the parent refetches and closes.
// Follows the CreateLearningModal pattern: action buttons live in the Modal footer
// (outside the form), so submit is wired through handleSubmit, not <form onSubmit>.

import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Textarea, Select } from '../ui/Input';
import api from '../../lib/api';
import { useToast } from '../../hooks/useToast';

const EMPTY_FORM = {
  title: '', author: '', shelf: 'want_to_read',
  total_pages: '', current_page: '0', rating: '', notes: '', genre: '',
};

/**
 * @param {{ isOpen: boolean, onClose: () => void, onSaved: () => void, book?: object|null }} props
 */
export function CreateBookModal({ isOpen, onClose, onSaved, book = null }) {
  const isEdit = book !== null;
  const { addToast } = useToast();

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Sync the form when the modal opens (create → blank, edit → populated).
  useEffect(() => {
    if (!isOpen) return;
    /* setState here is intentional modal-open sync (mirrors CreateLearningModal) */
    /* eslint-disable react-hooks/set-state-in-effect */
    if (isEdit && book) {
      setForm({
        title:        book.title        ?? '',
        author:       book.author       ?? '',
        shelf:        book.shelf        ?? 'want_to_read',
        total_pages:  book.total_pages  != null ? String(book.total_pages)  : '',
        current_page: book.current_page != null ? String(book.current_page) : '0',
        rating:       book.rating       != null ? String(book.rating)       : '',
        notes:        book.notes        ?? '',
        genre:        book.genre        ?? '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setErrors({});
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, book, isEdit]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.title.trim()) errs.title = 'Title is required.';
    if (form.total_pages !== '' && (!/^\d+$/.test(form.total_pages) || parseInt(form.total_pages, 10) < 1))
      errs.total_pages = 'Must be a positive number.';
    if (form.current_page !== '' && (!/^\d+$/.test(form.current_page)))
      errs.current_page = 'Must be a number.';
    if (form.rating !== '' && ![1, 2, 3, 4, 5].includes(parseInt(form.rating, 10)))
      errs.rating = 'Rating is 1–5.';
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSubmitting(true);
    try {
      if (isEdit) {
        // PATCH allows rating + current_page; send the full editable set.
        await api.patch(`/api/reading/${book.id}`, {
          title:        form.title.trim(),
          author:       form.author.trim() || null,
          shelf:        form.shelf,
          total_pages:  form.total_pages ? parseInt(form.total_pages, 10) : null,
          current_page: form.current_page ? parseInt(form.current_page, 10) : 0,
          rating:       form.rating ? parseInt(form.rating, 10) : null,
          notes:        form.notes.trim() || null,
          genre:        form.genre.trim() || null,
        });
        addToast({ type: 'success', title: 'Book updated' });
      } else {
        // POST ignores rating/current_page server-side (set them by editing later).
        await api.post('/api/reading', {
          title:       form.title.trim(),
          author:      form.author.trim() || null,
          shelf:       form.shelf,
          total_pages: form.total_pages ? parseInt(form.total_pages, 10) : null,
          notes:       form.notes.trim() || null,
          genre:       form.genre.trim() || null,
        });
        addToast({ type: 'success', title: 'Book added' });
      }
      onSaved();
    } catch (err) {
      addToast({ type: 'error', title: isEdit ? 'Failed to update book' : 'Failed to add book', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Book' : 'Add Book'}
      size="md"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" size="md" onClick={handleSubmit} disabled={submitting || !form.title.trim()}>
            {submitting ? (isEdit ? 'Saving…' : 'Adding…') : (isEdit ? 'Save Changes' : 'Add Book')}
          </Button>
        </>
      }
    >
      <Input
        id="book-title"
        label="Title"
        placeholder="Book title"
        value={form.title}
        onChange={set('title')}
        error={errors.title}
      />
      <Input
        id="book-author"
        label="Author (optional)"
        placeholder="Author name"
        value={form.author}
        onChange={set('author')}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select id="book-shelf" label="Shelf" value={form.shelf} onChange={set('shelf')}>
          <option value="want_to_read">Want to Read</option>
          <option value="reading">Currently Reading</option>
          <option value="finished">Finished</option>
        </Select>
        <Input
          id="book-genre"
          label="Genre (optional)"
          placeholder="e.g. Philosophy"
          value={form.genre}
          onChange={set('genre')}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Input
          id="book-total-pages"
          label="Total Pages"
          type="number"
          min={1}
          placeholder="0"
          value={form.total_pages}
          onChange={set('total_pages')}
          error={errors.total_pages}
        />
        <Input
          id="book-current-page"
          label="Current Page"
          type="number"
          min={0}
          value={form.current_page}
          onChange={set('current_page')}
          error={errors.current_page}
        />
        <Input
          id="book-rating"
          label="Rating (1–5)"
          type="number"
          min={1}
          max={5}
          placeholder="★"
          value={form.rating}
          onChange={set('rating')}
          error={errors.rating}
        />
      </div>

      <Textarea
        id="book-notes"
        label="Notes (optional)"
        rows={3}
        placeholder="Personal notes, takeaways…"
        value={form.notes}
        onChange={set('notes')}
      />
    </Modal>
  );
}

export default CreateBookModal;
