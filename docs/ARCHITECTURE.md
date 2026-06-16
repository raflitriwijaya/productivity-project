# Architecture — Rafli's Productivity Suite

> **Canonical reference.** This file is the single source of truth for routes, DB schema, data flow, and design decisions. For operational procedures see [RUNBOOK.md](RUNBOOK.md). For the phase log and sprint status see [../PROJECT_STATE.md](../PROJECT_STATE.md).

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite (port 5173) |
| Backend | Node.js 22 + Express 5 (port 3000) |
| Database | PostgreSQL 16 |
| Session store | `connect-pg-simple` (Postgres) |
| Reverse proxy | nginx (Docker) or manual nginx + PM2 |
| Tunnel | Cloudflare Tunnel |

---

## High-Level Data Flow

```
Browser
  │
  ├─ Static assets (JS/CSS/HTML) ──────────────► nginx → client/dist
  │
  └─ API calls (axios, withCredentials:true) ──► nginx /api proxy
                                                    │
                                                    ▼
                                              Express (port 3000)
                                                    │
                                          ┌─────────┴──────────┐
                                          │   Session cookie   │
                                          │   (sid, httpOnly)  │
                                          └─────────┬──────────┘
                                                    │
                                              PostgreSQL
```

All API responses use the standard envelope:

```json
{ "success": true,  "data": {...} }
{ "success": false, "error": { "code": "...", "message": "...", "reqId": "..." } }
```

---

## Route Map

| Prefix | Auth | Router file |
|--------|------|-------------|
| `GET /health` | public | inline in `server/index.js` |
| `/api/auth` | public (rate-limited 5/15min) | `server/routes/auth.js` |
| `/api/todos` | session required | `server/routes/todos.js` |
| `/api/finances` | session required | `server/routes/finances.js` |
| `/api/learning` | session required | `server/routes/learning.js` |
| `/api/research` | session required | `server/routes/research.js` |
| `/api/engineer` | session required | `server/routes/engineer.js` |
| `/api/links` | session required | `server/routes/links.js` |
| `/api/dashboard` | session required | `server/routes/dashboard.js` |
| `/api/reading` | session required | `server/routes/reading.js` |
| `/api/search` | session required | `server/routes/search.js` |
| `/api/contacts` | session required | `server/routes/contacts.js` |
| `/api/ideas` | session required | `server/routes/ideas.js` |
| `/api/time` | session required | `server/routes/time.js` |
| `/api/review` | session required | `server/routes/review.js` |
| `/api/goals` | session required | `server/routes/goals.js` |
| `/api/polymath` | session required | `server/routes/polymath.js` |
| `/api/chat` | session required | `server/routes/chat.js` |
| `/api/export` | session required | `server/routes/export.js` |
| `/api/settings` | session required | `server/routes/settings.js` |
| `/api/roadmaps` | session required | `server/routes/roadmaps.js` |

All protected routers also pass through `generalLimiter` (100 req/min/IP).

The full OpenAPI 3.1 spec is at [docs/openapi.json](openapi.json). Regenerate with `cd server && npm run openapi`.

---

## Database Schema

All tables follow these conventions (§6.5):
- `SERIAL` primary key named `id`
- `user_id` FK `ON DELETE CASCADE` (per-user rows); no `user_id` for global/seed tables
- `VARCHAR` enum columns guarded by `CHECK` (no `ENUM` types — easier ALTER)
- `TIMESTAMPTZ` timestamps (`created_at`, `updated_at`)
- Shared `set_updated_at()` trigger for `updated_at`
- `idx_{table}_{col}` index naming

### Core tables

| Table | Key columns |
|-------|-------------|
| `users` | id, email (unique), password_hash, name |
| `user_sessions` | auto-managed by `connect-pg-simple` |
| `todos` | id, user_id, title, description, status, priority, due_date |
| `learning_items` | id, user_id, title, type, source, status, priority, progress, total_hours, spent_hours |
| `research_entries` | id, user_id, title, type (journal/citation/note), status, content, source, tags, is_pinned |
| `research_topics` | id, user_id, name, description, color (#hex), status (active/archived) |
| `research_entry_topics` | entry_id, topic_id (pivot; both FK CASCADE) |
| `research_attachments` | id, entry_id FK, filename (UUID), original_name, file_path, mime_type, size |
| `user_settings` | id, user_id (UNIQUE), theme (light/dark/system), default_model, notifications_enabled — migration `016`, see [§user_settings](#user_settings-table-migration-016_user_settingssql) |

### Universal Links (migration `007_entity_links.sql`)

| Table | Key columns |
|-------|-------------|
| `entity_links` | id, user_id, from_type, from_id, to_type, to_id, note — UNIQUE `(user_id, from_type, from_id, to_type, to_id)`; CHECK whitelists `from_type`/`to_type` against the 24 `LINKABLE_TYPES`; indexed on `(user_id, from_type, from_id)`, `(user_id, to_type, to_id)`, and `(user_id, created_at DESC)` |

A polymorphic soft-reference: no FK to the target rows (they live across all waves and modules), so ownership of **both** sides is enforced at the API layer (`server/routes/links.js`) rather than by the database. `user_id` scoping plus the type CHECK and UNIQUE constraint protect the table itself.

### Finance ledger (migration `002_finance_upgrade.sql`)

| Table | Key columns |
|-------|-------------|
| `accounts` | id, user_id, name, type (CASH/ATM/DANA/SHOPEEPAY/GOPAY/INVESTMENT), initial_balance |
| `categories` | id, user_id, name, kind (INCOME/EXPENSE/SYSTEM) |
| `transactions` | id, user_id, type, amount, date, source_account_id, dest_account_id, category_id, reconciled |
| `receivables` | id, user_id, person, amount, due_date, status (outstanding/settled), account_id |
| `payables` | id, user_id, person, amount, due_date, status (outstanding/settled), account_id |
| `portfolio` | id, user_id, name, symbol, quantity, avg_price, current_price |
| `budgets` | id, user_id, category_id, amount (UNIQUE user_id+category_id) |

Balance rule: Income → +dest; Expense → −source; Transfer → −source +dest; Adjustment → +dest.

### Engineering Toolkit (migration `003_engineer_toolkit.sql`)

| Table | Key columns |
|-------|-------------|
| `engineer_projects` | id, user_id, name, project_type, platforms, stack, status, repo_url |
| `engineer_templates` | **global** — name, domain, folder_structure JSONB, doc_templates JSONB |
| `engineer_snippets` | id, user_id, title, category, language, tags, code |
| `engineer_documents` | id, user_id, nullable project_id, title, content, doc_type |
| `engineer_checkins` | id, project_id FK, user_id, week_start, achievements, plans_next, blockers |
| `engineer_issues` | id, project_id FK, user_id, title, severity (P0–P3), status, component, assignee |
| `engineer_roadmap_months` | **global** — month_number (UNIQUE), title, description |
| `engineer_roadmap_skills` | id, month_id FK, user_id, category (hardware/software/process), title, completed |

### Reading Tracker (migration `008_reading_tracker.sql`)

| Table | Key columns |
|-------|-------------|
| `books` | id, user_id, title, author, isbn, cover_url, status (want_to_read/reading/finished/dropped), rating, review, started_at, finished_at, page_count, pages_read |
| `book_notes` | id, user_id, book_id FK, content, page_number, note_type (highlight/note/quote) |

### Contacts (migration `009_contacts.sql`)

| Table | Key columns |
|-------|-------------|
| `contacts` | id, user_id, name, email, phone, company, role, tags, notes, last_contacted_at |

### Ideas (migration `010_ideas.sql`)

| Table | Key columns |
|-------|-------------|
| `ideas` | id, user_id, title, content, status (raw/developing/validated/archived), tags, energy (1–5) |

### Time Tracking (migration `011_time_tracking.sql`)

| Table | Key columns |
|-------|-------------|
| `time_categories` | id, user_id, name, color, icon |
| `time_entries` | id, user_id, category_id FK, description, started_at, ended_at, duration_minutes |

### Goals & OKRs + Habits (migration `012_goals_habits.sql`)

| Table | Key columns |
|-------|-------------|
| `goals` | id, user_id, title, description, target_date, status (active/completed/abandoned), progress |
| `okrs` | id, user_id, goal_id FK nullable, title, quarter, status |
| `okr_key_results` | id, okr_id FK, title, target_value, current_value, unit |
| `habits` | id, user_id, title, description, frequency (daily/weekly), target_count, streak_current, streak_best |
| `habit_logs` | id, user_id, habit_id FK, log_date (DATE), count, note |

### AI Chat (migration `013_ai_chat.sql`)

| Table | Key columns |
|-------|-------------|
| `chat_conversations` | id, user_id, title, model, created_at |
| `chat_messages` | id, conversation_id FK, role (user/assistant), content, reasoning_content, created_at |

### Research Embeddings (migration `014_research_embeddings.sql`)

| Table | Key columns |
|-------|-------------|
| `research_embeddings` | id, user_id, entry_id FK, embedding (vector(1536)), created_at |

Requires the `pgvector` extension. The vector dimension matches the DeepSeek/Ollama embedding model output. Indexed with `ivfflat` for approximate nearest-neighbour search.

### Learning Roadmaps (migration `017_learning_roadmaps.sql`)

| Table | Key columns |
|-------|-------------|
| `learning_roadmaps` | id, user_id, title, description, status (active/completed/archived), target_date |
| `roadmap_tracks` | id, roadmap_id FK, title, description, sort_order |
| `roadmap_milestones` | id, track_id FK, title, description, sort_order, completed, completed_at |

### Web Push & Reminders (migration `018_reminders.sql`)

| Table | Key columns |
|-------|-------------|
| `web_push_subscriptions` | id, user_id, endpoint, p256dh, auth, created_at |
| `reminders` | id, user_id, entity_type, entity_id, remind_at (TIMESTAMPTZ), title, sent |

### Migration runner

`server/db/migrate.js` (`npm run migrate`). Tracks applied files in `schema_migrations`. Acquires Postgres advisory lock `pg_advisory_lock(7391842)` for the run so concurrent replicas cannot race. Files under `server/db/migrations/` — date-prefixed v1 files sort before `NNN_` v2+ files.

---

## Server Middleware Stack (in order)

1. `pino-http` — structured logging; assigns `req.id` to every request
2. `cors` — origin `CLIENT_ORIGIN`, `credentials: true`
3. HTTP metrics middleware — records duration + count per request via `prom-client`
4. `express.json` / `express.urlencoded` — 1 MB body limit
5. `express-session` — Postgres session store, `httpOnly` + `secure` (prod) cookie `sid`
6. `trust proxy: 1` — (prod only) so Express sees real IP behind nginx
7. `helmet` — CSP, HSTS (prod), X-Frame-Options, X-Content-Type-Options, Referrer-Policy
8. `authLimiter` / `generalLimiter` — rate limiting per IP
9. `/metrics` — unauthenticated Prometheus scrape endpoint (restrict via nginx/Cloudflare in prod; see [RUNBOOK §6.3](RUNBOOK.md#63-metrics-endpoint-security))
10. `/health` — unauthenticated DB connectivity probe
11. Route handlers
12. 404 catch-all for `/api`
13. `errorHandler` — standard error envelope; Phase 5: captures to Sentry when `SENTRY_DSN` set

---

## Key Design Decisions

### API versioning (`/api` vs `/api/v1`)

**Decision: no version prefix at this time.**

Rationale: The suite is a single-tenant personal tool with one front-end client. The cost of maintaining two parallel prefixes (`/api` and `/api/v1`) outweighs the benefit when there is no external consumer to protect from breaking changes. The client can be updated atomically with the server.

**Trigger to revisit:** If a mobile client, third-party integration, or public API consumer is added that cannot be updated in lockstep with the server, introduce `/api/v1` at that point and keep `/api` as an alias for backward compatibility (one-line `app.use('/api', app._router)` re-mount).

### Session vs JWT

Sessions stored in Postgres via `connect-pg-simple`. Chosen over JWTs because:
- Single server (no cross-service token sharing needed)
- Revocation is trivial (delete the row)
- No client-side token storage XSS surface

### Attachment storage

Attachments live on local disk (`server/uploads/`) behind authenticated download routes. See [docs/RUNBOOK.md §4](RUNBOOK.md#4-object-storage-migration-plan-uploads--s3--cloudflare-r2) for the migration plan to Cloudflare R2 when a multi-replica deploy is needed.

---

## `user_settings` Table (migration `016_user_settings.sql`)

> **Status: shipped** (Post-V5). Server-side per-user preferences so theme, default
> AI model, and the notification preference follow the user across devices instead of
> living only in `localStorage`. Closes V5 §12.2 / §13.4 (personalization ceiling).

### Schema

```sql
CREATE TABLE user_settings (
  id                    SERIAL PRIMARY KEY,
  user_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  theme                 VARCHAR(20) NOT NULL DEFAULT 'system'
                        CHECK (theme IN ('light', 'dark', 'system')),
  default_model         VARCHAR(50) NOT NULL DEFAULT 'deepseek-v4-flash',
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE TRIGGER set_updated_at_user_settings
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

Typed columns (rather than the originally-proposed key/value EAV layout) were chosen
so each preference is constrained and self-documenting; the set is small and stable,
so the rare ALTER to add a column is preferred over an untyped `value TEXT`. `UNIQUE
(user_id)` gives exactly one row per user and also serves as the lookup index, so no
separate `idx_user_settings_user` is needed.

### Lazy seeding

There is no seed-on-register step. `getSettings(userId)` (`server/models/settings.model.js`)
runs `INSERT … ON CONFLICT (user_id) DO NOTHING` then selects, so the default row is
materialised on the first `GET /api/settings`. This mirrors the `ensureDefaults`
pattern already used in `finance.model.js`. `upsertSettings` splits the ensure-row
INSERT from the partial UPDATE so a first-time write persists the supplied values
rather than the schema defaults.

### API

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/settings` | Return the user's settings (created with defaults on first access) |
| `PUT`  | `/api/settings` | Upsert `theme` / `default_model` / `notifications_enabled` (Zod-validated; ≥1 field). Audit event `SETTINGS_UPDATE`. |

### Frontend wiring

- `client/src/hooks/useSettings.js` — loads settings once, exposes `update`, falls back to defaults on error.
- `client/src/hooks/useTheme.js` — the dark-mode toggle fire-and-forgets `PUT /api/settings { theme }` so the choice persists server-side (never blocks the UI).
- `client/src/pages/AIChat.jsx` — pre-selects `default_model` for a fresh chat (an open conversation still restores the model it used).

---

## Env Vars Reference

| Variable | Side | Required | Notes |
|----------|------|----------|-------|
| `DATABASE_URL` | server | yes | Postgres connection string |
| `CLIENT_ORIGIN` | server | yes | e.g. `http://localhost:5173` |
| `SESSION_SECRET` | server | yes | Random 32+ char string |
| `PORT` | server | no | Defaults to `3000` |
| `NODE_ENV` | server | no | `development` \| `production` |
| `SENTRY_DSN` | server | no | Omit to disable server-side error reporting |
| `VITE_API_URL` | client | no | Defaults to `http://localhost:3000` |
| `VITE_SENTRY_DSN` | client | no | Omit to disable client-side error reporting |
| `GRAFANA_PASSWORD` | infra | yes (prod) | Grafana admin password; default `changeme123` is insecure on public subdomain. Generate: `openssl rand -hex 16` |
| `RESTIC_PASSWORD` | infra | yes (prod) | AES-256 passphrase for Restic backup encryption |
| `B2_ACCOUNT_ID` / `B2_ACCOUNT_KEY` | infra | yes (prod) | Cloudflare R2 / Backblaze B2 credentials for off-site backup |

---

## Deployment Architecture

### Network Topology

```
Internet → Cloudflare Edge (DNS + TLS 1.3 + DDoS shield)
              ↓
         Cloudflare Zero Trust Tunnel (cloudflared container)
         Outbound-only — ZERO open inbound ports on host
              ↓ (internal Docker network: polymathos_net)
         nginx (React SPA + reverse proxy → :80/:443)
              ↓
         api (Express.js → :3000)
              ↓
         db (PostgreSQL 16 + pgvector → :5432, internal only)
```

The host firewall (UFW) blocks all inbound. SSH is LAN-only with key auth. All public subdomains terminate at Cloudflare and enter via the outbound tunnel — no port forwarding, no DMZ, no exposed services.

### Container Inventory (19 containers)

| Layer | Container | Image | Purpose |
|-------|-----------|-------|---------|
| **Core App** | `db` | `postgres:16-alpine` | Primary database |
| | `api` | local build | Express.js backend |
| | `client` / `nginx` | `nginx:alpine` + built SPA | Static files + reverse proxy |
| | `cloudflared` | `cloudflare/cloudflared` | Zero Trust ingress tunnel |
| **Monitoring** | `prometheus` | `prom/prometheus` | Metrics collection |
| | `grafana` | `grafana/grafana` | Dashboards |
| | `node-exporter` | `prom/node-exporter` | Host metrics (CPU, RAM, disk) |
| | `cadvisor` | `gcr.io/cadvisor/cadvisor` | Container metrics |
| | `uptime-kuma` | `louislam/uptime-kuma` | Uptime / status page |
| | `alertmanager` | `prom/alertmanager` | Alert routing |
| **Backup** | `restic-backup` | local build | Scheduled Restic → Cloudflare R2 |
| **Self-Hosted Cloud** | `gitea` | `gitea/gitea:1.22` | Private Git hosting |
| | `gitea-db` | `postgres:16-alpine` | Gitea database |
| | `nextcloud` | `nextcloud:stable` | File sync |
| | `nextcloud-db` | `mariadb:11` | Nextcloud database |
| | `nextcloud-redis` | `redis:alpine` | Nextcloud cache |
| | `vaultwarden` | `vaultwarden/server` | Password manager |
| **Dev Tools** | `collabora` | `collaboraoffice/collabora-online` | Online document editing |
| | `portainer` | `portainer/portainer-ce` | Container management UI |

Total: 19 containers. Host: Asus A455LF (Intel i5-5200U, 8 GB RAM, 500 GB SSD), Ubuntu Server 26.04 LTS.

### Resource Allocation

| Container group | RAM cap (compose `mem_limit`) |
|-----------------|-------------------------------|
| Core App (db + api + nginx) | ~1.5 GB combined |
| Monitoring stack | ~400 MB |
| Self-Hosted Cloud | ~2 GB (Nextcloud is hungriest) |
| Backup + Dev Tools | ~400 MB |
| **Headroom for OS + host** | ~3.7 GB |

Memory limits are set in `docker-compose.yml` and `docker-compose.services.yml` to prevent any single container from starving the host.

### Security Boundaries

| Boundary | Mechanism |
|----------|-----------|
| Public internet → host | UFW blocks all inbound; only Cloudflare tunnel (outbound) reaches services |
| SSH access | LAN-only (`AllowUsers` + `ListenAddress`), key auth, `PasswordAuthentication no` |
| Container isolation | Non-root users, `read_only` fs where possible, no `--privileged` |
| Secrets | `.env` files never committed; `.env.docker.example` has only keys + comments |
| DB access | Only `api` container can reach `db` (Docker network isolation); port 5432 not exposed |
| Grafana | Password-protected via `GRAFANA_PASSWORD`; served through Cloudflare Access |
| Backups | Restic AES-256 encryption (`RESTIC_PASSWORD`); off-site to Cloudflare R2 |
