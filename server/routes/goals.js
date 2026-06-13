// server/routes/goals.js
// Goals/OKRs System (Roadmap Wave 5). Mount as:
//   app.use('/api/goals', requireAuth, goalsRouter)
//
// Standard envelope ({ success, data[, meta] }), Zod validation on write bodies,
// audit logging on create/update/delete, literal routes (/stats) before the
// parameterized /:id to avoid shadowing (§6.3, mirrors ideas.js / contacts.js).
// POST /:id/recalc re-derives current_value from linked entities (Wave 1 links).

import { Router } from 'express';
import { z } from 'zod';
import { GOAL_TYPES, GOAL_STATUSES, GOAL_PRIORITIES } from '../lib/enums.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../lib/AppError.js';
import { logger } from '../lib/logger.js';
import {
  listGoals,
  getGoalById,
  createGoal,
  updateGoal,
  deleteGoal,
  getGoalStats,
  recalcGoalProgress,
  toggleHabitLog,
  getHabitLogs,
} from '../models/goals.model.js';

const router = Router();

// ─── Zod schemas (request bodies) ────────────────────────────────────────────
// Dates accept an ISO date string ('YYYY-MM-DD') or null. Numerics are coerced so
// the client may send strings from form inputs.

const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD.').optional().nullable();

const createGoalSchema = z.object({
  title:        z.string().min(1, 'Title is required.').max(500),
  description:  z.string().optional().nullable(),
  goal_type:    z.enum(GOAL_TYPES).default('target'),
  target_value: z.coerce.number().optional().nullable(),
  current_value: z.coerce.number().optional().nullable(),
  unit:         z.string().max(100).optional().nullable(),
  category:     z.string().max(100).optional().nullable(),
  status:       z.enum(GOAL_STATUSES).default('active'),
  priority:     z.enum(GOAL_PRIORITIES).default('medium'),
  start_date:   dateField,
  target_date:  dateField,
});

const updateGoalSchema = z.object({
  title:         z.string().min(1).max(500).optional(),
  description:   z.string().optional().nullable(),
  goal_type:     z.enum(GOAL_TYPES).optional(),
  target_value:  z.coerce.number().optional().nullable(),
  current_value: z.coerce.number().optional().nullable(),
  unit:          z.string().max(100).optional().nullable(),
  category:      z.string().max(100).optional().nullable(),
  status:        z.enum(GOAL_STATUSES).optional(),
  priority:      z.enum(GOAL_PRIORITIES).optional(),
  start_date:    dateField,
  target_date:   dateField,
}).refine(d => Object.keys(d).length > 0, { message: 'At least one field is required.' });

// ─── GET /api/goals/stats ────────────────────────────────────────────────────
// Declared before /:id to avoid route shadowing.
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await getGoalStats(req.user.id);
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/goals ──────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page ?? '1', 10));
    const per_page = Math.min(100, Math.max(1, parseInt(req.query.per_page ?? '50', 10)));
    const status   = GOAL_STATUSES.includes(req.query.status) ? req.query.status : undefined;
    const priority = GOAL_PRIORITIES.includes(req.query.priority) ? req.query.priority : undefined;
    const sort     = req.query.sort  ?? 'created_at';
    const order    = req.query.order ?? 'desc';

    const { data, meta } = await listGoals(req.user.id, { status, priority, sort, order, page, per_page });
    res.json({ success: true, data, meta });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/goals ─────────────────────────────────────────────────────────
router.post('/', validate(createGoalSchema), async (req, res, next) => {
  try {
    const goal = await createGoal(req.user.id, req.body);

    (req.log ?? logger).info(
      { event: 'GOAL_CREATE', userId: req.user.id, goalId: goal.id, reqId: req.id },
      `User ${req.user.id} created goal: ${goal.title}`
    );

    res.status(201).json({ success: true, data: goal });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/goals/:id ──────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) throw new AppError('Invalid goal ID.', 400, 'VALIDATION_ERROR', 'id');

    const goal = await getGoalById(req.user.id, id);
    if (!goal) throw new AppError('Goal not found.', 404, 'NOT_FOUND');

    res.json({ success: true, data: goal });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/goals/:id/recalc — re-derive current_value from linked entities ─
router.post('/:id/recalc', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) throw new AppError('Invalid goal ID.', 400, 'VALIDATION_ERROR', 'id');

    const goal = await recalcGoalProgress(req.user.id, id);
    if (!goal) throw new AppError('Goal not found.', 404, 'NOT_FOUND');

    (req.log ?? logger).info(
      { event: 'GOAL_RECALC', userId: req.user.id, goalId: id, current: goal.current_value, reqId: req.id },
      `User ${req.user.id} recalculated goal ${id} progress`
    );

    res.json({ success: true, data: goal });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/goals/:id/habit-log — toggle today's check-in for a habit goal ──
// Two-segment path, so it never collides with the single-segment /:id route.
router.post('/:id/habit-log', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) throw new AppError('Invalid goal ID.', 400, 'VALIDATION_ERROR', 'id');

    const goal = await getGoalById(req.user.id, id);
    if (!goal) throw new AppError('Goal not found.', 404, 'NOT_FOUND');
    if (goal.goal_type !== 'habit') {
      throw new AppError('Only habit goals support daily check-ins.', 400, 'VALIDATION_ERROR', 'goal_type');
    }

    const result = await toggleHabitLog(req.user.id, id);

    (req.log ?? logger).info(
      { event: 'HABIT_TOGGLE', userId: req.user.id, goalId: id, action: result.action, streak: result.streak, reqId: req.id },
      `User ${req.user.id} ${result.action} habit goal ${id} (streak ${result.streak})`
    );

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/goals/:id/habit-logs — calendar data + current streak ───────────
router.get('/:id/habit-logs', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) throw new AppError('Invalid goal ID.', 400, 'VALIDATION_ERROR', 'id');

    const goal = await getGoalById(req.user.id, id);
    if (!goal) throw new AppError('Goal not found.', 404, 'NOT_FOUND');

    const from = /^\d{4}-\d{2}-\d{2}$/.test(req.query.from ?? '') ? req.query.from : undefined;
    const to   = /^\d{4}-\d{2}-\d{2}$/.test(req.query.to ?? '')   ? req.query.to   : undefined;

    const data = await getHabitLogs(req.user.id, id, { from, to });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/goals/:id ────────────────────────────────────────────────────
router.patch('/:id', validate(updateGoalSchema), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) throw new AppError('Invalid goal ID.', 400, 'VALIDATION_ERROR', 'id');

    const goal = await updateGoal(req.user.id, id, req.body);
    if (!goal) throw new AppError('Goal not found.', 404, 'NOT_FOUND');

    (req.log ?? logger).info(
      { event: 'GOAL_UPDATE', userId: req.user.id, goalId: id, changes: Object.keys(req.body), reqId: req.id },
      `User ${req.user.id} updated goal ${id}`
    );

    res.json({ success: true, data: goal });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/goals/:id ───────────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) throw new AppError('Invalid goal ID.', 400, 'VALIDATION_ERROR', 'id');

    const goal = await deleteGoal(req.user.id, id);
    if (!goal) throw new AppError('Goal not found.', 404, 'NOT_FOUND');

    (req.log ?? logger).info(
      { event: 'GOAL_DELETE', userId: req.user.id, goalId: id, reqId: req.id },
      `User ${req.user.id} deleted goal: ${goal.title}`
    );

    res.json({ success: true, data: { id } });
  } catch (err) {
    next(err);
  }
});

export { router as goalsRouter };
export default router;
