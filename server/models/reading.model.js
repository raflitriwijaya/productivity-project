// server/models/reading.model.js
// Reading Tracker (Roadmap Wave 3). All queries are scoped to user_id — never
// expose cross-user rows. Mirrors the learning.model.js conventions, but uses the
// (userId, …) argument order; the route layer calls these with req.user.id first.

import pool from '../lib/db.js';

/**
 * List books for the user.
 * @param {number} userId
 * @param {{ shelf?: string, sort?: string, order?: string, page?: number, per_page?: number, search?: string }} opts
 * @returns {Promise<{ data: object[], meta: { total: number, page: number, per_page: number } }>}
 */
export async function listBooks(userId, opts = {}) {
  const { shelf, sort = 'created_at', order = 'desc', page = 1, per_page = 20, search } = opts;

  const ALLOWED_SORT  = ['created_at', 'updated_at', 'title', 'finished_at', 'rating', 'total_pages'];
  const ALLOWED_ORDER = ['asc', 'desc'];

  const sortCol   = ALLOWED_SORT.includes(sort)   ? sort  : 'created_at';
  const sortOrder = ALLOWED_ORDER.includes(order) ? order : 'desc';

  let where = 'WHERE user_id = $1';
  const params = [userId];
  let paramIdx = 2;

  if (shelf) {
    where += ` AND shelf = $${paramIdx++}`;
    params.push(shelf);
  }

  if (search && search.trim()) {
    where += ` AND (title ILIKE $${paramIdx} OR author ILIKE $${paramIdx} OR notes ILIKE $${paramIdx})`;
    params.push(`%${search.trim()}%`);
    paramIdx++;
  }

  const offset = (page - 1) * per_page;

  const [dataRes, countRes] = await Promise.all([
    pool.query(
      `SELECT * FROM books ${where} ORDER BY ${sortCol} ${sortOrder} LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, per_page, offset]
    ),
    pool.query(`SELECT COUNT(*) FROM books ${where}`, params),
  ]);

  return {
    data: dataRes.rows,
    meta: { total: parseInt(countRes.rows[0].count, 10), page, per_page },
  };
}

/**
 * Get a single book by ID, scoped to the user.
 * @param {number} userId
 * @param {number} bookId
 * @returns {Promise<object|null>}
 */
export async function getBookById(userId, bookId) {
  const res = await pool.query(
    'SELECT * FROM books WHERE id = $1 AND user_id = $2',
    [bookId, userId]
  );
  return res.rows[0] ?? null;
}

/**
 * Create a book.
 * @param {number} userId
 * @param {object} data
 * @returns {Promise<object>}
 */
export async function createBook(userId, data) {
  const { title, author, shelf = 'want_to_read', total_pages, notes, cover_url, genre } = data;

  const res = await pool.query(
    `INSERT INTO books (user_id, title, author, shelf, total_pages, notes, cover_url, genre)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [userId, title, author ?? null, shelf, total_pages ?? null, notes ?? null, cover_url ?? null, genre ?? null]
  );
  return res.rows[0];
}

/**
 * Partial update — only the fields present in `data` are written. Auto-stamps
 * started_at / finished_at on shelf transitions and back-fills current_page to
 * total_pages when a book is marked finished (unless the caller set those fields
 * explicitly — avoids a duplicate column assignment).
 * @param {number} userId
 * @param {number} bookId
 * @param {object} data
 * @returns {Promise<object|null>}
 */
export async function updateBook(userId, bookId, data) {
  const book = await getBookById(userId, bookId);
  if (!book) return null;

  const fields = [];
  const params = [userId, bookId];
  let paramIdx = 3;

  const UPDATABLE = ['title', 'author', 'shelf', 'current_page', 'total_pages', 'rating', 'notes', 'started_at', 'finished_at', 'cover_url', 'genre'];
  for (const field of UPDATABLE) {
    if (data[field] !== undefined) {
      fields.push(`${field} = $${paramIdx++}`);
      params.push(data[field]);
    }
  }

  // Auto-set timestamps on shelf transitions. Guard each clause so we never assign
  // the same column twice (which Postgres rejects with 42701) when the caller has
  // already supplied that field above.
  if (data.shelf === 'reading' && book.shelf !== 'reading' && data.started_at === undefined) {
    fields.push('started_at = COALESCE(started_at, NOW())');
  }
  if (data.shelf === 'finished' && book.shelf !== 'finished') {
    if (data.finished_at === undefined) fields.push('finished_at = NOW()');
    // Back-fill progress to the last page when finishing — only if not set explicitly.
    if (book.total_pages && data.current_page === undefined) {
      fields.push(`current_page = $${paramIdx}`);
      params.push(book.total_pages);
    }
  }

  if (fields.length === 0) return book; // nothing to change; updated_at trigger needs a real UPDATE

  const res = await pool.query(
    `UPDATE books SET ${fields.join(', ')} WHERE id = $2 AND user_id = $1 RETURNING *`,
    params
  );
  return res.rows[0] ?? null;
}

/**
 * Delete a book, scoped to the user.
 * @param {number} userId
 * @param {number} bookId
 * @returns {Promise<object|null>} the deleted row, or null if not found / not owned
 */
export async function deleteBook(userId, bookId) {
  const res = await pool.query(
    'DELETE FROM books WHERE id = $1 AND user_id = $2 RETURNING *',
    [bookId, userId]
  );
  return res.rows[0] ?? null;
}

/**
 * Aggregate reading statistics for the summary cards. Raw pg aggregates come back
 * as strings; coerce to numbers/float so the client renders cleanly (mirrors
 * getLearningStats).
 * @param {number} userId
 * @returns {Promise<{ want_to_read: number, reading: number, finished: number, finished_this_year: number, avg_rating: number, pages_read_this_year: number, total_pages_read: number }>}
 */
export async function getReadingStats(userId) {
  const res = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE shelf = 'want_to_read')                                                            AS want_to_read,
       COUNT(*) FILTER (WHERE shelf = 'reading')                                                                 AS reading,
       COUNT(*) FILTER (WHERE shelf = 'finished')                                                                AS finished,
       COUNT(*) FILTER (WHERE shelf = 'finished' AND finished_at >= DATE_TRUNC('year', CURRENT_DATE))            AS finished_this_year,
       COALESCE(AVG(rating) FILTER (WHERE shelf = 'finished' AND rating IS NOT NULL), 0)                         AS avg_rating,
       COALESCE(SUM(total_pages) FILTER (WHERE shelf = 'finished' AND finished_at >= DATE_TRUNC('year', CURRENT_DATE)), 0) AS pages_read_this_year,
       COALESCE(SUM(current_page), 0)                                                                            AS total_pages_read
     FROM books
     WHERE user_id = $1`,
    [userId]
  );
  const row = res.rows[0];
  return {
    want_to_read:         parseInt(row.want_to_read, 10),
    reading:              parseInt(row.reading, 10),
    finished:             parseInt(row.finished, 10),
    finished_this_year:   parseInt(row.finished_this_year, 10),
    avg_rating:           parseFloat(row.avg_rating),
    pages_read_this_year: parseInt(row.pages_read_this_year, 10),
    total_pages_read:     parseInt(row.total_pages_read, 10),
  };
}
