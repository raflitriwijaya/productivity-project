// Phase 4: ownership scoping tests — user A cannot read/modify user B's rows
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/db.js', () => {
  const pool = { query: vi.fn(), connect: vi.fn(), on: vi.fn(), end: vi.fn() };
  return { pool, default: pool };
});
vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { pool } = await import('../lib/db.js');
const {
  getTransactionById,
  patchTransaction,
  deleteTransaction,
  createTransaction,
} = await import('../models/finance.model.js');

beforeEach(() => vi.clearAllMocks());

const USER_A = 1;
const _USER_B = 2;

describe('Transaction ownership — user A cannot access user B rows', () => {
  it('getTransactionById returns null for a row owned by user B', async () => {
    // DB returns no rows when (id=99, user_id=USER_A) doesn't match
    pool.query.mockResolvedValueOnce({ rows: [] });
    const tx = await getTransactionById(99, USER_A);
    expect(tx).toBeNull();
    // Confirm user_id=$2 param is USER_A
    expect(pool.query.mock.calls[0][1]).toContain(USER_A);
    expect(pool.query.mock.calls[0][1]).toContain(99);
  });

  it('patchTransaction returns null when row belongs to another user', async () => {
    // getTransactionById (ownership check via user_id) returns nothing
    pool.query.mockResolvedValueOnce({ rows: [] });
    const result = await patchTransaction(99, USER_A, { description: 'hack' });
    expect(result).toBeNull();
  });

  it('deleteTransaction returns false when row belongs to another user', async () => {
    pool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const deleted = await deleteTransaction(99, USER_A);
    expect(deleted).toBe(false);
    // DELETE query must carry USER_A as the user_id parameter
    expect(pool.query.mock.calls[0][1]).toContain(USER_A);
  });

  it('createTransaction rejects an account that belongs to user B', async () => {
    // assertAccountsOwned: query returns only 0 matching rows (account belongs to B)
    pool.query
      .mockResolvedValueOnce({ rows: [] })  // validateTransactionShape (no pre-query)
      .mockResolvedValueOnce({ rows: [] }); // assertAccountsOwned → 0 of 1 found

    await expect(
      createTransaction(USER_A, {
        type: 'Income',
        amount: 100,
        date: '2026-06-01',
        dest_account_id: 999, // account owned by user B
      })
    ).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
  });
});
