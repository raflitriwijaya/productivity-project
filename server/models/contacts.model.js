// server/models/contacts.model.js
// Contacts CRM (Roadmap Wave 4). All queries are scoped to user_id — never expose
// cross-user rows. Mirrors reading.model.js conventions: (userId, …) argument order,
// the route layer calls these with req.user.id first.

import pool from '../lib/db.js';

const ALLOWED_SORT = ['created_at', 'updated_at', 'name', 'company', 'last_contacted'];

/**
 * List contacts for the user, with optional type/status filters and text search.
 * @param {number} userId
 * @param {{ type?: string, status?: string, sort?: string, order?: string, page?: number, per_page?: number, search?: string }} opts
 * @returns {Promise<{ data: object[], meta: { total: number, page: number, per_page: number } }>}
 */
export async function listContacts(userId, opts = {}) {
  const { type, status, sort = 'created_at', order = 'desc', page = 1, per_page = 20, search } = opts;

  const sortCol   = ALLOWED_SORT.includes(sort) ? sort : 'created_at';
  const sortOrder = order === 'asc' ? 'asc' : 'desc';

  let where = 'WHERE user_id = $1';
  const params = [userId];
  let p = 2;

  if (type)   { where += ` AND type = $${p++}`;   params.push(type); }
  if (status) { where += ` AND status = $${p++}`; params.push(status); }
  if (search?.trim()) {
    where += ` AND (name ILIKE $${p} OR company ILIKE $${p} OR email ILIKE $${p})`;
    params.push(`%${search.trim()}%`);
    p++;
  }

  const offset = (page - 1) * per_page;

  const [dataRes, countRes] = await Promise.all([
    pool.query(
      `SELECT * FROM contacts ${where} ORDER BY ${sortCol} ${sortOrder} NULLS LAST LIMIT $${p} OFFSET $${p + 1}`,
      [...params, per_page, offset]
    ),
    pool.query(`SELECT COUNT(*) FROM contacts ${where}`, params),
  ]);

  return {
    data: dataRes.rows,
    meta: { total: parseInt(countRes.rows[0].count, 10), page, per_page },
  };
}

/**
 * Get a single contact by ID, scoped to the user.
 * @param {number} userId
 * @param {number} contactId
 * @returns {Promise<object|null>}
 */
export async function getContactById(userId, contactId) {
  const { rows } = await pool.query(
    'SELECT * FROM contacts WHERE id = $1 AND user_id = $2',
    [contactId, userId]
  );
  return rows[0] ?? null;
}

/**
 * Create a contact.
 * @param {number} userId
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function createContact(userId, data) {
  const { name, email, phone, company, role, type = 'client', status = 'active', notes } = data;
  const { rows } = await pool.query(
    `INSERT INTO contacts (user_id, name, email, phone, company, role, type, status, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [userId, name, email ?? null, phone ?? null, company ?? null, role ?? null, type, status, notes ?? null]
  );
  return rows[0];
}

/**
 * Partial update — only the fields present in `data` are written.
 * @param {number} userId
 * @param {number} contactId
 * @param {object} data
 * @returns {Promise<object|null>}
 */
export async function updateContact(userId, contactId, data) {
  const existing = await getContactById(userId, contactId);
  if (!existing) return null;

  const fields = [];
  const params = [userId, contactId];
  let p = 3;

  const UPDATABLE = ['name', 'email', 'phone', 'company', 'role', 'type', 'status', 'notes', 'last_contacted'];
  for (const f of UPDATABLE) {
    if (data[f] !== undefined) {
      fields.push(`${f} = $${p++}`);
      params.push(data[f]);
    }
  }

  if (fields.length === 0) return existing; // nothing to change

  const { rows } = await pool.query(
    `UPDATE contacts SET ${fields.join(', ')} WHERE id = $2 AND user_id = $1 RETURNING *`,
    params
  );
  return rows[0] ?? null;
}

/**
 * Delete a contact, scoped to the user.
 * @param {number} userId
 * @param {number} contactId
 * @returns {Promise<object|null>} the deleted row, or null if not found / not owned
 */
export async function deleteContact(userId, contactId) {
  const { rows } = await pool.query(
    'DELETE FROM contacts WHERE id = $1 AND user_id = $2 RETURNING *',
    [contactId, userId]
  );
  return rows[0] ?? null;
}

/**
 * Aggregate contact statistics for the summary cards. Raw pg aggregates come back
 * as strings; coerce to numbers so the client renders cleanly (mirrors getReadingStats).
 * @param {number} userId
 * @returns {Promise<{ total: number, clients: number, partners: number, active: number, leads: number }>}
 */
export async function getContactStats(userId) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*)                                AS total,
       COUNT(*) FILTER (WHERE type = 'client') AS clients,
       COUNT(*) FILTER (WHERE type = 'partner') AS partners,
       COUNT(*) FILTER (WHERE status = 'active') AS active,
       COUNT(*) FILTER (WHERE status = 'lead')  AS leads
     FROM contacts WHERE user_id = $1`,
    [userId]
  );
  const row = rows[0];
  return {
    total:    parseInt(row.total, 10),
    clients:  parseInt(row.clients, 10),
    partners: parseInt(row.partners, 10),
    active:   parseInt(row.active, 10),
    leads:    parseInt(row.leads, 10),
  };
}
