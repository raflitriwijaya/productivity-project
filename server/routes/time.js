// server/routes/time.js
// Time Tracking (Roadmap Wave 5). Mount as:
//   app.use('/api/time', requireAuth, timeRouter)
//
// Standard envelope ({ success, data[, meta] }), Zod validation on the start body,
// audit logging on start/stop/delete, literal routes (/running, /summary, /start,
// /stop) declared before the parameterized /:id to avoid shadowing (§6.3).

import { Router } from 'express';
import { z } from 'zod';
import { TIME_ENTITY_TYPES } from '../lib/enums.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../lib/AppError.js';
import { logger } from '../lib/logger.js';
import {
  startTimer,
  stopRunningTimer,
  getRunningTimer,
  listTimeEntries,
  deleteTimeEntry,
  getTimeSummary,
  getTodayHours,
} from '../models/time.model.js';

const router = Router();

// ─── Zod schema (POST /start body) ───────────────────────────────────────────
const startSchema = z.object({
  entity_type: z.enum(TIME_ENTITY_TYPES),
  entity_id:   z.number().int().positive(),
  note:        z.string().max(500).optional().nullable(),
});

// Default range helper: last 7 days through today (YYYY-MM-DD).
function defaultRange() {
  const to = new Date().toISOString().split('T')[0];
  const from = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  return { from, to };
}

// ─── GET /api/time/running — currently running timer (null when none) ─────────
router.get('/running', async (req, res, next) => {
  try {
    const timer = await getRunningTimer(req.user.id);
    res.json({ success: true, data: timer });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/time/summary?from=&to= — time grouped by entity type ────────────
router.get('/summary', async (req, res, next) => {
  try {
    const def = defaultRange();
    const from = typeof req.query.from === 'string' ? req.query.from : def.from;
    const to   = typeof req.query.to === 'string' ? req.query.to : def.to;

    const [summary, today_hours] = await Promise.all([
      getTimeSummary(req.user.id, from, to),
      getTodayHours(req.user.id),
    ]);

    res.json({ success: true, data: { summary, today_hours, from, to } });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/time — list entries (filterable) ────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page ?? '1', 10));
    const per_page = Math.min(100, Math.max(1, parseInt(req.query.per_page ?? '20', 10)));
    const entityType = TIME_ENTITY_TYPES.includes(req.query.entity_type) ? req.query.entity_type : undefined;
    const entityId = req.query.entity_id ? parseInt(req.query.entity_id, 10) : undefined;
    const from = typeof req.query.from === 'string' ? req.query.from : undefined;
    const to   = typeof req.query.to === 'string' ? req.query.to : undefined;

    const { data, meta } = await listTimeEntries(req.user.id, {
      entityType, entityId, from, to, page, per_page,
    });
    res.json({ success: true, data, meta });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/time/start — start a timer (stops any running one first) ───────
router.post('/start', validate(startSchema), async (req, res, next) => {
  try {
    const timer = await startTimer(req.user.id, {
      entityType: req.body.entity_type,
      entityId:   req.body.entity_id,
      note:       req.body.note,
    });

    (req.log ?? logger).info(
      { event: 'TIMER_START', userId: req.user.id, entryId: timer.id, entity: `${req.body.entity_type}/${req.body.entity_id}`, reqId: req.id },
      `User ${req.user.id} started timer on ${req.body.entity_type}/${req.body.entity_id}`
    );

    res.status(201).json({ success: true, data: timer });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/time/stop — stop the running timer ─────────────────────────────
router.post('/stop', async (req, res, next) => {
  try {
    const stopped = await stopRunningTimer(req.user.id);
    if (!stopped) throw new AppError('No running timer.', 404, 'NOT_FOUND');

    (req.log ?? logger).info(
      { event: 'TIMER_STOP', userId: req.user.id, entryId: stopped.id, duration: stopped.duration_seconds, reqId: req.id },
      `User ${req.user.id} stopped timer ${stopped.id} (${stopped.duration_seconds}s)`
    );

    res.json({ success: true, data: stopped });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/time/:id ─────────────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) throw new AppError('Invalid entry ID.', 400, 'VALIDATION_ERROR', 'id');

    const entry = await deleteTimeEntry(req.user.id, id);
    if (!entry) throw new AppError('Time entry not found.', 404, 'NOT_FOUND');

    (req.log ?? logger).info(
      { event: 'TIME_DELETE', userId: req.user.id, entryId: id, reqId: req.id },
      `User ${req.user.id} deleted time entry ${id}`
    );

    res.json({ success: true, data: { id } });
  } catch (err) {
    next(err);
  }
});

export { router as timeRouter };
export default router;
