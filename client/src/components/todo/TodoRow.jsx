// client/src/components/todo/TodoRow.jsx
// Used inside DataTable's render() for the actions column, and also as a
// standalone list row in the divide-y list variant inside Todo.jsx.
// Status → Badge variant mapping follows §5.8 canonical table.

import { Pencil, Trash2 } from 'lucide-react';
import { Badge }  from '../ui/Badge';
import { Button } from '../ui/Button';

/** @type {Record<string, 'emerald'|'blue'|'gray'|'red'|'amber'>} */
const STATUS_VARIANT = {
  done:        'emerald',
  completed:   'emerald',
  active:      'emerald',
  paid:        'emerald',
  in_progress: 'blue',
  scheduled:   'blue',
  pending:     'gray',
  draft:       'gray',
  overdue:     'red',
  failed:      'red',
  cancelled:   'red',
  on_hold:     'amber',
  due_soon:    'amber',
};

/** @type {Record<number, 'red'|'amber'|'gray'>} */
const PRIORITY_VARIANT = { 1: 'red', 2: 'amber', 3: 'gray' };
const PRIORITY_LABEL   = { 1: 'High', 2: 'Medium', 3: 'Low' };

/**
 * @param {Object}   props
 * @param {import('../../pages/Todo').Todo} props.todo
 * @param {Function} props.onEdit    - (todo) => void
 * @param {Function} props.onDelete  - (todo) => void
 */
export function TodoRow({ todo, onEdit, onDelete }) {
  return (
    <div className="flex items-center gap-4 px-6 py-4 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors duration-100">
      {/* Main content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-stone-900 dark:text-gray-50 truncate font-medium">
          {todo.title}
        </p>
        {todo.description && (
          <p className="text-xs text-stone-500 dark:text-gray-400 mt-0.5 truncate">
            {todo.description}
          </p>
        )}
        {todo.due_date && (
          <p className="text-[11px] text-stone-400 dark:text-gray-500 mt-0.5">
            Due {todo.due_date}
          </p>
        )}
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Badge variant={PRIORITY_VARIANT[todo.priority] ?? 'gray'}>
          {PRIORITY_LABEL[todo.priority] ?? 'Medium'}
        </Badge>
        <Badge variant={STATUS_VARIANT[todo.status] ?? 'gray'}>
          {todo.status.replace('_', ' ')}
        </Badge>
      </div>

      {/* Row actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(todo)}
          aria-label={`Edit "${todo.title}"`}
        >
          <Pencil size={14} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(todo)}
          aria-label={`Delete "${todo.title}"`}
          className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/30"
        >
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
  );
}
