// server/models/user.model.js
// Raw pg queries — no ORM, per §6.5.
// All functions throw on DB error; callers (route handlers) forward via next(err).

import { pool } from '../lib/db.js';

/**
 * Find a user row by email.
 * @param {string} email
 * @returns {Promise<object|null>} Full user row including password_hash, or null if not found.
 */
export async function findByEmail(email) {
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE email = $1 LIMIT 1',
    [email]
  );
  return rows[0] ?? null;
}

/**
 * Find a user row by primary key.
 * @param {number} id
 * @returns {Promise<object|null>} User row without password_hash, or null if not found.
 */
export async function findById(id) {
  const { rows } = await pool.query(
    'SELECT id, email, name, created_at, updated_at FROM users WHERE id = $1 LIMIT 1',
    [id]
  );
  return rows[0] ?? null;
}

/**
 * Insert a new user row.
 * @param {{ email: string, password_hash: string, name: string }} data
 * @returns {Promise<object>} Newly created user row without password_hash.
 */
export async function createUser({ email, password_hash, name }) {
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, name)
     VALUES ($1, $2, $3)
     RETURNING id, email, name, created_at, updated_at`,
    [email, password_hash, name]
  );
  return rows[0];
}
