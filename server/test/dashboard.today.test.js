// Roadmap Wave 2: Today Dashboard model unit tests.
// Verifies the date-scoped stat functions return the documented shape and coerce
// the raw pg string aggregates into numbers/booleans. Pure DB-mock — no real DB.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/db.js', () => {
  const pool = { query: vi.fn(), connect: vi.fn(), on: vi.fn(), end: vi.fn() };
  return { pool, default: pool };
});
vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { pool } = await import('../lib/db.js');
const { getTodayStats } = await import('../models/todo.model.js');
const { getTodayDashboard } = await import('../models/finance.model.js');
const { getActiveLearningStats } = await import('../models/learning.model.js');
const { getTodayEngineerStats } = await import('../models/engineer.model.js');

beforeEach(() => vi.clearAllMocks());

describe('getTodayStats (todos)', () => {
  it('parses status-filtered counts into numbers', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ pending: '3', in_progress: '2', completed_today: '1', overdue: '4' }],
    });

    const stats = await getTodayStats(1);

    expect(stats).toEqual({ pending: 3, in_progress: 2, completed_today: 1, overdue: 4 });
  });
});

describe('getTodayDashboard (finance)', () => {
  it('returns today cash flow + receivable/payable dues as numbers', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ today_income: '5000', today_expense: '1200' }] })
      .mockResolvedValueOnce({ rows: [{ count: '2', total: '750.50' }] }) // receivables
      .mockResolvedValueOnce({ rows: [{ count: '1', total: '300' }] });   // payables

    const data = await getTodayDashboard(1);

    expect(data.today_income).toBe(5000);
    expect(data.today_expense).toBe(1200);
    expect(data.receivables_due_this_week).toEqual({ count: 2, total: 750.5 });
    expect(data.payables_due_this_week).toEqual({ count: 1, total: 300 });
  });
});

describe('getActiveLearningStats', () => {
  it('sums in-progress hours and coerces types', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ active_count: '2', total_spent_hours: '10.5', total_target_hours: '40' }],
    });

    const stats = await getActiveLearningStats(1);

    expect(stats).toEqual({ active_count: 2, total_spent_hours: 10.5, total_target_hours: 40 });
  });
});

describe('getTodayEngineerStats', () => {
  it('reports P0 count, check-in existence, and active project count', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })          // P0 issues
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }], rowCount: 1 }) // this week's check-in
      .mockResolvedValueOnce({ rows: [{ count: '3' }] });         // active projects

    const stats = await getTodayEngineerStats(1);

    expect(stats).toEqual({ open_p0_issues: 1, this_week_checkin_exists: true, active_projects: 3 });
  });

  it('reports no check-in when none exists this week', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] });

    const stats = await getTodayEngineerStats(1);

    expect(stats.this_week_checkin_exists).toBe(false);
  });
});
