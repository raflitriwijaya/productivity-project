// client/src/components/finance/TransactionRow.jsx
// Named render helpers consumed by the DataTable column definitions in Finance.jsx.
// Not a standalone row component — keeps the columns array declarative.
/* eslint-disable react-refresh/only-export-components */

import { ArrowRight, Pencil, Trash2, CheckCircle2 } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { formatIdr } from '../../lib/formatIdr';

// ─── Type → badge variant & short label (§5.8 canonical variants) ───────────────
export const TYPE_VARIANT = {
  'Income':             'moss',
  'Expense':            'red',
  'Transfer':           'blue',
  'Balance Adjustment': 'gray',
  'Market Adjustment':  'amber',
};

export const TYPE_LABEL = {
  'Income':             'Income',
  'Expense':            'Expense',
  'Transfer':           'Transfer',
  'Balance Adjustment': 'Balance Adj.',
  'Market Adjustment':  'Market Adj.',
};

/** Sign + colour of a transaction's amount relative to net worth. */
function amountTone(row) {
  const amt = parseFloat(row.amount) || 0;
  switch (row.type) {
    case 'Income':   return { sign: '+', color: 'text-moss-600 dark:text-moss-400', value: amt };
    case 'Expense':  return { sign: '-', color: 'text-red-600 dark:text-red-400', value: amt };
    case 'Transfer': return { sign: '',  color: 'text-stone-600 dark:text-gray-300', value: amt };
    default: // Balance / Market Adjustment — sign follows the stored amount
      return amt < 0
        ? { sign: '-', color: 'text-red-600 dark:text-red-400', value: Math.abs(amt) }
        : { sign: '+', color: 'text-moss-600 dark:text-moss-400', value: amt };
  }
}

/** @param {{ row: object }} props */
export function TypeBadge({ row }) {
  return <Badge variant={TYPE_VARIANT[row.type] ?? 'gray'}>{TYPE_LABEL[row.type] ?? row.type}</Badge>;
}

/** @param {{ row: object }} props */
export function AmountCell({ row }) {
  const { sign, color, value } = amountTone(row);
  return (
    <span className={`text-sm font-medium tabular-nums ${color}`}>
      {sign}{formatIdr(value)}
    </span>
  );
}

/**
 * Shows the money flow: source → dest, with whichever side the type uses.
 * @param {{ row: object }} props
 */
export function AccountFlowCell({ row }) {
  const src = row.source_account_name;
  const dst = row.dest_account_name;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-stone-500 dark:text-gray-400">
      {src && <span className="text-stone-700 dark:text-gray-200">{src}</span>}
      {(src || dst) && <ArrowRight size={13} className="text-stone-400 dark:text-gray-500 flex-shrink-0" />}
      {dst && <span className="text-stone-700 dark:text-gray-200">{dst}</span>}
      {!src && !dst && <span>—</span>}
    </span>
  );
}

/** @param {{ row: object }} props */
export function ReconciledCell({ row }) {
  return row.reconciled
    ? <CheckCircle2 size={16} className="text-moss-500 dark:text-moss-400" aria-label="Reconciled" />
    : <span className="text-stone-300 dark:text-gray-600" aria-label="Not reconciled">—</span>;
}

/**
 * @param {{ row: object, onEdit: (row: object) => void, onDelete: (row: object) => void }} props
 */
export function TransactionActions({ row, onEdit, onDelete }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="sm" onClick={() => onEdit(row)} aria-label="Edit transaction">
        <Pencil size={14} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onDelete(row)}
        aria-label="Delete transaction"
        className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30"
      >
        <Trash2 size={14} />
      </Button>
    </div>
  );
}
