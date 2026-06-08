// client/src/components/finance/MonthYearSelector.jsx
// Compact month + year navigator used across the finance pages. Controlled:
// the parent owns { month (1-12), year } state and receives onChange(month, year).

import { ChevronLeft, ChevronRight } from 'lucide-react';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const selectClass = `
  px-3 py-1.5 rounded-lg text-sm
  bg-white dark:bg-gray-700
  text-stone-900 dark:text-gray-50
  border border-stone-200 dark:border-gray-600
  focus:outline-none focus:ring-2 focus:ring-moss-500 dark:focus:ring-moss-400 focus:border-transparent
  transition-colors duration-150`;

const arrowClass = `
  p-1.5 rounded-lg text-stone-500 dark:text-gray-400
  hover:bg-stone-100 dark:hover:bg-gray-700 hover:text-stone-700 dark:hover:text-gray-200
  focus:outline-none focus:ring-2 focus:ring-moss-500 dark:focus:ring-moss-400
  transition-colors duration-150`;

/**
 * @param {{
 *   month: number,                       // 1-12
 *   year: number,
 *   onChange: (month: number, year: number) => void
 * }} props
 */
export function MonthYearSelector({ month, year, onChange }) {
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 7 }, (_, i) => thisYear - 5 + i);

  function step(delta) {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    onChange(m, y);
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => step(-1)} aria-label="Previous month" className={arrowClass}>
        <ChevronLeft size={18} />
      </button>

      <select
        aria-label="Month"
        value={month}
        onChange={(e) => onChange(Number(e.target.value), year)}
        className={selectClass}
      >
        {MONTHS.map((label, i) => (
          <option key={label} value={i + 1}>{label}</option>
        ))}
      </select>

      <select
        aria-label="Year"
        value={year}
        onChange={(e) => onChange(month, Number(e.target.value))}
        className={selectClass}
      >
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>

      <button type="button" onClick={() => step(1)} aria-label="Next month" className={arrowClass}>
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
