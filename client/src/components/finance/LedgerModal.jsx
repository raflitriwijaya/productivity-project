// client/src/components/finance/LedgerModal.jsx
// Create/edit modal shared by Receivables and Payables (identical shape). `kind`
// only drives the labels/wording: 'receivable' (owed to you) | 'payable' (you owe).

import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Textarea, Select } from '../ui/Input';
import { toAmountInput, parseIdrInput } from '../../lib/formatIdr';

const EMPTY_FORM = { person: '', amount: '', due_date: '', account_id: '', description: '' };

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   onSubmit: (data: object) => Promise<void>,
 *   record: object|null,
 *   accounts: Array<{ id: number, name: string }>,
 *   kind: 'receivable'|'payable'
 * }} props
 */
export function LedgerModal({ isOpen, onClose, onSubmit, record, accounts = [], kind }) {
  const isEditing = record != null;
  const isReceivable = kind === 'receivable';
  const personLabel = isReceivable ? 'Owed by' : 'Owed to';

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    /* Phase 4: setState here is intentional modal-open sync */
    /* eslint-disable react-hooks/set-state-in-effect */
    if (isEditing) {
      setForm({
        person:      record.person ?? '',
        amount:      toAmountInput(record.amount),
        due_date:    record.due_date?.slice(0, 10) ?? '',
        account_id:  record.account_id != null ? String(record.account_id) : '',
        description: record.description ?? '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setErrors({});
    setSubmitError('');
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, record, isEditing]);

  function set(field) {
    return (e) => {
      const value = field === 'amount' ? e.target.value.replace(/[^0-9.]/g, '') : e.target.value;
      setForm(prev => ({ ...prev, [field]: value }));
      setErrors(prev => { if (!prev[field]) return prev; const n = { ...prev }; delete n[field]; return n; });
    };
  }

  function validate() {
    const e = {};
    if (!form.person.trim()) e.person = `${personLabel} is required.`;
    const amt = parseIdrInput(form.amount);
    if (form.amount === '' || Number.isNaN(amt) || amt <= 0) e.amount = 'Enter a valid positive amount.';
    return e;
  }

  async function handleSubmit() {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setSubmitting(true);
    setSubmitError('');
    try {
      await onSubmit({
        person:      form.person.trim(),
        amount:      parseIdrInput(form.amount),
        due_date:    form.due_date || null,
        account_id:  form.account_id ? Number(form.account_id) : null,
        description: form.description.trim() || null,
      });
    } catch (err) {
      setSubmitError(err.message ?? 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const noun = isReceivable ? 'Receivable' : 'Payable';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Edit ${noun}` : `New ${noun}`}
      size="md"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" size="md" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Saving…' : isEditing ? 'Save Changes' : `Add ${noun}`}
          </Button>
        </>
      }
    >
      <Input id="led-person" label={personLabel} placeholder="Name" value={form.person} onChange={set('person')} error={errors.person} disabled={submitting} />

      <Input id="led-amount" label="Amount (IDR)" inputMode="numeric" placeholder="0" value={form.amount} onChange={set('amount')} error={errors.amount} disabled={submitting} />

      <Input id="led-due" label="Due Date (optional)" type="date" value={form.due_date} onChange={set('due_date')} disabled={submitting} />

      <Select
        id="led-account"
        label={isReceivable ? 'Receive Into (optional)' : 'Pay From (optional)'}
        value={form.account_id}
        onChange={set('account_id')}
        helperText="Used to post the transaction when you settle."
        disabled={submitting}
      >
        <option value="">Choose later</option>
        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
      </Select>

      <Textarea id="led-description" label="Description (optional)" rows={2} placeholder="Add a note…" value={form.description} onChange={set('description')} disabled={submitting} />

      {submitError && <p className="text-xs text-red-600 dark:text-red-400">{submitError}</p>}
    </Modal>
  );
}
