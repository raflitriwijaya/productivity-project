// server/routes/roadmaps.js
// Custom Learning Roadmaps REST API. Mount in server/index.js as:
//   app.use('/api/roadmaps', requireAuth, roadmapsRouter)
//
// Standard envelope ({ success, data[, meta] }), Zod validation on every mutating
// route, audit logging on create/update/delete. Route ordering (§6.3): the literal
// /stats, /tracks/*, and /milestones/* paths are registered BEFORE the single-segment
// /:id routes so they are never shadowed. The new system is ADDITIVE — the old
// /api/engineer/roadmap is untouched.

import { Router } from 'express';
import { z } from 'zod';
import { ROADMAP_STATUSES, MILESTONE_STATUSES, MILESTONE_PRIORITIES } from '../lib/enums.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../lib/AppError.js';
import { logger } from '../lib/logger.js';
import {
  listRoadmaps,
  getRoadmapById,
  createRoadmap,
  updateRoadmap,
  deleteRoadmap,
  createTrack,
  updateTrack,
  deleteTrack,
  createMilestone,
  updateMilestone,
  deleteMilestone,
  recalcProgress,
  getRoadmapStats,
} from '../models/roadmap.model.js';

const router = Router();

// ─── Zod schemas ─────────────────────────────────────────────────────────────
// color is VARCHAR(7) ('#RRGGBB'); icon is VARCHAR(50) (emoji or icon name). Both
// are intentionally loose — user creativity is the goal (see risk notes). Numerics
// are coerced so the client may submit strings from form inputs.

const dateField  = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD.').optional().nullable();
const colorField = z.string().max(7).optional().nullable();
const hoursField = z.coerce.number().min(0).optional().nullable();

const resourceSchema = z.object({
  title: z.string().max(300).optional().nullable(),
  url:   z.string().max(2000).optional().nullable(),
  type:  z.string().max(30).optional().nullable(),
});

const inlineTrackSchema = z.object({
  title:       z.string().min(1, 'Track title is required.').max(300),
  description: z.string().optional().nullable(),
  color:       colorField,
});

const createRoadmapSchema = z.object({
  title:       z.string().min(1, 'Title is required.').max(300),
  description: z.string().optional().nullable(),
  category:    z.string().max(100).optional().nullable(),
  status:      z.enum(ROADMAP_STATUSES).default('active'),
  icon:        z.string().max(50).optional().nullable(),
  color:       colorField,
  tracks:      z.array(inlineTrackSchema).max(20).optional(),
});

const updateRoadmapSchema = z.object({
  title:       z.string().min(1).max(300).optional(),
  description: z.string().optional().nullable(),
  category:    z.string().max(100).optional().nullable(),
  status:      z.enum(ROADMAP_STATUSES).optional(),
  icon:        z.string().max(50).optional().nullable(),
  color:       colorField,
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field is required.' });

const createTrackSchema = z.object({
  title:       z.string().min(1, 'Title is required.').max(300),
  description: z.string().optional().nullable(),
  color:       colorField,
  sort_order:  z.coerce.number().int().optional().nullable(),
});

const updateTrackSchema = z.object({
  title:       z.string().min(1).max(300).optional(),
  description: z.string().optional().nullable(),
  color:       colorField,
  sort_order:  z.coerce.number().int().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field is required.' });

const createMilestoneSchema = z.object({
  title:           z.string().min(1, 'Title is required.').max(500),
  description:     z.string().optional().nullable(),
  status:          z.enum(MILESTONE_STATUSES).default('pending'),
  priority:        z.enum(MILESTONE_PRIORITIES).default('medium'),
  sort_order:      z.coerce.number().int().optional().nullable(),
  due_date:        dateField,
  notes:           z.string().optional().nullable(),
  resources:       z.array(resourceSchema).max(50).optional(),
  estimated_hours: hoursField,
  actual_hours:    hoursField,
});

const updateMilestoneSchema = z.object({
  title:           z.string().min(1).max(500).optional(),
  description:     z.string().optional().nullable(),
  status:          z.enum(MILESTONE_STATUSES).optional(),
  priority:        z.enum(MILESTONE_PRIORITIES).optional(),
  sort_order:      z.coerce.number().int().optional(),
  due_date:        dateField,
  notes:           z.string().optional().nullable(),
  resources:       z.array(resourceSchema).max(50).optional(),
  estimated_hours: hoursField,
  actual_hours:    hoursField,
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field is required.' });

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseId(raw, label = 'ID') {
  const id = parseInt(raw, 10);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(`Invalid ${label}.`, 400, 'VALIDATION_ERROR', 'id');
  }
  return id;
}

const log = (req) => (req.log ?? logger);

// ═════════════════════════════════════════════════════════════════════════════
// Roadmaps — collection + stats
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/roadmaps/stats — declared before /:id to avoid shadowing.
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await getRoadmapStats(req.user.id);
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

// GET /api/roadmaps — list (flat, with aggregate counts).
router.get('/', async (req, res, next) => {
  try {
    const status   = ROADMAP_STATUSES.includes(req.query.status) ? req.query.status : undefined;
    const category = req.query.category || undefined;
    const sort     = req.query.sort  ?? 'updated_at';
    const order    = req.query.order ?? 'desc';

    const data = await listRoadmaps(req.user.id, { status, category, sort, order });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// POST /api/roadmaps — create (optionally with inline tracks).
router.post('/', validate(createRoadmapSchema), async (req, res, next) => {
  try {
    const roadmap = await createRoadmap(req.user.id, req.body);

    log(req).info(
      { event: 'ROADMAP_CREATE', userId: req.user.id, roadmapId: roadmap.id, reqId: req.id },
      `User ${req.user.id} created roadmap: ${roadmap.title}`
    );

    res.status(201).json({ success: true, data: roadmap });
  } catch (err) {
    next(err);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// Tracks — literal-prefixed routes (registered before /:id)
// ═════════════════════════════════════════════════════════════════════════════

// PATCH /api/roadmaps/tracks/:trackId — update a track.
router.patch('/tracks/:trackId', validate(updateTrackSchema), async (req, res, next) => {
  try {
    const trackId = parseId(req.params.trackId, 'track ID');
    const track = await updateTrack(req.user.id, trackId, req.body);
    if (!track) throw new AppError('Track not found.', 404, 'NOT_FOUND');

    log(req).info(
      { event: 'ROADMAP_TRACK_UPDATE', userId: req.user.id, trackId, changes: Object.keys(req.body), reqId: req.id },
      `User ${req.user.id} updated track ${trackId}`
    );

    res.json({ success: true, data: track });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/roadmaps/tracks/:trackId — delete a track (cascade milestones).
router.delete('/tracks/:trackId', async (req, res, next) => {
  try {
    const trackId = parseId(req.params.trackId, 'track ID');
    const track = await deleteTrack(req.user.id, trackId);
    if (!track) throw new AppError('Track not found.', 404, 'NOT_FOUND');

    log(req).info(
      { event: 'ROADMAP_TRACK_DELETE', userId: req.user.id, trackId, reqId: req.id },
      `User ${req.user.id} deleted track ${trackId}`
    );

    res.json({ success: true, data: { id: trackId } });
  } catch (err) {
    next(err);
  }
});

// POST /api/roadmaps/tracks/:trackId/milestones — add a milestone to a track.
router.post('/tracks/:trackId/milestones', validate(createMilestoneSchema), async (req, res, next) => {
  try {
    const trackId = parseId(req.params.trackId, 'track ID');
    const milestone = await createMilestone(req.user.id, trackId, req.body);
    if (!milestone) throw new AppError('Track not found.', 404, 'NOT_FOUND');

    log(req).info(
      { event: 'ROADMAP_MILESTONE_CREATE', userId: req.user.id, trackId, milestoneId: milestone.id, reqId: req.id },
      `User ${req.user.id} added milestone ${milestone.id} to track ${trackId}`
    );

    res.status(201).json({ success: true, data: milestone });
  } catch (err) {
    next(err);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// Milestones — literal-prefixed routes (registered before /:id)
// ═════════════════════════════════════════════════════════════════════════════

// PATCH /api/roadmaps/milestones/:milestoneId — update (status, notes, hours, …).
router.patch('/milestones/:milestoneId', validate(updateMilestoneSchema), async (req, res, next) => {
  try {
    const milestoneId = parseId(req.params.milestoneId, 'milestone ID');
    const milestone = await updateMilestone(req.user.id, milestoneId, req.body);
    if (!milestone) throw new AppError('Milestone not found.', 404, 'NOT_FOUND');

    log(req).info(
      { event: 'ROADMAP_MILESTONE_UPDATE', userId: req.user.id, milestoneId, changes: Object.keys(req.body), reqId: req.id },
      `User ${req.user.id} updated milestone ${milestoneId}`
    );

    res.json({ success: true, data: milestone });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/roadmaps/milestones/:milestoneId — delete a milestone.
router.delete('/milestones/:milestoneId', async (req, res, next) => {
  try {
    const milestoneId = parseId(req.params.milestoneId, 'milestone ID');
    const milestone = await deleteMilestone(req.user.id, milestoneId);
    if (!milestone) throw new AppError('Milestone not found.', 404, 'NOT_FOUND');

    log(req).info(
      { event: 'ROADMAP_MILESTONE_DELETE', userId: req.user.id, milestoneId, reqId: req.id },
      `User ${req.user.id} deleted milestone ${milestoneId}`
    );

    res.json({ success: true, data: { id: milestoneId } });
  } catch (err) {
    next(err);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// Roadmaps — item routes (parameterized /:id, registered last)
// ═════════════════════════════════════════════════════════════════════════════

// GET /api/roadmaps/:id — roadmap with nested tracks + milestones.
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id, 'roadmap ID');
    const roadmap = await getRoadmapById(req.user.id, id);
    if (!roadmap) throw new AppError('Roadmap not found.', 404, 'NOT_FOUND');

    res.json({ success: true, data: roadmap });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/roadmaps/:id — update roadmap metadata.
router.patch('/:id', validate(updateRoadmapSchema), async (req, res, next) => {
  try {
    const id = parseId(req.params.id, 'roadmap ID');
    const roadmap = await updateRoadmap(req.user.id, id, req.body);
    if (!roadmap) throw new AppError('Roadmap not found.', 404, 'NOT_FOUND');

    log(req).info(
      { event: 'ROADMAP_UPDATE', userId: req.user.id, roadmapId: id, changes: Object.keys(req.body), reqId: req.id },
      `User ${req.user.id} updated roadmap ${id}`
    );

    res.json({ success: true, data: roadmap });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/roadmaps/:id — delete roadmap (cascade tracks + milestones).
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id, 'roadmap ID');
    const roadmap = await deleteRoadmap(req.user.id, id);
    if (!roadmap) throw new AppError('Roadmap not found.', 404, 'NOT_FOUND');

    log(req).info(
      { event: 'ROADMAP_DELETE', userId: req.user.id, roadmapId: id, reqId: req.id },
      `User ${req.user.id} deleted roadmap: ${roadmap.title}`
    );

    res.json({ success: true, data: { id } });
  } catch (err) {
    next(err);
  }
});

// POST /api/roadmaps/:id/tracks — add a track to a roadmap.
router.post('/:id/tracks', validate(createTrackSchema), async (req, res, next) => {
  try {
    const id = parseId(req.params.id, 'roadmap ID');
    const track = await createTrack(req.user.id, id, req.body);
    if (!track) throw new AppError('Roadmap not found.', 404, 'NOT_FOUND');

    log(req).info(
      { event: 'ROADMAP_TRACK_CREATE', userId: req.user.id, roadmapId: id, trackId: track.id, reqId: req.id },
      `User ${req.user.id} added track ${track.id} to roadmap ${id}`
    );

    res.status(201).json({ success: true, data: track });
  } catch (err) {
    next(err);
  }
});

// POST /api/roadmaps/:id/recalc — force-recalculate progress from milestones.
router.post('/:id/recalc', async (req, res, next) => {
  try {
    const id = parseId(req.params.id, 'roadmap ID');
    const roadmap = await recalcProgress(req.user.id, id);
    if (!roadmap) throw new AppError('Roadmap not found.', 404, 'NOT_FOUND');

    log(req).info(
      { event: 'ROADMAP_RECALC', userId: req.user.id, roadmapId: id, progress: roadmap.progress, reqId: req.id },
      `User ${req.user.id} recalculated roadmap ${id} progress`
    );

    res.json({ success: true, data: roadmap });
  } catch (err) {
    next(err);
  }
});

export { router as roadmapsRouter };
export default router;
