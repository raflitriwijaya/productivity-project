# Security — Rafli's Productivity Suite

> Operational security properties, threat model, and disclosure contacts.
> For architecture see [ARCHITECTURE.md](ARCHITECTURE.md). For runbook procedures see [RUNBOOK.md](RUNBOOK.md).

---

## Authentication & Session

- Sessions stored in PostgreSQL via `connect-pg-simple`. No JWTs; revocation is a row delete.
- `bcryptjs` cost 12 for password hashing.
- Session cookie: `httpOnly: true`, `secure: true` (production), `sameSite: lax`.
- Session is regenerated on every successful login to prevent fixation.
- Auth endpoints (`/api/auth/login`, `/api/auth/register`) carry a strict rate-limiter (5 req / 15 min / IP).

## Transport Security

- `helmet` enforces CSP (`default-src 'none'`), X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and HSTS (production, 1 year, preload).
- All API traffic behind nginx in production; the app port is not directly internet-reachable.

## Authorization

- Every protected route requires `requireAuth` middleware; the session is checked before the route handler runs.
- Every model function accepts `userId` and filters by it in SQL — cross-user data access is structurally impossible.
- The `entity_links` router verifies ownership of **both** endpoints before writing a link, returning 404 (never 403) to avoid existence disclosure.

## Input Validation

- All mutating routes validate with Zod; invalid payloads are rejected before hitting the database.
- All SQL uses parameterized queries (`$1`, `$2`, …). No dynamic query string construction.
- Body parsers are capped at 1 MB; file uploads at 10 MB with MIME-type and extension whitelisting.

## Rate Limiting

- Global limiter: 100 req / 60 s / IP (applied before body parsers to reject flood payloads early).
- Auth limiter: 5 req / 15 min / IP on login and register only.

---

## Third-Party Data Egress

> Added Wave 7 (2026-06-12). For six waves Polymath OS was a closed system — data entered, was processed on-host, and never left. Wave 7 introduces two deliberate doors, both opt-in and key-gated.

### AI Chat (DeepSeek cloud)

**What leaves the host:** when a user sends a chat message using a `cloud` model (`deepseek-chat`, `deepseek-chat-max`), the following is transmitted to DeepSeek's API:

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

## Known Lower-Priority Items

| # | Item | Status |
|---|------|--------|
| S-1 | `/metrics` unauthenticated at app port (edge-blocked via nginx `location` omission) | Accepted risk; bind to localhost for defence-in-depth |
| S-2 | No CSRF token (defence: `sameSite: lax` + CORS origin allowlist) | Carried; upgrade to `strict` or double-submit token if a third-party client is added |
| S-3 | `LOGIN_FAILURE` logs attempted email in plaintext | Accepted; hash if logs leave the host |

---

## Responsible Disclosure

This is a personal single-user productivity suite. Security issues may be reported directly to the repository owner via the project issue tracker.
