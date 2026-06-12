// client/src/components/reading/BookCard.jsx
// Card for the Reading library grid (Roadmap Wave 3). Shows cover placeholder,
// title/author, shelf + genre badges, a progress bar (reading) or star rating
// (finished). Clicking the card opens the detail modal.

import { BookOpen, Star } from 'lucide-react';
import { Badge } from '../ui/Badge';

const SHELF_VARIANTS = {
  want_to_read: 'gray',
  reading:      'ember',
  finished:     'moss',
};

const SHELF_LABELS = {
  want_to_read: 'Want to Read',
  reading:      'Reading',
  finished:     'Finished',
};

/**
 * @param {{ book: object, onClick: () => void }} props
 */
export function BookCard({ book, onClick }) {
  const progress = book.total_pages > 0
    ? Math.round((book.current_page / book.total_pages) * 100)
    : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-white dark:bg-gray-800 rounded-xl border border-stone-200 dark:border-gray-700 p-5 cursor-pointer hover:shadow-md hover:border-moss-300 dark:hover:border-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500 transition-all group"
    >
      <div className="flex gap-4">
        {/* Cover placeholder */}
        <div className="w-16 h-24 bg-stone-100 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0 border border-stone-200 dark:border-gray-600">
          <BookOpen size={24} className="text-stone-400 dark:text-gray-500" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-stone-800 dark:text-gray-100 line-clamp-2 group-hover:text-moss-600 dark:group-hover:text-moss-400 transition-colors">
            {book.title}
          </h3>
          {book.author && (
            <p className="text-sm text-stone-500 dark:text-gray-400 mt-0.5 truncate">{book.author}</p>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge variant={SHELF_VARIANTS[book.shelf] ?? 'gray'}>{SHELF_LABELS[book.shelf] ?? book.shelf}</Badge>
            {book.genre && <Badge variant="gray">{book.genre}</Badge>}
          </div>

          {/* Progress bar — only while reading */}
          {book.shelf === 'reading' && book.total_pages > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-stone-400 dark:text-gray-500 mb-1">
                <span>{progress}%</span>
                <span>{book.current_page} / {book.total_pages} pages</span>
              </div>
              <div className="w-full h-1.5 bg-stone-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-moss-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {/* Star rating — only when finished and rated */}
          {book.shelf === 'finished' && book.rating && (
            <div className="flex items-center gap-1 mt-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  size={14}
                  className={i < book.rating ? 'text-ember-500 fill-ember-500' : 'text-stone-300 dark:text-gray-600'}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

export default BookCard;
