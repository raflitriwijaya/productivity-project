// server/models/ideas.model.js
// Ideas Tracker (Roadmap Wave 4). All queries are scoped to user_id — never expose
// cross-user rows. Mirrors reading.model.js / contacts.model.js conventions: the
// (userId, …) argument order; the route layer calls these with req.user.id first.

import pool from '../lib/db.js';

const ALLOWED_SORT = ['created_at', 'updated_at', 'title', 'status'];

/**
 * List ideas for the user, with optional status filter and text search.
 * @param {number} userId
 * @param {{ status?: string, sort?: string, order?: string, page?: number, per_page?: number, search?: string }} opts
 * @returns {Promise<{ data: object[], meta: { total: number, page: number, per_page: number } }>}
 */
export async function listIdeas(userId, opts = {}) {
  const { status, sort = 'created_at', order = 'desc', page = 1, per_page = 20, search } = opts;

  const sortCol   = ALLOWED_SORT.includes(sort) ? sort : 'created_at';
  const sortOrder = order === 'asc' ? 'asc' : 'desc';

  let where = 'WHERE user_id = $1';
  const params = [userId];
  let p = 2;

  if (status) { where += ` AND status = $${p++}`; params.push(status); }
  if (search?.trim()) {
    where += ` AND (title ILIKE $${p} OR description ILIKE $${p} OR tags ILIKE $${p})`;
    params.push(`%${search.trim()}%`);
    p++;
  }

  const offset = (page - 1) * per_page;

  const [dataRes, countRes] = await Promise.all([
    pool.query(
      `SELECT * FROM ideas ${where} ORDER BY ${sortCol} ${sortOrder} LIMIT $${p} OFFSET $${p + 1}`,
      [...params, per_page, offset]
    ),
    pool.query(`SELECT COUNT(*) FROM ideas ${where}`, params),
  ]);

  return {
    data: dataRes.rows,
    meta: { total: parseInt(countRes.rows[0].count, 10), page, per_page },
  };
}

/**
 * Get a single idea by ID, scoped to the user.
 * @param {number} userId
 * @param {number} ideaId
 * @returns {Promise<object|null>}
 */
export async function getIdeaById(userId, ideaId) {
  const { rows } = await pool.query(
    'SELECT * FROM ideas WHERE id = $1 AND user_id = $2',
    [ideaId, userId]
  );
  return rows[0] ?? null;
}

/**
 * Create an idea.
 * @param {number} userId
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function createIdea(userId, data) {
  const { title, description, status = 'new', tags, source } = data;
  const { rows } = await pool.query(
    `INSERT INTO ideas (user_id, title, description, status, tags, source)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [userId, title, description ?? null, status, tags ?? null, source ?? null]
  );
  return rows[0];
}

/**
 * Partial update — only the fields present in `data` are written.
 * @param {number} userId
 * @param {number} ideaId
 * @param {object} data
 * @returns {Promise<object|null>}
 */
export async function updateIdea(userId, ideaId, data) {
  const existing = await getIdeaById(userId, ideaId);
  if (!existing) return null;

  const fields = [];
  const params = [userId, ideaId];
  let p = 3;

  const UPDATABLE = ['title', 'description', 'status', 'tags', 'source', 'converted_to', 'converted_id'];
  for (const f of UPDATABLE) {
    if (data[f] !== undefined) {
      fields.push(`${f} = $${p++}`);
      params.push(data[f]);
    }
  }

  if (fields.length === 0) return existing; // nothing to change

  const { rows } = await pool.query(
    `UPDATE ideas SET ${fields.join(', ')} WHERE id = $2 AND user_id = $1 RETURNING *`,
    params
  );
  return rows[0] ?? null;
}

/**
 * Delete an idea, scoped to the user.
 * @param {number} userId
 * @param {number} ideaId
 * @returns {Promise<object|null>} the deleted row, or null if not found / not owned
 */
export async function deleteIdea(userId, ideaId) {
  const { rows } = await pool.query(
    'DELETE FROM ideas WHERE id = $1 AND user_id = $2 RETURNING *',
    [ideaId, userId]
  );
  return rows[0] ?? null;
}

/**
 * Aggregate idea statistics for the summary cards. Raw pg aggregates come back as
 * strings; coerce to numbers so the client renders cleanly (mirrors getContactStats).
 * @param {number} userId
 * @returns {Promise<{ total: number, new: number, developing: number, validated: number, archived: number, converted: number }>}
 */
export async function getIdeaStats(userId) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*)                                    AS total,
       COUNT(*) FILTER (WHERE status = 'new')        AS new,
       COUNT(*) FILTER (WHERE status = 'developing') AS developing,
       COUNT(*) FILTER (WHERE status = 'validated')  AS validated,
       COUNT(*) FILTER (WHERE status = 'archived')   AS archived,
       COUNT(*) FILTER (WHERE status = 'converted')  AS converted
     FROM ideas WHERE user_id = $1`,
    [userId]
  );
  const row = rows[0];
  return {
    total:      parseInt(row.total, 10),
    new:        parseInt(row.new, 10),
    developing: parseInt(row.developing, 10),
    validated:  parseInt(row.validated, 10),
    archived:   parseInt(row.archived, 10),
    converted:  parseInt(row.converted, 10),
  };
}
