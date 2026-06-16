# Contributing

Thank you for your interest in improving this project.

---

## Prerequisites

- Node.js 22
- PostgreSQL 16
- Docker + Docker Compose (optional, for the full stack locally)

---

## Local Setup

```bash
# 1. Clone
git clone https://github.com/raflitriwijaya/productivity-project.git
cd productivity-project

# 2. Server dependencies
cd server && cp .env.example .env   # fill in DATABASE_URL, CLIENT_ORIGIN, SESSION_SECRET
npm install

# 3. Run migrations
npm run migrate

# 4. Client dependencies
cd ../client && cp .env.example .env
npm install

# 5. Start both (two terminals)
cd server && npm run dev      # http://localhost:3000
cd client && npm run dev      # http://localhost:5173
```

---

## Lint, Test, Build

All commands run from their respective subdirectory (`server/` or `client/`).

| Command | What it does |
|---------|-------------|
| `npm run lint` | ESLint (0 warnings allowed) |
| `npm test` | Vitest unit tests |
| `npm run test:integration` | Vitest integration tests (server only; requires live DB) |
| `npm run test:property` | Fast-check property tests (server only) |
| `npm run test:fuzz` | Fuzz tests for parsing/validation edge cases (server only) |
| `npm run test:e2e` | Playwright end-to-end tests (client only) |
| `npm run build` | Vite production build (client only) |
| `npm run openapi` | Regenerate `docs/openapi.json` from Zod schemas (server only) |
| `npm run migrate` | Run pending DB migrations (server only) |

---

## CI Gate

Every push and pull request to `main` runs `.github/workflows/ci.yml`:

1. **server** job: `npm ci` → `npm audit --audit-level=high` → `npm run lint` → `npm test`
2. **client** job: `npm ci` → `npm audit --audit-level=high` → `npm run lint` → `npm run build` → `npm test`

Both jobs must pass before a merge. Set them as required status checks in **Settings → Branches → Branch protection rules**.

---

## Branch and PR Conventions

- Branch names: `feat/<short-description>`, `fix/<short-description>`, `docs/<short-description>`, `chore/<short-description>`.
- Keep PRs focused — one logical change per PR.
- Commit messages: imperative present tense, concise (≤ 72 chars subject).
- Reference issues in the PR body when applicable.
- Update `CHANGELOG.md` (the `[Unreleased]` section) for any user-visible change.

---

## Code Style

- **Server** — ESM (`"type": "module"`); async/await; Zod validation on all mutating routes via `validate()` middleware; standard error envelope `{ success, data }` / `{ success, error }`.
- **Client** — React 19; functional components + hooks; Tailwind CSS (no inline hex, no arbitrary values except sanctioned `style` exceptions for runtime widths/colours); `useApi` / `useToast` / `useTheme` hooks; no new UI dependencies without discussion.
- **No comments** explaining *what* the code does — only explain *why* when the reason is non-obvious.
- Follow the existing phase-comment convention (`// Phase N: reason`) when adding to files already using it.

---

## Adding a DB Migration

1. **Name your migration:** Run `ls server/db/migrations/ | tail -5` to see the most recent files. The next migration number is one higher than the latest. Follow the established pattern: `DROP TABLE IF EXISTS … CASCADE` for re-runnability, `user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE`, and the shared `set_updated_at()` trigger.
2. Write idempotent SQL: `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` / `DROP … IF EXISTS CASCADE` before each `CREATE`.
3. Test by running `npm run migrate` against a dev database.
4. The CI server job runs `npm run migrate` against the CI Postgres service automatically — integration tests can assume a fully-migrated schema.

---

## Security

Please read [SECURITY.md](SECURITY.md) before reporting vulnerabilities. Do not open public issues for security bugs.
