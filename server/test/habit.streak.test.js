// Unit tests for deriveStreak — the core habit streak logic in goals.model.js.
// Uses a mocked pool so no DB is needed; each case controls exactly what
// habit_logs rows are returned plus what CURRENT_DATE evaluates to.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/db.js', () => {
  const pool = { query: vi.fn(), connect: vi.fn(), on: vi.fn(), end: vi.fn() };
  return { pool, default: pool };
});
vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

const { default: pool } = await import('../lib/db.js');
const { deriveStreak } = await import('../models/goals.model.js');

beforeEach(() => vi.clearAllMocks());

// Helper: configure the mock so that the first pool.query returns log rows and
// the second returns the given "today" date string.
function mockLogs(logDates, today) {
  pool.query
    .mockResolvedValueOnce({ rows: logDates.map((d) => ({ d })) }) // habit_logs SELECT
    .mockResolvedValueOnce({ rows: [{ today }] });                  // CURRENT_DATE SELECT
}

describe('deriveStreak', () => {
  it('returns streak 0 and total 0 when there are no logs', async () => {
    mockLogs([], '2026-06-13');
    const result = await deriveStreak(1, 42);
    expect(result.streak).toBe(0);
    expect(result.total).toBe(0);
    expect(result.checkedToday).toBe(false);
    expect(result.today).toBe('2026-06-13');
  });

  it('returns streak 1 when only today is logged', async () => {
    mockLogs(['2026-06-13'], '2026-06-13');
    const result = await deriveStreak(1, 42);
    expect(result.streak).toBe(1);
    expect(result.checkedToday).toBe(true);
    expect(result.total).toBe(1);
  });

  it('counts consecutive days back from today', async () => {
    // Logged 3 consecutive days ending today
    mockLogs(['2026-06-11', '2026-06-12', '2026-06-13'], '2026-06-13');
    const result = await deriveStreak(1, 42);
    expect(result.streak).toBe(3);
    expect(result.checkedToday).toBe(true);
  });

  it('stops counting at a gap in the middle (today logged, gap 2 days ago)', async () => {
    // 2026-06-11 (gap at 2026-06-12), then 2026-06-13 today
    mockLogs(['2026-06-11', '2026-06-13'], '2026-06-13');
    const result = await deriveStreak(1, 42);
    expect(result.streak).toBe(1); // only today counts; gap breaks the chain
  });

  it('counts from yesterday when today is not logged', async () => {
    // Logged yesterday and day before — not today
    mockLogs(['2026-06-11', '2026-06-12'], '2026-06-13');
    const result = await deriveStreak(1, 42);
    expect(result.streak).toBe(2);
    expect(result.checkedToday).toBe(false);
  });

  it('returns streak 0 when only today is missed and yesterday is also missed', async () => {
    // Last log was 3 days ago — streak broken
    mockLogs(['2026-06-10'], '2026-06-13');
    const result = await deriveStreak(1, 42);
    expect(result.streak).toBe(0);
    expect(result.checkedToday).toBe(false);
  });

  it('counts streak from today even when older logs exist after a gap', async () => {
    // Ancient log, gap, then today — streak is 1 (today only)
    mockLogs(['2026-01-01', '2026-06-13'], '2026-06-13');
    const result = await deriveStreak(1, 42);
    expect(result.streak).toBe(1);
    expect(result.total).toBe(2);
  });
});
