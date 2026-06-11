// server/routes/dashboard.js
// Today Dashboard aggregate endpoint (Roadmap Wave 2).
// Mounted in index.js as:
//   app.use('/api/dashboard', requireAuth, dashboardRouter)
//
// GET /api/dashboard/today fans out to each module's date-scoped stat function
// in parallel and returns a single briefing payload — one round-trip instead of
// the five the client would otherwise make.

import { Router } from 'express';
import { getTodayStats } from '../models/todo.model.js';
import { getTodayDashboard } from '../models/finance.model.js';
import { getActiveLearningStats } from '../models/learning.model.js';
import { getTodayEngineerStats } from '../models/engineer.model.js';
import { getResearchStats } from '../models/research.model.js';

const router = Router();

// ─── GET /api/dashboard/today ──────────────────────────────────────────────────
router.get('/today', async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [todos, finance, learning, engineer, research] = await Promise.all([
      getTodayStats(userId),
      getTodayDashboard(userId),
      getActiveLearningStats(userId),
      getTodayEngineerStats(userId),
      getResearchStats(userId),
    ]);

    res.json({
      success: true,
      data: {
        todos,
        finance,
        learning,
        engineer,
        research,
        date: new Date().toISOString().split('T')[0],
      },
    });
  } catch (err) {
    next(err);
  }
});

// Named export matches the `import { dashboardRouter }` convention in index.js.
export { router as dashboardRouter };
export default router;
