// server/models/finance.model.js
// Raw pg query functions for the multi-account finance ledger.
// All queries are scoped by user_id — never trust client-supplied ownership.
//
// Ledger model (see migration 002):
//   accounts      — money stores (6 standard types per user)
//   categories    — INCOME / EXPENSE / SYSTEM buckets (14 standard per user)
//   transactions  — typed entries that move money between accounts
//   receivables / payables / portfolio / budgets — supporting ledgers
//
// Balance rule (applied in getBalances / getSummary):
//   Income             → +dest
//   Expense            → -source
//   Transfer           → -source, +dest
//   Balance Adjustment → +dest
//   Market Adjustment  → +dest

import pool from '../lib/db.js';
import { AppError } from '../lib/AppError.js';
import { TX_TYPES } from '../lib/enums.js';

// Phase 8: defensive range check so a direct model caller (script/test/new route)
// passing an out-of-range month can never reach make_date() and 500.
function assertMonthYear(month, year) {
  if (month === undefined && year === undefined) return;
  const ok = Number.isInteger(month) && month >= 1 && month <= 12
          && Number.isInteger(year)  && year >= 1900;
  if (!ok) throw new AppError('Invalid month/year.', 400, 'VALIDATION_ERROR', 'month');
}

// ─── Standard seed data ───────────────────────────────────────────────────────

const DEFAULT_ACCOUNTS = [
  { type: 'CASH',       name: 'Cash' },
  { type: 'ATM',        name: 'Bank / ATM' },
  { type: 'DANA',       name: 'DANA' },
  { type: 'SHOPEEPAY',  name: 'ShopeePay' },
  { type: 'GOPAY',      name: 'GoPay' },
  { type: 'INVESTMENT', name: 'Investment' },
];

const DEFAULT_CATEGORIES = [
  { name: 'Salary',        kind: 'INCOME' },
  { name: 'Freelance',     kind: 'INCOME' },
  { name: 'Investment',    kind: 'INCOME' },
  { name: 'Gift',          kind: 'INCOME' },
  { name: 'Food & Drink',  kind: 'EXPENSE' },
  { name: 'Transport',     kind: 'EXPENSE' },
  { name: 'Utilities',     kind: 'EXPENSE' },
  { name: 'Rent',          kind: 'EXPENSE' },
  { name: 'Healthcare',    kind: 'EXPENSE' },
  { name: 'Education',     kind: 'EXPENSE' },
  { name: 'Shopping',      kind: 'EXPENSE' },
  { name: 'Subscriptions', kind: 'EXPENSE' },
  { name: 'Transfer',      kind: 'SYSTEM' },
  { name: 'Adjustment',    kind: 'SYSTEM' },
];

// Which transaction types credit dest / debit source.
// Revenue (Wave 4) credits the destination account exactly like Income.
const CREDITS_DEST   = ['Income', 'Revenue', 'Transfer', 'Balance Adjustment', 'Market Adjustment'];
const DEBITS_SOURCE  = ['Expense', 'Transfer'];

// ─── Default provisioning ──────────────────────────────────────────────────────

/**
 * Idempotently ensure the 6 standard accounts and 14 standard categories exist for
 * a user. Safe to call on every account/category read — ON CONFLICT makes it a
 * no-op once seeded.
 * @param {number} userId
 */
export async function ensureDefaults(userId) {
  await pool.query(
    `INSERT INTO accounts (user_id, name, type)
     SELECT $1, x.name, x.type
     FROM jsonb_to_recordset($2::jsonb) AS x(name text, type text)
     ON CONFLICT (user_id, type) DO NOTHING`,
    [userId, JSON.stringify(DEFAULT_ACCOUNTS)]
  );
  await pool.query(
    `INSERT INTO categories (user_id, name, kind)
     SELECT $1, x.name, x.kind
     FROM jsonb_to_recordset($2::jsonb) AS x(name text, kind text)
     ON CONFLICT (user_id, name) DO NOTHING`,
    [userId, JSON.stringify(DEFAULT_CATEGORIES)]
  );
}

// ─── Accounts ──────────────────────────────────────────────────────────────────

/**
 * @param {number} userId
 * @returns {Promise<object[]>} accounts ordered by the standard type order
 */
export async function listAccounts(userId) {
  await ensureDefaults(userId);
  const { rows } = await pool.query(
    `SELECT id, name, type, initial_balance, created_at, updated_at
     FROM accounts
     WHERE user_id = $1
     ORDER BY array_position(ARRAY['CASH','ATM','DANA','SHOPEEPAY','GOPAY','INVESTMENT']::text[], type), id`,
    [userId]
  );
  return rows;
}

/**
 * Accounts with their live computed balance (initial_balance + ledger movements).
 * @param {number} userId
 * @returns {Promise<object[]>}
 */
export async function getBalances(userId) {
  await ensureDefaults(userId);
  const { rows } = await pool.query(
    `SELECT a.id, a.name, a.type, a.initial_balance,
       (a.initial_balance
         + COALESCE((SELECT SUM(t.amount) FROM transactions t
                     WHERE t.user_id = a.user_id AND t.dest_account_id = a.id
                       AND t.type = ANY($2)), 0)
         - COALESCE((SELECT SUM(t.amount) FROM transactions t
                     WHERE t.user_id = a.user_id AND t.source_account_id = a.id
                       AND t.type = ANY($3)), 0)
       ) AS balance
     FROM accounts a
     WHERE a.user_id = $1
     ORDER BY array_position(ARRAY['CASH','ATM','DANA','SHOPEEPAY','GOPAY','INVESTMENT']::text[], a.type), a.id`,
    [userId, CREDITS_DEST, DEBITS_SOURCE]
  );
  return rows;
}

/**
 * Update an account's display name and/or opening balance.
 * @param {number} id
 * @param {number} userId
 * @param {{ name?: string, initial_balance?: number }} data
 * @returns {Promise<object|null>}
 */
export async function patchAccount(id, userId, data) {
  const allowed = ['name', 'initial_balance'];
  const fields = Object.keys(data).filter(k => allowed.includes(k));
  if (fields.length === 0) {
    const { rows } = await pool.query(
      `SELECT id, name, type, initial_balance, created_at, updated_at FROM accounts WHERE id=$1 AND user_id=$2`,
      [id, userId]
    );
    return rows[0] ?? null;
  }
  const set = fields.map((f, i) => `${f} = $${i + 3}`);
  const { rows } = await pool.query(
    `UPDATE accounts SET ${set.join(', ')} WHERE id = $1 AND user_id = $2
     RETURNING id, name, type, initial_balance, created_at, updated_at`,
    [id, userId, ...fields.map(f => data[f])]
  );
  return rows[0] ?? null;
}

// ─── Categories ────────────────────────────────────────────────────────────────

/**
 * @param {number} userId
 * @param {{ kind?: 'INCOME'|'EXPENSE'|'SYSTEM' }} opts
 * @returns {Promise<object[]>}
 */
export async function listCategories(userId, { kind } = {}) {
  await ensureDefaults(userId);
  const params = [userId];
  let where = 'user_id = $1';
  if (kind) {
    params.push(kind);
    where += ` AND kind = $${params.length}`;
  }
  const { rows } = await pool.query(
    `SELECT id, name, kind, created_at, updated_at FROM categories WHERE ${where} ORDER BY kind, name`,
    params
  );
  return rows;
}

// ─── Transaction validation helpers ────────────────────────────────────────────

/**
 * Enforce which account fields a transaction type requires.
 *   Income / Adjustment → dest only
 *   Expense             → source only
 *   Transfer            → source + dest, source <> dest
 * Throws AppError(400) on violation.
 */
function validateTransactionShape({ type, source_account_id, dest_account_id }) {
  // Revenue (Wave 4) shares Income's shape: destination-only, no source.
  const needsDest   = ['Income', 'Revenue', 'Balance Adjustment', 'Market Adjustment', 'Transfer'].includes(type);
  const needsSource = ['Expense', 'Transfer'].includes(type);

  if (needsSource && !source_account_id) {
    throw new AppError(`${type} requires a source account.`, 400, 'VALIDATION_ERROR', 'source_account_id');
  }
  if (needsDest && !dest_account_id) {
    throw new AppError(`${type} requires a destination account.`, 400, 'VALIDATION_ERROR', 'dest_account_id');
  }
  if (type === 'Transfer' && source_account_id === dest_account_id) {
    throw new AppError('Transfer source and destination must differ.', 400, 'VALIDATION_ERROR', 'dest_account_id');
  }
  if (['Income', 'Revenue', 'Balance Adjustment', 'Market Adjustment'].includes(type) && source_account_id) {
    throw new AppError(`${type} must not have a source account.`, 400, 'VALIDATION_ERROR', 'source_account_id');
  }
  if (type === 'Expense' && dest_account_id) {
    throw new AppError('Expense must not have a destination account.', 400, 'VALIDATION_ERROR', 'dest_account_id');
  }
}

/** Throw 400 unless every supplied account id belongs to the user. */
async function assertAccountsOwned(userId, ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return;
  const { rows } = await pool.query(
    `SELECT id FROM accounts WHERE user_id = $1 AND id = ANY($2)`,
    [userId, unique]
  );
  if (rows.length !== unique.length) {
    throw new AppError('Account not found.', 400, 'VALIDATION_ERROR', 'account_id');
  }
}

/** Throw 400 unless the category belongs to the user. */
async function assertCategoryOwned(userId, categoryId) {
  if (!categoryId) return;
  const { rows } = await pool.query(
    `SELECT id FROM categories WHERE user_id = $1 AND id = $2`,
    [userId, categoryId]
  );
  if (rows.length === 0) {
    throw new AppError('Category not found.', 400, 'VALIDATION_ERROR', 'category_id');
  }
}

// ─── Transactions ──────────────────────────────────────────────────────────────

const TX_SELECT = `
  SELECT t.id, t.type, t.amount, t.description, t.date,
         t.source_account_id, t.dest_account_id, t.category_id, t.reconciled,
         t.created_at, t.updated_at,
         sa.name AS source_account_name, sa.type AS source_account_type,
         da.name AS dest_account_name,   da.type AS dest_account_type,
         c.name  AS category_name,       c.kind  AS category_kind
  FROM transactions t
  LEFT JOIN accounts   sa ON sa.id = t.source_account_id
  LEFT JOIN accounts   da ON da.id = t.dest_account_id
  LEFT JOIN categories c  ON c.id  = t.category_id`;

/**
 * List transactions with optional filters, newest first.
 * @param {number} userId
 * @param {{ month?: number, year?: number, type?: string, categoryId?: number,
 *           accountId?: number, search?: string, page?: number, perPage?: number }} opts
 * @returns {Promise<{ rows: object[], total: number }>}
 */
export async function listTransactions(userId, opts = {}) {
  const { month, year, type, categoryId, accountId, search, page = 1, perPage = 50 } = opts;
  assertMonthYear(month, year); // Phase 8: clean 400 instead of make_date 500

  const conditions = ['t.user_id = $1'];
  const params = [userId];

  if (Number.isInteger(month) && Number.isInteger(year)) {
    params.push(year, month);
    conditions.push(
      `t.date >= make_date($${params.length - 1}, $${params.length}, 1)
       AND t.date < (make_date($${params.length - 1}, $${params.length}, 1) + interval '1 month')`
    );
  }
  if (type && TX_TYPES.includes(type)) {
    params.push(type);
    conditions.push(`t.type = $${params.length}`);
  }
  if (Number.isInteger(categoryId)) {
    params.push(categoryId);
    conditions.push(`t.category_id = $${params.length}`);
  }
  if (Number.isInteger(accountId)) {
    params.push(accountId);
    conditions.push(`(t.source_account_id = $${params.length} OR t.dest_account_id = $${params.length})`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(t.description ILIKE $${params.length} OR c.name ILIKE $${params.length})`);
  }

  const where = conditions.join(' AND ');

  const countRes = await pool.query(
    `SELECT COUNT(*) FROM transactions t LEFT JOIN categories c ON c.id = t.category_id WHERE ${where}`,
    params
  );

  const offset = (page - 1) * perPage;
  params.push(perPage, offset);
  const dataRes = await pool.query(
    `${TX_SELECT} WHERE ${where} ORDER BY t.date DESC, t.id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return { rows: dataRes.rows, total: parseInt(countRes.rows[0].count, 10) };
}

/**
 * @param {number} id
 * @param {number} userId
 * @returns {Promise<object|null>}
 */
export async function getTransactionById(id, userId) {
  const { rows } = await pool.query(`${TX_SELECT} WHERE t.id = $1 AND t.user_id = $2`, [id, userId]);
  return rows[0] ?? null;
}

/**
 * @param {number} userId
 * @param {object} data { type, amount, description?, date, source_account_id?, dest_account_id?, category_id?, reconciled? }
 * @returns {Promise<object>}
 */
export async function createTransaction(userId, data) {
  const {
    type, amount, description = null, date,
    source_account_id = null, dest_account_id = null, category_id = null, reconciled = false,
  } = data;

  validateTransactionShape({ type, source_account_id, dest_account_id });
  await assertAccountsOwned(userId, [source_account_id, dest_account_id]);
  await assertCategoryOwned(userId, category_id);

  const { rows } = await pool.query(
    `INSERT INTO transactions
       (user_id, type, amount, description, date, source_account_id, dest_account_id, category_id, reconciled)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id`,
    [userId, type, amount, description, date, source_account_id, dest_account_id, category_id, reconciled]
  );
  return getTransactionById(rows[0].id, userId);
}

/**
 * Partial update. The post-update shape is re-validated against the (possibly new) type.
 * @param {number} id
 * @param {number} userId
 * @param {object} data
 * @returns {Promise<object|null>}
 */
export async function patchTransaction(id, userId, data) {
  const existing = await getTransactionById(id, userId);
  if (!existing) return null;

  const allowed = ['type', 'amount', 'description', 'date', 'source_account_id', 'dest_account_id', 'category_id', 'reconciled'];
  const fields = Object.keys(data).filter(k => allowed.includes(k));
  if (fields.length === 0) return existing;

  // Merge for validation against the resulting row.
  const merged = {
    type:              data.type              ?? existing.type,
    source_account_id: data.source_account_id !== undefined ? data.source_account_id : existing.source_account_id,
    dest_account_id:   data.dest_account_id   !== undefined ? data.dest_account_id   : existing.dest_account_id,
    category_id:       data.category_id       !== undefined ? data.category_id       : existing.category_id,
  };
  validateTransactionShape(merged);
  await assertAccountsOwned(userId, [merged.source_account_id, merged.dest_account_id]);
  await assertCategoryOwned(userId, merged.category_id);

  const set = fields.map((f, i) => `${f} = $${i + 3}`);
  await pool.query(
    `UPDATE transactions SET ${set.join(', ')} WHERE id = $1 AND user_id = $2`,
    [id, userId, ...fields.map(f => data[f])]
  );
  return getTransactionById(id, userId);
}

/**
 * @param {number} id
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
export async function deleteTransaction(id, userId) {
  const res = await pool.query(`DELETE FROM transactions WHERE id = $1 AND user_id = $2`, [id, userId]);
  return res.rowCount > 0;
}

// ─── Summary & dashboard ───────────────────────────────────────────────────────

/**
 * Aggregate totals. Income/expense/net are scoped to month+year when both are
 * provided (else all-time). Net worth and outstanding receivables/payables are
 * always point-in-time snapshots.
 * @param {number} userId
 * @param {{ month?: number, year?: number }} opts
 */
export async function getSummary(userId, { month, year } = {}) {
  assertMonthYear(month, year); // Phase 8: clean 400 instead of make_date 500
  const scoped = Number.isInteger(month) && Number.isInteger(year);
  const params = [userId];
  let dateFilter = '';
  if (scoped) {
    params.push(year, month);
    dateFilter = `AND date >= make_date($2,$3,1) AND date < (make_date($2,$3,1) + interval '1 month')`;
  }

  const [flow, worth, recv, pay] = await Promise.all([
    pool.query(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE type IN ('Income','Revenue')), 0) AS total_income,
         COALESCE(SUM(amount) FILTER (WHERE type = 'Expense'),             0) AS total_expense
       FROM transactions WHERE user_id = $1 ${dateFilter}`,
      params
    ),
    pool.query(
      `SELECT
         COALESCE((SELECT SUM(initial_balance) FROM accounts WHERE user_id = $1), 0)
         + COALESCE(SUM(amount) FILTER (WHERE type IN ('Income','Revenue')), 0)
         - COALESCE(SUM(amount) FILTER (WHERE type = 'Expense'), 0)
         + COALESCE(SUM(amount) FILTER (WHERE type IN ('Balance Adjustment','Market Adjustment')), 0)
           AS net_worth
       FROM transactions WHERE user_id = $1`,
      [userId]
    ),
    pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM receivables WHERE user_id = $1 AND status = 'outstanding'`,
      [userId]
    ),
    pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM payables WHERE user_id = $1 AND status = 'outstanding'`,
      [userId]
    ),
  ]);

  const total_income  = flow.rows[0].total_income;
  const total_expense = flow.rows[0].total_expense;
  const net_balance   = (parseFloat(total_income) - parseFloat(total_expense)).toFixed(2);

  return {
    total_income,
    total_expense,
    net_balance,
    net_worth:         worth.rows[0].net_worth,
    total_receivables: recv.rows[0].total,
    total_payables:    pay.rows[0].total,
  };
}

/**
 * Dashboard data: 12-month income/expense/net trend, current-month expense
 * breakdown by category, account balances, and the current-month summary.
 * @param {number} userId
 */
export async function getDashboard(userId) {
  await ensureDefaults(userId);

  const [trendRes, catRes, balances] = await Promise.all([
    pool.query(
      `WITH months AS (
         SELECT generate_series(
           date_trunc('month', CURRENT_DATE) - interval '11 months',
           date_trunc('month', CURRENT_DATE),
           interval '1 month'
         ) AS m
       )
       SELECT to_char(months.m, 'YYYY-MM') AS ym,
              to_char(months.m, 'Mon')     AS label,
              COALESCE(SUM(t.amount) FILTER (WHERE t.type IN ('Income','Revenue')), 0) AS income,
              COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'Expense'),             0) AS expense
       FROM months
       LEFT JOIN transactions t
         ON t.user_id = $1 AND date_trunc('month', t.date) = months.m
       GROUP BY months.m
       ORDER BY months.m`,
      [userId]
    ),
    pool.query(
      `SELECT c.id AS category_id, c.name AS category_name, COALESCE(SUM(t.amount), 0) AS total
       FROM categories c
       JOIN transactions t ON t.category_id = c.id AND t.user_id = $1 AND t.type = 'Expense'
         AND date_trunc('month', t.date) = date_trunc('month', CURRENT_DATE)
       WHERE c.user_id = $1 AND c.kind = 'EXPENSE'
       GROUP BY c.id, c.name
       HAVING SUM(t.amount) > 0
       ORDER BY total DESC`,
      [userId]
    ),
    getBalances(userId),
  ]);

  const trends = trendRes.rows.map(r => ({
    ym: r.ym,
    label: r.label,
    income: r.income,
    expense: r.expense,
    net: (parseFloat(r.income) - parseFloat(r.expense)).toFixed(2),
  }));

  const now = new Date();
  const summary = await getSummary(userId, { month: now.getMonth() + 1, year: now.getFullYear() });

  return {
    trends,
    expense_by_category: catRes.rows,
    balances,
    summary,
  };
}

/**
 * Today-scoped finance briefing for the Today Dashboard (Roadmap Wave 2).
 * Returns today's income/expense totals plus outstanding receivables/payables
 * coming due within the next 7 days. All money fields are returned as numbers
 * (the dashboard formats at the display boundary).
 * @param {number} userId
 */
export async function getTodayDashboard(userId) {
  const [flow, recv, pay, recvList, payList] = await Promise.all([
    pool.query(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE type = 'Income'),  0) AS today_income,
         COALESCE(SUM(amount) FILTER (WHERE type = 'Revenue'), 0) AS today_revenue,
         COALESCE(SUM(amount) FILTER (WHERE type = 'Expense'), 0) AS today_expense
       FROM transactions
       WHERE user_id = $1 AND date = CURRENT_DATE`,
      [userId]
    ),
    pool.query(
      `SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
       FROM receivables
       WHERE user_id = $1 AND status = 'outstanding'
         AND due_date IS NOT NULL AND due_date <= CURRENT_DATE + INTERVAL '7 days'`,
      [userId]
    ),
    pool.query(
      `SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total
       FROM payables
       WHERE user_id = $1 AND status = 'outstanding'
         AND due_date IS NOT NULL AND due_date <= CURRENT_DATE + INTERVAL '7 days'`,
      [userId]
    ),
    // Wave 4: the actual rows so the briefing can list who/what is due, not just a count.
    pool.query(
      `SELECT id, person, amount, due_date
       FROM receivables
       WHERE user_id = $1 AND status = 'outstanding'
         AND due_date IS NOT NULL AND due_date <= CURRENT_DATE + INTERVAL '7 days'
       ORDER BY due_date ASC
       LIMIT 5`,
      [userId]
    ),
    pool.query(
      `SELECT id, person, amount, due_date
       FROM payables
       WHERE user_id = $1 AND status = 'outstanding'
         AND due_date IS NOT NULL AND due_date <= CURRENT_DATE + INTERVAL '7 days'
       ORDER BY due_date ASC
       LIMIT 5`,
      [userId]
    ),
  ]);

  const mapDue = (r) => ({ id: r.id, person: r.person, amount: parseFloat(r.amount), due_date: r.due_date });

  return {
    today_income:  parseFloat(flow.rows[0].today_income),
    today_revenue: parseFloat(flow.rows[0].today_revenue),
    today_expense: parseFloat(flow.rows[0].today_expense),
    receivables_due_this_week: {
      count: parseInt(recv.rows[0].count, 10),
      total: parseFloat(recv.rows[0].total),
    },
    payables_due_this_week: {
      count: parseInt(pay.rows[0].count, 10),
      total: parseFloat(pay.rows[0].total),
    },
    // Itemized lists (≤5 each) for the Today Dashboard reminders (Wave 4).
    receivables_due: recvList.rows.map(mapDue),
    payables_due:    payList.rows.map(mapDue),
  };
}

// ─── Receivables & Payables (shared shape) ─────────────────────────────────────

const LEDGER_TABLES = { receivables: 'receivables', payables: 'payables' };

/**
 * @param {'receivables'|'payables'} table
 * @param {number} userId
 * @param {{ status?: 'outstanding'|'settled' }} opts
 */
export async function listLedger(table, userId, { status } = {}) {
  const t = LEDGER_TABLES[table];
  const params = [userId];
  let where = 'l.user_id = $1';
  if (status) {
    params.push(status);
    where += ` AND l.status = $${params.length}`;
  }
  const { rows } = await pool.query(
    `SELECT l.id, l.person, l.description, l.amount, l.due_date, l.status,
            l.account_id, l.settled_at, l.created_at, l.updated_at,
            a.name AS account_name, a.type AS account_type
     FROM ${t} l
     LEFT JOIN accounts a ON a.id = l.account_id
     WHERE ${where}
     ORDER BY (l.status = 'settled'), l.due_date NULLS LAST, l.created_at DESC`,
    params
  );
  return rows;
}

export async function getLedgerById(table, id, userId) {
  const t = LEDGER_TABLES[table];
  const { rows } = await pool.query(
    `SELECT l.id, l.person, l.description, l.amount, l.due_date, l.status,
            l.account_id, l.settled_at, l.created_at, l.updated_at,
            a.name AS account_name, a.type AS account_type
     FROM ${t} l LEFT JOIN accounts a ON a.id = l.account_id
     WHERE l.id = $1 AND l.user_id = $2`,
    [id, userId]
  );
  return rows[0] ?? null;
}

export async function createLedger(table, userId, data) {
  const t = LEDGER_TABLES[table];
  const { person, description = null, amount, due_date = null, account_id = null } = data;
  await assertAccountsOwned(userId, [account_id]);
  const { rows } = await pool.query(
    `INSERT INTO ${t} (user_id, person, description, amount, due_date, account_id)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [userId, person, description, amount, due_date, account_id]
  );
  return getLedgerById(table, rows[0].id, userId);
}

export async function patchLedger(table, id, userId, data) {
  const t = LEDGER_TABLES[table];
  const allowed = ['person', 'description', 'amount', 'due_date', 'account_id', 'status'];
  const fields = Object.keys(data).filter(k => allowed.includes(k));
  if (fields.length === 0) return getLedgerById(table, id, userId);
  if (data.account_id) await assertAccountsOwned(userId, [data.account_id]);

  const set = fields.map((f, i) => `${f} = $${i + 3}`);
  const { rowCount } = await pool.query(
    `UPDATE ${t} SET ${set.join(', ')} WHERE id = $1 AND user_id = $2`,
    [id, userId, ...fields.map(f => data[f])]
  );
  if (rowCount === 0) return null;
  return getLedgerById(table, id, userId);
}

export async function deleteLedger(table, id, userId) {
  const t = LEDGER_TABLES[table];
  const res = await pool.query(`DELETE FROM ${t} WHERE id = $1 AND user_id = $2`, [id, userId]);
  return res.rowCount > 0;
}

/**
 * Settle a receivable or payable: post the matching ledger transaction (Income into
 * the account for a receivable, Expense out of it for a payable) and flip the row to
 * 'settled'. Atomic — both writes commit together or neither does.
 * @param {'receivables'|'payables'} table
 * @param {number} id
 * @param {number} userId
 * @param {{ account_id?: number, date?: string }} opts
 * @returns {Promise<object|null>} the settled row, or null if not found
 */
export async function settleLedger(table, id, userId, { account_id, date } = {}) {
  const t = LEDGER_TABLES[table];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: lrows } = await client.query(
      `SELECT * FROM ${t} WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [id, userId]
    );
    const ledger = lrows[0];
    if (!ledger) { await client.query('ROLLBACK'); return null; }
    if (ledger.status === 'settled') {
      await client.query('ROLLBACK');
      throw new AppError('Already settled.', 400, 'ALREADY_SETTLED');
    }

    const accountId = account_id ?? ledger.account_id;
    if (!accountId) {
      await client.query('ROLLBACK');
      throw new AppError('An account is required to settle.', 400, 'VALIDATION_ERROR', 'account_id');
    }
    const { rows: arows } = await client.query(
      `SELECT id FROM accounts WHERE id = $1 AND user_id = $2`,
      [accountId, userId]
    );
    if (arows.length === 0) {
      await client.query('ROLLBACK');
      throw new AppError('Account not found.', 400, 'VALIDATION_ERROR', 'account_id');
    }

    const isReceivable = table === 'receivables';
    const txType = isReceivable ? 'Income' : 'Expense';
    const descr  = `${isReceivable ? 'Receivable from' : 'Payable to'} ${ledger.person}` +
                   (ledger.description ? ` — ${ledger.description}` : '');

    await client.query(
      `INSERT INTO transactions
         (user_id, type, amount, description, date, source_account_id, dest_account_id, reconciled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)`,
      [
        userId, txType, ledger.amount, descr, date ?? new Date().toISOString().slice(0, 10),
        isReceivable ? null : accountId,   // Expense → source
        isReceivable ? accountId : null,   // Income  → dest
      ]
    );

    await client.query(
      `UPDATE ${t} SET status = 'settled', settled_at = NOW(), account_id = $3
       WHERE id = $1 AND user_id = $2`,
      [id, userId, accountId]
    );

    await client.query('COMMIT');
    return getLedgerById(table, id, userId);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// ─── Portfolio ─────────────────────────────────────────────────────────────────

/**
 * Holdings with derived market value, cost basis, and unrealized gain.
 * @param {number} userId
 */
export async function listPortfolio(userId) {
  const { rows } = await pool.query(
    `SELECT id, name, symbol, quantity, avg_price, current_price,
            ROUND(quantity * current_price, 2)                       AS market_value,
            ROUND(quantity * avg_price, 2)                           AS cost_basis,
            ROUND(quantity * current_price - quantity * avg_price, 2) AS gain,
            created_at, updated_at
     FROM portfolio WHERE user_id = $1 ORDER BY (quantity * current_price) DESC, name`,
    [userId]
  );
  return rows;
}

export async function getPortfolioById(id, userId) {
  const { rows } = await pool.query(
    `SELECT id, name, symbol, quantity, avg_price, current_price,
            ROUND(quantity * current_price, 2)                       AS market_value,
            ROUND(quantity * avg_price, 2)                           AS cost_basis,
            ROUND(quantity * current_price - quantity * avg_price, 2) AS gain,
            created_at, updated_at
     FROM portfolio WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return rows[0] ?? null;
}

export async function createPortfolio(userId, data) {
  const { name, symbol = null, quantity = 0, avg_price = 0, current_price = 0 } = data;
  const { rows } = await pool.query(
    `INSERT INTO portfolio (user_id, name, symbol, quantity, avg_price, current_price)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [userId, name, symbol, quantity, avg_price, current_price]
  );
  return getPortfolioById(rows[0].id, userId);
}

export async function patchPortfolio(id, userId, data) {
  const allowed = ['name', 'symbol', 'quantity', 'avg_price', 'current_price'];
  const fields = Object.keys(data).filter(k => allowed.includes(k));
  if (fields.length === 0) return getPortfolioById(id, userId);
  const set = fields.map((f, i) => `${f} = $${i + 3}`);
  const { rowCount } = await pool.query(
    `UPDATE portfolio SET ${set.join(', ')} WHERE id = $1 AND user_id = $2`,
    [id, userId, ...fields.map(f => data[f])]
  );
  if (rowCount === 0) return null;
  return getPortfolioById(id, userId);
}

export async function deletePortfolio(id, userId) {
  const res = await pool.query(`DELETE FROM portfolio WHERE id = $1 AND user_id = $2`, [id, userId]);
  return res.rowCount > 0;
}

// ─── Budgets ───────────────────────────────────────────────────────────────────

/**
 * Every EXPENSE category with its monthly budget and the amount spent in the given
 * month (defaults to the current month). Categories with no budget row report 0.
 * @param {number} userId
 * @param {{ month?: number, year?: number }} opts
 */
export async function listBudgets(userId, { month, year } = {}) {
  assertMonthYear(month, year); // Phase 8: clean 400 instead of make_date 500
  await ensureDefaults(userId);
  const now = new Date();
  const m = Number.isInteger(month) ? month : now.getMonth() + 1;
  const y = Number.isInteger(year)  ? year  : now.getFullYear();

  const { rows } = await pool.query(
    `SELECT c.id AS category_id, c.name AS category_name,
            b.id AS budget_id,
            COALESCE(b.amount, 0) AS amount,
            COALESCE((SELECT SUM(t.amount) FROM transactions t
                      WHERE t.user_id = $1 AND t.category_id = c.id AND t.type = 'Expense'
                        AND t.date >= make_date($2,$3,1)
                        AND t.date < (make_date($2,$3,1) + interval '1 month')), 0) AS spent
     FROM categories c
     LEFT JOIN budgets b ON b.category_id = c.id AND b.user_id = $1
     WHERE c.user_id = $1 AND c.kind = 'EXPENSE'
     ORDER BY c.name`,
    [userId, y, m]
  );
  return rows;
}

/**
 * Set (insert or update) the monthly budget for a category.
 * @param {number} userId
 * @param {number} categoryId
 * @param {number} amount
 * @returns {Promise<object>}
 */
export async function upsertBudget(userId, categoryId, amount) {
  const { rows: crows } = await pool.query(
    `SELECT id FROM categories WHERE id = $1 AND user_id = $2 AND kind = 'EXPENSE'`,
    [categoryId, userId]
  );
  if (crows.length === 0) {
    throw new AppError('Expense category not found.', 400, 'VALIDATION_ERROR', 'category_id');
  }
  const { rows } = await pool.query(
    `INSERT INTO budgets (user_id, category_id, amount)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, category_id) DO UPDATE SET amount = EXCLUDED.amount
     RETURNING id, category_id, amount, created_at, updated_at`,
    [userId, categoryId, amount]
  );
  return rows[0];
}

/**
 * A single budget row with its category name, scoped to the user. Used by the
 * Project Budget vs Actual endpoint (Wave 4) and the links ownership validator.
 * @param {number} userId
 * @param {number} budgetId
 * @returns {Promise<object|null>}
 */
export async function getBudgetById(userId, budgetId) {
  const { rows } = await pool.query(
    `SELECT b.id, b.category_id, b.amount, b.created_at, b.updated_at,
            c.name AS category_name
     FROM budgets b
     JOIN categories c ON c.id = b.category_id
     WHERE b.id = $1 AND b.user_id = $2`,
    [budgetId, userId]
  );
  return rows[0] ?? null;
}
