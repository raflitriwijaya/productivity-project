// client/e2e/auth.setup.js
// Shared auth helpers for e2e tests. All smoke tests need an authenticated session.
import { expect } from '@playwright/test';

const TEST_USER = {
  name: 'E2E Test User',
  email: `e2e-${Date.now()}@test.local`,
  password: 'testtest12', // Meets 8-char minimum
};

/**
 * Ensures a test user exists and returns credentials.
 * If TEST_EMAIL and TEST_PASSWORD env vars are set (CI), uses those instead of
 * registering a fresh user.
 *
 * @param {import('@playwright/test').APIRequestContext} request
 * @returns {Promise<{email: string, password: string}>}
 */
export async function ensureTestUser(request) {
  if (process.env.TEST_EMAIL && process.env.TEST_PASSWORD) {
    return {
      email: process.env.TEST_EMAIL,
      password: process.env.TEST_PASSWORD,
    };
  }

  const registerRes = await request.post('/api/auth/register', {
    data: TEST_USER,
  });

  // 409 = user already exists from a previous run — that's fine.
  expect(registerRes.status()).toBeOneOf([201, 409]);

  return TEST_USER;
}

/**
 * Logs in via the API and returns an authenticated browser context (with the
 * session cookie already set). Callers must `await context.close()` when done.
 *
 * @param {import('@playwright/test').Browser} browser
 * @param {string} baseURL
 * @param {{email: string, password: string}} credentials
 * @returns {Promise<import('@playwright/test').BrowserContext>}
 */
export async function loginViaApi(browser, baseURL, credentials) {
  const context = await browser.newContext();

  const loginRes = await context.request.post(`${baseURL}/api/auth/login`, {
    data: credentials,
  });

  expect(loginRes.status()).toBe(200);

  return context;
}
