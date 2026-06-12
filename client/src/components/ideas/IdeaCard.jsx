// client/src/components/ideas/IdeaCard.jsx
// A single idea rendered as a sticky-note-style card (Roadmap Wave 4). Presentational —
// the parent owns selection/fetching. The STATUS maps are module-private (the detail
// modal keeps its own copy) to satisfy react-refresh/only-export-components.

import { Lightbulb, ArrowRight } from 'lucide-react';
import { Badge } from '../ui/Badge';

const STATUS_VARIANTS = {
  new:        'ember',
  developing: 'blue',
  validated:  'moss',
  archived:   'gray',
  converted:  'moss',
};

const STATUS_LABELS = {
  new:        'New',
  developing: 'Developing',
  validated:  'Validated',
  archived:   'Archived',
  converted:  'Converted',
};

/**
 * @param {{ idea: object, onClick: () => void }} props
 */
export function IdeaCard({ idea, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-white dark:bg-gray-800 rounded-xl border border-stone-200 dark:border-gray-700 p-5 cursor-pointer hover:shadow-md hover:border-ember-300 dark:hover:border-ember-700 transition-all duration-150 group focus:outline-none focus:ring-2 focus:ring-ember-500 dark:focus:ring-ember-400"
    >
      <div className="flex items-start gap-3">
        <Lightbulb size={20} className="text-ember-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-stone-800 dark:text-gray-200 group-hover:text-ember-600 dark:group-hover:text-ember-400 transition-colors duration-150 line-clamp-2">
            {idea.title}
          </h3>
          {idea.description && (
            <p className="text-sm text-stone-500 dark:text-gray-400 mt-1 line-clamp-2">{idea.description}</p>
          )}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Badge variant={STATUS_VARIANTS[idea.status] ?? 'gray'}>{STATUS_LABELS[idea.status] ?? idea.status}</Badge>
            {idea.tags && idea.tags.split(',').filter(t => t.trim()).slice(0, 3).map((tag) => (
              <span key={tag.trim()} className="text-xs text-stone-400 dark:text-gray-500">#{tag.trim()}</span>
            ))}
            {idea.source && (
              <span className="text-xs text-stone-400 dark:text-gray-500 ml-auto flex items-center gap-1">
                <ArrowRight size={10} /> {idea.source}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

export default IdeaCard;
