// client/src/pages/EngineerSnippets.jsx
// Code snippet library — a responsive grid of SnippetCard with search and
// category/language filters, a full-view modal with copy, and create/edit/delete.
//
// Snippets are fetched once and filtered client-side (matching the Research page
// precedent); the server also supports ?q=/?category=/?language= for API callers.

import { useState, useMemo } from 'react';
import { Plus, Search, Code } from 'lucide-react';

import api from '../lib/api';
import { useApi } from '../hooks/useApi';

import { Card, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { ListSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';

import { SnippetCard } from '../components/engineer/SnippetCard';
import { SnippetModal } from '../components/engineer/SnippetModal';
import { CreateSnippetModal } from '../components/engineer/CreateSnippetModal';
import { SNIPPET_LANGUAGES, LANGUAGE_LABEL } from '../components/engineer/snippetConstants';
import { splitTags } from '../components/engineer/ProjectRow';

export default function EngineerSnippets() {
  // ── UI state ──────────────────────────────────────────────────────────────
  const [query,         setQuery]         = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [viewing,       setViewing]       = useState(null);   // snippet in full-view modal
  const [isCreateOpen,  setIsCreateOpen]  = useState(false);
  const [editingSnippet, setEditingSnippet] = useState(null);
  const [deletingSnippet, setDeletingSnippet] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Data fetching ───────────────────────────────────────────────────────────
  const { data: snippets, loading, error, refetch } =
    useApi(() => api.get('/api/engineer/snippets'), []);

  // ── Derived: categories present + client-side filter ─────────────────────────
  const categories = useMemo(() => {
    if (!snippets) return [];
    return [...new Set(snippets.map(s => s.category))].sort();
  }, [snippets]);

  const filtered = useMemo(() => {
    if (!snippets) return [];
    const q = query.trim().toLowerCase();
    return snippets.filter(s => {
      if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;
      if (languageFilter !== 'all' && s.language !== languageFilter) return false;
      if (!q) return true;
      const haystack = [s.title, s.tags ?? '', s.code].join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [snippets, query, categoryFilter, languageFilter]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleCreate = async (data) => {
    await api.post('/api/engineer/snippets', data);
    refetch();
  };

  const handleEdit = async (data) => {
    await api.patch(`/api/engineer/snippets/${editingSnippet.id}`, data);
    refetch();
  };

  const openCreate = () => { setEditingSnippet(null); setIsCreateOpen(true); };
  const openEditFromView = (snippet) => { setViewing(null); setEditingSnippet(snippet); setIsCreateOpen(true); };
  const closeCreate = () => { setIsCreateOpen(false); setEditingSnippet(null); };
  const openDeleteFromView = (snippet) => { setViewing(null); setDeletingSnippet(snippet); };

  const confirmDelete = async () => {
    if (!deletingSnippet) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/api/engineer/snippets/${deletingSnippet.id}`);
      setDeletingSnippet(null);
      refetch();
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">

      {/* PAGE HEADER */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-gray-50 tracking-[-0.02em]">
            Snippets
          </h1>
          <p className="text-sm text-stone-500 dark:text-gray-400 mt-1">
            Reusable code — drivers, comms, control loops, and config.
          </p>
        </div>
        <Button variant="primary" size="md" onClick={openCreate}>
          <Plus size={16} />
          New Snippet
        </Button>
      </div>

      {/* SEARCH + FILTERS */}
      <Card>
        <CardBody>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
            <div className="relative">
              <Input
                id="snippet-search"
                label="Search"
                placeholder="Search title, tags, or code…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
              <Search
                size={16}
                className="absolute left-3 top-[2.35rem] text-stone-400 dark:text-gray-500 pointer-events-none"
              />
            </div>

            <Select
              id="snippet-category-filter"
              label="Category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>

            <Select
              id="snippet-language-filter"
              label="Language"
              value={languageFilter}
              onChange={(e) => setLanguageFilter(e.target.value)}
            >
              <option value="all">All languages</option>
              {SNIPPET_LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </Select>
          </div>
        </CardBody>
      </Card>

      {/* GRID — four-state switch (§7) */}
      {loading && (
        <Card><CardBody className="p-0"><ListSkeleton rows={4} /></CardBody></Card>
      )}
      {error && !loading && (
        <Card><CardBody className="p-0"><ErrorState message={error} onRetry={refetch} /></CardBody></Card>
      )}
      {!loading && !error && filtered.length === 0 && (
        <Card>
          <CardBody className="p-0">
            <EmptyState
              icon={Code}
              title={snippets?.length ? 'No snippets match' : 'No snippets yet'}
              message={
                snippets?.length
                  ? 'Try a different search term or clear the filters.'
                  : 'Save your first reusable code snippet.'
              }
              action={
                !snippets?.length && (
                  <Button variant="primary" size="sm" onClick={openCreate}>
                    <Plus size={14} />
                    New Snippet
                  </Button>
                )
              }
            />
          </CardBody>
        </Card>
      )}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(snippet => (
            <SnippetCard key={snippet.id} snippet={snippet} onOpen={setViewing} />
          ))}
        </div>
      )}

      {/* FULL-VIEW MODAL */}
      <SnippetModal
        isOpen={!!viewing}
        onClose={() => setViewing(null)}
        snippet={viewing}
        onEdit={openEditFromView}
        onDelete={openDeleteFromView}
      />

      {/* CREATE / EDIT MODAL */}
      <CreateSnippetModal
        isOpen={isCreateOpen}
        onClose={closeCreate}
        onSubmit={editingSnippet ? handleEdit : handleCreate}
        snippet={editingSnippet}
      />

      {/* DELETE CONFIRMATION */}
      <Modal
        isOpen={!!deletingSnippet}
        onClose={() => setDeletingSnippet(null)}
        title="Delete Snippet"
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="md" onClick={() => setDeletingSnippet(null)} disabled={deleteLoading}>
              Cancel
            </Button>
            <Button variant="danger" size="md" onClick={confirmDelete} disabled={deleteLoading}>
              {deleteLoading ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-stone-600 dark:text-gray-400">
          Delete{' '}
          <span className="font-semibold text-stone-900 dark:text-gray-50">
            "{deletingSnippet?.title}"
          </span>
          {deletingSnippet && (
            <span className="text-stone-500 dark:text-gray-400">
              {' '}({LANGUAGE_LABEL[deletingSnippet.language] ?? deletingSnippet.language}
              {splitTags(deletingSnippet.tags).length > 0 ? `, ${splitTags(deletingSnippet.tags).length} tags` : ''})
            </span>
          )}
          ? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
