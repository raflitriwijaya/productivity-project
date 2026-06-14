// server/test/performance.test.js
//
// API response-time baselines. These pin a ceiling on how long each hot endpoint
// may take so a performance regression (an accidental N+1, a dropped index, a
// runaway aggregation) fails loudly instead of silently degrading.
//
// OPT-IN: the whole suite is skipped unless a live server is reachable, signalled
// by TEST_SERVER=1 (or by providing TEST_SESSION_COOKIE). It therefore never runs
// in the default `npm test` / CI lane. To run it:
//   1. Start the API:  (cd server && npm run dev)
//   2. Log in and copy your `sid` cookie value.
//   3. TEST_SERVER=1 TEST_SESSION_COOKIE=<sid> npm run test:performance
//
// All paths verified against server/index.js mounts + server/routes/*.js.
import { describe, it, expect } from 'vitest';

// Thresholds in milliseconds -- fail if any endpoint exceeds these.
const THRESHOLDS = {
  '/health': { max: 100, desc: 'health check' },
  '/api/auth/me': { max: 200, desc: 'session check' },
  '/api/todos?per_page=5': { max: 200, desc: 'todos list' },
  '/api/finances/balances': { max: 500, desc: 'account balances' },
  '/api/finances/portfolio': { max: 300, desc: 'portfolio list' },
  '/api/finances/summary': { max: 500, desc: 'finance summary' },
  '/api/finances/dashboard': { max: 1000, desc: 'finance dashboard' },
  '/api/research?per_page=10': { max: 500, desc: 'research list' },
  '/api/reading?per_page=10': { max: 300, desc: 'reading list' },
  '/api/dashboard/today': { max: 1000, desc: 'today dashboard' },
  '/api/goals?per_page=10': { max: 300, desc: 'goals list' },
  '/api/review/weekly': { max: 1500, desc: 'weekly review' },
  '/api/review/annual?year=2026': { max: 2000, desc: 'annual report' },
  '/api/polymath': { max: 2000, desc: 'polymath dashboard' },
};

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || '';

// Only run when a live server is explicitly available -- otherwise these would
// fail with connection-refused in unit/CI lanes.
const hasServer = !!process.env.TEST_SERVER || !!SESSION_COOKIE;

describe.skipIf(!hasServer)('API Response Time Baselines', () => {
  Object.entries(THRESHOLDS).forEach(([path, { max, desc }]) => {
    it(`${desc} (${path}) responds within ${max}ms`, async () => {
      const start = Date.now();
      const response = await fetch(`${BASE_URL}${path}`, {
        headers: SESSION_COOKIE ? { Cookie: `sid=${SESSION_COOKIE}` } : {},
      });
      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThanOrEqual(max);
    }, max + 3000); // per-test timeout = threshold + 3s buffer
  });
});
