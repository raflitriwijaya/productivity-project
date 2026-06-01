// server/routes/learning.js
// Mount as: app.use('/api/learning', requireAuth, learningRouter)

import { Router } from 'express';
import { z }      from 'zod';
import { validate }           from '../middleware/validate.js';
import { AppError }           from '../lib/AppError.js';
import {
  listLearningItems,
  getLearningItemById,
  createLearningItem,
  patchLearningItem,
  deleteLearningItem,
  getLearningStats,
} from '../models/learning.model.js';

const router = Router();

// ─── Zod schemas ────────────────────────────────────────────────────────────

const TYPE_ENUM   = ['course', 'book', 'video', 'article', 'other'];
const STATUS_ENUM = ['not_started', 'in_progress', 'completed', 'on_hold'];

const createSchema = z.object({
  title:        z.string().min(1, 'Title is required.').max(255),
  type:         z.enum(TYPE_ENUM).default('course'),
  source:       z.string().max(255).optional().nullable(),
  status:       z.enum(STATUS_ENUM).default('not_started'),
  priority:     z.number().int().min(1).max(3).default(2),
  progress:     z.number().int().min(0).max(100).default(0),
  total_hours:  z.number().positive().optional().nullable(),
  spent_hours:  z.number().min(0).optional().nullable(),
  started_at:   z.string().date().optional().nullable(),
  completed_at: z.string().date().optional().nullable(),
  notes:        z.string().optional().nullable(),
  url:          z.string().url('Must be a valid URL.').max(2048).optional().nullable(),
});

// PATCH accepts any subset of createSchema fields (all optional)
const patchSchema = createSchema.partial();

// ─── GET /api/learning/stats ─────────────────────────────────────────────────
// Must be declared before /:id to avoid route shadowing.
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await getLearningStats(req.user.id);
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/learning ───────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const page    = Math.max(1, parseInt(req.query.page    ?? '1',  10));
    const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page ?? '20', 10)));
    const status  = STATUS_ENUM.includes(req.query.status) ? req.query.status : undefined;
    const sort    = req.query.sort  ?? 'created_at';
    const order   = req.query.order ?? 'desc';

    const { rows, total } = await listLearningItems(req.user.id, { status, sort, order, page, perPage });

    res.json({
      success: true,
      data: rows,
      meta: { total, page, per_page: perPage },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/learning/:id ───────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const item = await getLearningItemById(parseInt(req.params.id, 10), req.user.id);
    if (!item) return next(new AppError('Learning item not found.', 404, 'NOT_FOUND'));
    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/learning ──────────────────────────────────────────────────────
router.post('/', validate(createSchema), async (req, res, next) => {
  try {
    const item = await createLearningItem(req.user.id, req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/learning/:id ─────────────────────────────────────────────────
router.patch('/:id', validate(patchSchema), async (req, res, next) => {
  try {
    const existing = await getLearningItemById(parseInt(req.params.id, 10), req.user.id);
    if (!existing) return next(new AppError('Learning item not found.', 404, 'NOT_FOUND'));

    const updated = await patchLearningItem(parseInt(req.params.id, 10), req.user.id, req.body);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/learning/:id ────────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await deleteLearningItem(parseInt(req.params.id, 10), req.user.id);
    if (!deleted) return next(new AppError('Learning item not found.', 404, 'NOT_FOUND'));
    res.json({ success: true, data: { id: parseInt(req.params.id, 10) } });
  } catch (err) {
    next(err);
  }
});

// Named export matches `import { learningRouter }` in index.js; default kept for flexibility.
export { router as learningRouter };
export default router;
