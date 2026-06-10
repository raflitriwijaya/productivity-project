# Phase 1 — Critical Security Hardening

> **Run with:** Sonnet 4.6 · Effort: medium · Thinking: off
> **Source audit:** `docs/AUDIT_REPORT.md` (§2, §3, §8)
> **Goal of this phase:** Close the highest-severity, internet-facing security holes so the app is safe behind an authenticated perimeter.

---

## [TASK]

Harden the perimeter security of this React + Express + PostgreSQL productivity suite. Implement rate limiting on auth, security headers, an authenticated/owner-gated download path for uploads, and strict markdown sanitization. These are the **Critical** items from the audit. Make minimal, backward-compatible edits.

---

## [ISSUES TO FIX]

### 1. Rate limiting on auth + general API routes — **Critical**
- **Files:** `server/index.js` (app wiring), `server/routes/auth.js` (mount point), `server/package.json` (dependency).
- **Install:** `cd server && npm install express-rate-limit`
- **Changes:**
  - Add a **strict limiter** for `/api/auth/*`: `5` attempts / `15 min` / IP (`windowMs: 15*60*1000`, `max: 5`, `standardHeaders: true`, `legacyHeaders: false`). Apply it to the auth router (login + register at minimum).
  - Add a **general limiter** for `/api/*`: `100 req / min / IP`.
  - Return the standard JSON error envelope used by the app (do not break the response shape) — set a custom `handler` or `message` matching the existing `{ error: ... }` / envelope format.
  - Confirm `app.set('trust proxy', ...)` is already configured in prod so the limiter keys on the real client IP behind Cloudflare/nginx; if conditional, do not change its existing behavior.

### 2. Helmet + Content-Security-Policy — **Critical**
- **Files:** `server/index.js`, `server/package.json`.
- **Install:** `cd server && npm install helmet`
- **Changes:**
  - `app.use(helmet())` early in the middleware chain (before routes, after `trust proxy`).
  - Configure a **tuned CSP** appropriate for an API that also has a separate SPA origin; do not break the existing CORS setup. Allow `default-src 'self'`; permit what the app genuinely needs. If the API serves only JSON (SPA is on nginx), keep CSP strict.
  - Enable **HSTS** (`strictTransportSecurity`) for production only.
  - Ensure `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (or CSP `frame-ancestors 'none'`), and `Referrer-Policy` are emitted (helmet defaults cover most — verify).

### 3. Gate `/uploads` behind auth + ownership — **Critical**
- **Files:** `server/index.js` (remove the public static mount near line 101), `server/routes/research.js` (add download route + UUID filenames), `server/models/*` for research attachments as needed.
- **Changes:**
  - **Remove** the public `express.static(uploadsDir)` mount that serves uploads with no auth.
  - Add an authenticated, ownership-checked download route, e.g. `GET /api/research/attachments/:id/download`:
    - `requireAuth` middleware.
    - Verify the attachment's **parent research entry belongs to `req.user`** before streaming.
    - Stream the file from `uploadsDir` (reconstruct path from `filename`, not a stored absolute path).
    - Set `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff` so files are never rendered/sniffed inline.
    - Return `404` (not `403`) for non-owned/missing IDs to avoid existence disclosure.
  - Generate upload filenames with **`crypto.randomUUID()`** instead of `${Date.now()}-${rand}`.
  - Update the client attachment links to use the new authenticated route (search `client/src` for the old `/uploads/` URL usage and repoint it).

### 4. Fix markdown sanitization (rehype-sanitize) — **High**
- **Files:** `client/src/components/engineer/MarkdownEditor.jsx` (around line 38, `MarkdownPreview` / `MDEditor.Markdown`), `client/package.json`.
- **Install:** `cd client && npm install rehype-sanitize` (use a version compatible with the installed `@uiw/react-md-editor`).
- **Changes:**
  - Explicitly pass `rehypePlugins={[rehypeSanitize]}` (and/or `skipHtml`) to `MDEditor.Markdown` so raw HTML in user content cannot execute.
  - **Pin** `@uiw/react-md-editor` to an exact version (remove the `^` caret) in `client/package.json`.
  - Add a quick render test/asset note proving `<img src=x onerror=alert(1)>` content does **not** execute (a test file is fine even though full suite arrives in Phase 4).

---

## [CONSTRAINTS]
- **Minimal edits** — touch only what each fix requires; do not refactor unrelated code.
- **Backward-compatible** — keep the existing response envelope, route names (except the removed public mount), and CORS behavior intact.
- **Install dependencies before using them** (commands above) and verify they appear in the correct `package.json`.
- Add a **brief one-line comment** on each modified block explaining the security rationale (e.g. `// Phase 1: rate-limit auth to stop credential stuffing`).
- Do not weaken existing protections (parameterized SQL, `user_id` scoping, bcrypt cost, session regeneration).

## [DELIVERABLE]
After execution, output:
1. A **summary table** of every changed/created file with a one-line description.
2. The **diffs** for each change.
3. The exact **install commands** run and confirmation deps landed in the right `package.json`.
4. Any manual verification steps the user should perform (e.g. confirm CSP doesn't break the SPA).
