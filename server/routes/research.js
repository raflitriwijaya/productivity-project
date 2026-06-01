// server/routes/research.js
// Mount in server/index.js as:
//   app.use('/api/research', requireAuth, researchRouter)

import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { AppError } from '../lib/AppError.js';
import {
  listResearchEntries,
  getResearchEntryById,
  createResearchEntry,
  patchResearchEntry,
  deleteResearchEntry,
  getResearchStats,
} from '../models/research.model.js';

const router = Router();

// ─── Zod schemas ────────────────────────────────────────────────────────────

const TYPES    = ['journal', 'citation', 'note'];
const STATUSES = ['draft', 'active', 'archived'];

const createSchema = z.object({
  title:   z.string().min(1, 'Title is required.').max(255),
  type:    z.enum(TYPES,    { errorMap: () => ({ message: 'Type must be journal, citation, or note.' }) }),
  status:  z.enum(STATUSES, { errorMap: () => ({ message: 'Status must be draft, active, or archived.' }) }).default('draft'),
  content: z.string().max(10000).optional(),
  source:  z.string().max(500).optional(),
  tags:    z.string().max(500).optional(),
});

const patchSchema = z.object({
  title:   z.string().min(1).max(255).optional(),
  type:    z.enum(TYPES).optional(),
  status:  z.enum(STATUSES).optional(),
  content: z.string().max(10000).optional(),
  source:  z.string().max(500).optional(),
  tags:    z.string().max(500).optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field is required.' });

// ─── GET /api/research/stats ─────────────────────────────────────────────────

router.get('/stats', async (req, res, next) => {
  try {
    const stats = await getResearchStats(req.user.id);
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/research ───────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const { type, status, page, per_page, sort, order } = req.query;
    const opts = {
      type:     type     || undefined,
      status:   status   || undefined,
      page:     page     ? parseInt(page, 10)     : 1,
      per_page: per_page ? Math.min(parseInt(per_page, 10), 100) : 20,
      sort:     sort     || 'created_at',
      order:    order    || 'desc',
    };
    const { rows, total } = await listResearchEntries(req.user.id, opts);
    res.json({
      success: true,
      data: rows,
      meta: { total, page: opts.page, per_page: opts.per_page },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/research/:id ───────────────────────────────────────────────────

router.get('/:id', async (req, res, next) => {
  try {
    const entry = await getResearchEntryById(parseInt(req.params.id, 10), req.user.id);
    if (!entry) return next(new AppError('Research entry not found.', 404, 'NOT_FOUND'));
    res.json({ success: true, data: entry });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/research ──────────────────────────────────────────────────────

router.post('/', validate(createSchema), async (req, res, next) => {
  try {
    const entry = await createResearchEntry(req.user.id, req.body);
    res.status(201).json({ success: true, data: entry });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/research/:id ─────────────────────────────────────────────────

router.patch('/:id', validate(patchSchema), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await getResearchEntryById(id, req.user.id);
    if (!existing) return next(new AppError('Research entry not found.', 404, 'NOT_FOUND'));

    const updated = await patchResearchEntry(id, req.user.id, req.body);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/research/:id ────────────────────────────────────────────────

router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const deleted = await deleteResearchEntry(id, req.user.id);
    if (!deleted) return next(new AppError('Research entry not found.', 404, 'NOT_FOUND'));
    res.json({ success: true, data: { id } });
  } catch (err) {
    next(err);
  }
});

// Named export matches `import { researchRouter }` in index.js; default kept for flexibility.
export { router as researchRouter };
export default router;
