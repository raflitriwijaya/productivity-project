// server/models/goals.model.js
// Goals/OKRs System (Roadmap Wave 5). All queries scoped to user_id. Follows the
// (userId, …) argument order used across the codebase.
//
// Auto-progression: current_value is derived from entities linked to the goal via
// entity_links (Wave 1). recalcGoalProgress counts "completed" linked entities per
// type (finished books, deployed projects, done todos, completed learning items,
// created research entries) and adds summed hours from any linked time entries.
// Progress is recomputed on demand (goal create/update/detail view) — NOT via DB
// triggers, see Wave 5 risk notes.

import pool from '../lib/db.js';

const ALLOWED_SORT = ['created_at', 'updated_at', 'title', 'priority', 'target_date', 'status'];

const UPDATABLE = [
  'title', 'description', 'goal_type', 'target_value', 'current_value', 'unit',
  'category', 'status', 'priority', 'start_date', 'target_date', 'completed_at',
];

/**
 * List goals for the user, with optional status/priority filters.
 * @param {number} userId
 * @param {{ status?: string, priority?: string, sort?: string, order?: string, page?: number, per_page?: number }} opts
 * @returns {Promise<{ data: object[], meta: { total: number, page: number, per_page: number } }>}
 */
export async function listGoals(userId, opts = {}) {
  const { status, priority, sort = 'created_at', order = 'desc', page = 1, per_page = 50 } = opts;

  const sortCol   = ALLOWED_SORT.includes(sort) ? sort : 'created_at';
  const sortOrder = order === 'asc' ? 'asc' : 'desc';

  let where = 'WHERE user_id = $1';
  const params = [userId];
  let p = 2;

  if (status)   { where += ` AND status = $${p++}`;   params.push(status); }
  if (priority) { where += ` AND priority = $${p++}`; params.push(priority); }

  const offset = (page - 1) * per_page;

  const [dataRes, countRes] = await Promise.all([
    pool.query(
      `SELECT * FROM goals ${where} ORDER BY ${sortCol} ${sortOrder} LIMIT $${p} OFFSET $${p + 1}`,
      [...params, per_page, offset]
    ),
    pool.query(`SELECT COUNT(*) FROM goals ${where}`, params),
  ]);

  return {
    data: dataRes.rows,
    meta: { total: parseInt(countRes.rows[0].count, 10), page, per_page },
  };
}

/**
 * Get a single goal by ID, scoped to the user.
 * @param {number} userId
 * @param {number} goalId
 * @returns {Promise<object|null>}
 */
export async function getGoalById(userId, goalId) {
  const { rows } = await pool.query(
    'SELECT * FROM goals WHERE id = $1 AND user_id = $2',
    [goalId, userId]
  );
  return rows[0] ?? null;
}

/**
 * Create a goal.
 * @param {number} userId
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function createGoal(userId, data) {
  const {
    title, description, goal_type = 'target', target_value, current_value = 0,
    unit, category, status = 'active', priority = 'medium', start_date, target_date,
  } = data;

  const { rows } = await pool.query(
    `INSERT INTO goals
       (user_id, title, description, goal_type, target_value, current_value,
        unit, category, status, priority, start_date, target_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      userId, title, description ?? null, goal_type, target_value ?? null, current_value ?? 0,
      unit ?? null, category ?? null, status, priority, start_date ?? null, target_date ?? null,
    ]
  );
  return rows[0];
}

/**
 * Partial update — only the fields present in `data` are written. When status is
 * set to 'completed' and completed_at is not provided, it is stamped to NOW().
 * @param {number} userId
 * @param {number} goalId
 * @param {object} data
 * @returns {Promise<object|null>}
 */
export async function updateGoal(userId, goalId, data) {
  const existing = await getGoalById(userId, goalId);
  if (!existing) return null;

  const fields = [];
  const params = [userId, goalId];
  let p = 3;

  for (const f of UPDATABLE) {
    if (data[f] !== undefined) {
      fields.push(`${f} = $${p++}`);
      params.push(data[f]);
    }
  }

  // Auto-stamp completed_at when transitioning to 'completed' without an explicit value.
  if (data.status === 'completed' && data.completed_at === undefined && existing.status !== 'completed') {
    fields.push(`completed_at = NOW()`);
  }
  // Clear completed_at if moving back out of 'completed'.
  if (data.status !== undefined && data.status !== 'completed' && existing.completed_at) {
    fields.push(`completed_at = NULL`);
  }

  if (fields.length === 0) return existing;

  const { rows } = await pool.query(
    `UPDATE goals SET ${fields.join(', ')} WHERE id = $2 AND user_id = $1 RETURNING *`,
    params
  );
  return rows[0] ?? null;
}

/**
 * Delete a goal, scoped to the user.
 * @param {number} userId
 * @param {number} goalId
 * @returns {Promise<object|null>}
 */
export async function deleteGoal(userId, goalId) {
  const { rows } = await pool.query(
    'DELETE FROM goals WHERE id = $1 AND user_id = $2 RETURNING *',
    [goalId, userId]
  );
  return rows[0] ?? null;
}

/**
 * Aggregate goal statistics for the summary cards. "On track" = active goals whose
 * progress ratio (current/target) is at or above the elapsed-time ratio between
 * start_date and target_date (or simply >0 progress when dates are absent).
 * @param {number} userId
 * @returns {Promise<{ total: number, active: number, completed: number, paused: number, abandoned: number, critical: number, on_track: number }>}
 */
export async function getGoalStats(userId) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*)                                                          AS total,
       COUNT(*) FILTER (WHERE status = 'active')                         AS active,
       COUNT(*) FILTER (WHERE status = 'completed')                      AS completed,
       COUNT(*) FILTER (WHERE status = 'paused')                         AS paused,
       COUNT(*) FILTER (WHERE status = 'abandoned')                      AS abandoned,
       COUNT(*) FILTER (WHERE status = 'active' AND priority = 'critical') AS critical,
       COUNT(*) FILTER (
         WHERE status = 'active'
           AND target_value IS NOT NULL AND target_value > 0
           AND current_value >= target_value * COALESCE(
             CASE
               WHEN target_date IS NOT NULL AND start_date IS NOT NULL AND target_date > start_date
               THEN LEAST(1, GREATEST(0,
                 (NOW()::date - start_date)::float /
                 NULLIF((target_date - start_date), 0)))
               ELSE 0
             END, 0)
       ) AS on_track
     FROM goals WHERE user_id = $1`,
    [userId]
  );
  const r = rows[0];
  return {
    total:     parseInt(r.total, 10),
    active:    parseInt(r.active, 10),
    completed: parseInt(r.completed, 10),
    paused:    parseInt(r.paused, 10),
    abandoned: parseInt(r.abandoned, 10),
    critical:  parseInt(r.critical, 10),
    on_track:  parseInt(r.on_track, 10),
  };
}

/**
 * Recalculate a goal's current_value from the entities linked to it (entity_links,
 * either direction). Counts "completed" linked entities per type and adds summed
 * hours from linked time entries. Persists and returns the updated goal. No-op
 * (returns the goal unchanged) when nothing is linked.
 *
 * Completion semantics per type:
 *   book             → shelf = 'finished'
 *   engineer_project → status = 'deployed'
 *   todo             → status = 'done'
 *   learning_item    → status = 'completed'
 *   research_entry   → counted as created (any)
 *   time_entry       → summed duration in whole hours
 *
 * @param {number} userId
 * @param {number} goalId
 * @returns {Promise<object|null>} the updated goal, or null if not found / not owned
 */
export async function recalcGoalProgress(userId, goalId) {
  const goal = await getGoalById(userId, goalId);
  if (!goal) return null;

  // Collect linked entity ids grouped by type (goal on either side of the link).
  const { rows: links } = await pool.query(
    `SELECT to_type AS t, to_id AS id FROM entity_links
       WHERE user_id = $1 AND from_type = 'goal' AND from_id = $2
     UNION ALL
     SELECT from_type AS t, from_id AS id FROM entity_links
       WHERE user_id = $1 AND to_type = 'goal' AND to_id = $2`,
    [userId, goalId]
  );

  if (links.length === 0) return goal; // nothing linked — leave current_value as-is

  const idsByType = {};
  for (const { t, id } of links) (idsByType[t] ??= []).push(id);

  // Per-type completion query. Each returns a single numeric `n`.
  const COUNTERS = {
    book:             (ids) => [`SELECT COUNT(*)::numeric AS n FROM books WHERE user_id = $1 AND shelf = 'finished' AND id = ANY($2::int[])`, ids],
    engineer_project: (ids) => [`SELECT COUNT(*)::numeric AS n FROM engineer_projects WHERE user_id = $1 AND status = 'deployed' AND id = ANY($2::int[])`, ids],
    todo:             (ids) => [`SELECT COUNT(*)::numeric AS n FROM todos WHERE user_id = $1 AND status = 'done' AND id = ANY($2::int[])`, ids],
    learning_item:    (ids) => [`SELECT COUNT(*)::numeric AS n FROM learning_items WHERE user_id = $1 AND status = 'completed' AND id = ANY($2::int[])`, ids],
    research_entry:   (ids) => [`SELECT COUNT(*)::numeric AS n FROM research_entries WHERE user_id = $1 AND id = ANY($2::int[])`, ids],
    time_entry:       (ids) => [`SELECT COALESCE(SUM(duration_seconds), 0) / 3600.0 AS n FROM time_entries WHERE user_id = $1 AND ended_at IS NOT NULL AND id = ANY($2::int[])`, ids],
  };

  let total = 0;
  for (const [type, ids] of Object.entries(idsByType)) {
    const build = COUNTERS[type];
    if (!build) continue; // unsupported linked type contributes nothing
    const [sql, idArr] = build(ids);
    const { rows } = await pool.query(sql, [userId, idArr]);
    total += parseFloat(rows[0].n);
  }

  // Round time-derived fractions to one decimal; counts stay integral.
  const current = Math.round(total * 10) / 10;

  const { rows } = await pool.query(
    `UPDATE goals SET current_value = $3 WHERE id = $2 AND user_id = $1 RETURNING *`,
    [userId, goalId, current]
  );
  return rows[0] ?? goal;
}
