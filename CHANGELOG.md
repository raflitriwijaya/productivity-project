# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Phase 5 — Documentation, Observability & Future-Proofing (2026-06-10)

#### Added
- **Sentry error reporting** — `@sentry/node` on the server (captures unhandled exceptions; attaches `reqId` tag; gated on `SENTRY_DSN` env var); `@sentry/react` on the client (initializes before render; composed with the existing `ErrorBoundary`; gated on `VITE_SENTRY_DSN`).
- **OpenAPI 3.1 spec** — `server/scripts/generate-openapi.js` uses `@asteasolutions/zod-to-openapi` to derive a spec from existing Zod schemas; `npm run openapi` (from `server/`) writes to `docs/openapi.json`.
- **`docs/RUNBOOK.md`** — DB backup/restore (`pg_dump` / `pg_restore`), migration rollback procedure, `SESSION_SECRET` rotation, object storage migration plan (disk → Cloudflare R2), and common incident runbooks.
- **`docs/ARCHITECTURE.md`** — Durable architecture reference: stack, data flow, full route map, complete DB schema table, middleware stack order, and design decisions (API versioning, session vs JWT, attachment storage). Includes the `user_settings` table plan and the API versioning decision.
- **`CHANGELOG.md`**, **`SECURITY.md`**, **`CONTRIBUTING.md`** — standard project meta-files.
- `SENTRY_DSN` / `VITE_SENTRY_DSN` documented in all three `.env*.example` files.

#### Changed
- `PROJECT_STATE.md` — added pointer to `docs/ARCHITECTURE.md` and `docs/RUNBOOK.md`; living status content retained.

---

### Phase 4 — Operational Hardening (2026-06-09)

- `bcrypt` → `bcryptjs` (pure JS; eliminates `tar`/`node-pre-gyp` high-severity transitive vulns).
- CI pipeline (`.github/workflows/ci.yml`): parallel server + client jobs; `npm audit --audit-level=high`; lint; build; test.
- Structured logging: `server/lib/logger.js` (pino); `pino-http` assigns `req.id`; `errorHandler` echoes `reqId` in responses.
- Docker healthchecks for `api` and `nginx` containers; nginx `depends_on: service_healthy`.
- Nginx security + cache headers in `client/nginx.docker.conf`.
- `db_backup` sidecar: daily `pg_dump` → `postgres_backups` named volume.

---

### Phase 3 — Data Integrity & Resilience (2026-06-09)

- Named Docker volume `uploads_data` — attachments survive `docker compose up --build`.
- Graceful shutdown — `SIGTERM`/`SIGINT` drain HTTP connections → pg pool → exit 0; 10 s force-exit fallback.
- Auto-run migrations on deploy (`migrate.js && index.js`); advisory lock prevents race on rolling deploys.
- React `ErrorBoundary` wraps `<App />` — render crashes show `ErrorState` instead of white screen.
- Email lowercase normalization on register; pg `23505` → `409 CONFLICT` in error handler.
- Migration `005_idempotency_guards.sql`: `CHECK (amount <> 0)` + partial UNIQUE index on Transfer rows.

---

### Phase 2 — Security Hardening (2026-06-10)

- `express-rate-limit` (`authLimiter` 5/15 min; `generalLimiter` 100/min).
- `helmet` (CSP, HSTS in prod, X-Frame-Options, X-Content-Type-Options, Referrer-Policy).
- Authenticated attachment downloads — removed public `/uploads/` static mount; new `GET /api/research/attachments/:id/download` route (auth + ownership).
- `rehype-sanitize` applied to markdown editor live preview and `MarkdownPreview`.
- `crypto.randomUUID()` filenames for uploads (replaces `Date.now()`-based names).

---

### Phase 1 — Research Upgrade (2026-06-02)

- Migration `004_research_topics.sql`: `research_topics`, `research_entry_topics` pivot, `research_attachments`, `research_entries.is_pinned`.
- Full-text search, tag filters, date-range filter, topic sidebar, bulk actions (archive/delete), entry detail modal, export (JSON/CSV), pin/duplicate/copy-citation controls.

---

### Initial Deployment (2026-06-01)

- Docker + Docker Compose (nginx → api → db), manual Nginx + PM2 configs, Cloudflare Tunnel.
- README rewritten in English.

---

### Audit & Foundation (2026-05-31)

- Full audit/hardening pass: created missing `components/ui/*`, hooks (`useApi`, `useTheme`, `useToast`), `server/lib/*`, `errorHandler`, `validate` middleware.
- Fixed broken config: `index.css` Tailwind directives, `index.html` Inter font, `postcss.config.js`, Vite port/proxy, missing client/server deps.
- Corrected bugs: router named-export mismatch, Dashboard stat-key mismatches, duplicate `AppLayout.jsx`.
- Added `express.json({ limit: '1mb' })`, session `sameSite: 'lax'`, pg pool sizing.
