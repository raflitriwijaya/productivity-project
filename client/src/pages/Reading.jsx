// client/src/pages/Reading.jsx
// /reading — Reading Tracker (Roadmap Wave 3). Track books across shelves
// (Want to Read / Reading / Finished) with progress, ratings, and annual stats,
// and link each book to Research entries via Universal Links (Wave 1).

import { useState, useEffect, useCallback } from 'react';
import { Plus, Bookmark, BookOpen, BookMarked, Library, Search } from 'lucide-react';

import api from '../lib/api';
import useDocumentTitle from '../hooks/useDocumentTitle';

import { Card, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { StatCard } from '../components/ui/StatCard';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';

import { BookCard } from '../components/reading/BookCard';
import { CreateBookModal } from '../components/reading/CreateBookModal';
import { BookDetailModal } from '../components/reading/BookDetailModal';

const SHELVES = [
  { key: '',             label: 'All' },
  { key: 'want_to_read', label: 'Want to Read' },
  { key: 'reading',      label: 'Reading' },
  { key: 'finished',     label: 'Finished' },
];

// Stat-card skeleton (matches the four-up grid; never a spinner — §10 NEVER #14).
function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardBody>
            <div className="h-3 w-24 rounded bg-stone-200 dark:bg-gray-700 animate-pulse mb-3" />
            <div className="h-7 w-16 rounded bg-stone-200 dark:bg-gray-700 animate-pulse" />
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-36 rounded-xl bg-stone-100 dark:bg-gray-800 animate-pulse" />
      ))}
    </div>
  );
}

export default function Reading() {
  useDocumentTitle('Reading');

  const [books, setBooks]           = useState([]);
  const [stats, setStats]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [activeShelf, setActiveShelf] = useState('');
  const [search, setSearch]         = useState('');
  const [meta, setMeta]             = useState({ total: 0, page: 1, per_page: 20 });

  const [showCreate, setShowCreate]     = useState(false);
  const [editBook, setEditBook]         = useState(null);
  const [selectedBook, setSelectedBook] = useState(null);

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ per_page: '20' });
      if (activeShelf)   params.set('shelf', activeShelf);
      if (search.trim()) params.set('search', search.trim());

      const [booksRes, statsRes] = await Promise.all([
        api.get(`/api/reading?${params.toString()}`),
        api.get('/api/reading/stats'),
      ]);

      setBooks(booksRes.data ?? []);
      setMeta(booksRes.meta ?? { total: 0, page: 1, per_page: 20 });
      setStats(statsRes.data);
    } catch (err) {
      setError(err.message || 'Failed to load reading list');
    } finally {
      setLoading(false);
    }
  }, [activeShelf, search]);

  // Debounce so typing in the search box doesn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(fetchBooks, 300);
    return () => clearTimeout(timer);
  }, [fetchBooks]);

  const handleSaved = () => {
    setShowCreate(false);
    setEditBook(null);
    fetchBooks();
  };

  const openEdit = (book) => { setSelectedBook(null); setEditBook(book); setShowCreate(true); };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">

      {/* HEADER */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-gray-50 tracking-[-0.02em]">Reading</h1>
          <p className="text-sm text-stone-500 dark:text-gray-400 mt-1">
            {stats ? `${stats.finished_this_year} book${stats.finished_this_year === 1 ? '' : 's'} finished this year` : 'Track your reading journey.'}
          </p>
        </div>
        <Button variant="primary" size="md" onClick={() => { setEditBook(null); setShowCreate(true); }}>
          <Plus size={16} />
          Add Book
        </Button>
      </div>

      {/* STAT CARDS */}
      {loading && !stats ? (
        <StatsSkeleton />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Want to Read"       value={stats?.want_to_read ?? 0}       icon={Bookmark} />
          <StatCard label="Reading Now"         value={stats?.reading ?? 0}            icon={BookOpen} />
          <StatCard label="Finished This Year"  value={stats?.finished_this_year ?? 0} icon={BookMarked} />
          <StatCard
            label="Pages This Year"
            value={(stats?.pages_read_this_year ?? 0).toLocaleString()}
            icon={Library}
            subtitle={stats?.avg_rating ? `Avg rating: ${stats.avg_rating.toFixed(1)} ★` : undefined}
          />
        </div>
      )}

      {/* SHELF TABS + SEARCH */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          {SHELVES.map((shelf) => {
            const isActive = activeShelf === shelf.key;
            return (
              <button
                key={shelf.key || 'all'}
                onClick={() => setActiveShelf(shelf.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-moss-500 dark:focus:ring-moss-400 ${
                  isActive
                    ? 'bg-moss-50 dark:bg-moss-950/50 text-moss-700 dark:text-moss-400 border border-moss-200 dark:border-moss-800'
                    : 'bg-white dark:bg-gray-800 text-stone-600 dark:text-gray-400 border border-stone-200 dark:border-gray-700 hover:bg-stone-50 dark:hover:bg-gray-700 hover:text-stone-900 dark:hover:text-gray-100'
                }`}
              >
                {shelf.label}
              </button>
            );
          })}
        </div>
        <div className="relative w-full sm:w-64">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 dark:text-gray-500 pointer-events-none" />
          <Input
            placeholder="Search books…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            aria-label="Search books"
          />
        </div>
      </div>

      {/* GRID / STATES */}
      {error && books.length === 0 ? (
        <ErrorState message={error} onRetry={fetchBooks} />
      ) : loading && books.length === 0 ? (
        <GridSkeleton />
      ) : books.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={activeShelf ? `No books in "${SHELVES.find((s) => s.key === activeShelf)?.label}"` : 'No books yet'}
          message={search.trim() ? 'No books match your search.' : 'Start building your library — add your first book.'}
          action={<Button variant="primary" size="sm" onClick={() => { setEditBook(null); setShowCreate(true); }}><Plus size={14} /> Add Book</Button>}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {books.map((book) => (
              <BookCard key={book.id} book={book} onClick={() => setSelectedBook(book)} />
            ))}
          </div>
          {meta.total > books.length && (
            <p className="text-center text-sm text-stone-400 dark:text-gray-500">
              Showing {books.length} of {meta.total} books
            </p>
          )}
        </>
      )}

      {/* CREATE / EDIT MODAL */}
      <CreateBookModal
        isOpen={showCreate}
        onClose={() => { setShowCreate(false); setEditBook(null); }}
        onSaved={handleSaved}
        book={editBook}
      />

      {/* DETAIL MODAL */}
      {selectedBook && (
        <BookDetailModal
          isOpen={!!selectedBook}
          onClose={() => { setSelectedBook(null); fetchBooks(); }}
          book={selectedBook}
          onEdit={() => openEdit(selectedBook)}
        />
      )}
    </div>
  );
}
