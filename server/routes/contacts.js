// server/routes/contacts.js
// Contacts CRM (Roadmap Wave 4). Mount as:
//   app.use('/api/contacts', requireAuth, contactsRouter)
//
// Standard envelope ({ success, data[, meta] }), Zod validation on write bodies,
// audit logging on create/update/delete, literal routes (/stats) before the
// parameterized /:id to avoid shadowing (§6.3, mirrors reading.js).

import { Router } from 'express';
import { z } from 'zod';
import { CONTACT_TYPES, CONTACT_STATUSES } from '../lib/enums.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../lib/AppError.js';
import { logger } from '../lib/logger.js';
import {
  listContacts,
  getContactById,
  createContact,
  updateContact,
  deleteContact,
  getContactStats,
} from '../models/contacts.model.js';

const router = Router();

// ─── Zod schemas (request bodies) ────────────────────────────────────────────

const createContactSchema = z.object({
  name:    z.string().min(1, 'Name is required.').max(200),
  email:   z.string().email('Invalid email.').max(300).optional().nullable(),
  phone:   z.string().max(50).optional().nullable(),
  company: z.string().max(200).optional().nullable(),
  role:    z.string().max(100).optional().nullable(),
  type:    z.enum(CONTACT_TYPES).default('client'),
  status:  z.enum(CONTACT_STATUSES).default('active'),
  notes:   z.string().optional().nullable(),
});

const updateContactSchema = z.object({
  name:           z.string().min(1).max(200).optional(),
  email:          z.string().email('Invalid email.').max(300).optional().nullable(),
  phone:          z.string().max(50).optional().nullable(),
  company:        z.string().max(200).optional().nullable(),
  role:           z.string().max(100).optional().nullable(),
  type:           z.enum(CONTACT_TYPES).optional(),
  status:         z.enum(CONTACT_STATUSES).optional(),
  notes:          z.string().optional().nullable(),
  last_contacted: z.string().datetime().optional().nullable(),
}).refine(d => Object.keys(d).length > 0, { message: 'At least one field is required.' });

// ─── GET /api/contacts/stats ─────────────────────────────────────────────────
// Declared before /:id to avoid route shadowing.
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await getContactStats(req.user.id);
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/contacts ───────────────────────────────────────────────────────
// Query params parsed by hand (validate() only covers req.body), mirroring reading.js.
router.get('/', async (req, res, next) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page ?? '1', 10));
    const per_page  = Math.min(100, Math.max(1, parseInt(req.query.per_page ?? '20', 10)));
    const type     = CONTACT_TYPES.includes(req.query.type) ? req.query.type : undefined;
    const status   = CONTACT_STATUSES.includes(req.query.status) ? req.query.status : undefined;
    const sort     = req.query.sort  ?? 'created_at';
    const order    = req.query.order ?? 'desc';
    const search   = typeof req.query.search === 'string' ? req.query.search : undefined;

    const { data, meta } = await listContacts(req.user.id, { type, status, sort, order, page, per_page, search });
    res.json({ success: true, data, meta });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/contacts ──────────────────────────────────────────────────────
router.post('/', validate(createContactSchema), async (req, res, next) => {
  try {
    const contact = await createContact(req.user.id, req.body);

    (req.log ?? logger).info(
      { event: 'CONTACT_CREATE', userId: req.user.id, contactId: contact.id, type: contact.type, reqId: req.id },
      `User ${req.user.id} added contact: ${contact.name}`
    );

    res.status(201).json({ success: true, data: contact });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/contacts/:id ───────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) throw new AppError('Invalid contact ID.', 400, 'VALIDATION_ERROR', 'id');

    const contact = await getContactById(req.user.id, id);
    if (!contact) throw new AppError('Contact not found.', 404, 'NOT_FOUND');

    res.json({ success: true, data: contact });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/contacts/:id ─────────────────────────────────────────────────
router.patch('/:id', validate(updateContactSchema), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) throw new AppError('Invalid contact ID.', 400, 'VALIDATION_ERROR', 'id');

    const contact = await updateContact(req.user.id, id, req.body);
    if (!contact) throw new AppError('Contact not found.', 404, 'NOT_FOUND');

    (req.log ?? logger).info(
      { event: 'CONTACT_UPDATE', userId: req.user.id, contactId: id, changes: Object.keys(req.body), reqId: req.id },
      `User ${req.user.id} updated contact ${id}`
    );

    res.json({ success: true, data: contact });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/contacts/:id ────────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) throw new AppError('Invalid contact ID.', 400, 'VALIDATION_ERROR', 'id');

    const contact = await deleteContact(req.user.id, id);
    if (!contact) throw new AppError('Contact not found.', 404, 'NOT_FOUND');

    (req.log ?? logger).info(
      { event: 'CONTACT_DELETE', userId: req.user.id, contactId: id, reqId: req.id },
      `User ${req.user.id} deleted contact: ${contact.name}`
    );

    res.json({ success: true, data: { id } });
  } catch (err) {
    next(err);
  }
});

export { router as contactsRouter };
export default router;
