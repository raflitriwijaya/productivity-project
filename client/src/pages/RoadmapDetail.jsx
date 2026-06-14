// client/src/pages/RoadmapDetail.jsx
// Custom Learning Roadmaps — detail view for a single roadmap. Header (icon, title,
// description, status, overall auto-calculated progress, edit/recalc/delete), the
// track lanes in a responsive grid (TrackLane → MilestoneItem), an "Add Track"
// affordance, and the Universal Links section. All four states. Every mutation
// re-fetches the nested roadmap so progress bars stay truthful.

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2, RefreshCw, Link as LinkIcon } from 'lucide-react';

import api from '../lib/api';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useToast } from '../hooks/useToast';

import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { LinkedItems } from '../components/shared/LinkedItems';

import { TrackLane } from '../components/roadmaps/TrackLane';
import { CreateRoadmapModal } from '../components/roadmaps/CreateRoadmapModal';
import { CreateTrackModal } from '../components/roadmaps/CreateTrackModal';
import { CreateMilestoneModal } from '../components/roadmaps/CreateMilestoneModal';
import { ROADMAP_STATUS_VARIANT, ROADMAP_STATUS_LABEL, pct } from '../lib/roadmapEnums';

function DetailSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
      <div className="h-4 w-32 rounded bg-stone-200 dark:bg-gray-700 animate-pulse" />
      <div className="space-y-3">
        <div className="h-8 w-72 rounded bg-stone-200 dark:bg-gray-700 animate-pulse" />
        <div className="h-4 w-96 rounded bg-stone-100 dark:bg-gray-700/50 animate-pulse" />
        <div className="h-2.5 w-full rounded bg-stone-200 dark:bg-gray-700 animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-64 rounded-xl bg-stone-100 dark:bg-gray-800 animate-pulse" />)}
      </div>
    </div>
  );
}

export default function RoadmapDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [roadmap, setRoadmap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const [showEditRoadmap, setShowEditRoadmap] = useState(false);
  const [trackModal, setTrackModal] = useState({ open: false, track: null });
  const [milestoneModal, setMilestoneModal] = useState({ open: false, trackId: null, milestone: null });

  useDocumentTitle(roadmap ? roadmap.title : 'Roadmap');

  const fetchRoadmap = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/roadmaps/${id}`);
      setRoadmap(res.data);
    } catch (err) {
      setError(err.message || 'Failed to load roadmap');
    } finally {
      setLoading(false);
    }
  }, [id]);

  /* eslint-disable-next-line react-hooks/set-state-in-effect */
  useEffect(() => { fetchRoadmap(); }, [fetchRoadmap]);

  const handleRecalc = async () => {
    setBusy(true);
    try {
      const res = await api.post(`/api/roadmaps/${id}/recalc`);
      setRoadmap(res.data);
      addToast({ type: 'success', title: 'Progress recalculated' });
    } catch (err) {
      addToast({ type: 'error', title: 'Recalculation failed', message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteRoadmap = async () => {
    if (!window.confirm('Delete this roadmap and all its tracks and milestones? This cannot be undone.')) return;
    setBusy(true);
    try {
      await api.delete(`/api/roadmaps/${id}`);
      addToast({ type: 'success', title: 'Roadmap deleted' });
      navigate('/roadmaps');
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to delete roadmap', message: err.message });
      setBusy(false);
    }
  };

  if (loading && !roadmap) return <DetailSkeleton />;

  if (error && !roadmap) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        <Link to="/roadmaps" className="inline-flex items-center gap-1.5 text-sm text-stone-500 dark:text-gray-400 hover:text-stone-900 dark:hover:text-gray-100 transition-colors duration-150">
          <ArrowLeft size={16} /> Back to Roadmaps
        </Link>
        <ErrorState message={error} onRetry={fetchRoadmap} />
      </div>
    );
  }

  if (!roadmap) return null;

  const progress = pct(roadmap.progress);
  const tracks = roadmap.tracks ?? [];
  const accent = roadmap.color || '#4A7C59';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">

      {/* Back */}
      <Link to="/roadmaps" className="inline-flex items-center gap-1.5 text-sm text-stone-500 dark:text-gray-400 hover:text-stone-900 dark:hover:text-gray-100 transition-colors duration-150">
        <ArrowLeft size={16} /> Back to Roadmaps
      </Link>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            {roadmap.icon && <span className="text-3xl leading-none" aria-hidden="true">{roadmap.icon}</span>}
            <h1 className="text-2xl font-bold text-stone-900 dark:text-gray-50 tracking-[-0.02em]">{roadmap.title}</h1>
            <Badge variant={ROADMAP_STATUS_VARIANT[roadmap.status] ?? 'gray'}>
              {ROADMAP_STATUS_LABEL[roadmap.status] ?? roadmap.status}
            </Badge>
            {roadmap.category && (
              <span className="text-sm text-stone-400 dark:text-gray-500 capitalize">{roadmap.category}</span>
            )}
          </div>
          {roadmap.description && (
            <p className="text-sm text-stone-600 dark:text-gray-400 max-w-2xl whitespace-pre-wrap">{roadmap.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="secondary" size="sm" onClick={handleRecalc} disabled={busy}>
            <RefreshCw size={14} className={busy ? 'animate-spin' : ''} /> Recalc
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowEditRoadmap(true)}>
            <Pencil size={14} /> Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDeleteRoadmap} disabled={busy} aria-label="Delete roadmap">
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {/* Overall progress */}
      <div className="rounded-xl border border-stone-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-medium text-stone-700 dark:text-gray-300">Overall progress</span>
          <span className="font-semibold tabular-nums" style={{ color: accent }}>{progress}%</span>
        </div>
        <div className="w-full h-2.5 bg-stone-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: accent }} />
        </div>
      </div>

      {/* Tracks */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-stone-700 dark:text-gray-300">Tracks ({tracks.length})</h2>
        <Button variant="secondary" size="sm" onClick={() => setTrackModal({ open: true, track: null })}>
          <Plus size={14} /> Add Track
        </Button>
      </div>

      {tracks.length === 0 ? (
        <EmptyState
          icon={Plus}
          title="No tracks yet"
          message="Add a track (lane) — e.g. “Fundamentals”, “Peripherals”, “Projects” — then fill it with milestones."
          action={<Button variant="primary" size="sm" onClick={() => setTrackModal({ open: true, track: null })}><Plus size={14} /> Add Track</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
          {tracks.map((track) => (
            <TrackLane
              key={track.id}
              track={track}
              onChanged={fetchRoadmap}
              onAddMilestone={(trackId) => setMilestoneModal({ open: true, trackId, milestone: null })}
              onEditMilestone={(m) => setMilestoneModal({ open: true, trackId: m.track_id, milestone: m })}
              onEditTrack={(t) => setTrackModal({ open: true, track: t })}
            />
          ))}
        </div>
      )}

      {/* Linked items (Universal Links) */}
      <div className="rounded-xl border border-stone-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <h2 className="text-sm font-semibold text-stone-700 dark:text-gray-300 flex items-center gap-2 mb-3">
          <LinkIcon size={16} /> Connections
        </h2>
        <LinkedItems entityType="learning_roadmap" entityId={roadmap.id} />
      </div>

      {/* Modals */}
      <CreateRoadmapModal
        isOpen={showEditRoadmap}
        onClose={() => setShowEditRoadmap(false)}
        onSaved={() => { setShowEditRoadmap(false); fetchRoadmap(); }}
        roadmap={roadmap}
      />

      <CreateTrackModal
        isOpen={trackModal.open}
        onClose={() => setTrackModal({ open: false, track: null })}
        onSaved={() => { setTrackModal({ open: false, track: null }); fetchRoadmap(); }}
        roadmapId={roadmap.id}
        track={trackModal.track}
      />

      <CreateMilestoneModal
        isOpen={milestoneModal.open}
        onClose={() => setMilestoneModal({ open: false, trackId: null, milestone: null })}
        onSaved={() => { setMilestoneModal({ open: false, trackId: null, milestone: null }); fetchRoadmap(); }}
        trackId={milestoneModal.trackId}
        milestone={milestoneModal.milestone}
      />
    </div>
  );
}
