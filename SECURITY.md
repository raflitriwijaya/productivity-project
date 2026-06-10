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
| DB errors | pg `23505` mapped to `409`; 500 details masked from client |
| Error reporting | Sentry captures unhandled exceptions (when `SENTRY_DSN` set); request ID (`reqId`) surfaced for correlation |

### Client (React)

| Control | Implementation |
|---------|---------------|
| Markdown XSS | `rehype-sanitize` applied to editor live preview and `MarkdownPreview` |
| Error boundary | `ErrorBoundary` wraps `<App />` to prevent white-screen data leaks on crashes |
| Attachment download | Axios blob fetch → object URL (no unauthenticated `<a href>` to `/uploads/`) |
| No secrets in bundle | Only `VITE_`-prefixed env vars reach the browser |
| Error reporting | Sentry initialized before render (when `VITE_SENTRY_DSN` set) |

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

## Known Limitations

- **Single-tenant only** — there is no multi-tenant isolation; all data is owned by the single authenticated user.
- **No 2FA** — password authentication only. Add TOTP (e.g., `speakeasy`) if the deployment is public-facing.
- **Attachment storage** — files live on local disk; see [docs/RUNBOOK.md §4](docs/RUNBOOK.md#4-object-storage-migration-plan-uploads--s3--cloudflare-r2) for the planned migration to object storage.
- **No CSRF token** — session cookie uses `sameSite: lax` which mitigates most CSRF vectors for top-level navigation but does not protect against same-site subdomains. Add `csurf` (or the `sameSite: strict` upgrade) if the deployment origin changes.
