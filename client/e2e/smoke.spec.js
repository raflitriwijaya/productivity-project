// client/e2e/smoke.spec.js
// Core smoke tests — first-ever browser-level verification of the app.
// Tests prove: login, dashboard, create transaction via modal, research
// attachment upload+download, dark mode toggle, and mobile navigation.
import { test, expect } from '@playwright/test';
import { ensureTestUser, loginViaApi } from './auth.setup.js';

test.describe('Smoke Tests', () => {
  let credentials;
  let baseURL;

  test.beforeAll(async ({ browser, request }) => {
    baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
    credentials = await ensureTestUser(request);
  });

  test('login page renders and can log in', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();

    await page.getByLabel(/email/i).fill(credentials.email);
    await page.getByLabel(/password/i).fill(credentials.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL('/');
    await expect(page.getByText(/dashboard/i).first()).toBeVisible();
  });

  test('login page has correct document title', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/Sign In/);
  });

  test('dashboard loads with stat cards', async ({ browser }) => {
    const context = await loginViaApi(browser, baseURL, credentials);
    const page = await context.newPage();

    await page.goto('/');

    await expect(page.getByTestId('stat-card').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/recent/i).first()).toBeVisible();
    await expect(page).toHaveTitle(/Dashboard/);

    await context.close();
  });

  test('create a transaction via modal', async ({ browser }) => {
    const context = await loginViaApi(browser, baseURL, credentials);
    const page = await context.newPage();

    await page.goto('/finance');

    // Open create modal
    await page.getByRole('button', { name: /add|create|new/i }).first().click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();

    // Select Income type
    const typeSelect = modal.getByLabel(/type/i);
    if (await typeSelect.isVisible()) {
      await typeSelect.selectOption('Income');
    }

    // Fill amount
    const amountInput = modal.getByLabel(/amount/i);
    if (await amountInput.isVisible()) {
      await amountInput.fill('50000');
    }

    // Select destination account (first available)
    const destSelect = modal.getByLabel(/destination account|to account|account/i).first();
    if (await destSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await destSelect.selectOption({ index: 1 });
    }

    // Select category (first available)
    const catSelect = modal.getByLabel(/category/i);
    if (await catSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await catSelect.selectOption({ index: 1 });
    }

    // Submit
    await modal.getByRole('button', { name: /save|create|submit/i }).click();

    // Modal should close
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    await context.close();
  });

  test('modal focus trap: Tab cycles within dialog', async ({ browser }) => {
    const context = await loginViaApi(browser, baseURL, credentials);
    const page = await context.newPage();

    await page.goto('/finance');
    await page.getByRole('button', { name: /add|create|new/i }).first().click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();

    // Tab through all focusable elements; focus should never leave the dialog
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null);
      expect(focused).toBe(true);
    }

    // Escape should close the modal
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible({ timeout: 3000 });

    await context.close();
  });

  test('research: upload attachment and download', async ({ browser }) => {
    const context = await loginViaApi(browser, baseURL, credentials);
    const page = await context.newPage();

    // Create a research entry via API so we have something to attach to
    const createRes = await context.request.post(`${baseURL}/api/research`, {
      data: {
        title: `E2E Test Entry ${Date.now()}`,
        type: 'note',
        status: 'active',
        content: 'Test content for e2e attachment test.',
      },
    });
    expect(createRes.status()).toBe(201);
    const entry = await createRes.json();
    const entryId = entry.data.id;
    const entryTitle = entry.data.title;

    await page.goto('/research');

    // Open the entry detail modal by clicking on the entry title
    await page.getByText(entryTitle).first().click();
    const detailModal = page.getByRole('dialog');
    await expect(detailModal).toBeVisible();

    // Upload a file
    const fileInput = detailModal.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-attachment.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('E2E test attachment content'),
    });

    // Wait for the filename to appear in the attachment list
    await expect(detailModal.getByText(/test-attachment\.txt/i)).toBeVisible({ timeout: 10000 });

    // Download the file
    const downloadPromise = page.waitForEvent('download');
    await detailModal.getByRole('button', { name: /download/i }).first().click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('test-attachment');

    // Clean up the entry (attachments cascade)
    await context.request.delete(`${baseURL}/api/research/${entryId}`);

    await context.close();
  });

  test('dark mode toggle works', async ({ browser }) => {
    const context = await loginViaApi(browser, baseURL, credentials);
    const page = await context.newPage();

    await page.goto('/');

    // Find the theme toggle button by label or fallback to the sidebar footer button
    const themeButton = page.getByLabel(/dark mode|light mode|theme/i).first();
    const isLabelled = await themeButton.isVisible({ timeout: 2000 }).catch(() => false);
    const toggle = isLabelled ? themeButton : page.getByRole('button', { name: /dark mode|light mode/i }).first();

    await toggle.click();

    // The html element should gain the dark class
    const htmlClasses = await page.locator('html').getAttribute('class');
    expect(htmlClasses).toContain('dark');

    await context.close();
  });

  test('mobile navigation works', async ({ page }) => {
    // This test runs under the chromium-mobile project (Pixel 7 viewport)
    await page.goto('/login');

    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();

    await page.getByLabel(/email/i).fill(credentials.email);
    await page.getByLabel(/password/i).fill(credentials.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL('/');

    // On mobile the sidebar is hidden behind a hamburger
    const menuButton = page.getByLabel(/open navigation/i).first();
    if (await menuButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await menuButton.click();
      await expect(page.getByText(/dashboard/i).first()).toBeVisible();
    }

    await expect(page.getByTestId('stat-card').first()).toBeVisible({ timeout: 10000 });
  });
});
