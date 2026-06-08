// client/src/components/ui/DataTable.jsx
// Canonical sortable table (§5.4). Always render tables through this — never
// hand-roll <table> markup in pages. Empty/loading/error are handled by the
// parent (§7); this only renders when items.length > 0.

import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

/**
 * @typedef {Object} Column
 * @property {string} key                   Row property + React key for the column.
 * @property {string} header                Column header label.
 * @property {boolean} [sortable]           Header is clickable and sorts by key.
 * @property {'left'|'right'} [align]       Cell alignment (default 'left').
 * @property {(row: object) => React.ReactNode} [render] Custom cell renderer.
 */

/**
 * @param {Object} props
 * @param {Column[]} props.columns
 * @param {object[]} props.items  Each item must have a stable `id`.
 * @param {string|null} [props.initialSortKey=null]
 * @returns {JSX.Element}
 */
export function DataTable({ columns, items, initialSortKey = null }) {
  const [sort, setSort] = useState({ key: initialSortKey, dir: 'asc' });

  const sorted = useMemo(() => {
    if (!sort.key) return items;
    const col = columns.find(c => c.key === sort.key);
    if (!col?.sortable) return items;
    return [...items].sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      if (av === bv) return 0;
      const cmp = av > bv ? 1 : -1;
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [items, sort, columns]);

  const toggleSort = (key) =>
    setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-200 dark:border-gray-700">
            {columns.map(col => {
              const isSorted = sort.key === col.key;
              return (
                <th
                  key={col.key}
                  onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                  className={`px-6 py-3 text-xs font-medium tracking-wide uppercase whitespace-nowrap
                    ${col.align === 'right' ? 'text-right' : 'text-left'}
                    ${col.sortable ? 'cursor-pointer select-none hover:text-stone-700 dark:hover:text-gray-200' : ''}
                    ${isSorted ? 'text-moss-600 dark:text-moss-400' : 'text-stone-500 dark:text-gray-400'}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && isSorted && (
                      sort.dir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={row.id}
              className={`${i % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-stone-50 dark:bg-gray-700/50'}
                hover:bg-moss-50/30 dark:hover:bg-moss-950/20 transition-colors duration-100`}
            >
              {columns.map(col => (
                <td
                  key={col.key}
                  className={`px-6 py-4 whitespace-nowrap text-sm text-stone-900 dark:text-gray-50
                    ${col.align === 'right' ? 'text-right font-medium space-x-2' : ''}`}
                >
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
