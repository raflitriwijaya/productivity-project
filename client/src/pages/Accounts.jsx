// client/src/pages/Accounts.jsx  → route /finance/accounts
// The six standard accounts as cards with their live balances. Name and opening
// balance are editable (PATCH /api/finances/accounts/:id).

import { useState, useEffect } from 'react';
import { Banknote, Landmark, Wallet, ShoppingBag, Smartphone, TrendingUp, Pencil } from 'lucide-react';

import api from '../lib/api';
import { useApi } from '../hooks/useApi';
import { useToast } from '../hooks/useToast';

import { Card, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { formatIdr, parseIdrInput, formatIdrInput } from '../lib/formatIdr';

const ACCOUNT_ICON = {
  CASH: Banknote, ATM: Landmark, DANA: Wallet, SHOPEEPAY: ShoppingBag, GOPAY: Smartphone, INVESTMENT: TrendingUp,
};

function AccountEditModal({ isOpen, onClose, onSubmit, account }) {
  const [name, setName] = useState('');
  const [initial, setInitial] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !account) return;
    setName(account.name ?? '');
    setInitial(formatIdrInput(String(account.initial_balance ?? '')));
    setError('');
  }, [isOpen, account]);

  async function handleSave() {
    if (!name.trim()) { setError('Name is required.'); return; }
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), initial_balance: parseIdrInput(initial || '0') || 0 });
    } catch (err) {
      setError(err.message ?? 'Could not save.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Account"
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" size="md" onClick={handleSave} disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <Input id="acc-name" label="Account Name" value={name} onChange={(e) => { setName(e.target.value); setError(''); }} error={error || undefined} disabled={submitting} />
      <Input id="acc-initial" label="Opening Balance (IDR)" inputMode="numeric" value={initial} onChange={(e) => setInitial(formatIdrInput(e.target.value.replace(/-/g, '')))} disabled={submitting} helperText="The balance before any recorded transactions." />
    </Modal>
  );
}

export default function Accounts() {
  const { data: balances, loading, error, refetch } = useApi(() => api.get('/api/finances/balances'), []);
  const [editing, setEditing] = useState(null);
  const { addToast } = useToast();

  const netWorth = (balances ?? []).reduce((sum, a) => sum + (parseFloat(a.balance) || 0), 0);

  async function handleEditSubmit(formData) {
    await api.patch(`/api/finances/accounts/${editing.id}`, formData);
    refetch();
    setEditing(null);
    addToast({ type: 'success', title: 'Account updated' });
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-gray-50 tracking-[-0.02em]">Accounts</h1>
          <p className="text-sm text-stone-500 dark:text-gray-400 mt-1">Live balance across every account.</p>
        </div>
        {!loading && !error && (
          <div className="text-right">
            <p className="text-xs font-medium text-stone-500 dark:text-gray-400 tracking-wide uppercase">Net Worth</p>
            <p className={`text-2xl font-bold tracking-[-0.02em] ${netWorth >= 0 ? 'text-stone-900 dark:text-gray-50' : 'text-red-600 dark:text-red-400'}`}>
              {formatIdr(netWorth)}
            </p>
          </div>
        )}
      </div>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Card key={i}><CardBody>
              <Skeleton className="h-9 w-9 rounded-lg mb-4" />
              <Skeleton className="h-3 w-24 mb-2" />
              <Skeleton className="h-7 w-32" />
            </CardBody></Card>
          ))}
        </div>
      )}

      {error && !loading && <Card><CardBody><ErrorState message={error} onRetry={refetch} /></CardBody></Card>}

      {!loading && !error && balances && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {balances.map(acc => {
            const Icon = ACCOUNT_ICON[acc.type] ?? Wallet;
            const bal = parseFloat(acc.balance) || 0;
            const color = bal >= 0 ? 'text-stone-900 dark:text-gray-50' : 'text-red-600 dark:text-red-400';
            return (
              <Card key={acc.id}>
                <CardBody>
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-9 h-9 rounded-lg bg-moss-50 dark:bg-moss-950/50 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-moss-600 dark:text-moss-400" />
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(acc)} aria-label="Edit account">
                      <Pencil size={14} />
                    </Button>
                  </div>
                  <p className="text-[10px] font-semibold text-stone-400 dark:text-gray-500 tracking-widest uppercase">{acc.type}</p>
                  <p className="text-sm text-stone-700 dark:text-gray-200 mb-1">{acc.name}</p>
                  <p className={`text-2xl font-bold tracking-[-0.02em] tabular-nums ${color}`}>{formatIdr(bal)}</p>
                  <p className="text-xs text-stone-400 dark:text-gray-500 mt-1">Opening {formatIdr(acc.initial_balance)}</p>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <AccountEditModal isOpen={editing != null} onClose={() => setEditing(null)} onSubmit={handleEditSubmit} account={editing} />
    </div>
  );
}
