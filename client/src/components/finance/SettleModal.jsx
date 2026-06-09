// client/src/components/finance/SettleModal.jsx
// Confirms settling a receivable/payable. Settling posts an Income (receivable) or
// Expense (payable) transaction into/out of the chosen account and marks it settled.

import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/Input';
import { formatIdr } from '../../lib/formatIdr';

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   onSettle: (data: { account_id: number, date: string }) => Promise<void>,
 *   record: object|null,
 *   accounts: Array<{ id: number, name: string }>,
 *   kind: 'receivable'|'payable'
 * }} props
 */
export function SettleModal({ isOpen, onClose, onSettle, record, accounts = [], kind }) {
  const isReceivable = kind === 'receivable';
  const [accountId, setAccountId] = useState('');
  const [date, setDate] = useState(todayIso());
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    /* Phase 4: setState here is intentional modal-open reset */
    /* eslint-disable react-hooks/set-state-in-effect */
    setAccountId(record?.account_id != null ? String(record.account_id) : '');
    setDate(todayIso());
    setError('');
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, record]);

  async function handleSettle() {
    if (!accountId) { setError('Select an account.'); return; }
    setSubmitting(true);
    setError('');
    try {
      await onSettle({ account_id: Number(accountId), date });
    } catch (err) {
      setError(err.message ?? 'Could not settle. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isReceivable ? 'Settle Receivable' : 'Settle Payable'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" size="md" onClick={handleSettle} disabled={submitting}>
            {submitting ? 'Settling…' : 'Confirm Settle'}
          </Button>
        </>
      }
    >
      {record && (
        <div className="p-3 rounded-lg bg-stone-50 dark:bg-gray-700 border border-stone-200 dark:border-gray-600">
          <p className="text-sm font-medium text-stone-900 dark:text-gray-50">{record.person}</p>
          <p className="text-sm text-stone-500 dark:text-gray-400 mt-0.5">{formatIdr(record.amount)}</p>
        </div>
      )}

      <p className="text-sm text-stone-700 dark:text-gray-300">
        This posts {isReceivable ? 'an income' : 'an expense'} transaction
        {isReceivable ? ' into' : ' from'} the selected account.
      </p>

      <Select
        id="settle-account"
        label={isReceivable ? 'Receive Into' : 'Pay From'}
        value={accountId}
        onChange={(e) => { setAccountId(e.target.value); setError(''); }}
        error={error || undefined}
        disabled={submitting}
      >
        <option value="">Select an account…</option>
        {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
      </Select>

      <Input id="settle-date" label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={submitting} />
    </Modal>
  );
}
