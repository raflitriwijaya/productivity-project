// server/models/todo.model.js
import { pool } from '../lib/db.js';

/**
 * @param {number} userId
 * @param {{ page?: number, perPage?: number, sort?: string, order?: string, status?: string }} opts
 * @returns {Promise<{ rows: object[], total: number }>}
 */
export async function listTodos(userId, opts = {}) {
  const {
    page = 1,
    perPage = 20,
    sort = 'created_at',
    order = 'desc',
    status,
  } = opts;

  const ALLOWED_SORT = ['created_at', 'updated_at', 'due_date', 'priority', 'title'];
  const safeSort = ALLOWED_SORT.includes(sort) ? sort : 'created_at';
  const safeOrder = order === 'asc' ? 'ASC' : 'DESC';

  const conditions = ['user_id = $1'];
  const values = [userId];

  if (status) {
    values.push(status);
    conditions.push(`status = $${values.length}`);
  }

  const where = conditions.join(' AND ');
  const offset = (page - 1) * perPage;

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM todos WHERE ${where}`,
    values
  );

  values.push(perPage, offset);
  const dataResult = await pool.query(
    `SELECT * FROM todos WHERE ${where}
     ORDER BY ${safeSort} ${safeOrder}
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  return { rows: dataResult.rows, total: parseInt(countResult.rows[0].count, 10) };
}

/**
 * @param {number} id
 * @param {number} userId
 * @returns {Promise<object|null>}
 */
export async function getTodoById(id, userId) {
  const result = await pool.query(
    'SELECT * FROM todos WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return result.rows[0] ?? null;
}

/**
 * @param {number} userId
 * @param {{ title: string, description?: string, status?: string, priority?: number, due_date?: string, due_time?: string }} fields
 * @returns {Promise<object>}
 */
export async function createTodo(userId, fields) {
  const { title, description = null, status = 'pending', priority = 2, due_date = null, due_time = null } = fields;
  const result = await pool.query(
    `INSERT INTO todos (user_id, title, description, status, priority, due_date, due_time)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [userId, title, description, status, priority, due_date, due_time]
  );
  return result.rows[0];
}

/**
 * Partial update — only provided keys are written.
 * @param {number} id
 * @param {number} userId
 * @param {Partial<{ title: string, description: string, status: string, priority: number, due_date: string, due_time: string }>} fields
 * @returns {Promise<object|null>}
 */
export async function patchTodo(id, userId, fields) {
  const ALLOWED = ['title', 'description', 'status', 'priority', 'due_date', 'due_time'];
  const keys = Object.keys(fields).filter(k => ALLOWED.includes(k));
  if (keys.length === 0) return getTodoById(id, userId);

  const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const values = keys.map(k => fields[k]);
  values.push(id, userId);

  const result = await pool.query(
    `UPDATE todos SET ${setClauses}
     WHERE id = $${values.length - 1} AND user_id = $${values.length}
     RETURNING *`,
    values
  );
  return result.rows[0] ?? null;
}

/**
 * @param {number} id
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
export async function deleteTodo(id, userId) {
  const result = await pool.query(
    'DELETE FROM todos WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return result.rowCount > 0;
}

/**
 * Returns counts grouped by status, plus an overdue count.
 * "overdue" = status != 'done' AND due_date < CURRENT_DATE.
 *
 * @param {number} userId
 * @returns {Promise<{ total: number, pending: number, in_progress: number, done: number, overdue: number }>}
 */
export async function getTodoStats(userId) {
  const result = await pool.query(
    `SELECT
       COUNT(*)                                                          AS total,
       COUNT(*) FILTER (WHERE status = 'pending')                       AS pending,
       COUNT(*) FILTER (WHERE status = 'in_progress')                   AS in_progress,
       COUNT(*) FILTER (WHERE status = 'done')                          AS done,
       COUNT(*) FILTER (WHERE status != 'done' AND due_date < CURRENT_DATE) AS overdue
     FROM todos
     WHERE user_id = $1`,
    [userId]
  );

  const row = result.rows[0];
  return {
    total:       parseInt(row.total,       10),
    pending:     parseInt(row.pending,     10),
    in_progress: parseInt(row.in_progress, 10),
    done:        parseInt(row.done,        10),
    overdue:     parseInt(row.overdue,     10),
  };
}

/**
 * Date-scoped stats for the Today Dashboard briefing (Roadmap Wave 2).
 * Counts the user's open tasks (pending / in_progress), tasks completed *today*
 * (status flipped to 'done' with updated_at on the current date), and overdue
 * tasks (not done with a due_date in the past). Status values follow
 * TODO_STATUSES — note 'done', not 'completed'.
 *
 * @param {number} userId
 * @returns {Promise<{ pending: number, in_progress: number, completed_today: number, overdue: number }>}
 */
export async function getTodayStats(userId) {
  const result = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'pending')                                 AS pending,
       COUNT(*) FILTER (WHERE status = 'in_progress')                             AS in_progress,
       COUNT(*) FILTER (WHERE status = 'done' AND updated_at::date = CURRENT_DATE) AS completed_today,
       COUNT(*) FILTER (WHERE status != 'done' AND due_date < CURRENT_DATE)        AS overdue
     FROM todos
     WHERE user_id = $1`,
    [userId]
  );
  const row = result.rows[0];
  return {
    pending:         parseInt(row.pending,         10),
    in_progress:     parseInt(row.in_progress,     10),
    completed_today: parseInt(row.completed_today, 10),
    overdue:         parseInt(row.overdue,         10),
  };
}

/**
 * Open todos due today within the next `minutesAhead` minutes that have a
 * time-of-day set and haven't been reminded in the last hour. Powers the
 * Telegram reminder scheduler (server/lib/todoReminder.js).
 *
 * NOTE on the time comparison: `due_time` is `TIME` (without time zone), so we
 * compare against `LOCALTIME` — also `time without time zone`. The spec used
 * `CURRENT_TIME`, but that returns `timetz` and Postgres won't compare it to a
 * plain `TIME` column. `minutesAhead` is parameterized via `make_interval` to
 * keep the query fully parameterized (Invariant 4 / §3.2).
 *
 * @param {number} userId
 * @param {number} [minutesAhead=30]
 * @returns {Promise<object[]>}
 */
export async function getTodosDueSoon(userId, minutesAhead = 30) {
  const { rows } = await pool.query(
    `SELECT id, title, description, due_date, due_time, priority, status
       FROM todos
      WHERE user_id = $1
        AND status IN ('pending', 'in_progress')
        AND due_date = CURRENT_DATE
        AND due_time IS NOT NULL
        AND due_time > LOCALTIME
        AND due_time <= LOCALTIME + make_interval(mins => $2)
        -- Anti-spam: skip todos reminded within the last hour.
        AND (reminded_at IS NULL OR reminded_at < NOW() - INTERVAL '1 hour')
      ORDER BY due_time ASC`,
    [userId, minutesAhead]
  );
  return rows;
}

/**
 * Stamp reminded_at = NOW() on the given todos so they aren't re-notified for an
 * hour. No-op for an empty id list.
 *
 * @param {number} userId
 * @param {number[]} todoIds
 * @returns {Promise<void>}
 */
export async function markReminded(userId, todoIds) {
  if (!todoIds || todoIds.length === 0) return;
  await pool.query(
    `UPDATE todos SET reminded_at = NOW() WHERE user_id = $1 AND id = ANY($2)`,
    [userId, todoIds]
  );
}
