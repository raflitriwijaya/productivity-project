// server/models/time.model.js
// Time Tracking (Roadmap Wave 5). All queries scoped to user_id — never expose
// cross-user rows. Follows the (userId, …) argument order used across the codebase;
// the route layer calls these with req.user.id first.
//
// Design: only ONE timer may run at a time per user (ended_at IS NULL). startTimer
// stops any running timer first. duration_seconds is computed server-side on stop so
// the client clock is never trusted. Time entries couple to exactly one entity via
// entity_type/entity_id (NOT entity_links) — see Wave 5 risk notes.

import pool from '../lib/db.js';

/**
 * Start a timer for an entity. Stops any previously running timer first so only
 * one timer is ever active per user.
 * @param {number} userId
 * @param {{ entityType: string, entityId: number, note?: string|null }} data
 * @returns {Promise<object>} the new running entry
 */
export async function startTimer(userId, { entityType, entityId, note }) {
  await stopRunningTimer(userId);

  const { rows } = await pool.query(
    `INSERT INTO time_entries (user_id, entity_type, entity_id, started_at, note)
     VALUES ($1, $2, $3, NOW(), $4)
     RETURNING *`,
    [userId, entityType, entityId, note ?? null]
  );
  return rows[0];
}

/**
 * Stop the currently running timer. duration_seconds is computed from NOW() so the
 * elapsed time is authoritative on the server.
 * @param {number} userId
 * @returns {Promise<object|null>} the stopped entry, or null if none was running
 */
export async function stopRunningTimer(userId) {
  const { rows } = await pool.query(
    `UPDATE time_entries
       SET ended_at = NOW(),
           duration_seconds = GREATEST(1, ROUND(EXTRACT(EPOCH FROM (NOW() - started_at))))
     WHERE user_id = $1 AND ended_at IS NULL
     RETURNING *`,
    [userId]
  );
  return rows[0] ?? null;
}

/**
 * Get the currently running timer, if any.
 * @param {number} userId
 * @returns {Promise<object|null>}
 */
export async function getRunningTimer(userId) {
  const { rows } = await pool.query(
    `SELECT * FROM time_entries WHERE user_id = $1 AND ended_at IS NULL LIMIT 1`,
    [userId]
  );
  return rows[0] ?? null;
}

/**
 * Get a single time entry by ID, scoped to the user. Used by the links ownership
 * validator (Wave 1) so a link to a time_entry can be verified.
 * @param {number} userId
 * @param {number} entryId
 * @returns {Promise<object|null>}
 */
export async function getTimeEntryById(userId, entryId) {
  const { rows } = await pool.query(
    `SELECT * FROM time_entries WHERE id = $1 AND user_id = $2`,
    [entryId, userId]
  );
  return rows[0] ?? null;
}

/**
 * List time entries with optional filters and pagination.
 * @param {number} userId
 * @param {{ entityType?: string, entityId?: number, from?: string, to?: string, page?: number, per_page?: number }} opts
 * @returns {Promise<{ data: object[], meta: { total: number, page: number, per_page: number } }>}
 */
export async function listTimeEntries(userId, opts = {}) {
  const { entityType, entityId, from, to, page = 1, per_page = 20 } = opts;

  let where = 'WHERE user_id = $1';
  const params = [userId];
  let p = 2;

  if (entityType) { where += ` AND entity_type = $${p++}`; params.push(entityType); }
  if (entityId)   { where += ` AND entity_id = $${p++}`;   params.push(entityId); }
  if (from)       { where += ` AND started_at >= $${p++}`; params.push(from); }
  if (to)         { where += ` AND started_at <= $${p++}`; params.push(to); }

  const offset = (page - 1) * per_page;

  const [dataRes, countRes] = await Promise.all([
    pool.query(
      `SELECT * FROM time_entries ${where} ORDER BY started_at DESC LIMIT $${p} OFFSET $${p + 1}`,
      [...params, per_page, offset]
    ),
    pool.query(`SELECT COUNT(*) FROM time_entries ${where}`, params),
  ]);

  return {
    data: dataRes.rows,
    meta: { total: parseInt(countRes.rows[0].count, 10), page, per_page },
  };
}

/**
 * Delete a time entry, scoped to the user.
 * @param {number} userId
 * @param {number} entryId
 * @returns {Promise<object|null>} the deleted row, or null if not found / not owned
 */
export async function deleteTimeEntry(userId, entryId) {
  const { rows } = await pool.query(
    `DELETE FROM time_entries WHERE id = $1 AND user_id = $2 RETURNING *`,
    [entryId, userId]
  );
  return rows[0] ?? null;
}

/**
 * Get time summary for a date range, grouped by entity type. Only completed
 * sessions contribute duration; active timers are reported separately so the UI
 * can flag in-progress work. Raw aggregates come back as strings — coerce to numbers.
 * @param {number} userId
 * @param {string} from  inclusive date (YYYY-MM-DD)
 * @param {string} to    inclusive date (YYYY-MM-DD)
 * @returns {Promise<Array<{ entity_type: string, session_count: number, total_seconds: number, active_timers: number }>>}
 */
export async function getTimeSummary(userId, from, to) {
  const { rows } = await pool.query(
    `SELECT
       entity_type,
       COUNT(*)                                   AS session_count,
       COALESCE(SUM(duration_seconds), 0)         AS total_seconds,
       COUNT(*) FILTER (WHERE ended_at IS NULL)   AS active_timers
     FROM time_entries
     WHERE user_id = $1 AND started_at::date BETWEEN $2 AND $3
     GROUP BY entity_type
     ORDER BY total_seconds DESC`,
    [userId, from, to]
  );
  return rows.map(r => ({
    entity_type:   r.entity_type,
    session_count: parseInt(r.session_count, 10),
    total_seconds: parseInt(r.total_seconds, 10),
    active_timers: parseInt(r.active_timers, 10),
  }));
}

/**
 * Get total hours logged today (completed sessions only), rounded to one decimal.
 * @param {number} userId
 * @returns {Promise<number>}
 */
export async function getTodayHours(userId) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(duration_seconds), 0) AS total_seconds
     FROM time_entries
     WHERE user_id = $1 AND started_at::date = CURRENT_DATE AND ended_at IS NOT NULL`,
    [userId]
  );
  return Math.round((parseFloat(rows[0].total_seconds) / 3600) * 10) / 10;
}
