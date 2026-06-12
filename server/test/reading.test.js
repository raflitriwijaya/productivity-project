// Roadmap Wave 3: Reading Tracker model unit tests (pure DB-mock — no real DB,
// matching the rest of server/test). Verifies stat coercion, list shape, and the
// shelf-transition auto-stamping logic in updateBook (including the guard that
// prevents a duplicate current_page assignment).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/db.js', () => {
  const pool = { query: vi.fn(), connect: vi.fn(), on: vi.fn(), end: vi.fn() };
  return { pool, default: pool };
});
vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

const { pool } = await import('../lib/db.js');
const { listBooks, getReadingStats, updateBook } = await import('../models/reading.model.js');

beforeEach(() => vi.clearAllMocks());

describe('getReadingStats', () => {
  it('coerces the raw pg aggregates to numbers', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{
        want_to_read: '4', reading: '2', finished: '10', finished_this_year: '3',
        avg_rating: '4.5000000000000000', pages_read_this_year: '1200', total_pages_read: '3400',
      }],
    });

    const stats = await getReadingStats(1);

    expect(stats).toEqual({
      want_to_read: 4, reading: 2, finished: 10, finished_this_year: 3,
      avg_rating: 4.5, pages_read_this_year: 1200, total_pages_read: 3400,
    });
  });
});

describe('listBooks', () => {
  it('returns { data, meta } with a numeric total', async () => {
    // listBooks fires the data query and the count query via Promise.all.
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, title: 'Meditations' }] }) // data
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });                 // count

    const result = await listBooks(1, { page: 1, per_page: 20 });

    expect(result.data).toHaveLength(1);
    expect(result.meta).toEqual({ total: 1, page: 1, per_page: 20 });
  });

  it('falls back to a safe sort column for an unknown sort key', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] });

    await listBooks(1, { sort: 'evil; DROP TABLE books', order: 'sideways' });

    const dataSql = pool.query.mock.calls[0][0];
    expect(dataSql).toContain('ORDER BY created_at desc'); // not the injected value
  });
});

describe('updateBook shelf transitions', () => {
  it('stamps finished_at and back-fills current_page when finishing', async () => {
    // 1st query: getBookById (book currently want_to_read, 200 pages)
    pool.query.mockResolvedValueOnce({ rows: [{ id: 7, shelf: 'want_to_read', total_pages: 200, current_page: 0 }] });
    // 2nd query: the UPDATE
    pool.query.mockResolvedValueOnce({ rows: [{ id: 7, shelf: 'finished', finished_at: 'now', current_page: 200 }] });

    const updated = await updateBook(1, 7, { shelf: 'finished', rating: 5 });

    const updateSql = pool.query.mock.calls[1][0];
    expect(updateSql).toContain('finished_at = NOW()');
    expect(updateSql).toContain('current_page =');     // back-filled
    expect(updated.shelf).toBe('finished');
  });

  it('does NOT double-assign current_page when it is provided explicitly', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 8, shelf: 'reading', total_pages: 300, current_page: 150 }] });
    pool.query.mockResolvedValueOnce({ rows: [{ id: 8, shelf: 'finished' }] });

    await updateBook(1, 8, { shelf: 'finished', current_page: 280 });

    const updateSql = pool.query.mock.calls[1][0];
    // Exactly one current_page assignment (the explicit one), so the SQL stays valid.
    expect(updateSql.match(/current_page =/g)).toHaveLength(1);
    expect(updateSql).toContain('finished_at = NOW()');
  });

  it('returns null when the book does not exist / is not owned', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // getBookById → null
    const result = await updateBook(1, 999, { shelf: 'reading' });
    expect(result).toBeNull();
  });
});
