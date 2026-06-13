# Security Policy

## Supported Versions

This is a personal productivity tool. Only the `main` branch HEAD is actively maintained.

| Branch / Version | Supported |
|------------------|-----------|
| `main` (latest)  | Yes       |
| older commits    | No        |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

1. Email the maintainer directly (see GitHub profile) with the subject line `[SECURITY] <brief description>`.
2. Include: affected component, steps to reproduce, potential impact, and any suggested fix.
3. You will receive an acknowledgement within 48 hours and a resolution timeline within 7 days.

Once a fix is merged, the vulnerability will be documented in [CHANGELOG.md](CHANGELOG.md).

---

## Hardening Already in Place

### Server (Express)

| Control | Implementation |
|---------|---------------|
| Security headers | `helmet` — CSP (`default-src 'none'`), HSTS (prod), X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy |
| Rate limiting | `express-rate-limit` — auth: 5 req/15 min/IP; general API: 100 req/min/IP |
| Session security | `httpOnly` cookie, `secure` in production, `sameSite: lax`, 7-day TTL, Postgres-backed (`connect-pg-simple`) |
| Input validation | Zod schemas on every mutating route; `validate()` middleware |
| Body size cap | `express.json({ limit: '1mb' })` |
| Password hashing | `bcryptjs` at cost factor 12 |
| Upload filenames | `crypto.randomUUID()` — no user-controlled path components |
| Attachment auth | Downloads gated behind `requireAuth` + ownership check; no public `/uploads/` static mount |
| Pre-upload ownership | `requireOwnedEntry` middleware verifies entry ownership *before* multer writes to disk; unauthorized upload requests are rejected without touching `server/uploads/` |
| Attachment delete path | DELETE reconstructs path from `filename` only (`path.join(uploadsDir, filename)`), never trusts the stored absolute `file_path`; host/mount-independent |
| Export size cap | `/api/research/export` capped at 10,000 rows; returns `413` on overflow to prevent a single request from pinning the container heap |
| Month/year validation | Finance endpoints reject present-but-invalid `?month`/`?year` params with `400 VALIDATION_ERROR` rather than silently treating them as all-time queries |
| Cross-module link ownership | `POST /api/links` verifies the caller owns **both** referenced entities (via each module's `get*ById`) before creating a link; missing/non-owned entities return `404` (never `403`) to avoid existence disclosure. `DELETE`/`GET` are `user_id`-scoped at the query level |
| DB errors | pg `23505` mapped to `409`; 500 details masked from client |
| Error reporting | Sentry captures unhandled exceptions (when `SENTRY_DSN` set); request ID (`reqId`) surfaced for correlation |

### Client (React)

| Control | Implementation |
|---------|---------------|
| Markdown XSS | `rehype-sanitize` applied to editor live preview and `MarkdownPreview` |
| Error boundary | `ErrorBoundary` wraps `<App />` to prevent white-screen data leaks on crashes |
| Attachment download | Axios blob fetch → object URL (no unauthenticated `<a href>` to `/uploads/`) |
| No secrets in bundle | Only `VITE_`-prefixed env vars reach the browser |
| Error reporting | Sentry initialized before render **when `VITE_SENTRY_DSN` is supplied as a Docker build arg** (disabled by default; the nginx CSP `connect-src` allows `https://*.ingest.sentry.io`) |

### Infrastructure (nginx / Docker)

| Control | Implementation |
|---------|---------------|
| Nginx security headers | `X-Frame-Options DENY`, `X-Content-Type-Options nosniff`, `Referrer-Policy strict-origin-when-cross-origin`, CSP `default-src 'self'`, `frame-ancestors 'none'` |
| Static asset caching | `Cache-Control: public, immutable` + 1-year `expires` for Vite-hashed assets |
| Container isolation | `api` and `db` are on an internal Docker network; only nginx exposes port 80 |
| DB healthcheck | nginx waits for `api` to pass `GET /health` before serving traffic |
| Backup durability | `db_backup` sidecar pushes nightly `pg_dump` off-host to S3/R2 when `BACKUP_S3_BUCKET` is set, so a host failure cannot destroy both live data and its only backup |
| Migration data-loss guard | `002_finance_upgrade.sql` aborts with `RAISE EXCEPTION` if `transactions` is populated, preventing accidental ledger wipeout on manual re-runs or `schema_migrations` resets |
| Secret hygiene | Dev `SESSION_SECRET`/DB password treated as compromised; rotation procedure documented in `docs/RUNBOOK.md §3`; example env files carry explicit generate-fresh warnings |

---

## Third-Party Data Egress

> Added Wave 7 (2026-06-12). For six waves Polymath OS was a closed system — data entered, was processed on-host, and never left. Wave 7 introduces two deliberate doors, both opt-in and key-gated.

### AI Chat (DeepSeek cloud)

**What leaves the host:** when a user sends a chat message using a `cloud` model (`deepseek-v4-flash`, `deepseek-v4-pro`), the following is transmitted to DeepSeek's API:

1. The user's message text.
2. All prior messages in the conversation thread (the running context window).
3. On the first message of a context-linked conversation, a JSON snapshot of the anchoring entity injected as a system prompt. This snapshot contains fields from one of: a research entry, an engineer project, a book, a learning item, a goal, or an idea — belonging to the authenticated user only. No other users' data is ever included.

**What does NOT leave:** session tokens, passwords, financial raw data, file attachments, or data from modules not explicitly linked to the conversation.

**Provider:** DeepSeek (<https://deepseek.com>). Traffic goes to `DEEPSEEK_BASE_URL` (default: `https://api.deepseek.com/v1`).

**How to prevent egress (local-only mode):** set `model: 'deepseek-r1-local'` in the chat UI. This routes all requests through a locally-running Ollama instance (`OLLAMA_BASE_URL`, default: `http://localhost:11434`). No data leaves the host in this mode.

**How to disable AI chat entirely:** do not set `DEEPSEEK_API_KEY`. Cloud model availability is gated on this variable; without it the cloud models report `available: false` and the send endpoint returns an error event before any upstream fetch is made.

### Embeddings / Semantic Search (DeepSeek cloud)

**What leaves the host:** when a research entry is created or edited with an embedding API key configured, the entry's `title`, `content`, `tags`, and `source` are sent to the embedding endpoint to generate a semantic vector. The same fields are sent when a user performs a semantic search query.

**Provider:** configurable via `EMBEDDING_API_URL` (default: `https://api.deepseek.com/v1/embeddings`). Can be pointed at any OpenAI-compatible embeddings endpoint, including a self-hosted one.

**How to disable:** do not set `EMBEDDING_API_KEY` or `DEEPSEEK_API_KEY`. Embedding generation is skipped silently; keyword search continues to work normally.

### Timeouts

Both the chat fetch and the embedding fetch carry `AbortController` timeouts (60 s for DeepSeek cloud, 120 s for Ollama, 30 s for embeddings). A timed-out request emits an error event to the client and releases the SSE stream; it does not retry automatically.

---

## Known Limitations

- **Single-tenant only** — there is no multi-tenant isolation; all data is owned by the single authenticated user.
- **No 2FA** — password authentication only. Add TOTP (e.g., `speakeasy`) if the deployment is public-facing.
- **Attachment storage** — files live on local disk; see [docs/RUNBOOK.md §4](docs/RUNBOOK.md#4-object-storage-migration-plan-uploads--s3--cloudflare-r2) for the planned migration to object storage.
- **No CSRF token** — session cookie uses `sameSite: lax` which mitigates most CSRF vectors for top-level navigation but does not protect against same-site subdomains. Add `csurf` (or the `sameSite: strict` upgrade) if the deployment origin changes.
