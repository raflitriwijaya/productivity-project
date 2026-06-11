// server/models/links.model.js
// All DB interactions for the entity_links table — the Universal Links system
// (Roadmap Wave 1). Polymorphic soft-references between any two entities.
//
// Every function takes userId and scopes every query by user_id (§6.5). Ownership
// of the *referenced* entities is the route layer's job (links.js verifyOwnership);
// this model only guarantees a caller can never touch another user's link rows.
// Uses snake_case keys on the wire (§6.0).

import pool from '../lib/db.js';

/**
 * @typedef {Object} EntityLink
 * @property {number} id
 * @property {number} user_id
 * @property {string} from_type
 * @property {number} from_id
 * @property {string} to_type
 * @property {number} to_id
 * @property {string|null} note
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * Create a link between two entities. Idempotent on the (user, from, to) tuple:
 * a repeat call updates the note instead of erroring on the UNIQUE constraint.
 * Ownership of BOTH entities MUST be validated by the caller.
 * @param {number} userId
 * @param {{ fromType: string, fromId: number, toType: string, toId: number, note?: string|null }} data
 * @returns {Promise<EntityLink>}
 */
export async function createLink(userId, { fromType, fromId, toType, toId, note }) {
  const { rows } = await pool.query(
    `INSERT INTO entity_links (user_id, from_type, from_id, to_type, to_id, note)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT ON CONSTRAINT uq_entity_link DO UPDATE
       SET note = EXCLUDED.note, updated_at = NOW()
     RETURNING *`,
    [userId, fromType, fromId, toType, toId, note ?? null]
  );
  return rows[0];
}

/**
 * All links touching a given entity, in either direction. Each row carries the
 * *linked* (other) entity's type/id, the note, and a direction discriminator
 * ('outgoing' = this entity is the from side, 'incoming' = the to side).
 * @param {number} userId
 * @param {string} type   entity type
 * @param {number} id     entity id
 * @param {'from'|'to'|'both'} [direction='both']
 * @returns {Promise<Array<{ id: number, entity_type: string, entity_id: number, linked_type: string, linked_id: number, note: string|null, created_at: string, direction: 'outgoing'|'incoming' }>>}
 */
export async function getLinksForEntity(userId, type, id, direction = 'both') {
  const params = [userId, type, id];

  const outgoing = `
    SELECT el.id, el.from_type AS entity_type, el.from_id AS entity_id,
           el.to_type AS linked_type, el.to_id AS linked_id,
           el.note, el.created_at,
           'outgoing' AS direction
      FROM entity_links el
     WHERE el.user_id = $1 AND el.from_type = $2 AND el.from_id = $3`;

  const incoming = `
    SELECT el.id, el.to_type AS entity_type, el.to_id AS entity_id,
           el.from_type AS linked_type, el.from_id AS linked_id,
           el.note, el.created_at,
           'incoming' AS direction
      FROM entity_links el
     WHERE el.user_id = $1 AND el.to_type = $2 AND el.to_id = $3`;

  let query;
  if (direction === 'from') {
    query = `${outgoing} ORDER BY created_at DESC`;
  } else if (direction === 'to') {
    query = `${incoming} ORDER BY created_at DESC`;
  } else {
    query = `${outgoing} UNION ALL ${incoming} ORDER BY created_at DESC`;
  }

  const { rows } = await pool.query(query, params);
  return rows;
}

/**
 * Get a single link by id, scoped to the user.
 * @param {number} userId
 * @param {number} linkId
 * @returns {Promise<EntityLink|null>}
 */
export async function getLinkById(userId, linkId) {
  const { rows } = await pool.query(
    'SELECT * FROM entity_links WHERE id = $1 AND user_id = $2',
    [linkId, userId]
  );
  return rows[0] ?? null;
}

/**
 * Delete a link by id, scoped to the user.
 * @param {number} userId
 * @param {number} linkId
 * @returns {Promise<EntityLink|null>} the deleted row, or null if not found / not owned
 */
export async function deleteLink(userId, linkId) {
  const { rows } = await pool.query(
    'DELETE FROM entity_links WHERE id = $1 AND user_id = $2 RETURNING *',
    [linkId, userId]
  );
  return rows[0] ?? null;
}

/**
 * Per-type link counts for a user (an entity counted once per link it touches,
 * on either side). Useful for dashboards/stats.
 * @param {number} userId
 * @returns {Promise<Record<string, number>>}
 */
export async function getLinkStats(userId) {
  const { rows } = await pool.query(
    `SELECT entity_type, SUM(c)::int AS link_count FROM (
       SELECT from_type AS entity_type, COUNT(*) AS c
         FROM entity_links WHERE user_id = $1 GROUP BY from_type
       UNION ALL
       SELECT to_type AS entity_type, COUNT(*) AS c
         FROM entity_links WHERE user_id = $1 GROUP BY to_type
     ) t
     GROUP BY entity_type`,
    [userId]
  );
  const counts = {};
  for (const row of rows) counts[row.entity_type] = row.link_count;
  return counts;
}
