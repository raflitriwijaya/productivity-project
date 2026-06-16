# CLAUDE.md — Polymath OS

> **Purpose:** Context guide for every Claude Code session. Read this before writing any code.
> **Last updated:** 2026-06-16
> **Current audit score:** 8.8/10 ([docs/audit/AUDIT_REPORT_V10.md](docs/audit/AUDIT_REPORT_V10.md))
> **Internal name:** the docs also call this "Rafli's Productivity Suite" — same system.

---

## 1. WHAT IS THIS PROJECT?

Polymath OS is a single-user personal productivity system for a researcher / engineer / founder / polymath — finances, research, engineering, learning, reading, contacts, ideas, goals, time, and an AI assistant in one app. It spans ~18 modules and 100+ API paths, is AI-powered (DeepSeek V4 + local Ollama R1), and is built on a "50-year architecture": PostgreSQL, open formats, additive evolution, and a `pg_dump`-plus-source complete rebuild guarantee.

---

## 2. TECH STACK

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + Vite/Rolldown, Tailwind CSS (Stoic Garden palette), React Router DOM |
| Backend | Node.js 22 + Express 5 (raw SQL, no ORM) |
| Database | PostgreSQL 16 + pgvector |
| Sessions | `express-session` + `connect-pg-simple` (cookie `sid`, httpOnly) |
| AI | DeepSeek V4 Pro/Flash (cloud), Ollama R1 (local) |
| Monitoring | Prometheus (`/metrics`), Pino, Sentry (optional, DSN-gated) |
| Testing | Vitest, Playwright, axe-core |
| PWA | vite-plugin-pwa |
| Deploy | Docker Compose + nginx + Cloudflare Tunnel |

---

## 3. PROJECT CONVENTIONS (READ BEFORE WRITING CODE)

### 3.1 The Six Invariants (NEVER VIOLATE)

1. Data in PostgreSQL, open formats, fully exportable
2. `route → model → SQL` and `component → hook → API` spine
3. Additive evolution — new capability = new tables + routes + pages. Never rewrite core
4. `user_id` scoping on every query, ownership validated at the API
5. Documented rationale for every major decision
6. `pg_dump` + source = complete rebuild (⇒ never leave `git status` dirty)

### 3.2 Server Conventions

- **Router exports are NAMED**: `import { Router } from 'express'` → `const router = Router()` → define routes → `export { router as fooRouter }` (a `export default router` is usually added too, but `index.js` mounts the **named** export).
- Mount pattern in [server/index.js](server/index.js): `app.use('/api/foo', requireAuth, fooRouter)`.
- **Literal routes BEFORE parameterized routes** (`/models`, `/conversations` before `/conversations/:id`).
- All queries: parameterized (`$1, $2, …`) and `WHERE user_id = $1` scoped. Ownership re-checked on every read/update/delete (return `null` → route throws 404).
- Response envelope: `{ success: true, data }` (add `meta` for paginated lists) or `{ success: false, error: { code, message, reqId, field? } }`.
- **AppError is MESSAGE FIRST**: `new AppError(message, statusCode, code, field?)`. Throw it; the central handler builds the envelope.
- Validation: Zod schema + `validate(schema)` middleware on every mutating route. The middleware replaces `req.body` with parsed/coerced data and throws `VALIDATION_ERROR` on the first failure.
- Auth: `requireAuth` reads `req.session.userId` → sets `req.user = { id }`; downstream uses `req.user.id`.
- Audit logging: `(req.log ?? logger).info({ event: 'EVENT_NAME', userId, reqId: req.id }, message)`.
- DB pool: import either way — `import { pool } from '../lib/db.js'` or `import pool from '../lib/db.js'` (same singleton).
- Models: export **named** functions `(userId, …)` → parameterized queries → return rows/objects. JSONB comes back pre-parsed (no manual `JSON.parse`).
- Migrations: forward-only runner ([server/db/migrate.js](server/db/migrate.js), `npm run migrate`). Use `DROP TABLE IF EXISTS … CASCADE`, `user_id` FK `ON DELETE CASCADE`, and a `set_updated_at()` trigger.
- Migration naming: `NNN_descriptive_name.sql`. Find the next number with `ls server/db/migrations/ | grep -E '^[0-9]{3}_' | sort | tail -1` (legacy `YYYYMMDD_*` files sort after the numbered series — ignore them).

### 3.3 Client Conventions

- Page pattern: `useDocumentTitle('Title')` → `useApi` or a custom `useCallback` fetch → render **4 states** (Loading skeleton / Error / Empty / Data). Never a spinner — use skeletons.
- Components & UI primitives use **named exports**: `import { Modal } from '../components/ui/Modal'`, `import { Button } from '../components/ui/Button'`. (`Skeleton`, `ErrorState`, `EmptyState`, `StatCard`, `Badge` are all named too.)
- `useDocumentTitle` is a **default** export; `useToast` is a **named** export from `../hooks/useToast`.
- Axios: `import api from '../lib/api'` → `api.get/post/patch/delete`. The response interceptor **unwraps `response.data`**, so callers get `{ success, data, meta }` directly. A 401 hard-redirects to `/login`; 429 is surfaced, not redirected.
- Do NOT set a default `Content-Type` on `api` — it auto-detects `multipart/form-data` for FormData uploads. SSE streaming uses a raw `fetch` (not `api`), see [AIChat.jsx](client/src/pages/AIChat.jsx).
- Toast: `import { useToast } from '../hooks/useToast'` → `const { addToast } = useToast()` → `addToast({ type: 'success'|'error', title })`.
- Format IDR: `import { formatIdr, parseIdrInput, formatIdrInput } from '../lib/formatIdr'`. Always use `parseIdrInput` in form submit handlers — never `Number()` on IDR fields.
- Dark mode: always include `dark:` variants for every Tailwind class.
- Stoic Garden palette: **moss** (green/success), **terracotta** (hardware/craft), **ember** (amber/CTA), **stone** (neutral).
- Routes in [client/src/App.jsx](client/src/App.jsx): literal paths before parameterized; heavy pages (Research, Engineer*) are `lazy()`-loaded.
- Sidebar nav lives in [client/src/components/layout/AppLayout.jsx](client/src/components/layout/AppLayout.jsx) (`NAV_SECTIONS`).

### 3.4 Common Imports (Copy-Paste Ready)

**Server:**
```js
import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../lib/db.js';
import { AppError } from '../lib/AppError.js';
import { logger } from '../lib/logger.js';
import { validate } from '../middleware/validate.js';
```

**Client (from a page in `client/src/pages/`):**
```jsx
import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { useToast } from '../hooks/useToast';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { StatCard } from '../components/ui/StatCard';
import { Skeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
```

---

## 4. KEY FILES MAP

### Server
| File | Purpose |
|------|---------|
| [server/index.js](server/index.js) | Entry point, middleware order, all router mounts |
| [server/lib/db.js](server/lib/db.js) | Shared pg Pool (named + default export) |
| [server/lib/AppError.js](server/lib/AppError.js) | Operational error class (message-first) |
| [server/lib/enums.js](server/lib/enums.js) | Single source of truth: `LINKABLE_TYPES`, `TX_TYPES`, all enums |
| [server/middleware/errorHandler.js](server/middleware/errorHandler.js) | Central error → envelope; maps pg 23505 → 409 |
| [server/middleware/auth.js](server/middleware/auth.js) | `requireAuth` |
| [server/middleware/validate.js](server/middleware/validate.js) | Zod `validate(schema)` |
| [server/routes/chat.js](server/routes/chat.js) | AI Chat — `MODELS`, SSE streaming, backward compat |
| [server/db/migrate.js](server/db/migrate.js) | Forward-only, self-healing migration runner |
| [server/scripts/generate-openapi.js](server/scripts/generate-openapi.js) | OpenAPI spec generator |

### Client
| File | Purpose |
|------|---------|
| [client/src/App.jsx](client/src/App.jsx) | Route tree, lazy loading |
| [client/src/lib/api.js](client/src/lib/api.js) | Axios instance with interceptors |
| [client/src/lib/enums.js](client/src/lib/enums.js) | Client mirror of server enums (22 `LINKABLE_TYPES`) |
| [client/src/hooks/useApi.js](client/src/hooks/useApi.js) | `{ data, loading, error, refetch }` fetch hook |
| [client/src/components/ui/Modal.jsx](client/src/components/ui/Modal.jsx) | Portal modal with Tab focus trap |
| [client/src/components/layout/AppLayout.jsx](client/src/components/layout/AppLayout.jsx) | Sidebar / `NAV_SECTIONS` |

---

## 5. COMMON COMMANDS

```bash
# Server (cd server)
npm run dev                 # node --watch index.js
npm run migrate             # node db/migrate.js — apply pending migrations
npm test                    # vitest run
npm run test:integration    # vitest run test/integration
npm run lint                # eslint . --max-warnings 0
npm run openapi             # regenerate docs/openapi.json

# Client (cd client)
npm run dev                 # vite dev server (:5173)
npm run build               # vite production build
npm test                    # vitest run
npm run test:e2e            # playwright test
npm run lint                # eslint . --max-warnings 0

# Docker (production)
docker compose up --build -d   # build & start all services
docker compose ps              # service status
docker compose logs -f api     # follow API logs
```

---

## 6. DO NOT DO (Common Mistakes)

- ❌ Do NOT use `AppError(statusCode, code, message)` — it is **MESSAGE FIRST**: `AppError(message, statusCode, code, field?)`.
- ❌ Do NOT default-import the UI primitives — `Modal`, `Button`, `Skeleton`, `ErrorState`, `EmptyState`, `StatCard`, `Badge` are all **named** exports.
- ❌ Do NOT `export default router` and expect it to mount — `index.js` imports the **named** router (`{ fooRouter }`).
- ❌ Do NOT hardcode migration numbers in docs — derive the next one from `ls server/db/migrations/`.
- ❌ Do NOT add a new `LINKABLE_TYPES` entry without updating **BOTH** [server/lib/enums.js](server/lib/enums.js) AND [client/src/lib/enums.js](client/src/lib/enums.js) (and the `chk_entity_link_types` CHECK in the migration).
- ❌ Do NOT create new endpoints without adding `addPath` calls in [server/scripts/generate-openapi.js](server/scripts/generate-openapi.js).
- ❌ Do NOT set a default `Content-Type` on the axios `api` client — it breaks FormData/multipart uploads.
- ❌ Do NOT send `temperature`/`top_p` when DeepSeek thinking mode is enabled — they must be OMITTED.
- ❌ Do NOT forget to pass `reasoning_content` back in multi-turn AI chat conversations.
- ❌ Do NOT put a parameterized route before a literal one (`/:id` before `/stats`).
- ❌ Do NOT rewrite core middleware / error handler / auth — always extend additively.
- ❌ Do NOT change the error envelope shape — `{ success, data/error }` is sacred.
- ❌ Do NOT leave `git status` dirty — commit all changes after every session (Invariant 6).
- ❌ Do NOT submit money/IDR fields via `Number()` — always use `parseIdrInput()` from `../lib/formatIdr`. `Number("50.000")` returns `50` in JavaScript (dot = decimal), not `50000`. This was the founding bug that survived 8 audits.
- ❌ Do NOT use `formatIdrInput` in form input `value` props — it causes the ×100 formatting bug. Use raw numbers in inputs, `formatIdr` for display-only.
