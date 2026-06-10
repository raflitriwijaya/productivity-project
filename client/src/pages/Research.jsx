// client/src/pages/Research.jsx
// Personal research hub — manages journal entries, citations, and notes,
// organised by colour-coded topics. Follows §8 Module Page Template.
//
// Two filter dimensions:
//   • Topic sidebar (left, desktop / horizontal tabs, mobile) — scopes the whole
//     page to one topic via the topic-scoped endpoints, or "All Entries".
//   • Type pills (above the table) — client-side filter within the loaded set.

import { useState, useMemo, useEffect, useRef } from 'react';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { Plus, BookOpen, Search, X, Download, ChevronDown, Archive, Trash2 } from 'lucide-react';

import api from '../lib/api';
import { useApi } from '../hooks/useApi';
import { useToast } from '../hooks/useToast';
import { generateCitation } from '../lib/generateCitation';

import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { ListSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';

import { ResearchSummaryCards } from '../components/research/ResearchSummaryCards';
import { CreateResearchModal } from '../components/research/CreateResearchModal';
import { EntryDetailModal } from '../components/research/EntryDetailModal';
import { TopicSidebar } from '../components/research/TopicSidebar';
import {
  TypeCell,
  StatusCell,
  SourceCell,
  TopicsCell,
  TagsCell,
  ActionsCell,
  TYPE_LABEL,
} from '../components/research/ResearchEntryRow';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/** Build a query string from search, tag, topic, and date-range filters. */
function buildQuery({ q, tags, topicId, dateFrom, dateTo }) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (tags && tags.length > 0) params.set('tags', tags.join(','));
  if (topicId) params.set('topic_id', topicId);
  if (dateFrom) params.set('date_from', dateFrom);
  // A bare <input type=date> value is midnight; for `date_to` we want the whole
  // day included, so push the boundary to end-of-day (else "To: today" excludes
  // everything created after 00:00 today).
  if (dateTo) params.set('date_to', `${dateTo}T23:59:59.999`);
  const s = params.toString();
  return s ? `?${s}` : '';
}

// ─── Filter options ───────────────────────────────────────────────────────────

const TYPE_FILTERS = [
  { value: 'all',      label: 'All' },
  { value: 'journal',  label: 'Journal' },
  { value: 'citation', label: 'Citation' },
  { value: 'note',     label: 'Note' },
];

// ─── Page component ───────────────────────────────────────────────────────────

export default function Research() {
  useDocumentTitle('Research Journal');
  // ── UI state ────────────────────────────────────────────────────────────────
  const [selectedTopicId, setSelectedTopicId] = useState(null); // null = All Entries
  const [typeFilter,      setTypeFilter]      = useState('all');
  const [isCreateOpen,    setIsCreateOpen]    = useState(false);
  const [editingEntry,    setEditingEntry]    = useState(null);   // null = create mode
  const [deletingEntry,   setDeletingEntry]   = useState(null);   // entry to confirm-delete
  const [deleteLoading,   setDeleteLoading]   = useState(false);
  const [topicsVersion,   setTopicsVersion]   = useState(0);      // bump to refresh sidebar-derived data

  const [searchQuery,     setSearchQuery]     = useState('');     // raw input
  const [debouncedQuery,  setDebouncedQuery]  = useState('');     // 300ms-debounced, drives the fetch
  const [activeTagFilters, setActiveTagFilters] = useState([]);   // clicked tag chips → server ?tags=
  const [dateFrom,        setDateFrom]        = useState('');     // ?date_from=
  const [dateTo,          setDateTo]          = useState('');     // ?date_to=

  const [viewingEntry,    setViewingEntry]    = useState(null);   // entry shown in the detail modal
  const [exportOpen,      setExportOpen]      = useState(false);  // export dropdown
  const exportRef = useRef(null);

  const [selectedIds,     setSelectedIds]     = useState([]);     // bulk-selected entry ids
  const [bulkDeleteOpen,  setBulkDeleteOpen]  = useState(false);  // bulk delete confirm modal
  const [bulkLoading,     setBulkLoading]     = useState(false);

  const { addToast } = useToast();

  // ── Debounce the search input (300ms) ────────────────────────────────────────
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(id);
  }, [searchQuery]);

  // ── Close the export dropdown on outside click ───────────────────────────────
  useEffect(() => {
    if (!exportOpen) return;
    const onDocClick = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) setExportOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [exportOpen]);

  // Stable dependency key for the tag filters (array identity would re-fetch every render).
  const tagKey = activeTagFilters.join(',');

  // ── Data fetching ────────────────────────────────────────────────────────────
  // The entries list switches endpoint based on the selected topic and carries the
  // debounced search + tag filters as server-side query params (both endpoints
  // support q/tags). Re-runs when topic, query, or tag filters change.
  const { data: entries, loading, error, refetch } = useApi(
    () => {
      const qs = buildQuery({ q: debouncedQuery, tags: activeTagFilters, dateFrom, dateTo });
      const base = selectedTopicId
        ? `/api/research/topics/${selectedTopicId}/entries`
        : '/api/research';
      return api.get(`${base}${qs}`);
    },
    [selectedTopicId, debouncedQuery, tagKey, dateFrom, dateTo]
  );

  const { data: stats, loading: statsLoading, refetch: refetchStats } = useApi(
    () => api.get(
      selectedTopicId
        ? `/api/research/topics/${selectedTopicId}`
        : '/api/research/stats'
    ),
    [selectedTopicId]
  );

  // Topic detail endpoint returns { topic, stats }; the global stats endpoint
  // returns the stats object directly. Normalise both for the summary cards and
  // the section heading.
  const summaryStats = selectedTopicId ? stats?.stats : stats;
  const selectedTopic = selectedTopicId ? stats?.topic : null;

  // Always-global fetch used only to derive sidebar counts (per-topic + total),
  // independent of the (possibly topic-scoped) table fetch above.
  const { data: allEntries } = useApi(
    () => api.get('/api/research?per_page=100'),
    [topicsVersion]
  );

  const { topicCounts, allCount } = useMemo(() => {
    const counts = {};
    if (Array.isArray(allEntries)) {
      for (const e of allEntries) {
        for (const t of e.topics ?? []) {
          counts[t.id] = (counts[t.id] ?? 0) + 1;
        }
      }
    }
    return { topicCounts: counts, allCount: Array.isArray(allEntries) ? allEntries.length : undefined };
  }, [allEntries]);

  // ── Derived: client-side type filter ─────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!entries) return [];
    if (typeFilter === 'all') return entries;
    return entries.filter(e => e.type === typeFilter);
  }, [entries, typeFilter]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const refreshAll = () => {
    refetch();
    refetchStats();
    setTopicsVersion(v => v + 1); // re-derive sidebar counts
  };

  const handleCreate = async (data) => {
    await api.post('/api/research', data);
    refreshAll();
  };

  const handleEdit = async (data) => {
    await api.patch(`/api/research/${editingEntry.id}`, data);
    refreshAll();
  };

  const openEdit = (entry) => {
    setEditingEntry(entry);
    setIsCreateOpen(true);
  };

  const closeModal = () => {
    setIsCreateOpen(false);
    setEditingEntry(null);
  };

  const confirmDelete = async () => {
    if (!deletingEntry) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/api/research/${deletingEntry.id}`);
      setDeletingEntry(null);
      refreshAll();
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Tag filtering (clicking a tag in a row adds a server-side ?tags= filter) ──
  const addTagFilter = (tag) =>
    setActiveTagFilters(prev => (prev.includes(tag) ? prev : [...prev, tag]));
  const removeTagFilter = (tag) =>
    setActiveTagFilters(prev => prev.filter(t => t !== tag));

  // ── Detail view → edit handoff ───────────────────────────────────────────────
  const editFromDetail = (entry) => {
    setViewingEntry(null);
    setEditingEntry(entry);
    setIsCreateOpen(true);
  };

  // ── Row actions: duplicate / pin / copy citation ─────────────────────────────
  const handleDuplicate = async (entry) => {
    try {
      await api.post(`/api/research/${entry.id}/duplicate`);
      addToast({ type: 'success', title: 'Entry duplicated' });
      refreshAll();
    } catch (err) {
      addToast({ type: 'error', title: 'Duplicate failed', message: err.message });
    }
  };

  const handleTogglePin = async (entry) => {
    try {
      await api.patch(`/api/research/${entry.id}`, { is_pinned: !entry.is_pinned });
      addToast({ type: 'success', title: entry.is_pinned ? 'Entry unpinned' : 'Entry pinned' });
      refreshAll();
    } catch (err) {
      addToast({ type: 'error', title: 'Update failed', message: err.message });
    }
  };

  const handleCopyCitation = async (entry, style) => {
    const text = generateCitation(entry, style);
    try {
      await navigator.clipboard.writeText(text);
      addToast({ type: 'success', title: `${style.toUpperCase()} citation copied!` });
    } catch {
      addToast({ type: 'error', title: 'Copy failed', message: 'Clipboard is unavailable.' });
    }
  };

  const rowActions = {
    onEdit: openEdit,
    onDelete: (r) => setDeletingEntry(r),
    onDuplicate: handleDuplicate,
    onTogglePin: handleTogglePin,
    onCopyCitation: handleCopyCitation,
  };

  // ── Export (download the current filtered set as JSON/CSV) ────────────────────
  const exportUrl = (format) => {
    const qs = buildQuery({ q: debouncedQuery, tags: activeTagFilters, topicId: selectedTopicId, dateFrom, dateTo });
    const sep = qs ? '&' : '?';
    return `${API_BASE}/api/research/export${qs}${sep}format=${format}`;
  };
  const doExport = (format) => {
    window.open(exportUrl(format), '_blank');
    setExportOpen(false);
  };

  // ── Bulk selection ────────────────────────────────────────────────────────────
  const toggleSelect = (id) =>
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  const clearSelection = () => setSelectedIds([]);
  const allVisibleSelected = filtered.length > 0 && filtered.every(e => selectedIds.includes(e.id));
  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      const visible = new Set(filtered.map(e => e.id));
      setSelectedIds(prev => prev.filter(id => !visible.has(id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...filtered.map(e => e.id)])]);
    }
  };

  const bulkArchive = async () => {
    setBulkLoading(true);
    try {
      await api.patch('/api/research/bulk', { ids: selectedIds, status: 'archived' });
      addToast({ type: 'success', title: `${selectedIds.length} archived` });
      clearSelection();
      refreshAll();
    } catch (err) {
      addToast({ type: 'error', title: 'Archive failed', message: err.message });
    } finally {
      setBulkLoading(false);
    }
  };

  const bulkDelete = async () => {
    setBulkLoading(true);
    try {
      await api.delete('/api/research/bulk', { data: { ids: selectedIds } });
      addToast({ type: 'success', title: `${selectedIds.length} deleted` });
      setBulkDeleteOpen(false);
      clearSelection();
      refreshAll();
    } catch (err) {
      addToast({ type: 'error', title: 'Delete failed', message: err.message });
    } finally {
      setBulkLoading(false);
    }
  };

  // ── DataTable column contract (§5.4) ─────────────────────────────────────────

  const checkboxClass =
    'h-4 w-4 rounded border-stone-300 dark:border-gray-600 text-moss-600 ' +
    'focus:ring-moss-500 dark:focus:ring-moss-400 focus:ring-offset-0 ' +
    'bg-white dark:bg-gray-700 cursor-pointer accent-moss-600 dark:accent-moss-500';

  const columns = [
    {
      key: 'select',
      header: (
        <input
          type="checkbox"
          className={checkboxClass}
          checked={allVisibleSelected}
          onChange={toggleSelectAll}
          aria-label="Select all visible entries"
        />
      ),
      render: (row) => (
        <input
          type="checkbox"
          className={checkboxClass}
          checked={selectedIds.includes(row.id)}
          onChange={() => toggleSelect(row.id)}
          aria-label={`Select ${row.title}`}
        />
      ),
    },
    {
      key: 'title',
      header: 'Title',
      sortable: true,
      render: (row) => (
        <button
          type="button"
          onClick={() => setViewingEntry(row)}
          className="text-left text-sm text-stone-900 dark:text-gray-50 hover:text-moss-600 dark:hover:text-moss-400 hover:underline truncate max-w-xs focus:outline-none"
        >
          {row.title}
        </button>
      ),
    },
    { key: 'type',   header: 'Type',   render: TypeCell },
    { key: 'status', header: 'Status', render: StatusCell },
    { key: 'topics', header: 'Topics', render: TopicsCell },
    { key: 'tags',   header: 'Tags',   render: TagsCell(addTagFilter) },
    { key: 'source', header: 'Source', render: SourceCell },
    {
      key:      'created_at',
      header:   'Created',
      sortable: true,
      render:   (row) => (
        <span className="text-sm text-stone-500 dark:text-gray-400">
          {new Date(row.created_at).toLocaleDateString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric',
          })}
        </span>
      ),
    },
    {
      key:    'actions',
      header: '',
      align:  'right',
      render: (row) => ActionsCell(row, rowActions),
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">

      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-gray-50 tracking-[-0.02em]">
            Research
          </h1>
          <p className="text-sm text-stone-500 dark:text-gray-400 mt-1">
            Journal entries, citations, and notes — organised by topic.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* SEARCH */}
          <div className="relative w-full sm:w-64">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 dark:text-gray-500 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search entries…"
              aria-label="Search research entries"
              className="w-full pl-9 pr-9 py-2 rounded-lg text-sm
                bg-white dark:bg-gray-700
                text-stone-900 dark:text-gray-50
                placeholder-stone-400 dark:placeholder-gray-500
                border border-stone-200 dark:border-gray-600
                focus:outline-none focus:ring-2 focus:ring-moss-500 dark:focus:ring-moss-400 focus:border-transparent
                transition-colors duration-150"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-stone-400 hover:text-stone-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-stone-100 dark:hover:bg-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* EXPORT */}
          <div className="relative flex-shrink-0" ref={exportRef}>
            <Button variant="secondary" size="md" onClick={() => setExportOpen(o => !o)}>
              <Download size={16} />
              Export
              <ChevronDown size={14} />
            </Button>
            {exportOpen && (
              <div className="absolute right-0 mt-1 w-44 z-40 rounded-lg border border-stone-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1">
                <button
                  type="button"
                  onClick={() => doExport('json')}
                  className="w-full text-left px-4 py-2 text-sm text-stone-700 dark:text-gray-300 hover:bg-moss-50 dark:hover:bg-moss-950/30 hover:text-moss-700 dark:hover:text-moss-400 transition-colors duration-100"
                >
                  Export as JSON
                </button>
                <button
                  type="button"
                  onClick={() => doExport('csv')}
                  className="w-full text-left px-4 py-2 text-sm text-stone-700 dark:text-gray-300 hover:bg-moss-50 dark:hover:bg-moss-950/30 hover:text-moss-700 dark:hover:text-moss-400 transition-colors duration-100"
                >
                  Export as CSV
                </button>
              </div>
            )}
          </div>

          <Button variant="primary" size="md" onClick={() => { setEditingEntry(null); setIsCreateOpen(true); }} className="flex-shrink-0">
            <Plus size={16} />
            New Entry
          </Button>
        </div>
      </div>

      {/* MOBILE: horizontal topic tabs (desktop sidebar is in the flex row below) */}
      <div className="lg:hidden mb-6">
        <TopicSidebar
          selectedTopicId={selectedTopicId}
          onSelectTopic={setSelectedTopicId}
          topicCounts={topicCounts}
          allCount={allCount}
          onTopicsChanged={() => setTopicsVersion(v => v + 1)}
        />
      </div>

      {/* CONTENT ROW: desktop sidebar + main area */}
      <div className="flex flex-col lg:flex-row gap-6">

        {/* DESKTOP SIDEBAR */}
        <aside className="hidden lg:block">
          <TopicSidebar
            selectedTopicId={selectedTopicId}
            onSelectTopic={setSelectedTopicId}
            topicCounts={topicCounts}
            allCount={allCount}
            onTopicsChanged={() => setTopicsVersion(v => v + 1)}
          />
        </aside>

        {/* MAIN AREA */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* SELECTED-TOPIC HEADING */}
          {selectedTopic && (
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: selectedTopic.color }}
              />
              <h2 className="text-lg font-semibold text-stone-900 dark:text-gray-50 tracking-[-0.01em]">
                {selectedTopic.name}
              </h2>
              {selectedTopic.description && (
                <span className="text-sm text-stone-500 dark:text-gray-400 truncate">
                  — {selectedTopic.description}
                </span>
              )}
            </div>
          )}

          {/* SUMMARY STATS */}
          <ResearchSummaryCards stats={statsLoading ? null : summaryStats} />

          {/* FILTER BAR: type pills + date range */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            {/* TYPE FILTER PILLS */}
            <div className="flex items-center gap-2 flex-wrap">
              {TYPE_FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setTypeFilter(f.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150
                    ${typeFilter === f.value
                      ? 'bg-moss-50 dark:bg-moss-950/50 text-moss-700 dark:text-moss-400'
                      : 'bg-white dark:bg-gray-800 border border-stone-200 dark:border-gray-700 text-stone-600 dark:text-gray-400 hover:bg-stone-50 dark:hover:bg-gray-700'
                    }`}
                >
                  {f.label}
                  {f.value !== 'all' && entries && (
                    <span className="ml-1.5 text-[11px] text-stone-400 dark:text-gray-500">
                      ({entries.filter(e => e.type === f.value).length})
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* DATE RANGE FILTER */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-stone-500 dark:text-gray-400">From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                aria-label="Filter from date"
                className="px-3 py-1.5 rounded-lg text-xs
                  bg-white dark:bg-gray-700 text-stone-900 dark:text-gray-50
                  border border-stone-200 dark:border-gray-600
                  focus:outline-none focus:ring-2 focus:ring-moss-500 dark:focus:ring-moss-400 focus:border-transparent
                  transition-colors duration-150 [color-scheme:light] dark:[color-scheme:dark]"
              />
              <span className="text-xs text-stone-500 dark:text-gray-400">To</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                aria-label="Filter to date"
                className="px-3 py-1.5 rounded-lg text-xs
                  bg-white dark:bg-gray-700 text-stone-900 dark:text-gray-50
                  border border-stone-200 dark:border-gray-600
                  focus:outline-none focus:ring-2 focus:ring-moss-500 dark:focus:ring-moss-400 focus:border-transparent
                  transition-colors duration-150 [color-scheme:light] dark:[color-scheme:dark]"
              />
              {(dateFrom || dateTo) && (
                <button
                  type="button"
                  onClick={() => { setDateFrom(''); setDateTo(''); }}
                  className="text-xs text-stone-400 dark:text-gray-500 hover:text-stone-600 dark:hover:text-gray-300 underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* ACTIVE TAG FILTERS (server-side ?tags=) */}
          {activeTagFilters.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-stone-500 dark:text-gray-400">Filtered by tag:</span>
              {activeTagFilters.map(tag => (
                <Badge key={tag} variant="moss" className="gap-1 pr-1">
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTagFilter(tag)}
                    aria-label={`Remove tag filter ${tag}`}
                    className="rounded-full p-0.5 text-moss-500 hover:text-moss-800 dark:text-moss-400 dark:hover:text-moss-200 hover:bg-moss-100 dark:hover:bg-moss-900/50"
                  >
                    <X size={11} />
                  </button>
                </Badge>
              ))}
              <button
                type="button"
                onClick={() => setActiveTagFilters([])}
                className="text-xs text-stone-400 dark:text-gray-500 hover:text-stone-600 dark:hover:text-gray-300 underline"
              >
                Clear all
              </button>
            </div>
          )}

          {/* BULK ACTION BAR */}
          {selectedIds.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 rounded-xl border border-moss-200 dark:border-moss-800 bg-moss-50 dark:bg-moss-950/30">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-moss-800 dark:text-moss-300">
                  {selectedIds.length} selected
                </span>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-xs text-stone-500 dark:text-gray-400 hover:text-stone-700 dark:hover:text-gray-200 underline"
                >
                  Clear
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={bulkArchive} disabled={bulkLoading}>
                  <Archive size={14} />
                  Archive Selected
                </Button>
                <Button variant="danger" size="sm" onClick={() => setBulkDeleteOpen(true)} disabled={bulkLoading}>
                  <Trash2 size={14} />
                  Delete Selected
                </Button>
              </div>
            </div>
          )}

          {/* MAIN TABLE — four-state switch (§7) */}
          <Card>
            <CardHeader
              title="All Entries"
              subtitle={filtered.length > 0 ? `${filtered.length} ${typeFilter === 'all' ? 'total' : TYPE_LABEL[typeFilter]?.toLowerCase() ?? typeFilter}` : undefined}
            />
            <CardBody className="p-0">
              {loading && <ListSkeleton rows={5} />}
              {error && !loading && <ErrorState message={error} onRetry={refetch} />}
              {!loading && !error && filtered.length === 0 && (() => {
                const hasFilters = debouncedQuery || activeTagFilters.length > 0 || dateFrom || dateTo;
                return (
                <EmptyState
                  icon={BookOpen}
                  title={
                    hasFilters
                      ? 'No matching entries'
                      : (typeFilter === 'all' ? 'No entries yet' : `No ${TYPE_LABEL[typeFilter]?.toLowerCase() ?? typeFilter} entries`)
                  }
                  message={
                    hasFilters
                      ? 'No entries match the current search or tag filters. Try clearing them.'
                      : typeFilter === 'all'
                        ? (selectedTopic
                            ? `No entries in "${selectedTopic.name}" yet. Create one or assign an existing entry to this topic.`
                            : 'Create your first journal entry, citation, or note to get started.')
                        : `Switch to "All" or create a new ${TYPE_LABEL[typeFilter]?.toLowerCase() ?? typeFilter} entry.`
                  }
                  action={
                    !hasFilters && typeFilter === 'all' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => { setEditingEntry(null); setIsCreateOpen(true); }}
                      >
                        <Plus size={14} />
                        New Entry
                      </Button>
                    )
                  }
                />
                );
              })()}
              {!loading && !error && filtered.length > 0 && (
                <DataTable
                  columns={columns}
                  items={filtered}
                  initialSortKey="created_at"
                />
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* ENTRY DETAIL MODAL */}
      <EntryDetailModal
        isOpen={!!viewingEntry}
        onClose={() => setViewingEntry(null)}
        entry={viewingEntry}
        onEdit={editFromDetail}
      />

      {/* CREATE / EDIT MODAL */}
      <CreateResearchModal
        isOpen={isCreateOpen}
        onClose={closeModal}
        onSubmit={editingEntry ? handleEdit : handleCreate}
        entry={editingEntry}
      />

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={!!deletingEntry}
        onClose={() => setDeletingEntry(null)}
        title="Delete Entry"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setDeletingEntry(null)}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={confirmDelete}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Deleting…' : 'Delete'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-stone-600 dark:text-gray-400">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-stone-900 dark:text-gray-50">
            "{deletingEntry?.title}"
          </span>
          ? This action cannot be undone.
        </p>
      </Modal>

      {/* BULK DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        title="Delete Entries"
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="md" onClick={() => setBulkDeleteOpen(false)} disabled={bulkLoading}>
              Cancel
            </Button>
            <Button variant="danger" size="md" onClick={bulkDelete} disabled={bulkLoading}>
              {bulkLoading ? 'Deleting…' : `Delete ${selectedIds.length}`}
            </Button>
          </>
        }
      >
        <p className="text-sm text-stone-600 dark:text-gray-400">
          Delete{' '}
          <span className="font-semibold text-stone-900 dark:text-gray-50">{selectedIds.length}</span>
          {' '}selected {selectedIds.length === 1 ? 'entry' : 'entries'}? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
