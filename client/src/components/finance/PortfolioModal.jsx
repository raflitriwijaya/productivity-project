// client/src/components/finance/PortfolioModal.jsx
// Create/edit an investment holding. Quantity uses up to 4 decimals; prices are IDR
// per unit. Market value (quantity × current price) is derived server-side.

import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { parseIdrInput, formatIdrInput } from '../../lib/formatIdr';

const EMPTY_FORM = { name: '', symbol: '', quantity: '', avg_price: '', current_price: '' };

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   onSubmit: (data: object) => Promise<void>,
 *   holding: object|null
 * }} props
 */
export function PortfolioModal({ isOpen, onClose, onSubmit, holding }) {
  const isEditing = holding != null;

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    if (isEditing) {
      setForm({
        name:          holding.name ?? '',
        symbol:        holding.symbol ?? '',
        quantity:      String(holding.quantity ?? ''),
        avg_price:     formatIdrInput(String(holding.avg_price ?? '')),
        current_price: formatIdrInput(String(holding.current_price ?? '')),
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setErrors({});
    setSubmitError('');
  }, [isOpen, holding, isEditing]);

  function set(field) {
    return (e) => {
      let value = e.target.value;
      if (field === 'avg_price' || field === 'current_price') value = formatIdrInput(value.replace(/-/g, ''));
      setForm(prev => ({ ...prev, [field]: value }));
      setErrors(prev => { if (!prev[field]) return prev; const n = { ...prev }; delete n[field]; return n; });
    };
  }

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required.';
    const qty = Number(form.quantity);
    if (form.quantity === '' || Number.isNaN(qty) || qty < 0) e.quantity = 'Enter a valid quantity.';
    if (Number.isNaN(parseIdrInput(form.avg_price || '0'))) e.avg_price = 'Enter a valid price.';
    if (Number.isNaN(parseIdrInput(form.current_price || '0'))) e.current_price = 'Enter a valid price.';
    return e;
  }

  async function handleSubmit() {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setSubmitting(true);
    setSubmitError('');
    try {
      await onSubmit({
        name:          form.name.trim(),
        symbol:        form.symbol.trim() || null,
        quantity:      Number(form.quantity),
        avg_price:     parseIdrInput(form.avg_price || '0') || 0,
        current_price: parseIdrInput(form.current_price || '0') || 0,
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
      title={isEditing ? 'Edit Holding' : 'New Holding'}
      size="md"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" size="md" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Holding'}
          </Button>
        </>
      }
    >
      <Input id="pf-name" label="Name" placeholder="e.g. BBCA / S&P 500 ETF" value={form.name} onChange={set('name')} error={errors.name} disabled={submitting} />
      <Input id="pf-symbol" label="Symbol (optional)" placeholder="e.g. BBCA" value={form.symbol} onChange={set('symbol')} disabled={submitting} />
      <Input id="pf-qty" label="Quantity" type="number" min="0" step="any" placeholder="0" value={form.quantity} onChange={set('quantity')} error={errors.quantity} disabled={submitting} />
      <Input id="pf-avg" label="Average Buy Price (IDR)" inputMode="numeric" placeholder="0" value={form.avg_price} onChange={set('avg_price')} error={errors.avg_price} disabled={submitting} />
      <Input id="pf-cur" label="Current Price (IDR)" inputMode="numeric" placeholder="0" value={form.current_price} onChange={set('current_price')} error={errors.current_price} disabled={submitting} />

      {submitError && <p className="text-xs text-red-600 dark:text-red-400">{submitError}</p>}
    </Modal>
  );
}
