// server/routes/finances.js
// Mounted in index.js as:
//   import { financesRouter } from './routes/finances.js';
//   app.use('/api/finances', requireAuth, financesRouter);
//
// Route order matters: every literal sub-resource path (/summary, /balances,
// /accounts, /receivables, …) is declared BEFORE the transaction `/:id` handlers,
// otherwise Express resolves e.g. "summary" as a transaction id.

import { Router } from 'express';
import { z } from 'zod';
import { TX_TYPES, LEDGER_STATUSES } from '../lib/enums.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../lib/AppError.js';
import { logger } from '../lib/logger.js';
import {
  listAccounts, getBalances, patchAccount,
  listCategories,
  listTransactions, getTransactionById, createTransaction, patchTransaction, deleteTransaction,
  getSummary, getDashboard,
  listLedger, createLedger, patchLedger, deleteLedger, settleLedger,
  listPortfolio, createPortfolio, patchPortfolio, deletePortfolio,
  listBudgets, upsertBudget,
} from '../models/finance.model.js';

const router = Router();

// ─── Shared constants & helpers ────────────────────────────────────────────────

const ADJUSTMENTS = ['Balance Adjustment', 'Market Adjustment'];
const DATE_RE    = /^\d{4}-\d{2}-\d{2}$/;
const nonEmpty   = (d) => Object.keys(d).length > 0;

/**
 * Parse ?month & ?year query params into integers.
 * Phase 8: absent → {} (all-time). Present-but-invalid (e.g. month=13, month=0,
 * year=abc, or only one of the two) → throw 400 instead of silently returning
 * all-time data, which looked like a successful filter to the user.
 */
function parseMonthYear(req) {
  const hasMonth = req.query.month !== undefined && req.query.month !== '';
  const hasYear  = req.query.year  !== undefined && req.query.year  !== '';
  if (!hasMonth && !hasYear) return {}; // neither supplied → all-time

  const month = parseInt(req.query.month, 10);
  const year  = parseInt(req.query.year, 10);
  const valid = Number.isInteger(month) && month >= 1 && month <= 12
             && Number.isInteger(year)  && year >= 1900;
  if (!valid) {
    throw new AppError(
      'month must be 1–12 and year must be a 4-digit year (both required together).',
      400, 'VALIDATION_ERROR', 'month'
    );
  }
  return { month, year };
}

const nullableId = z.number().int().positive().nullable().optional();

// ─── Zod schemas ────────────────────────────────────────────────────────────────

const txCreateSchema = z.object({
  type:              z.enum(TX_TYPES),
  amount:            z.number({ message: 'Amount must be a number.' }),
  description:       z.string().max(1000).nullable().optional(),
  date:              z.string().regex(DATE_RE, 'Date must be in YYYY-MM-DD format.'),
  source_account_id: nullableId,
  dest_account_id:   nullableId,
  category_id:       nullableId,
  reconciled:        z.boolean().optional().default(false),
})
  .refine(d => d.amount !== 0, { message: 'Amount cannot be zero.', path: ['amount'] })
  .refine(d => ADJUSTMENTS.includes(d.type) || d.amount > 0, {
    message: 'Amount must be greater than 0.', path: ['amount'],
  });

const txPatchSchema = z.object({
  type:              z.enum(TX_TYPES).optional(),
  amount:            z.number().optional(),
  description:       z.string().max(1000).nullable().optional(),
  date:              z.string().regex(DATE_RE).optional(),
  source_account_id: nullableId,
  dest_account_id:   nullableId,
  category_id:       nullableId,
  reconciled:        z.boolean().optional(),
})
  .refine(nonEmpty, { message: 'At least one field must be provided.' })
  .refine(d => d.amount === undefined || d.amount !== 0, { message: 'Amount cannot be zero.', path: ['amount'] })
  .refine(
    d => d.amount === undefined || d.type === undefined || ADJUSTMENTS.includes(d.type) || d.amount > 0,
    { message: 'Amount must be greater than 0.', path: ['amount'] }
  );

const accountPatchSchema = z.object({
  name:            z.string().min(1, 'Name is required.').max(100).optional(),
  initial_balance: z.number().optional(),
}).refine(nonEmpty, { message: 'At least one field must be provided.' });

const ledgerCreateSchema = z.object({
  person:      z.string().min(1, 'Person is required.').max(255),
  description: z.string().max(1000).nullable().optional(),
  amount:      z.number().positive('Amount must be greater than 0.'),
  due_date:    z.string().regex(DATE_RE, 'Date must be in YYYY-MM-DD format.').nullable().optional(),
  account_id:  nullableId,
});

const ledgerPatchSchema = z.object({
  person:      z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  amount:      z.number().positive().optional(),
  due_date:    z.string().regex(DATE_RE).nullable().optional(),
  account_id:  nullableId,
  status:      z.enum(LEDGER_STATUSES).optional(),
}).refine(nonEmpty, { message: 'At least one field must be provided.' });

const settleSchema = z.object({
  account_id: nullableId,
  date:       z.string().regex(DATE_RE).nullable().optional(),
});

const portfolioCreateSchema = z.object({
  name:          z.string().min(1, 'Name is required.').max(255),
  symbol:        z.string().max(50).nullable().optional(),
  quantity:      z.number().min(0).optional().default(0),
  avg_price:     z.number().min(0).optional().default(0),
  current_price: z.number().min(0).optional().default(0),
});

const portfolioPatchSchema = z.object({
  name:          z.string().min(1).max(255).optional(),
  symbol:        z.string().max(50).nullable().optional(),
  quantity:      z.number().min(0).optional(),
  avg_price:     z.number().min(0).optional(),
  current_price: z.number().min(0).optional(),
}).refine(nonEmpty, { message: 'At least one field must be provided.' });

const budgetSchema = z.object({
  category_id: z.number().int().positive(),
  amount:      z.number().min(0, 'Budget cannot be negative.'),
});

// ─── Aggregates ──────────────────────────────────────────────────────────────────

// GET /api/finances/summary?month&year — month-scoped when both present, else all-time.
router.get('/summary', async (req, res, next) => {
  try {
    const summary = await getSummary(req.user.id, parseMonthYear(req));
    res.json({ success: true, data: summary });
  } catch (err) { next(err); }
});

// GET /api/finances/balances — every account with its live balance.
router.get('/balances', async (req, res, next) => {
  try {
    const balances = await getBalances(req.user.id);
    res.json({ success: true, data: balances });
  } catch (err) { next(err); }
});

// GET /api/finances/dashboard — 12-month trend + breakdowns.
router.get('/dashboard', async (req, res, next) => {
  try {
    const data = await getDashboard(req.user.id);
    res.json({ success: true, data });
  } catch (err) { next(err); }
});

// GET /api/finances/overview?month&year — one-screen financial review (V6 §13.2).
// Consolidates Transactions / Accounts / Receivables / Payables / Portfolio /
// Budget into a single payload so a monthly review no longer means hopping
// between pages. Additive — every detail page stays untouched. Built entirely on
// existing model functions (listBudgets already returns spend; listPortfolio
// already derives market_value/gain) so no new SQL or column assumptions.
router.get('/overview', async (req, res, next) => {
  try {
    const userId = req.user.id;
    // month+year are required-together here (the UI always sends both); reuse the
    // shared parser so an invalid pair is a clean 400. Default to the current
    // month when neither is supplied.
    const { month, year } = parseMonthYear(req);
    const now = new Date();
    const m = month ?? now.getMonth() + 1;
    const y = year ?? now.getFullYear();

    const today    = new Date().toISOString().slice(0, 10);
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

    const [summary, budgets, receivables, payables, portfolio, recentTx, accounts] =
      await Promise.all([
        getSummary(userId, { month: m, year: y }),
        listBudgets(userId, { month: m, year: y }),
        listLedger('receivables', userId, { status: 'outstanding' }),
        listLedger('payables', userId, { status: 'outstanding' }),
        listPortfolio(userId),
        listTransactions(userId, { page: 1, perPage: 10 }),
        getBalances(userId),
      ]);

    const income  = parseFloat(summary.total_income) || 0;
    const expense = parseFloat(summary.total_expense) || 0;

    // Budget vs actual — listBudgets already computed `spent`. Keep only categories
    // with a budget set or some spend, biggest spenders first.
    const budgetVsActual = budgets
      .map((b) => {
        const budgeted = parseFloat(b.amount) || 0;
        const spent    = parseFloat(b.spent) || 0;
        return {
          category_id:   b.category_id,
          category_name: b.category_name,
          budgeted,
          spent,
          remaining: budgeted - spent,
          percent:   budgeted > 0 ? (spent / budgeted) * 100 : 0,
        };
      })
      .filter((b) => b.budgeted > 0 || b.spent > 0)
      .sort((a, b) => b.spent - a.spent);

    // Aging buckets via lexicographic YYYY-MM-DD comparison (works whether pg
    // returns the DATE as a string or a Date). No due date → 'upcoming'.
    const agingOf = (rows) => {
      const aging = { overdue: 0, due_soon: 0, upcoming: 0, total: 0 };
      const items = rows.map((r) => {
        const dueStr = r.due_date
          ? (typeof r.due_date === 'string'
              ? r.due_date.slice(0, 10)
              : new Date(r.due_date).toISOString().slice(0, 10))
          : null;
        let bucket = 'upcoming';
        if (dueStr && dueStr < today) bucket = 'overdue';
        else if (dueStr && dueStr <= nextWeek) bucket = 'due_soon';
        const amount = parseFloat(r.amount) || 0;
        aging[bucket] += amount;
        aging.total   += amount;
        return { id: r.id, person: r.person, amount, due_date: r.due_date, aging: bucket };
      });
      return { items, aging };
    };

    const holdings = portfolio.map((h) => ({
      id:           h.id,
      name:         h.name,
      symbol:       h.symbol,
      quantity:     h.quantity,
      market_value: parseFloat(h.market_value) || 0,
      gain:         parseFloat(h.gain) || 0,
    }));
    const portfolioTotal = holdings.reduce((sum, h) => sum + h.market_value, 0);

    res.json({
      success: true,
      data: {
        month: m,
        year:  y,
        summary: { income, expense, net: income - expense },
        accounts,
        budget_vs_actual: budgetVsActual,
        receivables: agingOf(receivables),
        payables:    agingOf(payables),
        portfolio:   { holdings, total: portfolioTotal },
        recent_transactions: recentTx.rows,
      },
    });
  } catch (err) { next(err); }
});

// ─── Accounts ────────────────────────────────────────────────────────────────────

router.get('/accounts', async (req, res, next) => {
  try {
    const accounts = await listAccounts(req.user.id);
    res.json({ success: true, data: accounts });
  } catch (err) { next(err); }
});

router.patch('/accounts/:id', validate(accountPatchSchema), async (req, res, next) => {
  try {
    const updated = await patchAccount(Number(req.params.id), req.user.id, req.body);
    if (!updated) throw new AppError('Account not found.', 404, 'NOT_FOUND');
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// ─── Categories ────────────────────────────────────────────────────────────────

router.get('/categories', async (req, res, next) => {
  try {
    const kind = ['INCOME', 'EXPENSE', 'SYSTEM'].includes(req.query.kind) ? req.query.kind : undefined;
    const categories = await listCategories(req.user.id, { kind });
    res.json({ success: true, data: categories });
  } catch (err) { next(err); }
});

// ─── Receivables / Payables (shared handlers) ──────────────────────────────────

for (const table of ['receivables', 'payables']) {
  router.get(`/${table}`, async (req, res, next) => {
    try {
      const status = ['outstanding', 'settled'].includes(req.query.status) ? req.query.status : undefined;
      const rows = await listLedger(table, req.user.id, { status });
      res.json({ success: true, data: rows });
    } catch (err) { next(err); }
  });

  router.post(`/${table}`, validate(ledgerCreateSchema), async (req, res, next) => {
    try {
      const row = await createLedger(table, req.user.id, req.body);
      res.status(201).json({ success: true, data: row });
    } catch (err) { next(err); }
  });

  router.patch(`/${table}/:id`, validate(ledgerPatchSchema), async (req, res, next) => {
    try {
      const row = await patchLedger(table, Number(req.params.id), req.user.id, req.body);
      if (!row) throw new AppError('Record not found.', 404, 'NOT_FOUND');
      res.json({ success: true, data: row });
    } catch (err) { next(err); }
  });

  router.post(`/${table}/:id/settle`, validate(settleSchema), async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const row = await settleLedger(table, id, req.user.id, req.body);
      if (!row) throw new AppError('Record not found.', 404, 'NOT_FOUND');
      (req.log ?? logger).info({ event: 'SETTLE', userId: req.user.id, ledgerType: table, ledgerId: id, reqId: req.id }, `User ${req.user.id} settled ${table} ${id}`);
      res.json({ success: true, data: row });
    } catch (err) { next(err); }
  });

  router.delete(`/${table}/:id`, async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const ok = await deleteLedger(table, id, req.user.id);
      if (!ok) throw new AppError('Record not found.', 404, 'NOT_FOUND');
      (req.log ?? logger).info({ event: 'DELETE', userId: req.user.id, resource: table, resourceId: id, reqId: req.id }, `User ${req.user.id} deleted ${table} ${id}`);
      res.json({ success: true, data: null });
    } catch (err) { next(err); }
  });
}

// ─── Portfolio ─────────────────────────────────────────────────────────────────

router.get('/portfolio', async (req, res, next) => {
  try {
    const rows = await listPortfolio(req.user.id);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

router.post('/portfolio', validate(portfolioCreateSchema), async (req, res, next) => {
  try {
    const row = await createPortfolio(req.user.id, req.body);
    res.status(201).json({ success: true, data: row });
  } catch (err) { next(err); }
});

router.patch('/portfolio/:id', validate(portfolioPatchSchema), async (req, res, next) => {
  try {
    const row = await patchPortfolio(Number(req.params.id), req.user.id, req.body);
    if (!row) throw new AppError('Holding not found.', 404, 'NOT_FOUND');
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
});

router.delete('/portfolio/:id', async (req, res, next) => {
  try {
    const ok = await deletePortfolio(Number(req.params.id), req.user.id);
    if (!ok) throw new AppError('Holding not found.', 404, 'NOT_FOUND');
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});

// ─── Budgets ───────────────────────────────────────────────────────────────────

// GET /api/finances/budgets?month&year — every expense category with budget + spend.
router.get('/budgets', async (req, res, next) => {
  try {
    const rows = await listBudgets(req.user.id, parseMonthYear(req));
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// PUT /api/finances/budgets — set (insert/update) one category's monthly budget.
router.put('/budgets', validate(budgetSchema), async (req, res, next) => {
  try {
    const row = await upsertBudget(req.user.id, req.body.category_id, req.body.amount);
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
});

// ─── Transactions (generic — declared LAST so /:id can't shadow the above) ───────

router.get('/', async (req, res, next) => {
  try {
    const page    = Math.max(1, parseInt(req.query.page ?? '1', 10));
    const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page ?? '50', 10)));
    const type    = TX_TYPES.includes(req.query.type) ? req.query.type : undefined;
    const categoryId = Number.isInteger(parseInt(req.query.category_id, 10)) ? parseInt(req.query.category_id, 10) : undefined;
    const accountId  = Number.isInteger(parseInt(req.query.account_id, 10))  ? parseInt(req.query.account_id, 10)  : undefined;
    const search  = typeof req.query.search === 'string' && req.query.search.trim() ? req.query.search.trim() : undefined;

    const { rows, total } = await listTransactions(req.user.id, {
      ...parseMonthYear(req), type, categoryId, accountId, search, page, perPage,
    });

    res.json({ success: true, data: rows, meta: { total, page, per_page: perPage } });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const row = await getTransactionById(Number(req.params.id), req.user.id);
    if (!row) throw new AppError('Transaction not found.', 404, 'NOT_FOUND');
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
});

router.post('/', validate(txCreateSchema), async (req, res, next) => {
  try {
    const row = await createTransaction(req.user.id, req.body);
    (req.log ?? logger).info({ event: 'TRANSACTION_CREATE', userId: req.user.id, type: req.body.type, amount: req.body.amount, transactionId: row.id, reqId: req.id }, `User ${req.user.id} created ${req.body.type} transaction ${row.id} for ${req.body.amount}`);
    res.status(201).json({ success: true, data: row });
  } catch (err) { next(err); }
});

router.patch('/:id', validate(txPatchSchema), async (req, res, next) => {
  try {
    const updated = await patchTransaction(Number(req.params.id), req.user.id, req.body);
    if (!updated) throw new AppError('Transaction not found.', 404, 'NOT_FOUND');
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const deleted = await deleteTransaction(id, req.user.id);
    if (!deleted) throw new AppError('Transaction not found.', 404, 'NOT_FOUND');
    (req.log ?? logger).info({ event: 'DELETE', userId: req.user.id, resource: 'transaction', resourceId: id, reqId: req.id }, `User ${req.user.id} deleted transaction ${id}`);
    res.json({ success: true, data: null });
  } catch (err) { next(err); }
});

export { router as financesRouter };
export default router;
