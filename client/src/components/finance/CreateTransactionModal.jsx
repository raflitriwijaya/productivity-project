// client/src/components/finance/CreateTransactionModal.jsx
// Dual-mode modal: create (transaction = null) or edit (transaction = object).
// Which account/category fields show depends on the selected type:
//   Income            → Destination + Income category
//   Expense           → Source + Expense category
//   Transfer          → Source + Destination (no category)
//   Balance / Market Adjustment → Destination only (amount may be negative)
//
// Accounts & categories are passed in from the page (fetched once) so the modal
// stays presentational.

import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Textarea, Select } from '../ui/Input';
import { toAmountInput, parseIdrInput } from '../../lib/formatIdr';

const TYPE_OPTIONS = ['Income', 'Revenue', 'Expense', 'Transfer', 'Balance Adjustment', 'Market Adjustment'];
const ADJUSTMENTS = ['Balance Adjustment', 'Market Adjustment'];

const todayIso = () => new Date().toISOString().slice(0, 10);

const EMPTY_FORM = {
  type: 'Expense',
  amount: '',
  source_account_id: '',
  dest_account_id: '',
  category_id: '',
  reconciled: 'false',
  date: todayIso(),
  description: '',
};

function fieldsForType(type) {
  // Revenue (Wave 4) shares Income's shape: destination-only, income categories.
  return {
    showSource:   ['Expense', 'Transfer'].includes(type),
    showDest:     ['Income', 'Revenue', 'Transfer', 'Balance Adjustment', 'Market Adjustment'].includes(type),
    showCategory: ['Income', 'Revenue', 'Expense'].includes(type),
    categoryKind: ['Income', 'Revenue'].includes(type) ? 'INCOME' : 'EXPENSE',
    allowNegative: ADJUSTMENTS.includes(type),
  };
}

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   onSubmit: (data: object) => Promise<void>,
 *   transaction: object|null,
 *   accounts: Array<{ id: number, name: string, type: string }>,
 *   categories: Array<{ id: number, name: string, kind: string }>
 * }} props
 */
export function CreateTransactionModal({ isOpen, onClose, onSubmit, transaction, accounts = [], categories = [] }) {
  const isEditing = transaction != null;

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    /* Phase 4: setState here is intentional modal-open sync — not a cascading loop */
    /* eslint-disable react-hooks/set-state-in-effect */
    if (isEditing) {
      setForm({
        type:              transaction.type,
        amount:            toAmountInput(transaction.amount),
        source_account_id: transaction.source_account_id != null ? String(transaction.source_account_id) : '',
        dest_account_id:   transaction.dest_account_id   != null ? String(transaction.dest_account_id)   : '',
        category_id:       transaction.category_id       != null ? String(transaction.category_id)       : '',
        reconciled:        transaction.reconciled ? 'true' : 'false',
        date:              transaction.date?.slice(0, 10) ?? todayIso(),
        description:       transaction.description ?? '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setErrors({});
    setSubmitError('');
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, transaction, isEditing]);

  const { showSource, showDest, showCategory, categoryKind, allowNegative } = fieldsForType(form.type);
  const categoryOptions = categories.filter(c => c.kind === categoryKind);

  function clearError(field) {
    setErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function set(field) {
    return (e) => {
      const value = e.target.value;
      setForm(prev => {
        const next = { ...prev, [field]: value };
        if (field === 'type') {
          // Reset fields that no longer apply so we never submit a stale account/category.
          const f = fieldsForType(value);
          if (!f.showSource) next.source_account_id = '';
          if (!f.showDest) next.dest_account_id = '';
          if (!f.showCategory) next.category_id = '';
          if (!f.allowNegative && next.amount.startsWith('-')) next.amount = next.amount.replace(/^-/, '');
        }
        return next;
      });
      clearError(field);
    };
  }

  function onAmountChange(e) {
    const input = e.target.value;
    const negative = allowNegative && /^\s*-/.test(input);
    const digits = input.replace(/[^0-9.]/g, '');
    setForm(prev => ({ ...prev, amount: (negative ? '-' : '') + digits }));
    clearError('amount');
  }

  function validate() {
    const e = {};
    const amt = parseIdrInput(form.amount);
    if (form.amount === '' || form.amount === '-' || Number.isNaN(amt) || amt === 0) {
      e.amount = 'Enter a non-zero amount.';
    } else if (!allowNegative && amt < 0) {
      e.amount = 'Amount must be greater than 0.';
    }
    if (showSource && !form.source_account_id) e.source_account_id = 'Source account is required.';
    if (showDest && !form.dest_account_id) e.dest_account_id = 'Destination account is required.';
    if (form.type === 'Transfer' && form.source_account_id && form.source_account_id === form.dest_account_id) {
      e.dest_account_id = 'Source and destination must differ.';
    }
    if (!form.date) e.date = 'Date is required.';
    return e;
  }

  async function handleSubmit() {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setSubmitting(true);
    setSubmitError('');
    try {
      await onSubmit({
        type:              form.type,
        amount:            parseIdrInput(form.amount),
        date:              form.date,
        description:       form.description.trim() || null,
        source_account_id: showSource && form.source_account_id ? Number(form.source_account_id) : null,
        dest_account_id:   showDest && form.dest_account_id ? Number(form.dest_account_id) : null,
        category_id:       showCategory && form.category_id ? Number(form.category_id) : null,
        reconciled:        form.reconciled === 'true',
      });
    } catch (err) {
      setSubmitError(err.message ?? 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Transaction' : 'New Transaction'}
      size="md"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" size="md" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Transaction'}
          </Button>
        </>
      }
    >
      <Select id="tx-type" label="Type" value={form.type} onChange={set('type')} disabled={submitting}>
        {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
      </Select>

      <Input
        id="tx-amount"
        label="Amount (IDR)"
        inputMode={allowNegative ? 'text' : 'numeric'}
        placeholder="0"
        value={form.amount}
        onChange={onAmountChange}
        error={errors.amount}
        helperText={allowNegative ? 'Use a leading minus to decrease the balance.' : undefined}
        disabled={submitting}
      />

      {showSource && (
        <Select
          id="tx-source"
          label="Source Account"
          value={form.source_account_id}
          onChange={set('source_account_id')}
          error={errors.source_account_id}
          disabled={submitting}
        >
          <option value="">Select source account…</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
      )}

      {showDest && (
        <Select
          id="tx-dest"
          label="Destination Account"
          value={form.dest_account_id}
          onChange={set('dest_account_id')}
          error={errors.dest_account_id}
          disabled={submitting}
        >
          <option value="">Select destination account…</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
      )}

      {showCategory && (
        <Select
          id="tx-category"
          label="Category"
          value={form.category_id}
          onChange={set('category_id')}
          disabled={submitting}
        >
          <option value="">Uncategorized</option>
          {categoryOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      )}

      <Input id="tx-date" label="Date" type="date" value={form.date} onChange={set('date')} error={errors.date} disabled={submitting} />

      <Select id="tx-reconciled" label="Reconciliation" value={form.reconciled} onChange={set('reconciled')} disabled={submitting}>
        <option value="false">Not reconciled</option>
        <option value="true">Reconciled</option>
      </Select>

      <Textarea
        id="tx-description"
        label="Description (optional)"
        rows={2}
        placeholder="Add a note…"
        value={form.description}
        onChange={set('description')}
        disabled={submitting}
      />

      {submitError && <p className="text-xs text-red-600 dark:text-red-400">{submitError}</p>}
    </Modal>
  );
}
