// client/src/components/auth/ChangePasswordModal.jsx
// Lets a signed-in user change their password via PUT /api/auth/password.
// Confirm-match and min-length are checked client-side; the server re-validates
// and verifies the current password. Modal/Input/useToast are NAMED exports.

import { useState } from 'react';
import api from '../../lib/api';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { useToast } from '../../hooks/useToast';

export default function ChangePasswordModal({ isOpen, onClose }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const { addToast } = useToast();

  const reset = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await api.put('/api/auth/password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      addToast({ type: 'success', title: 'Password changed successfully' });
      reset();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to change password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Change Password" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Current Password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Enter current password"
          required
        />
        <Input
          label="New Password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Min. 8 characters"
          required
        />
        <Input
          label="Confirm New Password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Re-enter new password"
          required
        />

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm text-stone-600 dark:text-gray-400 hover:text-stone-800 dark:hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!currentPassword || !newPassword || !confirmPassword || submitting}
            className="px-4 py-2 text-sm bg-moss-500 text-white rounded-lg hover:bg-moss-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Changing…' : 'Change Password'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
