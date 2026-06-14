// client/e2e/visual.spec.js
//
// Visual regression for the critical pages. Screenshots are compared against
// committed baselines so an unintended layout/style change is caught.
//
// OPT-IN: these tests are SKIPPED unless RUN_VISUAL=1. Reason: they require a
// committed baseline screenshot per page (per browser project). Running them in a
// pipeline that has no baselines yet would fail on every run. Workflow:
//   1. Generate baselines once:  RUN_VISUAL=1 npx playwright test visual.spec.js --update-snapshots
//   2. Commit the *-snapshots/ folder.
//   3. From then on:             RUN_VISUAL=1 npx playwright test visual.spec.js
// The `npm run test:visual` script sets RUN_VISUAL for you.
import { test, expect } from '@playwright/test';
import { ensureTestUser, loginViaApi } from './auth.setup.js';

const RUN_VISUAL = !!process.env.RUN_VISUAL;

test.describe('Visual Regression -- Critical Pages', () => {
  // Skip the whole suite unless explicitly opted in (baselines required first).
  test.skip(!RUN_VISUAL, 'Visual tests are opt-in. Set RUN_VISUAL=1 after generating baselines.');

  let credentials;
  let baseURL;

  test.beforeAll(async ({ request }) => {
    baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
    credentials = await ensureTestUser(request);
  });

  // All paths verified against client/src/App.jsx route table.
  const PAGES = [
    { path: '/', name: 'Today Dashboard' },
    { path: '/finance', name: 'Finance Transactions' },
    { path: '/finance/overview', name: 'Finance Overview' },
    { path: '/finance/portfolio', name: 'Portfolio' },
    { path: '/finance/budget', name: 'Budget' },
    { path: '/research', name: 'Research' },
    { path: '/reading', name: 'Reading' },
    { path: '/goals', name: 'Goals' },
    { path: '/ai-chat', name: 'AI Chat' },
    { path: '/polymath', name: 'Polymath Dashboard' },
  ];

  PAGES.forEach(({ path, name }) => {
    test(`${name} page visual regression`, async ({ browser }) => {
      const context = await loginViaApi(browser, baseURL, credentials);
      const page = await context.newPage();
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000); // let animations / skeleton swaps settle

      await expect(page).toHaveScreenshot(`${name.toLowerCase().replace(/\s+/g, '-')}.png`, {
        fullPage: true,
        maxDiffPixels: 100, // allow sub-pixel / antialiasing differences
        // Mask volatile regions (clocks, "x ago" timers) so they don't flap the diff.
        animations: 'disabled',
      });

      await context.close();
    });
  });
});
