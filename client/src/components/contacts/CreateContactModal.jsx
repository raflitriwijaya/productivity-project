// client/src/components/contacts/CreateContactModal.jsx
// Create / Edit a contact (Roadmap Wave 4). contact === null → Create, else Edit (PATCH).
// Does its own API call, then calls onSaved() so the parent refetches and closes.
// Follows the CreateBookModal pattern: action buttons live in the Modal footer
// (outside the form), so submit is wired through handleSubmit, not <form onSubmit>.

import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Textarea, Select } from '../ui/Input';
import api from '../../lib/api';
import { useToast } from '../../hooks/useToast';

const EMPTY_FORM = {
  name: '', email: '', phone: '', company: '', role: '',
  type: 'client', status: 'active', notes: '',
};

// Basic email shape check mirroring the server's z.string().email().
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @param {{ isOpen: boolean, onClose: () => void, onSaved: () => void, contact?: object|null }} props
 */
export function CreateContactModal({ isOpen, onClose, onSaved, contact = null }) {
  const isEdit = contact !== null;
  const { addToast } = useToast();

  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Sync the form when the modal opens (create → blank, edit → populated).
  useEffect(() => {
    if (!isOpen) return;
    /* setState here is intentional modal-open sync (mirrors CreateBookModal) */
    /* eslint-disable react-hooks/set-state-in-effect */
    if (isEdit && contact) {
      setForm({
        name:    contact.name    ?? '',
        email:   contact.email   ?? '',
        phone:   contact.phone   ?? '',
        company: contact.company ?? '',
        role:    contact.role    ?? '',
        type:    contact.type    ?? 'client',
        status:  contact.status  ?? 'active',
        notes:   contact.notes   ?? '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setErrors({});
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isOpen, contact, isEdit]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required.';
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) errs.email = 'Enter a valid email.';
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSubmitting(true);
    try {
      const payload = {
        name:    form.name.trim(),
        email:   form.email.trim() || null,
        phone:   form.phone.trim() || null,
        company: form.company.trim() || null,
        role:    form.role.trim() || null,
        type:    form.type,
        status:  form.status,
        notes:   form.notes.trim() || null,
      };
      if (isEdit) {
        await api.patch(`/api/contacts/${contact.id}`, payload);
        addToast({ type: 'success', title: 'Contact updated' });
      } else {
        await api.post('/api/contacts', payload);
        addToast({ type: 'success', title: 'Contact added' });
      }
      onSaved();
    } catch (err) {
      addToast({ type: 'error', title: isEdit ? 'Failed to update contact' : 'Failed to add contact', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Contact' : 'Add Contact'}
      size="md"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary" size="md" onClick={handleSubmit} disabled={submitting || !form.name.trim()}>
            {submitting ? (isEdit ? 'Saving…' : 'Adding…') : (isEdit ? 'Save Changes' : 'Add Contact')}
          </Button>
        </>
      }
    >
      <Input
        id="contact-name"
        label="Name"
        placeholder="Full name"
        value={form.name}
        onChange={set('name')}
        error={errors.name}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          id="contact-email"
          label="Email (optional)"
          type="email"
          placeholder="name@company.com"
          value={form.email}
          onChange={set('email')}
          error={errors.email}
        />
        <Input
          id="contact-phone"
          label="Phone (optional)"
          placeholder="+62…"
          value={form.phone}
          onChange={set('phone')}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          id="contact-company"
          label="Company (optional)"
          placeholder="Company name"
          value={form.company}
          onChange={set('company')}
        />
        <Input
          id="contact-role"
          label="Role (optional)"
          placeholder="e.g. CTO, Procurement"
          value={form.role}
          onChange={set('role')}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select id="contact-type" label="Type" value={form.type} onChange={set('type')}>
          <option value="client">Client</option>
          <option value="partner">Partner</option>
          <option value="supplier">Supplier</option>
          <option value="investor">Investor</option>
          <option value="mentor">Mentor</option>
          <option value="other">Other</option>
        </Select>
        <Select id="contact-status" label="Status" value={form.status} onChange={set('status')}>
          <option value="active">Active</option>
          <option value="lead">Lead</option>
          <option value="inactive">Inactive</option>
        </Select>
      </div>

      <Textarea
        id="contact-notes"
        label="Notes (optional)"
        rows={3}
        placeholder="Context, deal stage, how you met…"
        value={form.notes}
        onChange={set('notes')}
      />
    </Modal>
  );
}

export default CreateContactModal;
