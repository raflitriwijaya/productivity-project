// Phase 4: settle atomicity test — a mid-settle failure leaves no partial ledger state
// Phase 10: replaced positional mockResolvedValueOnce chains with SQL-matching
// mockImplementation so reordering equally-correct SQL doesn't desync the mock.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockClient = {
  query: vi.fn(),
  release: vi.fn(),
};

vi.mock('../lib/db.js', () => {
  const pool = {
    query: vi.fn(),
    connect: vi.fn().mockResolvedValue(mockClient),
    on: vi.fn(),
    end: vi.fn(),
  };
  return { pool, default: pool };
});
vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { pool } = await import('../lib/db.js');
const { settleLedger } = await import('../models/finance.model.js');

beforeEach(() => {
  vi.clearAllMocks();
  pool.connect.mockResolvedValue(mockClient);
});

describe('settleLedger atomicity', () => {
  it('rolls back when the transaction INSERT fails mid-settle', async () => {
    // Phase 10: match on SQL content, not call order — reordering correct SQL won't desync.
    mockClient.query.mockImplementation((sql) => {
      if (sql === 'BEGIN')    return Promise.resolve({ rows: [] });
      if (sql === 'ROLLBACK') return Promise.resolve({ rows: [] });
      if (/FROM receivables/i.test(sql)) return Promise.resolve({ rows: [{
        id: 1, user_id: 1, person: 'Alice', description: 'test',
        amount: '500.00', status: 'outstanding', account_id: 10, due_date: null,
      }] });
      if (/FROM accounts/i.test(sql))              return Promise.resolve({ rows: [{ id: 10 }] });
      if (/INSERT INTO transactions/i.test(sql))   return Promise.reject(new Error('DB write error'));
      return Promise.resolve({ rows: [] });
    });

    await expect(settleLedger('receivables', 1, 1, { account_id: 10 }))
      .rejects.toThrow('DB write error');

    const calls = mockClient.query.mock.calls.map(c => c[0]);
    expect(calls).toContain('ROLLBACK');
    expect(calls).not.toContain('COMMIT');
  });

  it('rolls back when the row is already settled', async () => {
    mockClient.query.mockImplementation((sql) => {
      if (sql === 'BEGIN')    return Promise.resolve({ rows: [] });
      if (sql === 'ROLLBACK') return Promise.resolve({ rows: [] });
      if (/FROM receivables/i.test(sql)) return Promise.resolve({ rows: [{
        id: 2, status: 'settled', account_id: 10, amount: '200.00', user_id: 1,
      }] });
      return Promise.resolve({ rows: [] });
    });

    await expect(settleLedger('receivables', 2, 1, {}))
      .rejects.toMatchObject({ code: 'ALREADY_SETTLED' });

    const calls = mockClient.query.mock.calls.map(c => c[0]);
    expect(calls.filter(q => q === 'ROLLBACK').length).toBeGreaterThanOrEqual(1);
    expect(calls).not.toContain('COMMIT');
  });

  it('commits successfully when all steps pass', async () => {
    mockClient.query.mockImplementation((sql) => {
      if (sql === 'BEGIN')    return Promise.resolve({ rows: [] });
      if (sql === 'COMMIT')   return Promise.resolve({ rows: [] });
      if (/FROM receivables/i.test(sql)) return Promise.resolve({ rows: [{
        id: 3, user_id: 1, person: 'Bob', description: null,
        amount: '1000.00', status: 'outstanding', account_id: 10, due_date: null,
      }] });
      if (/FROM accounts/i.test(sql))            return Promise.resolve({ rows: [{ id: 10 }] });
      if (/INSERT INTO transactions/i.test(sql)) return Promise.resolve({ rows: [] });
      if (/UPDATE receivables/i.test(sql))       return Promise.resolve({ rows: [] });
      return Promise.resolve({ rows: [] });
    });

    // getLedgerById after COMMIT uses pool.query (not the transaction client)
    pool.query.mockResolvedValueOnce({
      rows: [{
        id: 3, person: 'Bob', amount: '1000.00', status: 'settled',
        account_id: 10, settled_at: new Date(),
      }],
    });

    const result = await settleLedger('receivables', 3, 1, { account_id: 10 });

    const calls = mockClient.query.mock.calls.map(c => c[0]);
    expect(calls).toContain('COMMIT');
    expect(calls).not.toContain('ROLLBACK');
    expect(result.status).toBe('settled');
  });
});
