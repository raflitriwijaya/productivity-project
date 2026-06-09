# Phase 3 — Operational Hardening

> **Run with:** Sonnet 4.6 · Effort: medium · Thinking: off
> **Source audit:** `docs/AUDIT_REPORT.md` (§6, §8, §3)
> **Goal of this phase:** Make the deployment observable, automatable, and recoverable — fix the vulnerable dependency, add CI, structured logging, container healthchecks, nginx hardening, and automated DB backups.

---

## [TASK]

Bring the operational layer to production grade: resolve the known `tar`/`bcrypt` vulnerability, add a CI pipeline, structured request logging with request IDs, healthchecks on the api and nginx containers, nginx security + cache headers, and a scheduled DB backup sidecar. Make minimal, backward-compatible edits.

---

## [ISSUES TO FIX]

### 1. Fix bcrypt/tar vulnerability — **High**
- **Files:** `server/package.json`, `server/package-lock.json`, any `require('bcrypt')` call sites.
- **Changes:**
  - First try `cd server && npm audit fix`. If the high-severity `tar` advisories (via `bcrypt` → `@mapbox/node-pre-gyp`) remain, **switch to `bcryptjs`** (pure JS, API-compatible drop-in): `npm uninstall bcrypt && npm install bcryptjs`, then update imports (`require('bcrypt')` → `require('bcryptjs')`).
  - Keep the existing **cost factor (12)** and hash/compare call signatures unchanged.
  - Confirm `npm audit --audit-level=high` reports clean afterward (used by CI below).

### 2. CI/CD pipeline — **High**
- **File:** `.github/workflows/ci.yml` (new).
- **Changes:**
  - Trigger on push + pull_request to `main`.
  - Jobs (matrix or separate for `client` and `server`): `npm ci`, `npm run lint`, client `npm run build`, and `npm audit --audit-level=high` for both.
  - Include a **tests** step that runs the suite (will be added in Phase 4) — make it tolerant now (e.g. run if a `test` script exists) so this file doesn't need editing later.
  - Configure to **gate merges on green** (the workflow being required is a repo setting; note it in the deliverable).

### 3. Structured logging — **High**
- **Files:** `server/index.js`, `server/package.json`, error handler.
- **Install:** `cd server && npm install pino pino-http`
- **Changes:**
  - Add `pino-http` middleware that assigns/echoes a **request ID** per request.
  - Include the request ID in the **error response envelope** so users can quote it in bug reports.
  - Log to **stdout** (captured by Docker/PM2). Use log levels; replace ad-hoc `console.error` in the error handler with the pino logger.

### 4. Healthchecks on api + nginx containers — **Medium**
- **File:** `docker-compose.yml`.
- **Changes:**
  - Add a `healthcheck` to the **`api`** service hitting `GET /health` (endpoint already exists).
  - Add a `healthcheck` to the **`nginx`** service hitting `/`.
  - Make `nginx` `depends_on` `api` with `condition: service_healthy`.

### 5. Nginx security + cache headers — **Medium**
- **File:** `client/nginx.docker.conf`.
- **Changes:**
  - Add **security headers**: `X-Frame-Options DENY`, `X-Content-Type-Options nosniff`, `Referrer-Policy`, and a CSP consistent with Phase 1's app CSP.
  - Add **immutable cache headers** for hashed static assets:
    `location ~* \.(js|css|svg|png|woff2)$ { expires 1y; add_header Cache-Control "public, immutable"; }`
  - Keep existing gzip config.

### 6. DB backup sidecar — **High**
- **Files:** `docker-compose.yml`, optionally a small backup script under `deploy/` or `scripts/`.
- **Changes:**
  - Add a **cron-based `pg_dump` sidecar** container that periodically dumps the database to a mounted volume (off the main data volume).
  - Parameterize credentials/schedule via env; reuse the existing DB env vars.
  - Note the restore procedure in a comment (full runbook lands in Phase 5).

---

## [CONSTRAINTS]
- **Minimal edits** — only what each fix requires.
- **Backward-compatible** — preserve the response envelope (now with request ID added, not reshaped), route names, and existing service ordering.
- **Install dependencies before use**, in the correct `package.json`.
- Add a **brief one-line comment** on each modified block (e.g. `# Phase 3: healthcheck so a hung-but-alive API is restarted`).
- Do not change application/business logic; this phase is operational only.

## [DELIVERABLE]
After execution, output:
1. A **summary table** of every changed/created file with a one-line description.
2. The **diffs** for each change.
3. `npm audit` before/after summary proving the high-severity advisories are resolved.
4. Manual verification steps (e.g. push to a branch and confirm CI runs; `docker compose ps` shows healthchecks).
