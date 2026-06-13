// server/models/settings.model.js
// Server-side user preferences (Post-V5 fix; addresses V5 §12.2). One row per user,
// lazily created on first read so existing accounts need no backfill. All queries
// scoped to user_id; follows the (userId, …) argument order used across the codebase.

import pool from '../lib/db.js';

// Whitelisted columns a client may set via PUT /api/settings.
const UPDATABLE = ['theme', 'default_model', 'notifications_enabled'];

/**
 * Fetch the user's settings, creating the default row on first access.
 * @param {number} userId
 * @returns {Promise<object>} the settings row
 */
export async function getSettings(userId) {
  // Lazily materialise a row using the schema defaults (theme 'system', model
  // 'deepseek-chat', notifications on). No-op once it exists.
  await pool.query(
    `INSERT INTO user_settings (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
  const { rows } = await pool.query(
    'SELECT * FROM user_settings WHERE user_id = $1',
    [userId]
  );
  return rows[0];
}

/**
 * Apply a partial update to the user's settings, returning the full updated row.
 * Omitted fields are left untouched. Splitting the ensure-row INSERT from the
 * UPDATE avoids the ON CONFLICT pitfall where a first-time write would otherwise
 * persist the schema defaults instead of the supplied values. updated_at is
 * maintained by the set_updated_at trigger.
 * @param {number} userId
 * @param {{ theme?: string, default_model?: string, notifications_enabled?: boolean }} data
 */
export async function upsertSettings(userId, data) {
  const fields = [];
  const params = [userId];
  let p = 2;
  for (const f of UPDATABLE) {
    if (data[f] !== undefined) { fields.push(`${f} = $${p++}`); params.push(data[f]); }
  }
  if (!fields.length) return getSettings(userId);

  await pool.query(
    `INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
  const { rows } = await pool.query(
    `UPDATE user_settings SET ${fields.join(', ')} WHERE user_id = $1 RETURNING *`,
    params
  );
  return rows[0];
}
