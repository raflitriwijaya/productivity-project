// client/src/components/shared/LinkedItems.jsx
// Universal Links (Roadmap Wave 1). Reusable section embedded in any detail
// modal/page: shows the links touching an entity, grouped by the linked module,
// with add/remove controls. Handles all four data states (§5.9–5.11).
//
// Display note (intentional, see V4 risk notes): we render "{Type} #{id}" rather
// than fetching each linked entity's title — resolving titles would be an N+1
// fan-out across modules. Wave 3 (Unified Search) will enrich this.

import { useState } from 'react';
import { Link as LinkIcon, Plus, X, ExternalLink } from 'lucide-react';

import api from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useToast } from '../../hooks/useToast';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';
import { ErrorState } from '../ui/ErrorState';
import { EmptyState } from '../ui/EmptyState';
import { LinkPickerModal } from './LinkPickerModal';

// Friendly labels per entity type.
const TYPE_LABELS = {
  transaction: 'Transaction',
  research_entry: 'Research Entry',
  learning_item: 'Learning Item',
  engineer_project: 'Engineering Project',
  todo: 'Todo',
  receivable: 'Receivable',
  payable: 'Payable',
  portfolio: 'Portfolio',
  budget: 'Budget',
  account: 'Account',
  research_topic: 'Research Topic',
  engineer_snippet: 'Snippet',
  engineer_document: 'Document',
  engineer_issue: 'Issue',
  engineer_checkin: 'Check-in',
  engineer_roadmap_skill: 'Roadmap Skill',
  book: 'Book',
};

// Map each type to a Badge variant (the canonical "Stoic Garden" accents).
const TYPE_VARIANTS = {
  transaction: 'moss',
  research_entry: 'moss',
  research_topic: 'moss',
  learning_item: 'ember',
  portfolio: 'ember',
  engineer_project: 'terracotta',
  engineer_snippet: 'terracotta',
  engineer_document: 'terracotta',
  engineer_issue: 'terracotta',
  engineer_checkin: 'terracotta',
  engineer_roadmap_skill: 'terracotta',
  todo: 'blue',
  receivable: 'amber',
  payable: 'red',
  budget: 'amber',
  account: 'gray',
  book: 'ember',
};

/**
 * @param {Object} props
 * @param {string} props.entityType  e.g. 'research_entry'
 * @param {number} props.entityId
 * @param {boolean} [props.editable=true]  show add/remove controls
 */
export function LinkedItems({ entityType, entityId, editable = true }) {
  const [showPicker, setShowPicker] = useState(false);
  const { addToast } = useToast();

  // §6.8: all fetching goes through useApi (loading/error/refetch for free).
  const { data, loading, error, refetch } = useApi(
    () => api.get(`/api/links?type=${entityType}&id=${entityId}&direction=both`),
    [entityType, entityId]
  );
  const links = data ?? [];

  const handleRemoveLink = async (linkId) => {
    try {
      await api.delete(`/api/links/${linkId}`);
      addToast({ type: 'success', title: 'Link removed' });
      refetch();
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to remove link', message: err.message });
    }
  };

  const handleLinkCreated = () => {
    setShowPicker(false);
    addToast({ type: 'success', title: 'Link created' });
    refetch();
  };

  const picker = showPicker ? (
    <LinkPickerModal
      isOpen={showPicker}
      onClose={() => setShowPicker(false)}
      entityType={entityType}
      entityId={entityId}
      onLinked={handleLinkCreated}
    />
  ) : null;

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return <ErrorState message={error} onRetry={refetch} />;
  }

  // ── Empty ────────────────────────────────────────────────────────────────
  if (links.length === 0) {
    return (
      <div>
        <EmptyState
          icon={LinkIcon}
          title="No links yet"
          message="Connect this to other items across all modules."
          action={editable
            ? <Button variant="secondary" size="sm" onClick={() => setShowPicker(true)}><Plus size={14} /> Add Link</Button>
            : undefined}
        />
        {picker}
      </div>
    );
  }

  // Group by the linked entity's type.
  const grouped = links.reduce((acc, link) => {
    (acc[link.linked_type] ??= []).push(link);
    return acc;
  }, {});

  // ── Data ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-stone-700 dark:text-gray-300 flex items-center gap-2">
          <LinkIcon size={16} />
          Linked Items ({links.length})
        </h4>
        {editable && (
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className="inline-flex items-center gap-1 text-xs text-moss-600 dark:text-moss-400 hover:text-moss-700 dark:hover:text-moss-300 transition-colors duration-150"
          >
            <Plus size={14} />
            Add Link
          </button>
        )}
      </div>

      {Object.entries(grouped).map(([type, typeLinks]) => (
        <div key={type} className="space-y-1">
          <Badge variant={TYPE_VARIANTS[type] ?? 'gray'}>{TYPE_LABELS[type] ?? type}</Badge>
          <div className="space-y-1 ml-1 border-l-2 border-stone-200 dark:border-gray-700 pl-3">
            {typeLinks.map((link) => (
              <div
                key={link.id}
                className="group flex items-center justify-between py-1 px-2 rounded hover:bg-stone-50 dark:hover:bg-gray-800/50 transition-colors duration-100"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <ExternalLink size={12} className="text-stone-400 flex-shrink-0" />
                  <span className="text-sm text-stone-700 dark:text-gray-300 truncate">
                    {TYPE_LABELS[link.linked_type] ?? link.linked_type} #{link.linked_id}
                    {link.note && (
                      <span className="text-stone-400 dark:text-gray-500 ml-1">— {link.note}</span>
                    )}
                  </span>
                </div>
                {editable && (
                  <button
                    type="button"
                    onClick={() => handleRemoveLink(link.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-stone-400 hover:text-red-500 transition-all duration-150 flex-shrink-0"
                    aria-label="Remove link"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {picker}
    </div>
  );
}

export default LinkedItems;
