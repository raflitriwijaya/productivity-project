// client/src/components/reading/BookDetailModal.jsx
// Read-only book detail (Roadmap Wave 3): meta, progress/rating, dates, notes, and
// the LinkedItems section so a book can link to Research entries (Wave 1).

import { useNavigate } from 'react-router-dom';
import { Star, Clock, Calendar, Bot } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { LinkedItems } from '../shared/LinkedItems';
import { Timer } from '../shared/Timer';

const SHELF_LABELS = {
  want_to_read: 'Want to Read',
  reading:      'Currently Reading',
  finished:     'Finished',
};

const SHELF_VARIANTS = {
  want_to_read: 'gray',
  reading:      'ember',
  finished:     'moss',
};

/**
 * @param {{ isOpen: boolean, onClose: () => void, book: object, onEdit: () => void }} props
 */
export function BookDetailModal({ isOpen, onClose, book, onEdit }) {
  const navigate = useNavigate();
  if (!book) return null;

  const progress = book.total_pages > 0
    ? Math.round((book.current_page / book.total_pages) * 100)
    : 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={book.title}
      size="lg"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>Close</Button>
          <Button variant="secondary" size="md" onClick={() => navigate(`/ai-chat?context=book&id=${book.id}`)}>
            <Bot size={14} />
            Ask AI
          </Button>
          <Button variant="primary" size="md" onClick={onEdit}>Edit</Button>
        </>
      }
    >
      {/* Meta */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={SHELF_VARIANTS[book.shelf] ?? 'gray'}>{SHELF_LABELS[book.shelf] ?? book.shelf}</Badge>
        {book.author && <span className="text-sm text-stone-500 dark:text-gray-400">by {book.author}</span>}
        {book.genre && <Badge variant="gray">{book.genre}</Badge>}
      </div>

      {/* Progress (reading) */}
      {book.shelf === 'reading' && book.total_pages > 0 && (
        <div>
          <div className="flex justify-between text-sm text-stone-600 dark:text-gray-400 mb-2">
            <span>{progress}% complete</span>
            <span>{book.current_page} / {book.total_pages} pages</span>
          </div>
          <div className="w-full h-2 bg-stone-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-moss-500 rounded-full" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Rating */}
      {book.rating && (
        <div className="flex items-center gap-1">
          <span className="text-sm text-stone-500 dark:text-gray-400 mr-1">Rating:</span>
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              size={18}
              className={i < book.rating ? 'text-ember-500 fill-ember-500' : 'text-stone-300 dark:text-gray-600'}
            />
          ))}
        </div>
      )}

      {/* Dates */}
      {(book.started_at || book.finished_at) && (
        <div className="flex flex-wrap gap-4 text-sm text-stone-500 dark:text-gray-400">
          {book.started_at && (
            <div className="flex items-center gap-1">
              <Calendar size={14} />
              Started: {new Date(book.started_at).toLocaleDateString()}
            </div>
          )}
          {book.finished_at && (
            <div className="flex items-center gap-1">
              <Clock size={14} />
              Finished: {new Date(book.finished_at).toLocaleDateString()}
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      {book.notes && (
        <div>
          <h4 className="text-sm font-semibold text-stone-700 dark:text-gray-300 mb-1">Notes</h4>
          <p className="text-sm text-stone-600 dark:text-gray-400 whitespace-pre-wrap">{book.notes}</p>
        </div>
      )}

      {/* Time tracking (Wave 5) */}
      <Timer entityType="book" entityId={book.id} />

      {/* Linked Research entries (Universal Links, Wave 1) */}
      <div className="border-t border-stone-200 dark:border-gray-700 pt-4">
        <LinkedItems entityType="book" entityId={book.id} />
      </div>
    </Modal>
  );
}

export default BookDetailModal;
