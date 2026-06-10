# Phase 6: Fix the `/api/auth/me` Rate-Limit Self-Lockout — Rafli's Productivity Suite

**Status:** Pending
**Priority:** Critical
**Estimated Effort:** S (<30 min)
**Audit References:** AUDIT_REPORT_V2.md §3-N1, §5, §8, §9
**Date Generated:** 2026-06-10

---

## Objective

Stop a normal usage pattern — refreshing or opening tabs more than five times in 15 minutes — from triggering a self-inflicted 15-minute lockout. The session heartbeat (`GET /api/auth/me`) and `POST /api/auth/logout` are currently behind the 5-req/15-min brute-force limiter; they must run under the lenient general limiter instead, and the client must surface `429` as a "slow down" message rather than silently ejecting the user to a login page that is *also* throttled.

**This is the single production-blocking item in the V2 audit. Do this phase first.**

---

## Pre-Flight Checklist

- [ ] Read `PROJECT_STATE.md` (`server/index.js` and `client/src/lib/api.js` sections) for current architecture context
- [ ] Read `server/index.js`, `server/routes/auth.js`, `client/src/lib/api.js`, `client/src/hooks/useAuth.js`
- [ ] Confirm each issue still exists in the current codebase (see "Current Behavior" in each fix)
- [ ] Ensure you are on the latest `main` branch with a clean working tree

---

## Fix 1: Move `/me` and `/logout` off the brute-force auth limiter

### Criticality
🔴 **CRITICAL — §3-N1 Backend (Node.js + Express)**

### What the Audit Found

> `app.use('/api/auth', authLimiter, authRouter)` places the *entire* auth router — including `/me` and `/logout` — under `authLimiter` (5 req / 15 min / IP). But `useAuth()` calls `/api/auth/me` on **every** protected-route mount. Six page loads / refreshes / tabs in 15 minutes ⇒ `429`. … Net effect: a self-inflicted 15-minute lockout for an ordinary usage pattern. — *Priority: Critical*

### Current Behavior

In [server/index.js:160](../server/index.js#L160) the whole auth router is mounted behind the strict limiter:

```js
// server/index.js (current)
app.use('/api/auth', authLimiter, authRouter);
```

`authLimiter` is defined at [server/index.js:127-136](../server/index.js#L127) as `windowMs: 15 * 60 * 1000, max: 5`. The auth router ([server/routes/auth.js](../server/routes/auth.js)) exposes four endpoints under that single mount: `POST /register`, `POST /login`, `POST /logout`, and `GET /me`. Because the limiter keys on IP and counts **all** requests to the prefix, `GET /api/auth/me` — called on every protected-route mount via `useAuth` ([client/src/hooks/useAuth.js:18](../client/src/hooks/useAuth.js#L18)) — burns the same 5-request budget that exists to slow password guessing. The sixth refresh in a 15-minute window returns `429`.

### Desired Behavior

- `POST /api/auth/login` and `POST /api/auth/register` remain protected by `authLimiter` (5 / 15 min / IP) — credential-guessing is still throttled.
- `GET /api/auth/me` and `POST /api/auth/logout` run under `generalLimiter` (100 / min / IP) — refreshes and tab opens no longer exhaust the strict budget.
- No route is left unlimited.

### Files to Modify

- `server/index.js` — change the auth mount so the strict limiter applies only to `login`/`register`; the router itself runs under `generalLimiter`.

### Implementation

#### Step 1: Replace the single auth mount with path-specific limiters

In [server/index.js](../server/index.js#L158), replace the auth-routes block:

```js
// ─── Auth routes — strict rate-limited (public, no requireAuth) ──────────────
// Phase 1: authLimiter caps login + register at 5 attempts / 15 min / IP.
app.use('/api/auth', authLimiter, authRouter);
```

with:

```js
// ─── Auth routes (public, no requireAuth) ────────────────────────────────────
// Phase 6: apply the strict brute-force limiter ONLY to the credential-guessable
// verbs. /me (session heartbeat, called on every protected-route mount) and
// /logout must NOT share the 5-req/15-min budget or a normal refresh pattern
// self-DoSes the user for 15 minutes (§3-N1).
//
// Mount order matters: the path-specific limiters are registered BEFORE the
// router mount, so a POST /api/auth/login passes through authLimiter first, then
// falls through to the generalLimiter + router. /me and /logout match only the
// generalLimiter + router path.
app.use('/api/auth/login',    authLimiter); // Phase 6: brute-force guard, credentials only
app.use('/api/auth/register', authLimiter); // Phase 6: brute-force guard, credentials only
app.use('/api/auth', generalLimiter, authRouter); // Phase 6: /me + /logout get the lenient 100/min budget
```

Why this approach: Express runs matching middleware in registration order. `app.use('/api/auth/login', authLimiter)` matches *only* requests whose path starts with `/api/auth/login` and applies the strict limiter, then control falls through to the next matching middleware — `app.use('/api/auth', generalLimiter, authRouter)` — which both applies the general limiter and dispatches into the router. A request to `/api/auth/me` never matches the two path-specific limiters, so it is governed solely by `generalLimiter`. No endpoint is left unprotected, and login/register keep their strict cap.

Edge case handled: applying `generalLimiter` to login/register as well (because they also match `/api/auth`) is harmless — they are already gated by the tighter `authLimiter` that runs first; the general limiter's 100/min ceiling is never the binding constraint for them.

### Verification

1. Restart the API (`cd server && npm run dev`).
2. Hit the heartbeat seven times in quick succession:
   ```bash
   for i in 1 2 3 4 5 6 7; do curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/auth/me; done
   ```
   → expect `401` on every line (no session cookie), **never** `429`. Before the fix, requests 6 and 7 returned `429`.
3. Exhaust the login limiter to prove it still works:
   ```bash
   for i in 1 2 3 4 5 6; do curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"x@y.com","password":"wrong"}'; done
   ```
   → expect `401` for the first 5, then `429` on the 6th. The brute-force guard is intact.
4. In a browser, log in, then refresh the dashboard 10+ times within a minute → you stay logged in (no bounce to `/login`).

### Risk / Regression Notes

⚠️ Mount **order** is the whole fix — the two `app.use('/api/auth/login'|'/register', authLimiter)` lines MUST come before `app.use('/api/auth', generalLimiter, authRouter)`. If reordered, the router would dispatch before the strict limiter runs and login/register would lose brute-force protection. After applying, re-run verification step 3 to confirm login is still capped at 5.
⚠️ Do not remove `authLimiter` from `login`/`register` — that would reopen the V1 Critical "no brute-force protection" finding.

---

## Fix 2: Handle `429` in the axios interceptor (stop the lockout cascade)

### Criticality
🔴 **CRITICAL — §5 / §8 / §9 (shared with §3-N1)**

### What the Audit Found

> The axios interceptor only special-cases `401`, so a `429` is surfaced as a generic error; `useAuth` returns `user: null`; `AuthGuard` redirects to `/login` — which is on the **same exhausted limiter** … add explicit `429` handling client-side: show "You're doing that too fast — try again in a few minutes" instead of redirecting. — *Priority: Critical (shared)*

### Current Behavior

[client/src/lib/api.js:25-45](../client/src/lib/api.js#L25) only branches on `401`:

```js
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error.response?.status;

    // Global 401 handler — session is gone; send user to login.
    if (status === 401) {
      const { pathname } = window.location;
      if (pathname !== '/login' && pathname !== '/register') {
        window.location.replace('/login');
      }
    }

    const message =
      error.response?.data?.error?.message || 'An unexpected error occurred.';
    return Promise.reject(new Error(message));
  }
);
```

A `429` falls straight through to the generic `Promise.reject(new Error(message))`. `useAuth` ([client/src/hooks/useAuth.js:17-21](../client/src/hooks/useAuth.js#L17)) maps any rejection to `user: null`, and `AuthGuard` then redirects to `/login`. With Fix 1 the heartbeat no longer 429s, but a `429` can still arise from the general limiter (100/min) or a genuinely throttled login — the client must distinguish "throttled" from "unauthenticated" so it never converts a `429` into a forced logout.

### Desired Behavior

- On `429`: reject with the server's message (e.g. "Too many requests. Please slow down.") **without** redirecting to `/login`. The caller surfaces it as an error/toast; the session is left intact.
- On `401`: unchanged — redirect to `/login` (guarded against loops).
- The rejected `Error` carries the HTTP `status` so callers (and `useAuth`) can branch on it.

### Files to Modify

- `client/src/lib/api.js` — add a `429` branch; attach `status` to the rejected error.
- `client/src/hooks/useAuth.js` — do not treat a `429` as "no session".

### Implementation

#### Step 1: Add a `429` branch and preserve the status code in `api.js`

Replace the interceptor body in [client/src/lib/api.js:25-45](../client/src/lib/api.js#L25):

```js
api.interceptors.response.use(
  // Unwrap the standard response envelope (§6.4)
  (response) => response.data,

  (error) => {
    const status = error.response?.status;

    // Global 401 handler — session is gone; send user to login.
    // Guard against redirect loops: don't redirect if already on /login or /register.
    if (status === 401) {
      const { pathname } = window.location;
      if (pathname !== '/login' && pathname !== '/register') {
        window.location.replace('/login');
      }
    }

    // Phase 6: a 429 is rate-limiting, NOT an auth failure. Do NOT redirect to
    // /login (that page shares a limiter and would deepen the lockout). Surface
    // the server's "slow down" message and let the caller show a toast.
    const message =
      error.response?.data?.error?.message ||
      (status === 429
        ? "You're doing that too fast — please wait a moment and try again."
        : 'An unexpected error occurred.');

    // Phase 6: attach the HTTP status so callers (e.g. useAuth) can distinguish
    // 429 (throttled) from 401 (unauthenticated) instead of nulling the session.
    const err = new Error(message);
    err.status = status;
    return Promise.reject(err);
  }
);
```

#### Step 2: Don't null the session on a `429` in `useAuth`

Update [client/src/hooks/useAuth.js:17-21](../client/src/hooks/useAuth.js#L17) so a throttle error does not masquerade as "logged out":

```js
export function useAuth() {
  const { data: user, loading, error } = useApi(() => api.get('/api/auth/me'));

  // Phase 6: a 429 means "throttled", not "unauthenticated". Treat it as a
  // transient error so AuthGuard does NOT redirect to /login on rate-limiting.
  const throttled = error?.status === 429;

  return { user: user ?? null, loading, error, throttled };
}
```

If `AuthGuard` currently redirects purely on `error` being truthy, gate that redirect on `!throttled` (only redirect on a real auth failure). Read [client/src/components/layout/AuthGuard.jsx](../client/src/components/layout/AuthGuard.jsx) and ensure the redirect condition is `user === null && !loading && !throttled`. When `throttled` is true, render the existing full-screen skeleton (treat it like "still loading") so the user is not ejected.

### Verification

1. Temporarily lower `generalLimiter.max` to `3` in `server/index.js`, restart, log in, then refresh rapidly. → You see a "slow down" error/skeleton, and you are **not** redirected to `/login`. Restore `max: 100` afterward.
2. With the limiter restored, confirm a real expired session still redirects: clear the `sid` cookie in devtools, refresh → redirected to `/login` (401 path unchanged).
3. `cd client && npm run build` → succeeds.
4. `cd client && npm run lint` → 0 warnings.

### Risk / Regression Notes

⚠️ Adding `err.status` must not change the rejected value's `message` for existing callers — every `catch (e)` that reads `e.message` keeps working; `e.status` is purely additive.
⚠️ Verify `AuthGuard`'s redirect condition does not still fire on any truthy `error`. If it does and you skip the `useAuth` change, a `429` will still bounce the user — re-test step 1.
⚠️ Do not redirect on `429` anywhere. The login page shares the auth limiter, so redirecting on throttle is the exact cascade this phase exists to kill.

---

## Completion Checklist

- [ ] All files modified as specified (`server/index.js`, `client/src/lib/api.js`, `client/src/hooks/useAuth.js`, and `AuthGuard.jsx` if its redirect condition needed gating)
- [ ] All verifications pass
- [ ] `npm run build` succeeds in `client/` (server has no build step)
- [ ] `npm test` passes in both `client/` and `server/` (no regressions)
- [ ] `npm run lint` passes in `client/` (`--max-warnings 0`)
- [ ] `npm audit` returns 0 vulnerabilities in both packages
- [ ] No new console errors or warnings in browser devtools; refreshing 10× in a minute keeps you logged in
- [ ] Changes committed with a descriptive message: `fix: phase 6 — move /me + /logout off brute-force limiter; handle 429 client-side`
