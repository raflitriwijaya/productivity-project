// client/src/components/contacts/ContactDetailModal.jsx
// Read-only contact detail (Roadmap Wave 4): identity, company/role, contact
// channels, notes, and the LinkedItems section so a contact can link to projects,
// receivables, and payables (Universal Links, Wave 1).

import { Mail, Phone, Building2, Clock } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { LinkedItems } from '../shared/LinkedItems';
// Post-V5: contact badge maps centralized in the shared client enums module.
import { CONTACT_TYPE_VARIANTS as TYPE_VARIANTS, CONTACT_STATUS_VARIANTS as STATUS_VARIANTS } from '../../lib/enums';

/**
 * @param {{ isOpen: boolean, onClose: () => void, contact: object, onEdit: () => void }} props
 */
export function ContactDetailModal({ isOpen, onClose, contact, onEdit }) {
  if (!contact) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={contact.name}
      size="lg"
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>Close</Button>
          <Button variant="primary" size="md" onClick={onEdit}>Edit</Button>
        </>
      }
    >
      {/* Meta */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={TYPE_VARIANTS[contact.type] ?? 'gray'}>{contact.type}</Badge>
        <Badge variant={STATUS_VARIANTS[contact.status] ?? 'gray'}>{contact.status}</Badge>
        {contact.role && <span className="text-sm text-stone-500 dark:text-gray-400">{contact.role}</span>}
      </div>

      {/* Company */}
      {contact.company && (
        <div className="flex items-center gap-2 text-sm text-stone-600 dark:text-gray-400">
          <Building2 size={14} className="text-stone-400" />
          {contact.company}
        </div>
      )}

      {/* Contact channels */}
      {(contact.email || contact.phone) && (
        <div className="flex flex-wrap gap-4 text-sm">
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              className="flex items-center gap-1.5 text-moss-600 dark:text-moss-400 hover:underline"
            >
              <Mail size={14} />
              {contact.email}
            </a>
          )}
          {contact.phone && (
            <a
              href={`tel:${contact.phone}`}
              className="flex items-center gap-1.5 text-stone-600 dark:text-gray-400 hover:text-stone-900 dark:hover:text-gray-100"
            >
              <Phone size={14} />
              {contact.phone}
            </a>
          )}
        </div>
      )}

      {/* Last contacted */}
      {contact.last_contacted && (
        <div className="flex items-center gap-1.5 text-sm text-stone-500 dark:text-gray-400">
          <Clock size={14} />
          Last contacted: {new Date(contact.last_contacted).toLocaleDateString()}
        </div>
      )}

      {/* Notes */}
      {contact.notes && (
        <div>
          <h4 className="text-sm font-semibold text-stone-700 dark:text-gray-300 mb-1">Notes</h4>
          <p className="text-sm text-stone-600 dark:text-gray-400 whitespace-pre-wrap">{contact.notes}</p>
        </div>
      )}

      {/* Linked items (Universal Links, Wave 1) — projects, receivables, payables */}
      <div className="border-t border-stone-200 dark:border-gray-700 pt-4">
        <LinkedItems entityType="contact" entityId={contact.id} />
      </div>
    </Modal>
  );
}

export default ContactDetailModal;
