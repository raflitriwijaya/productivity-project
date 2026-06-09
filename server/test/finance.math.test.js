// Phase 4: finance balance/summary math unit tests
// Tests the centralized getSummary computation against known inputs (pure DB-mock).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/db.js', () => {
  const pool = { query: vi.fn(), connect: vi.fn(), on: vi.fn(), end: vi.fn() };
  return { pool, default: pool };
});
vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { pool } = await import('../lib/db.js');
const { getSummary, getBalances } = await import('../models/finance.model.js');

beforeEach(() => vi.clearAllMocks());

describe('getSummary math', () => {
  it('net_balance = total_income − total_expense', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ total_income: '1500.00', total_expense: '400.00' }] }) // flow
      .mockResolvedValueOnce({ rows: [{ net_worth: '5000.00' }] })                             // worth
      .mockResolvedValueOnce({ rows: [{ total: '200.00' }] })                                  // receivables
      .mockResolvedValueOnce({ rows: [{ total: '100.00' }] });                                 // payables

    const summary = await getSummary(1, { month: 6, year: 2026 });

    expect(parseFloat(summary.net_balance)).toBeCloseTo(1100, 2);
    expect(summary.total_income).toBe('1500.00');
    expect(summary.total_expense).toBe('400.00');
    expect(summary.net_worth).toBe('5000.00');
    expect(summary.total_receivables).toBe('200.00');
    expect(summary.total_payables).toBe('100.00');
  });

  it('net_balance is zero when income equals expense', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ total_income: '750.00', total_expense: '750.00' }] })
      .mockResolvedValueOnce({ rows: [{ net_worth: '0.00' }] })
      .mockResolvedValueOnce({ rows: [{ total: '0.00' }] })
      .mockResolvedValueOnce({ rows: [{ total: '0.00' }] });

    const summary = await getSummary(1);
    expect(parseFloat(summary.net_balance)).toBe(0);
  });

  it('net_balance is negative when expense exceeds income', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ total_income: '300.00', total_expense: '500.00' }] })
      .mockResolvedValueOnce({ rows: [{ net_worth: '-200.00' }] })
      .mockResolvedValueOnce({ rows: [{ total: '0.00' }] })
      .mockResolvedValueOnce({ rows: [{ total: '0.00' }] });

    const summary = await getSummary(1);
    expect(parseFloat(summary.net_balance)).toBeCloseTo(-200, 2);
  });
});

describe('getBalances — ownership scoping', () => {
  it('queries accounts only for the given userId', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // ensureDefaults: accounts insert
      .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // ensureDefaults: categories insert
      .mockResolvedValueOnce({                          // getBalances select
        rows: [
          { id: 10, name: 'Cash', type: 'CASH', initial_balance: '500.00', balance: '600.00' },
        ],
      });

    const balances = await getBalances(42);

    // Every parameterized query must have userId=42 as $1
    for (const call of pool.query.mock.calls) {
      expect(call[1][0]).toBe(42);
    }
    expect(balances).toHaveLength(1);
    expect(balances[0].balance).toBe('600.00');
  });
});
