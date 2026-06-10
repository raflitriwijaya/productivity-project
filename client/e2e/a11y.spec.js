// client/e2e/a11y.spec.js
// Automated WCAG AA accessibility audit on every authenticated page.
// Runs axe-core via @axe-core/playwright against the live app.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { ensureTestUser, loginViaApi } from './auth.setup.js';

const PAGES_TO_CHECK = [
  { path: '/',                   name: 'Dashboard' },
  { path: '/todo',               name: 'Todo' },
  { path: '/finance',            name: 'Finance' },
  { path: '/finance/dashboard',  name: 'Finance Dashboard' },
  { path: '/finance/accounts',   name: 'Accounts' },
  { path: '/learning',           name: 'Learning' },
  { path: '/research',           name: 'Research' },
];

test.describe('Accessibility Audit', () => {
  let credentials;
  let baseURL;

  test.beforeAll(async ({ browser, request }) => {
    baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
    credentials = await ensureTestUser(request);
  });

  for (const pageConfig of PAGES_TO_CHECK) {
    test(`${pageConfig.name} page passes WCAG AA`, async ({ browser }) => {
      const context = await loginViaApi(browser, baseURL, credentials);
      const page = await context.newPage();

      await page.goto(pageConfig.path);

      // Let the page settle: skeletons disappear, async content renders
      await page.waitForTimeout(2000);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(results.violations).toEqual([]);

      await context.close();
    });
  }
});
