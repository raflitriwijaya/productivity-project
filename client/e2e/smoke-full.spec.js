// client/e2e/smoke-full.spec.js
//
// Full-system smoke test: every authenticated page must load without a hard
// navigation error and without tripping the React error boundary. This is the
// broad "did anything blow up" net that complements the focused smoke.spec.js.
//
// OPT-IN: SKIPPED unless RUN_SMOKE=1. Reason: it boots an authenticated session
// and walks ~27 routes across both browser projects (~50+ navigations). It needs
// a live server + client + DB. The focused smoke.spec.js stays in the default e2e
// run; this exhaustive sweep is opt-in so it can't destabilize the core pipeline
// before it's been validated against a live environment. Run it with:
//   RUN_SMOKE=1 npx playwright test smoke-full.spec.js     (or: npm run test:smoke)
import { test, expect } from '@playwright/test';
import { ensureTestUser, loginViaApi } from './auth.setup.js';

const RUN_SMOKE = !!process.env.RUN_SMOKE;

test.describe('Full System Smoke Test', () => {
  test.skip(!RUN_SMOKE, 'Exhaustive smoke sweep is opt-in. Set RUN_SMOKE=1 to run.');

  let credentials;
  let baseURL;

  test.beforeAll(async ({ request }) => {
    baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
    credentials = await ensureTestUser(request);
  });

  // Every path verified against client/src/App.jsx. NOTE: the engineer landing
  // route is `/engineer` (EngineerProjects); `/engineer/projects` would wrongly
  // match the `/engineer/:id` detail route, so it is intentionally not used here.
  const ALL_PAGES = [
    '/',
    '/dashboard',
    '/todo',
    '/finance',
    '/finance/overview',
    '/finance/dashboard',
    '/finance/accounts',
    '/finance/receivables',
    '/finance/payables',
    '/finance/portfolio',
    '/finance/budget',
    '/learning',
    '/reading',
    '/research',
    '/roadmaps',
    '/contacts',
    '/ideas',
    '/goals',
    '/review',
    '/report',
    '/polymath',
    '/ai-chat',
    '/engineer',
    '/engineer/sprint',
    '/engineer/snippets',
    '/engineer/docs',
    '/engineer/checkins',
    '/engineer/issues',
    '/engineer/roadmap',
  ];

  ALL_PAGES.forEach((path) => {
    test(`page loads without error: ${path}`, async ({ browser }) => {
      const context = await loginViaApi(browser, baseURL, credentials);
      const page = await context.newPage();

      // Surface uncaught page errors (a crashed render) as a hard failure.
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err.message));

      const response = await page.goto(path);
      // SPA dev server returns 200 (index.html) for every route; a 4xx/5xx here
      // means the static/host layer failed, which is a real smoke failure.
      expect(response.status()).toBeLessThan(400);

      await page.waitForTimeout(500); // give the route's first render a beat

      // No error boundary should have rendered (the app marks it with this attr).
      const errorBoundary = page.locator('[data-error-boundary]');
      await expect(errorBoundary).toHaveCount(0);

      expect(pageErrors, `uncaught page errors on ${path}: ${pageErrors.join(' | ')}`).toHaveLength(0);

      await context.close();
    });
  });
});
