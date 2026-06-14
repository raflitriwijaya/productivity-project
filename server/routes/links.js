// server/routes/links.js
// Universal cross-module links (Roadmap Wave 1). Mounted in server/index.js as:
//   app.use('/api/links', requireAuth, linksRouter)
//
// Standard envelope ({ success, data }), Zod validation on POST, ownership of BOTH
// referenced entities verified before a link is created, audit logging on
// create/delete. Only literal/static paths plus the generic /:id — no shadowing.

import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { AppError } from '../lib/AppError.js';
import { logger } from '../lib/logger.js';
import { LINKABLE_TYPES } from '../lib/enums.js';
import {
  createLink,
  getLinksForEntity,
  getLinkById,
  deleteLink,
} from '../models/links.model.js';

// Ownership-check functions from each module's model. NOTE the argument order is
// (id, userId) across every model in this codebase — do not flip it.
import { getTodoById } from '../models/todo.model.js';
import { getTransactionById } from '../models/finance.model.js';
import { getLearningItemById } from '../models/learning.model.js';
import { getResearchEntryById } from '../models/research.model.js';
import { getProjectById } from '../models/engineer.model.js';
import { getBookById } from '../models/reading.model.js';
import { getContactById } from '../models/contacts.model.js';
import { getIdeaById } from '../models/ideas.model.js';
import { getTimeEntryById } from '../models/time.model.js';
import { getGoalById } from '../models/goals.model.js';
import { getConversationById } from '../models/chat.model.js';
import { getRoadmapById, getMilestoneRow } from '../models/roadmap.model.js';

const router = Router();

// ─── Ownership verification ──────────────────────────────────────────────────
// Maps an entity type to its model's "get by id" function. Each returns the entity
// when owned by the user, or null when missing / not owned. Types without a
// registered validator are accepted for forward-compatibility (the user_id scoping
// and UNIQUE constraint in SQL still protect the row), but logged so the gap is visible.
const OWNERSHIP_VALIDATORS = {
  todo:             getTodoById,
  transaction:      getTransactionById,
  research_entry:   getResearchEntryById,
  learning_item:    getLearningItemById,
  engineer_project: getProjectById,
  // reading.model.getBookById takes (userId, id); validators are called as
  // (id, userId), so adapt the argument order here.
  book:             (id, userId) => getBookById(userId, id),
  // contacts.model.getContactById is also (userId, id) — same adaptation.
  contact:          (id, userId) => getContactById(userId, id),
  // ideas.model.getIdeaById is also (userId, id) — same adaptation.
  idea:             (id, userId) => getIdeaById(userId, id),
  // Wave 5 models are also (userId, id) — same adaptation.
  time_entry:       (id, userId) => getTimeEntryById(userId, id),
  goal:             (id, userId) => getGoalById(userId, id),
  // Wave 7 chat.model.getConversationById is (userId, id) — same adaptation.
  chat:             (id, userId) => getConversationById(userId, id),
  // Custom Learning Roadmaps — both model fns are (userId, id); adapt the order.
  learning_roadmap:  (id, userId) => getRoadmapById(userId, id),
  roadmap_milestone: (id, userId) => getMilestoneRow(userId, id),
};

/**
 * Verify the user owns the entity of (type, id). Returns the entity on success.
 * Throws 404 (never 403) when missing/not owned so we don't disclose existence.
 * @param {object} req  used for the request-scoped logger
 * @param {number} userId
 * @param {string} type
 * @param {number} id
 */
async function verifyOwnership(req, userId, type, id) {
  const validator = OWNERSHIP_VALIDATORS[type];
  if (!validator) {
    (req.log ?? logger).warn({ type }, `No ownership validator registered for link type "${type}" — accepting for forward-compatibility`);
    return { id };
  }
  const entity = await validator(id, userId);
  if (!entity) {
    throw new AppError(`Entity ${type}/${id} not found.`, 404, 'NOT_FOUND');
  }
  return entity;
}

// ─── Zod schema (POST body) ──────────────────────────────────────────────────

const createLinkSchema = z.object({
  from_type: z.enum(LINKABLE_TYPES, { errorMap: () => ({ message: 'Unknown from_type.' }) }),
  from_id:   z.number().int().positive(),
  to_type:   z.enum(LINKABLE_TYPES, { errorMap: () => ({ message: 'Unknown to_type.' }) }),
  to_id:     z.number().int().positive(),
  note:      z.string().max(500).optional().nullable(),
}).refine(
  data => !(data.from_type === data.to_type && data.from_id === data.to_id),
  { message: 'Cannot link an entity to itself.' }
);

// ─── GET /api/links?type=research_entry&id=42&direction=both ─────────────────
// Query params (validate() only covers req.body, so we parse the query by hand,
// mirroring research.js's parseListOpts pattern).
router.get('/', async (req, res, next) => {
  try {
    const { type, id, direction = 'both' } = req.query;

    if (!LINKABLE_TYPES.includes(type)) {
      return next(new AppError('Unknown or missing entity type.', 400, 'VALIDATION_ERROR', 'type'));
    }
    const entityId = parseInt(id, 10);
    if (!Number.isInteger(entityId) || entityId <= 0) {
      return next(new AppError('A positive entity id is required.', 400, 'VALIDATION_ERROR', 'id'));
    }
    if (!['from', 'to', 'both'].includes(direction)) {
      return next(new AppError('direction must be from, to, or both.', 400, 'VALIDATION_ERROR', 'direction'));
    }

    // Confirm the anchor entity exists and is owned before exposing its links.
    await verifyOwnership(req, req.user.id, type, entityId);

    const links = await getLinksForEntity(req.user.id, type, entityId, direction);
    res.json({ success: true, data: links });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/links ─────────────────────────────────────────────────────────
router.post('/', validate(createLinkSchema), async (req, res, next) => {
  try {
    const { from_type, from_id, to_type, to_id, note } = req.body;
    const userId = req.user.id;

    // Verify ownership of BOTH sides BEFORE writing the link.
    await verifyOwnership(req, userId, from_type, from_id);
    await verifyOwnership(req, userId, to_type, to_id);

    const link = await createLink(userId, {
      fromType: from_type, fromId: from_id, toType: to_type, toId: to_id, note,
    });

    (req.log ?? logger).info(
      { event: 'LINK_CREATE', userId, from_type, from_id, to_type, to_id, linkId: link.id, reqId: req.id },
      `User ${userId} linked ${from_type}/${from_id} -> ${to_type}/${to_id}`
    );

    res.status(201).json({ success: true, data: link });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/links/:id ───────────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const linkId = parseInt(req.params.id, 10);
    if (!Number.isInteger(linkId) || linkId <= 0) {
      return next(new AppError('Invalid link id.', 400, 'VALIDATION_ERROR', 'id'));
    }

    const link = await getLinkById(req.user.id, linkId);
    if (!link) return next(new AppError('Link not found.', 404, 'NOT_FOUND'));

    await deleteLink(req.user.id, linkId);

    (req.log ?? logger).info(
      { event: 'LINK_DELETE', userId: req.user.id, linkId, from_type: link.from_type, from_id: link.from_id, to_type: link.to_type, to_id: link.to_id, reqId: req.id },
      `User ${req.user.id} deleted link ${linkId}`
    );

    res.json({ success: true, data: { id: linkId } });
  } catch (err) {
    next(err);
  }
});

export { router as linksRouter };
export default router;
