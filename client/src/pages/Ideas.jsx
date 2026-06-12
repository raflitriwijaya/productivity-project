// client/src/pages/Ideas.jsx
// /ideas — Ideas Tracker (Roadmap Wave 4). "Don't let ideas evaporate." A visual,
// card-based board for impulsive ideas (product/business/partnership/marketing),
// with status workflow, search, Universal Links, and a "Convert to…" handoff.

import { useState, useEffect, useCallback } from 'react';
import { Plus, Lightbulb, Search } from 'lucide-react';

import api from '../lib/api';
import useDocumentTitle from '../hooks/useDocumentTitle';

import { Card, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { StatCard } from '../components/ui/StatCard';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';

import { IdeaCard } from '../components/ideas/IdeaCard';
import { CreateIdeaModal } from '../components/ideas/CreateIdeaModal';
import { IdeaDetailModal } from '../components/ideas/IdeaDetailModal';

const STATUS_TABS = [
  { key: '',           label: 'All' },
  { key: 'new',        label: 'New' },
  { key: 'developing', label: 'Developing' },
  { key: 'validated',  label: 'Validated' },
  { key: 'converted',  label: 'Converted' },
  { key: 'archived',   label: 'Archived' },
];

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {[...Array(5)].map((_, i) => (
        <Card key={i}>
          <CardBody>
            <div className="h-3 w-20 rounded bg-stone-200 dark:bg-gray-700 animate-pulse mb-3" />
            <div className="h-7 w-12 rounded bg-stone-200 dark:bg-gray-700 animate-pulse" />
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
        <div key={i} className="h-32 rounded-xl bg-stone-100 dark:bg-gray-800 animate-pulse" />
      ))}
    </div>
  );
}

export default function Ideas() {
  useDocumentTitle('Ideas');

  const [ideas, setIdeas]             = useState([]);
  const [stats, setStats]             = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [activeStatus, setActiveStatus] = useState('');
  const [search, setSearch]           = useState('');

  const [showCreate, setShowCreate]     = useState(false);
  const [editIdea, setEditIdea]         = useState(null);
  const [selectedIdea, setSelectedIdea] = useState(null);

  const fetchIdeas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ per_page: '50' });
      if (activeStatus)  params.set('status', activeStatus);
      if (search.trim()) params.set('search', search.trim());

      const [listRes, statsRes] = await Promise.all([
        api.get(`/api/ideas?${params.toString()}`),
        api.get('/api/ideas/stats'),
      ]);

      setIdeas(listRes.data ?? []);
      setStats(statsRes.data);
    } catch (err) {
      setError(err.message || 'Failed to load ideas');
    } finally {
      setLoading(false);
    }
  }, [activeStatus, search]);

  // Debounce so typing in the search box doesn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(fetchIdeas, 300);
    return () => clearTimeout(timer);
  }, [fetchIdeas]);

  // The QuickCapture palette can create an idea from anywhere — refetch when it does.
  useEffect(() => {
    const onCreated = () => fetchIdeas();
    window.addEventListener('quick-capture-created', onCreated);
    return () => window.removeEventListener('quick-capture-created', onCreated);
  }, [fetchIdeas]);

  const handleSaved = () => { setShowCreate(false); setEditIdea(null); fetchIdeas(); };
  const openEdit = (idea) => { setSelectedIdea(null); setEditIdea(idea); setShowCreate(true); };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-gray-50 tracking-[-0.02em]">Ideas</h1>
          <p className="text-sm text-stone-500 dark:text-gray-400 mt-1">
            {stats ? `${stats.total} idea${stats.total === 1 ? '' : 's'} captured — don't let them evaporate.` : 'Capture ideas before they evaporate.'}
          </p>
        </div>
        <Button variant="primary" size="md" onClick={() => { setEditIdea(null); setShowCreate(true); }}>
          <Plus size={16} />
          Capture Idea
        </Button>
      </div>

      {/* STAT CARDS */}
      {loading && !stats ? (
        <StatsSkeleton />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Total"      value={stats?.total ?? 0}      icon={Lightbulb} />
          <StatCard label="New"        value={stats?.new ?? 0} />
          <StatCard label="Developing" value={stats?.developing ?? 0} />
          <StatCard label="Validated"  value={stats?.validated ?? 0} />
          <StatCard label="Converted"  value={stats?.converted ?? 0} />
        </div>
      )}

      {/* STATUS TABS + SEARCH */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          {STATUS_TABS.map((tab) => {
            const isActive = activeStatus === tab.key;
            return (
              <button
                key={tab.key || 'all'}
                onClick={() => setActiveStatus(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ember-500 dark:focus:ring-ember-400 ${
                  isActive
                    ? 'bg-ember-50 dark:bg-ember-950/50 text-ember-700 dark:text-ember-400 border border-ember-200 dark:border-ember-800'
                    : 'bg-white dark:bg-gray-800 text-stone-600 dark:text-gray-400 border border-stone-200 dark:border-gray-700 hover:bg-stone-50 dark:hover:bg-gray-700 hover:text-stone-900 dark:hover:text-gray-100'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="relative w-full sm:w-64">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 dark:text-gray-500 pointer-events-none" />
          <Input
            placeholder="Search ideas…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            aria-label="Search ideas"
          />
        </div>
      </div>

      {/* GRID / STATES */}
      {error && ideas.length === 0 ? (
        <ErrorState message={error} onRetry={fetchIdeas} />
      ) : loading && ideas.length === 0 ? (
        <GridSkeleton />
      ) : ideas.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title={activeStatus ? `No ${activeStatus} ideas` : 'No ideas yet'}
          message={search.trim() ? 'No ideas match your search.' : 'Capture your first idea — product features, business models, partnership angles, anything.'}
          action={<Button variant="primary" size="sm" onClick={() => { setEditIdea(null); setShowCreate(true); }}><Plus size={14} /> Capture Idea</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ideas.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} onClick={() => setSelectedIdea(idea)} />
          ))}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      <CreateIdeaModal
        isOpen={showCreate}
        onClose={() => { setShowCreate(false); setEditIdea(null); }}
        onSaved={handleSaved}
        idea={editIdea}
      />

      {/* DETAIL MODAL */}
      {selectedIdea && (
        <IdeaDetailModal
          isOpen={!!selectedIdea}
          onClose={() => { setSelectedIdea(null); fetchIdeas(); }}
          idea={selectedIdea}
          onEdit={() => openEdit(selectedIdea)}
          onConverted={() => { setSelectedIdea(null); fetchIdeas(); }}
        />
      )}
    </div>
  );
}
