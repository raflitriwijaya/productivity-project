// server/models/learning.model.js
// All queries are scoped to user_id — never expose cross-user rows.

import pool from '../lib/db.js';

/**
 * @param {number} userId
 * @param {{ status?: string, sort?: string, order?: string, page?: number, perPage?: number }} opts
 * @returns {Promise<{ rows: object[], total: number }>}
 */
export async function listLearningItems(userId, { status, sort = 'created_at', order = 'desc', page = 1, perPage = 20 } = {}) {
  const ALLOWED_SORT  = ['created_at', 'updated_at', 'title', 'priority', 'progress', 'status', 'type'];
  const ALLOWED_ORDER = ['asc', 'desc'];
  const safeSort  = ALLOWED_SORT.includes(sort)   ? sort  : 'created_at';
  const safeOrder = ALLOWED_ORDER.includes(order) ? order : 'desc';

  const conditions = ['user_id = $1'];
  const values     = [userId];
  let   idx        = 2;

  if (status) {
    conditions.push(`status = $${idx++}`);
    values.push(status);
  }

  const where  = conditions.join(' AND ');
  const offset = (page - 1) * perPage;

  const [dataRes, countRes] = await Promise.all([
    pool.query(
      `SELECT * FROM learning_items
       WHERE ${where}
       ORDER BY ${safeSort} ${safeOrder}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, perPage, offset]
    ),
    pool.query(`SELECT COUNT(*) FROM learning_items WHERE ${where}`, values),
  ]);

  return { rows: dataRes.rows, total: parseInt(countRes.rows[0].count, 10) };
}

/**
 * @param {number} id
 * @param {number} userId
 * @returns {Promise<object|null>}
 */
export async function getLearningItemById(id, userId) {
  const res = await pool.query(
    'SELECT * FROM learning_items WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return res.rows[0] ?? null;
}

/**
 * @param {number} userId
 * @param {object} fields
 * @returns {Promise<object>}
 */
export async function createLearningItem(userId, fields) {
  const {
    title, type, source, status, priority, progress,
    total_hours, spent_hours, started_at, completed_at, notes, url,
  } = fields;

  const res = await pool.query(
    `INSERT INTO learning_items
       (user_id, title, type, source, status, priority, progress,
        total_hours, spent_hours, started_at, completed_at, notes, url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [userId, title, type, source ?? null, status, priority, progress ?? 0,
     total_hours ?? null, spent_hours ?? null, started_at ?? null,
     completed_at ?? null, notes ?? null, url ?? null]
  );
  return res.rows[0];
}

/**
 * Partial update — only the keys present in `fields` are written.
 * @param {number} id
 * @param {number} userId
 * @param {object} fields
 * @returns {Promise<object|null>}
 */
export async function patchLearningItem(id, userId, fields) {
  const PATCHABLE = [
    'title', 'type', 'source', 'status', 'priority', 'progress',
    'total_hours', 'spent_hours', 'started_at', 'completed_at', 'notes', 'url',
  ];

  const keys   = Object.keys(fields).filter(k => PATCHABLE.includes(k));
  if (keys.length === 0) return getLearningItemById(id, userId);

  const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const values     = [...keys.map(k => fields[k]), id, userId];

  const res = await pool.query(
    `UPDATE learning_items
     SET ${setClauses}
     WHERE id = $${keys.length + 1} AND user_id = $${keys.length + 2}
     RETURNING *`,
    values
  );
  return res.rows[0] ?? null;
}

/**
 * @param {number} id
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
export async function deleteLearningItem(id, userId) {
  const res = await pool.query(
    'DELETE FROM learning_items WHERE id = $1 AND user_id = $2 RETURNING id',
    [id, userId]
  );
  return res.rowCount > 0;
}

/**
 * Aggregate stats for the summary stat cards.
 * @param {number} userId
 * @returns {Promise<{ total: number, in_progress: number, completed: number, total_spent_hours: number }>}
 */
export async function getLearningStats(userId) {
  const res = await pool.query(
    `SELECT
       COUNT(*)                                          AS total,
       COUNT(*) FILTER (WHERE status = 'in_progress')   AS in_progress,
       COUNT(*) FILTER (WHERE status = 'completed')     AS completed,
       COALESCE(SUM(spent_hours), 0)                    AS total_spent_hours
     FROM learning_items
     WHERE user_id = $1`,
    [userId]
  );
  const row = res.rows[0];
  return {
    total:             parseInt(row.total, 10),
    in_progress:       parseInt(row.in_progress, 10),
    completed:         parseInt(row.completed, 10),
    total_spent_hours: parseFloat(row.total_spent_hours),
  };
}

/**
 * Active-learning stats for the Today Dashboard briefing (Roadmap Wave 2).
 * Scopes to in-progress items only and sums their logged vs. target hours.
 * @param {number} userId
 * @returns {Promise<{ active_count: number, total_spent_hours: number, total_target_hours: number }>}
 */
export async function getActiveLearningStats(userId) {
  const res = await pool.query(
    `SELECT
       COUNT(*)                      AS active_count,
       COALESCE(SUM(spent_hours), 0) AS total_spent_hours,
       COALESCE(SUM(total_hours), 0) AS total_target_hours
     FROM learning_items
     WHERE user_id = $1 AND status = 'in_progress'`,
    [userId]
  );
  const row = res.rows[0];
  return {
    active_count:       parseInt(row.active_count, 10),
    total_spent_hours:  parseFloat(row.total_spent_hours),
    total_target_hours: parseFloat(row.total_target_hours),
  };
}
