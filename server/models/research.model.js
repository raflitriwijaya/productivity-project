// server/models/research.model.js
// All DB interactions for the research_entries table.
// Uses snake_case keys throughout (§6.0 wire format convention).

import pool from '../lib/db.js';

/**
 * @typedef {Object} ResearchEntry
 * @param {number} id
 * @param {number} user_id
 * @param {string} title
 * @param {'journal'|'citation'|'note'} type
 * @param {'draft'|'active'|'archived'} status
 * @param {string|null} content
 * @param {string|null} source
 * @param {string|null} tags
 * @param {string} created_at
 * @param {string} updated_at
 */

/**
 * List all research entries for a user with optional type filter and pagination.
 * @param {number} userId
 * @param {{ type?: string, status?: string, page?: number, per_page?: number, sort?: string, order?: string }} opts
 * @returns {Promise<{ rows: ResearchEntry[], total: number }>}
 */
export async function listResearchEntries(userId, opts = {}) {
  const {
    type,
    status,
    page = 1,
    per_page = 20,
    sort = 'created_at',
    order = 'desc',
  } = opts;

  const allowedSort = ['created_at', 'updated_at', 'title', 'type', 'status'];
  const safeSort = allowedSort.includes(sort) ? sort : 'created_at';
  const safeOrder = order === 'asc' ? 'ASC' : 'DESC';

  const conditions = ['user_id = $1'];
  const params = [userId];
  let paramIdx = 2;

  if (type) {
    conditions.push(`type = $${paramIdx++}`);
    params.push(type);
  }
  if (status) {
    conditions.push(`status = $${paramIdx++}`);
    params.push(status);
  }

  const where = conditions.join(' AND ');
  const offset = (page - 1) * per_page;

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM research_entries WHERE ${where}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const dataResult = await pool.query(
    `SELECT * FROM research_entries
     WHERE ${where}
     ORDER BY ${safeSort} ${safeOrder}
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, per_page, offset]
  );

  return { rows: dataResult.rows, total };
}

/**
 * Get a single research entry by id, scoped to the user.
 * @param {number} id
 * @param {number} userId
 * @returns {Promise<ResearchEntry|null>}
 */
export async function getResearchEntryById(id, userId) {
  const result = await pool.query(
    'SELECT * FROM research_entries WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return result.rows[0] ?? null;
}

/**
 * Create a new research entry.
 * @param {number} userId
 * @param {{ title: string, type: string, status: string, content?: string, source?: string, tags?: string }} data
 * @returns {Promise<ResearchEntry>}
 */
export async function createResearchEntry(userId, data) {
  const { title, type, status, content, source, tags } = data;
  const result = await pool.query(
    `INSERT INTO research_entries (user_id, title, type, status, content, source, tags)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [userId, title, type, status ?? 'draft', content ?? null, source ?? null, tags ?? null]
  );
  return result.rows[0];
}

/**
 * Partial update (PATCH) a research entry.
 * @param {number} id
 * @param {number} userId
 * @param {Partial<ResearchEntry>} patch
 * @returns {Promise<ResearchEntry|null>}
 */
export async function patchResearchEntry(id, userId, patch) {
  const allowed = ['title', 'type', 'status', 'content', 'source', 'tags'];
  const fields = Object.keys(patch).filter(k => allowed.includes(k));
  if (fields.length === 0) return getResearchEntryById(id, userId);

  const setClauses = fields.map((f, i) => `${f} = $${i + 3}`).join(', ');
  const values = fields.map(f => patch[f]);

  const result = await pool.query(
    `UPDATE research_entries
     SET ${setClauses}
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [id, userId, ...values]
  );
  return result.rows[0] ?? null;
}

/**
 * Delete a research entry.
 * @param {number} id
 * @param {number} userId
 * @returns {Promise<boolean>} true if a row was deleted
 */
export async function deleteResearchEntry(id, userId) {
  const result = await pool.query(
    'DELETE FROM research_entries WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return result.rowCount > 0;
}

/**
 * Summary stats: counts per type and total.
 * @param {number} userId
 * @returns {Promise<{ total: number, journal: number, citation: number, note: number }>}
 */
export async function getResearchStats(userId) {
  const result = await pool.query(
    `SELECT
       COUNT(*)                                      AS total,
       COUNT(*) FILTER (WHERE type = 'journal')     AS journal,
       COUNT(*) FILTER (WHERE type = 'citation')    AS citation,
       COUNT(*) FILTER (WHERE type = 'note')        AS note
     FROM research_entries
     WHERE user_id = $1`,
    [userId]
  );
  const row = result.rows[0];
  return {
    total:    parseInt(row.total,    10),
    journal:  parseInt(row.journal,  10),
    citation: parseInt(row.citation, 10),
    note:     parseInt(row.note,     10),
  };
}
