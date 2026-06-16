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

## Infrastructure Security (Home Server — added V10)

Polymath OS runs on a self-hosted home server (Asus A455LF, Ubuntu Server 26.04 LTS) behind Cloudflare Zero Trust. The controls below supplement the application-level hardening above.

### Network Perimeter

| Control | Detail |
|---------|--------|
| **Zero open inbound ports** | UFW default-deny inbound. All external traffic enters via a Cloudflare outbound tunnel (`cloudflared`). `nmap` from the internet shows no open ports. |
| **Cloudflare Zero Trust** | All public subdomains terminate at Cloudflare Edge (TLS 1.3, DDoS protection) before reaching any service. Cloudflare Access policies guard sensitive dashboards (Grafana, Portainer). |
| **SSH LAN-only** | `sshd` configured with `ListenAddress <LAN-IP>`, `PasswordAuthentication no`, `PermitRootLogin no`. Key-only auth. Not reachable from the internet. |
| **UFW rules** | Only LAN SSH and Docker-internal subnets allowed. All other inbound dropped. |

### Container Security

| Control | Detail |
|---------|--------|
| **Non-root users** | Application containers (`api`, `nginx`) run as non-root UIDs where possible |
| **Memory limits** | All containers have `mem_limit` set in Compose files to prevent any single container starving the host |
| **`.dockerignore`** | `.env*`, `node_modules`, `*.md` excluded from build context; no secrets baked into images |
| **Pinned images** | Service images pinned to specific versions (e.g., `postgres:16-alpine`, `gitea/gitea:1.22`) — not `:latest` — so rebuilds are reproducible and supply-chain surprises are visible |
| **Internal-only DB** | PostgreSQL port 5432 is not exposed on the host; only the `api` container can reach `db` via the Docker bridge network |
| **No privileged containers** | No container runs with `--privileged` or `CAP_SYS_ADMIN` |

### Secret Management

| Control | Detail |
|---------|--------|
| **Env files never committed** | `.env` and `.env.docker` are in `.gitignore`; only `.env.docker.example` (keys, no values) is committed |
| **GRAFANA_PASSWORD** | Must be set before production deploy (see `.env.docker.example`). Default `changeme123` is blocked by a startup check. |
| **RESTIC_PASSWORD** | AES-256 passphrase for all Restic backup repositories. Stored only in `.env.docker`, never in Compose files. |
| **SESSION_SECRET** | 32+ random chars; rotation procedure in [RUNBOOK.md §3](docs/RUNBOOK.md) |
| **Generate-fresh warnings** | `.env.docker.example` carries explicit `openssl rand -hex 32` commands next to every secret field |

### Backup Security

| Control | Detail |
|---------|--------|
| **Restic AES-256 encryption** | All backup snapshots are client-side encrypted before leaving the host; Cloudflare R2 sees only ciphertext |
| **Off-site storage** | Snapshots pushed to Cloudflare R2 (zero-knowledge, geographically separate from host) |
| **9/9 data stores covered** | Verified 2026-06-16 post V10 audit. Covers: PostgreSQL (main), Gitea, Nextcloud, Vaultwarden, `server/uploads`, `.env.docker`, Prometheus data, Grafana data, Uptime Kuma data |
| **Backup freshness alert** | Prometheus rule fires if no snapshot in >48 hours (`BackupFreshness` in `alert_rules.yml`) |

### Repository Security

The source code is hosted publicly on GitHub. This is intentional (open-source, 50-year architecture). Sensitive operational data (`.env`, backups, secrets) never enters the repo. Audit reports are committed without redaction — they document the system's security posture for transparency.

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
- **Single host, no HA** — all 19 containers run on one machine. A hardware failure takes down all services until the host is recovered or rebuilt from backup. The backup + source rebuild guarantee (Invariant 6) is the recovery path.
- **Grafana publicly accessible** — Grafana is served through Cloudflare Access but is internet-reachable. `GRAFANA_PASSWORD` must be strong; consider adding Cloudflare Access policies with email-pinned identity.
- **npm audit vulns** — as of V10, `npm audit` reports high-severity findings in `form-data` (server) and `vite` (client). Tracked for next maintenance window.
