// server/routes/ideas.js
// Ideas Tracker (Roadmap Wave 4). Mount as:
//   app.use('/api/ideas', requireAuth, ideasRouter)
//
// Standard envelope ({ success, data[, meta] }), Zod validation on write bodies,
// audit logging on create/update/delete, literal routes (/stats) before the
// parameterized /:id to avoid shadowing (§6.3, mirrors reading.js / contacts.js).

import { Router } from 'express';
import { z } from 'zod';
import { IDEA_STATUSES } from '../lib/enums.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../lib/AppError.js';
import { logger } from '../lib/logger.js';
import {
  listIdeas,
  getIdeaById,
  createIdea,
  updateIdea,
  deleteIdea,
  getIdeaStats,
} from '../models/ideas.model.js';

const router = Router();

// ─── Zod schemas (request bodies) ────────────────────────────────────────────

const createIdeaSchema = z.object({
  title:       z.string().min(1, 'Title is required.').max(500),
  description: z.string().optional().nullable(),
  status:      z.enum(IDEA_STATUSES).default('new'),
  tags:        z.string().max(500).optional().nullable(),
  source:      z.string().max(100).optional().nullable(),
});

const updateIdeaSchema = z.object({
  title:        z.string().min(1).max(500).optional(),
  description:  z.string().optional().nullable(),
  status:       z.enum(IDEA_STATUSES).optional(),
  tags:         z.string().max(500).optional().nullable(),
  source:       z.string().max(100).optional().nullable(),
  converted_to: z.string().max(40).optional().nullable(),
  converted_id: z.number().int().positive().optional().nullable(),
}).refine(d => Object.keys(d).length > 0, { message: 'At least one field is required.' });

// ─── GET /api/ideas/stats ────────────────────────────────────────────────────
// Declared before /:id to avoid route shadowing.
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await getIdeaStats(req.user.id);
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/ideas ──────────────────────────────────────────────────────────
// Query params parsed by hand (validate() only covers req.body), mirroring reading.js.
router.get('/', async (req, res, next) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page ?? '1', 10));
    const per_page  = Math.min(100, Math.max(1, parseInt(req.query.per_page ?? '20', 10)));
    const status   = IDEA_STATUSES.includes(req.query.status) ? req.query.status : undefined;
    const sort     = req.query.sort  ?? 'created_at';
    const order    = req.query.order ?? 'desc';
    const search   = typeof req.query.search === 'string' ? req.query.search : undefined;

    const { data, meta } = await listIdeas(req.user.id, { status, sort, order, page, per_page, search });
    res.json({ success: true, data, meta });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/ideas ─────────────────────────────────────────────────────────
router.post('/', validate(createIdeaSchema), async (req, res, next) => {
  try {
    const idea = await createIdea(req.user.id, req.body);

    (req.log ?? logger).info(
      { event: 'IDEA_CREATE', userId: req.user.id, ideaId: idea.id, reqId: req.id },
      `User ${req.user.id} captured idea: ${idea.title}`
    );

    res.status(201).json({ success: true, data: idea });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/ideas/:id ──────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) throw new AppError('Invalid idea ID.', 400, 'VALIDATION_ERROR', 'id');

    const idea = await getIdeaById(req.user.id, id);
    if (!idea) throw new AppError('Idea not found.', 404, 'NOT_FOUND');

    res.json({ success: true, data: idea });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/ideas/:id ────────────────────────────────────────────────────
router.patch('/:id', validate(updateIdeaSchema), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) throw new AppError('Invalid idea ID.', 400, 'VALIDATION_ERROR', 'id');

    const idea = await updateIdea(req.user.id, id, req.body);
    if (!idea) throw new AppError('Idea not found.', 404, 'NOT_FOUND');

    (req.log ?? logger).info(
      { event: 'IDEA_UPDATE', userId: req.user.id, ideaId: id, changes: Object.keys(req.body), reqId: req.id },
      `User ${req.user.id} updated idea ${id}`
    );

    res.json({ success: true, data: idea });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/ideas/:id ───────────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) throw new AppError('Invalid idea ID.', 400, 'VALIDATION_ERROR', 'id');

    const idea = await deleteIdea(req.user.id, id);
    if (!idea) throw new AppError('Idea not found.', 404, 'NOT_FOUND');

    (req.log ?? logger).info(
      { event: 'IDEA_DELETE', userId: req.user.id, ideaId: id, reqId: req.id },
      `User ${req.user.id} deleted idea: ${idea.title}`
    );

    res.json({ success: true, data: { id } });
  } catch (err) {
    next(err);
  }
});

export { router as ideasRouter };
export default router;
