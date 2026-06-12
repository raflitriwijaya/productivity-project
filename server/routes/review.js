// server/routes/review.js
// Reflection & Growth (Roadmap Wave 5). Mount as:
//   app.use('/api/review', requireAuth, reviewRouter)
//
// Two read-only aggregation endpoints that span every module:
//   GET /api/review/weekly?from=&to=  — what was accomplished this week
//   GET /api/review/annual?year=      — the yearly "Polymath Report"
//
// Each runs a fan-out of independent COUNT/SUM queries in parallel (Promise.all),
// then coerces the string aggregates to numbers for a clean client payload.
// NOTE: todos use status 'done' (not 'completed') per the todos enum; finance sums
// treat 'Revenue' alongside 'Income' (mirrors finance.model conventions).

import { Router } from 'express';
import pool from '../lib/db.js';

const router = Router();

// Default weekly range: last 7 days through today (YYYY-MM-DD).
function defaultWeek() {
  const to = new Date().toISOString().split('T')[0];
  const from = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  return { from, to };
}

// ─── GET /api/review/weekly ───────────────────────────────────────────────────
router.get('/weekly', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const def = defaultWeek();
    const weekStart = typeof req.query.from === 'string' ? req.query.from : def.from;
    const weekEnd   = typeof req.query.to === 'string' ? req.query.to : def.to;

    const [todos, transactions, research, learning, books, time, issues] = await Promise.all([
      // Tasks completed this week (todos use 'done', not 'completed').
      pool.query(
        `SELECT COUNT(*) AS completed FROM todos
           WHERE user_id = $1 AND status = 'done' AND updated_at::date BETWEEN $2 AND $3`,
        [userId, weekStart, weekEnd]
      ),
      // Financial flow this week.
      pool.query(
        `SELECT
           COALESCE(SUM(amount) FILTER (WHERE type IN ('Income', 'Revenue')), 0) AS income,
           COALESCE(SUM(amount) FILTER (WHERE type = 'Expense'), 0)              AS expense
         FROM transactions WHERE user_id = $1 AND date BETWEEN $2 AND $3`,
        [userId, weekStart, weekEnd]
      ),
      // Research entries created.
      pool.query(
        `SELECT COUNT(*) AS created FROM research_entries
           WHERE user_id = $1 AND created_at::date BETWEEN $2 AND $3`,
        [userId, weekStart, weekEnd]
      ),
      // Learning items touched + hours.
      pool.query(
        `SELECT COUNT(*) AS in_progress, COALESCE(SUM(spent_hours), 0) AS hours_spent
         FROM learning_items WHERE user_id = $1 AND updated_at::date BETWEEN $2 AND $3`,
        [userId, weekStart, weekEnd]
      ),
      // Books finished.
      pool.query(
        `SELECT COUNT(*) AS finished FROM books
           WHERE user_id = $1 AND shelf = 'finished' AND finished_at::date BETWEEN $2 AND $3`,
        [userId, weekStart, weekEnd]
      ),
      // Time logged (completed sessions only).
      pool.query(
        `SELECT COALESCE(SUM(duration_seconds), 0) AS total_seconds, COUNT(*) AS sessions
         FROM time_entries
           WHERE user_id = $1 AND ended_at IS NOT NULL AND started_at::date BETWEEN $2 AND $3`,
        [userId, weekStart, weekEnd]
      ),
      // Issues resolved.
      pool.query(
        `SELECT COUNT(*) AS resolved FROM engineer_issues
           WHERE user_id = $1 AND status = 'resolved' AND updated_at::date BETWEEN $2 AND $3`,
        [userId, weekStart, weekEnd]
      ),
    ]);

    const income  = parseFloat(transactions.rows[0].income);
    const expense = parseFloat(transactions.rows[0].expense);
    const totalHours = Math.round((parseFloat(time.rows[0].total_seconds) / 3600) * 10) / 10;

    res.json({
      success: true,
      data: {
        period:   { from: weekStart, to: weekEnd },
        tasks:    { completed: parseInt(todos.rows[0].completed, 10) },
        finance:  { income, expense, net: income - expense },
        research: { entries_created: parseInt(research.rows[0].created, 10) },
        learning: {
          in_progress: parseInt(learning.rows[0].in_progress, 10),
          hours_spent: parseFloat(learning.rows[0].hours_spent),
        },
        reading:     { books_finished: parseInt(books.rows[0].finished, 10) },
        time:        { total_hours: totalHours, sessions: parseInt(time.rows[0].sessions, 10) },
        engineering: { issues_resolved: parseInt(issues.rows[0].resolved, 10) },
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/review/annual?year= ────────────────────────────────────────────
router.get('/annual', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const start = `${year}-01-01`;
    const end   = `${year}-12-31`;

    const [todos, research, books, time, learning, projects, finance, goalsAchieved] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) AS completed FROM todos
           WHERE user_id = $1 AND status = 'done' AND updated_at::date BETWEEN $2 AND $3`,
        [userId, start, end]
      ),
      pool.query(
        `SELECT COUNT(*) AS created,
           COUNT(*) FILTER (WHERE type = 'journal')  AS journals,
           COUNT(*) FILTER (WHERE type = 'citation') AS citations
         FROM research_entries WHERE user_id = $1 AND created_at::date BETWEEN $2 AND $3`,
        [userId, start, end]
      ),
      pool.query(
        `SELECT COUNT(*) AS finished,
           COALESCE(SUM(total_pages), 0) AS pages_read,
           COALESCE(AVG(rating) FILTER (WHERE rating IS NOT NULL), 0) AS avg_rating
         FROM books
           WHERE user_id = $1 AND shelf = 'finished' AND finished_at::date BETWEEN $2 AND $3`,
        [userId, start, end]
      ),
      pool.query(
        `SELECT COALESCE(SUM(duration_seconds), 0) AS total_seconds, COUNT(*) AS sessions
         FROM time_entries
           WHERE user_id = $1 AND ended_at IS NOT NULL AND started_at::date BETWEEN $2 AND $3`,
        [userId, start, end]
      ),
      // Learning is lifetime (no created/completed date filter mirrors V5 spec intent).
      pool.query(
        `SELECT COUNT(*) FILTER (WHERE status = 'completed') AS completed,
           COALESCE(SUM(spent_hours), 0) AS hours
         FROM learning_items WHERE user_id = $1`,
        [userId]
      ),
      pool.query(
        `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'deployed') AS deployed
         FROM engineer_projects WHERE user_id = $1 AND created_at::date BETWEEN $2 AND $3`,
        [userId, start, end]
      ),
      pool.query(
        `SELECT
           COALESCE(SUM(amount) FILTER (WHERE type IN ('Income','Revenue')), 0) AS income,
           COALESCE(SUM(amount) FILTER (WHERE type = 'Expense'), 0)             AS expense
         FROM transactions WHERE user_id = $1 AND date BETWEEN $2 AND $3`,
        [userId, start, end]
      ),
      // Goals marked completed this year.
      pool.query(
        `SELECT COUNT(*) AS achieved FROM goals
           WHERE user_id = $1 AND status = 'completed' AND completed_at::date BETWEEN $2 AND $3`,
        [userId, start, end]
      ),
    ]);

    const income  = parseFloat(finance.rows[0].income);
    const expense = parseFloat(finance.rows[0].expense);
    const totalHours = Math.round((parseFloat(time.rows[0].total_seconds) / 3600) * 10) / 10;

    res.json({
      success: true,
      data: {
        year,
        tasks: { completed: parseInt(todos.rows[0].completed, 10) },
        research: {
          total:     parseInt(research.rows[0].created, 10),
          journals:  parseInt(research.rows[0].journals, 10),
          citations: parseInt(research.rows[0].citations, 10),
        },
        reading: {
          books_finished: parseInt(books.rows[0].finished, 10),
          pages_read:     parseInt(books.rows[0].pages_read, 10) || 0,
          avg_rating:     Math.round((parseFloat(books.rows[0].avg_rating) || 0) * 10) / 10,
        },
        learning: {
          completed: parseInt(learning.rows[0].completed, 10),
          hours:     parseFloat(learning.rows[0].hours) || 0,
        },
        engineering: {
          total_projects: parseInt(projects.rows[0].total, 10),
          deployed:       parseInt(projects.rows[0].deployed, 10),
        },
        time:    { total_hours: totalHours, sessions: parseInt(time.rows[0].sessions, 10) },
        finance: { income, expense, net: income - expense },
        goals:   { achieved: parseInt(goalsAchieved.rows[0].achieved, 10) },
      },
    });
  } catch (err) {
    next(err);
  }
});

export { router as reviewRouter };
export default router;
