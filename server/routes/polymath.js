// server/routes/polymath.js
// Roadmap Wave 6 (Moonshots): the Polymath Dashboard. Mount as:
//   app.use('/api/polymath', requireAuth, polymathRouter)
//
// One read-only endpoint returning multi-year growth data across every module —
// books, research, learning, engineering, time, and the user's knowledge tags.
// Like review.js, this is a parallel fan-out of independent aggregation queries
// (Promise.all), each user_id-scoped, with string aggregates coerced to numbers.

import { Router } from 'express';
import pool from '../lib/db.js';

const router = Router();

// ─── GET /api/polymath ────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [
      booksByYear,
      researchByYear,
      learningByYear,
      projectsByYear,
      timeByYear,
      topTags,
    ] = await Promise.all([
      // Books finished, per year (+ pages read)
      pool.query(
        `SELECT EXTRACT(YEAR FROM finished_at)::int AS year,
                COUNT(*)::int AS count,
                COALESCE(SUM(total_pages), 0)::int AS pages
           FROM books
          WHERE user_id = $1 AND shelf = 'finished' AND finished_at IS NOT NULL
          GROUP BY year ORDER BY year`,
        [userId]
      ),
      // Research entries created, per year (split by type)
      pool.query(
        `SELECT EXTRACT(YEAR FROM created_at)::int AS year,
                COUNT(*)::int AS count,
                COUNT(*) FILTER (WHERE type = 'journal')::int  AS journals,
                COUNT(*) FILTER (WHERE type = 'citation')::int AS citations
           FROM research_entries
          WHERE user_id = $1
          GROUP BY year ORDER BY year`,
        [userId]
      ),
      // Learning items completed, per year (+ hours invested)
      pool.query(
        `SELECT EXTRACT(YEAR FROM completed_at)::int AS year,
                COUNT(*)::int AS count,
                COALESCE(SUM(spent_hours), 0)::numeric AS hours
           FROM learning_items
          WHERE user_id = $1 AND status = 'completed' AND completed_at IS NOT NULL
          GROUP BY year ORDER BY year`,
        [userId]
      ),
      // Engineering projects created, per year (+ how many reached deployed)
      pool.query(
        `SELECT EXTRACT(YEAR FROM created_at)::int AS year,
                COUNT(*)::int AS count,
                COUNT(*) FILTER (WHERE status = 'deployed')::int AS deployed
           FROM engineer_projects
          WHERE user_id = $1
          GROUP BY year ORDER BY year`,
        [userId]
      ),
      // Time logged, per year
      pool.query(
        `SELECT EXTRACT(YEAR FROM started_at)::int AS year,
                COALESCE(SUM(duration_seconds), 0)::bigint AS total_seconds,
                COUNT(*)::int AS sessions
           FROM time_entries
          WHERE user_id = $1 AND ended_at IS NOT NULL
          GROUP BY year ORDER BY year`,
        [userId]
      ),
      // Top knowledge tags across all research entries
      pool.query(
        `SELECT TRIM(tag) AS tag, COUNT(*)::int AS count
           FROM research_entries,
                UNNEST(STRING_TO_ARRAY(tags, ',')) AS tag
          WHERE user_id = $1 AND tags IS NOT NULL AND tags <> ''
            AND TRIM(tag) <> ''
          GROUP BY TRIM(tag)
          ORDER BY count DESC
          LIMIT 20`,
        [userId]
      ),
    ]);

    res.json({
      success: true,
      data: {
        books_by_year:    booksByYear.rows,
        research_by_year: researchByYear.rows,
        learning_by_year: learningByYear.rows.map(r => ({ ...r, hours: Math.round(parseFloat(r.hours) * 10) / 10 })),
        projects_by_year: projectsByYear.rows,
        time_by_year: timeByYear.rows.map(r => ({
          year:         r.year,
          sessions:     r.sessions,
          total_seconds: parseInt(r.total_seconds, 10),
          total_hours:  Math.round((parseInt(r.total_seconds, 10) / 3600) * 10) / 10,
        })),
        top_tags: topTags.rows,
      },
    });
  } catch (err) {
    next(err);
  }
});

export { router as polymathRouter };
export default router;
