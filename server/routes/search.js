// server/routes/search.js
// Unified cross-module search (Roadmap Wave 3). Mount as:
//   app.use('/api/search', requireAuth, searchRouter)
//
//   GET /api/search?q=<text>  → { success, data: [ {id, entity_type, title, …} ] }

import { Router } from 'express';
import { AppError } from '../lib/AppError.js';
import { searchAll } from '../models/search.model.js';

const router = Router();

// ─── GET /api/search?q= ──────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q.length < 1)   throw new AppError('A search query is required.', 400, 'VALIDATION_ERROR', 'q');
    if (q.length > 200) throw new AppError('Search query is too long.', 400, 'VALIDATION_ERROR', 'q');

    const results = await searchAll(req.user.id, q);
    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
});

export { router as searchRouter };
export default router;
