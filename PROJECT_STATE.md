# Project State

## Stack
- Frontend: React + Vite (port 5173)
- Backend: Node.js + Express (port 3000)
- DB: PostgreSQL

---

## npm packages

**Server** (`server/package.json`, `"type": "module"`): `express`, `cors`, `express-session`, `connect-pg-simple`, `bcrypt`, `pg`, `zod`, `dotenv`. Requires Node `>=18`. Scripts: `dev` (`node --watch index.js`), `start`.

**Client** (`client/package.json`, `"type": "module"`): runtime — `react`, `react-dom`, `react-router-dom`, `axios`, `lucide-react`; build — `vite`, `@vitejs/plugin-react`, `tailwindcss` (v3), `postcss`, `autoprefixer`, eslint toolchain.

> Run `npm install` in **both** `client/` and `server/` before first run; the dependency manifests above were completed during the audit (the code already imported them).

---

## Completed Pages

- `/login` → `client/src/pages/Login.jsx` — Email + password form; calls `POST /api/auth/login`; redirects to `/` on success; redirects to `/` if already authenticated; client-side field validation + server error banner
- `/register` → `client/src/pages/Register.jsx` — Name + email + password form; calls `POST /api/auth/register`; redirects to `/login` on success; redirects to `/` if already authenticated; client-side field validation (min 8-char password) + server error banner
- `/` → `client/src/pages/Dashboard.jsx` — Overview dashboard with per-module stat cards (todos, finance, learning, research) and four recent-activity widgets (RecentTodos, RecentTransactions, RecentResearch, RecentLearning); todo stats fetched from `GET /api/todos/stats` (no longer using the `per_page=100` workaround)
- `/todo` → `client/src/pages/Todo.jsx` — Task management with create, edit, delete, status filter, stat cards
- `/finance` → `client/src/pages/Finance.jsx` — Transactions ledger: month/year selector, monthly Income/Expense/Net/Net-Worth totals, typed create/edit form (Type/Amount(IDR)/Source/Dest/Category/Reconciliation), type filter tabs, colour-coded rows/badges, delete with confirmation
- `/finance/dashboard` → `client/src/pages/FinanceDashboard.jsx` — 12-month income/expense trend chart, this-month expense donut, per-account balance bars (`GET /api/finances/dashboard`)
- `/finance/accounts` → `client/src/pages/Accounts.jsx` — 6 account cards with live balances + net worth; edit name/opening balance (`GET /api/finances/balances`)
- `/finance/receivables` → `client/src/pages/Receivables.jsx` and `/finance/payables` → `Payables.jsx` — both thin wrappers over `components/finance/LedgerPage.jsx`; table + create/edit/delete + **settle** (posts an Income/Expense transaction)
- `/finance/portfolio` → `client/src/pages/Portfolio.jsx` — holdings table with **inline current-price edit**, derived value/gain, allocation donut
- `/finance/budget` → `client/src/pages/Budget.jsx` — month/year scoped, inline-editable per-category budgets with spend color-coding (`PUT /api/finances/budgets`)
- `/learning` → `client/src/pages/Learning.jsx` — Learning tracker with stat cards (total, in progress, completed, hours spent), status filter pills, DataTable with progress bars and type/status/priority badges, create/edit/delete with confirmation modal
- `/research` → `client/src/pages/Research.jsx` — Research hub with stat cards (total entries, journal, citations, notes), type filter pills, DataTable with source links and type/status badges, create/edit/delete with confirmation modal

---

## Existing DB Tables

- `users` — id, email, password_hash, name, created_at, updated_at
- `user_sessions` — managed automatically by `connect-pg-simple` (`createTableIfMissing: true` in `server/index.js`); no manual migration needed
- `todos` — id, user_id, title, description, status, priority, due_date, created_at, updated_at
- `transactions` — id, user_id, type, category, description, amount, date, created_at, updated_at
- `learning_items` — id, user_id, title, type, source, status, priority, progress, total_hours, spent_hours, started_at, completed_at, notes, url, created_at, updated_at
- `research_entries` — id, user_id, title, type (`journal|citation|note`), status (`draft|active|archived`), content, source, tags, created_at, updated_at

### Finance module (upgraded — migration `002_finance_upgrade.sql`)

The original flat `transactions` table was **replaced** by a multi-account general ledger (7 tables, all `user_id`-scoped, pre-upgrade transaction rows not migrated):

- `accounts` — id, user_id, name, type (`CASH|ATM|DANA|SHOPEEPAY|GOPAY|INVESTMENT`), initial_balance, …; `UNIQUE(user_id, type)`. The 6 standard accounts are seeded lazily by the model (`ensureDefaults`).
- `categories` — id, user_id, name, kind (`INCOME|EXPENSE|SYSTEM`); `UNIQUE(user_id, name)`. 14 standard categories seeded lazily.
- `transactions` — id, user_id, type (`Income|Expense|Transfer|Balance Adjustment|Market Adjustment`), amount, description, date, source_account_id, dest_account_id, category_id, reconciled, … . `amount` is **not** constrained `> 0` (adjustments may be negative).
- `receivables` / `payables` — id, user_id, person, description, amount, due_date, status (`outstanding|settled`), account_id, settled_at, … . Settling posts a matching Income/Expense transaction.
- `portfolio` — id, user_id, name, symbol, quantity, avg_price, current_price, … (market value / gain derived in queries).
- `budgets` — id, user_id, category_id, amount; `UNIQUE(user_id, category_id)` — one recurring monthly budget per category.

**Balance rule** (in `getBalances`/`getSummary`): Income→+dest, Expense→−source, Transfer→−source+dest, Balance/Market Adjustment→+dest.

---

## Existing DB Migrations

Migrations live under `server/db/migrations/` (not `server/migrations/`). All follow §6.5: SERIAL PK, `user_id` FK `ON DELETE CASCADE` (except `users`), VARCHAR status/type columns (no ENUM types), `TIMESTAMPTZ` timestamps, a shared `set_updated_at()` trigger, and `idx_{table}_user_id` / `idx_{table}_status` indexes.

- `20240101_create_users.sql` — `users` table, `set_updated_at()` trigger, unique index on `email`
- `20240101_create_todos.sql` — `todos`; indexes on `user_id`, `status`, `due_date`
- `20240102_create_transactions.sql` — `transactions`; CHECK on `type`/`amount`; indexes on `user_id`, `type`, `date`
- `20240103_create_learning.sql` — `learning_items`; CHECK on `progress`; indexes on `user_id`, `status`, `type`
- `20240101_create_research_entries.sql` — `research_entries`; indexes on `user_id`, `type`, `status`
- `002_finance_upgrade.sql` — drops the old `transactions` table and creates the 7 finance-ledger tables above (re-runnable: every CREATE is preceded by `DROP … IF EXISTS`).

**Migration runner** — `server/db/migrate.js` (`npm run migrate`). Tracks applied files in a `schema_migrations` table; applies each pending `*.sql` in its own transaction. Handles two cases: a pre-existing DB where the v1 tables were created out-of-band (a CREATE that fails with "already exists" is recorded as applied), and dependency ordering on a fresh DB (a file referencing a not-yet-created table is deferred and retried in a later pass). Date-prefixed v1 files sort before the `NNN_` v2+ series so `002_finance_upgrade.sql` runs after the base tables.

---

## Existing Components (custom/module-specific)

### UI (atomic — `client/src/components/ui/`, per SKILL.md §9a)
- `Button.jsx` (§5.1), `Card.jsx` → `Card`/`CardHeader`/`CardBody` (§5.2), `Input.jsx` → `Input`/`Textarea`/`Select` (§5.3), `DataTable.jsx` (§5.4), `Modal.jsx` (§5.6 — portal to `document.body`), `Badge.jsx` (§5.8), `EmptyState.jsx` (§5.9), `ErrorState.jsx` (§5.10), `Skeleton.jsx` → `Skeleton`/`ListSkeleton` (§5.11), `StatCard.jsx` (§5.12)

### Layout
- `client/src/components/layout/AppLayout.jsx` — Owns the visual frame (desktop sidebar, mobile drawer, top bar, `<Outlet />`). Sidebar footer has the theme toggle and a **Log out** `Button` → `POST /api/auth/logout` then `navigate('/login', { replace: true })` (toasts on success/failure; redirects even if the request fails).
- `client/src/components/layout/AuthGuard.jsx` — Wraps all protected routes; calls `useAuth` to check session via `GET /api/auth/me`; renders full-screen skeleton while loading, redirects to `/login` (replace) if no user or 401, renders `<Outlet />` when authenticated

### Dashboard
- `client/src/components/dashboard/RecentTodos.jsx` — Shows 5 most recent todos with priority dot, status badge, priority badge; fetches `GET /api/todos?per_page=5&sort=created_at&order=desc`
- `client/src/components/dashboard/RecentTransactions.jsx` — Shows 5 most recent transactions for the new ledger shape (type icon/colour by `type`, `category_name`, IDR amount via `formatIdr`); fetches `GET /api/finances?per_page=5`
- `client/src/components/dashboard/RecentResearch.jsx` — Shows 5 most recent research entries with type and status badges; fetches `GET /api/research?per_page=5&sort=created_at&order=desc`
- `client/src/components/dashboard/RecentLearning.jsx` — Shows 5 most recent learning items with inline MiniProgress bar, type and status badges; fetches `GET /api/learning?per_page=5&sort=created_at&order=desc`

### Todo
- `client/src/components/todo/TodoRow.jsx` — Single task row with priority/status badges and edit/delete actions
- `client/src/components/todo/CreateTodoModal.jsx` — Create & edit modal (mode toggled via `todo` prop: null = create, object = edit)

### Finance (multi-account ledger)
- `client/src/components/finance/TransactionRow.jsx` — DataTable render helpers `AmountCell` (signed/colour-coded), `TypeBadge`, `AccountFlowCell` (source→dest), `ReconciledCell`, `TransactionActions`; exports `TYPE_VARIANT`/`TYPE_LABEL` maps
- `client/src/components/finance/CreateTransactionModal.jsx` — Typed create/edit modal; fields shown conditionally per type; takes `accounts`/`categories` props
- `client/src/components/finance/FinanceSummaryCards.jsx` — Income / Expense / Net (month) / Net Worth cards, all IDR
- `client/src/components/finance/MonthYearSelector.jsx` — controlled month+year navigator (prev/next + selects)
- `client/src/components/finance/LedgerModal.jsx` / `SettleModal.jsx` — shared create/edit + settle modals for receivables & payables (parameterized by `kind`)
- `client/src/components/finance/PortfolioModal.jsx` — create/edit holding
- `client/src/components/finance/LedgerPage.jsx` — shared Receivables/Payables page body
- `client/src/components/finance/ProgressBar.jsx` — colour-coded meter (emerald<80% / amber<100% / red≥100%); uses the sanctioned dynamic-width `style` exception
- `client/src/components/finance/charts/TrendChart.jsx`, `charts/DonutChart.jsx` — dependency-free SVG charts; colours via Tailwind `fill-*`/`bg-*` within the defined palette, only geometry in SVG attributes

### Learning
- `client/src/components/learning/LearningRow.jsx` — Exports `TitleCell`, `ProgressCell`, `ActionsCell` as DataTable render helpers; also exports `STATUS_VARIANT`, `STATUS_LABEL`, `TYPE_VARIANT`, `PRIORITY_VARIANT`, `PRIORITY_LABEL` badge maps
- `client/src/components/learning/CreateLearningModal.jsx` — Create & edit modal (mode toggled via `item` prop: null = create, object = edit)

### Research
- `client/src/components/research/ResearchEntryRow.jsx` — Exports `TitleCell`, `TypeCell`, `StatusCell`, `SourceCell`, `ActionsCell` as DataTable render helpers; also exports `TYPE_VARIANT`, `TYPE_LABEL`, `STATUS_VARIANT`, `STATUS_LABEL` badge maps
- `client/src/components/research/CreateResearchModal.jsx` — Create & edit modal (mode toggled via `entry` prop: null = create, object = edit)
- `client/src/components/research/ResearchSummaryCards.jsx` — Stat cards for total entries, journal count, citation count, and note count

---

## Existing Hooks

- `client/src/hooks/useApi.js` — Generic data-fetching hook; returns `{ data, loading, error, refetch }`; used by all pages and `useAuth`. Includes an `isMounted` ref guard against setState-after-unmount.
- `client/src/hooks/useTheme.js` — Dark mode toggle; persists to `localStorage` key `"theme"`; applies/removes `.dark` on `document.documentElement`
- `client/src/hooks/useToast.jsx` — `ToastProvider` + `useToast()`; global, portal-rendered, bottom-right, cap 3, auto-dismiss 4s (§5.7). Wraps the app in `main.jsx` outside the router.
- `client/src/hooks/useAuth.js` — Calls `GET /api/auth/me` via `useApi`; returns `{ user, loading, error }`; `user` is `null` when unauthenticated or on 401

---

## Existing Backend Routes & Models

### Auth
- `server/routes/auth.js` — `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`; session written/destroyed here; mounted **without** `requireAuth`
- `server/models/user.model.js` — `findByEmail`, `findById`, `createUser`
- `server/middleware/auth.js` — `requireAuth` middleware; reads `req.session.userId`, attaches `req.user = { id }`; returns 401 `AUTH_REQUIRED` if no valid session

### Todos
- `server/routes/todos.js` — Full CRUD + `GET /stats`; `GET /stats` registered before `GET /:id` to prevent param shadowing; mounted as `app.use('/api/todos', requireAuth, todosRouter)`
- `server/models/todo.model.js` — `listTodos`, `getTodoById`, `createTodo`, `patchTodo`, `deleteTodo`, `getTodoStats`

### Finance (rewritten for the multi-account ledger)
- `server/routes/finances.js` — mounted as `app.use('/api/finances', requireAuth, financesRouter)`. Zod-validated. Endpoints: `GET /summary` (month/year-scoped or all-time), `GET /balances`, `GET /dashboard`; `GET /accounts`, `PATCH /accounts/:id`; `GET /categories`; transactions CRUD (`GET /` w/ month/year/type/category/account/search filters, `GET/:id`, `POST /`, `PATCH/:id`, `DELETE/:id`); `receivables` & `payables` CRUD + `POST /:id/settle`; `portfolio` CRUD; `GET /budgets` + `PUT /budgets`. **All literal sub-resource paths are registered before `/:id`** to avoid param shadowing.
- `server/models/finance.model.js` — `ensureDefaults`, `listAccounts`, `getBalances`, `patchAccount`, `listCategories`, transactions CRUD (with per-type shape validation + ownership checks), `getSummary`, `getDashboard`, ledger helpers (`listLedger`/`getLedgerById`/`createLedger`/`patchLedger`/`deleteLedger`/`settleLedger`), portfolio CRUD, `listBudgets`/`upsertBudget`.
- `server/utils/formatIdr.js` — `formatIdr`, `parseIdrInput` (server-side IDR helpers, mirrors the client lib).

### Learning
- `server/routes/learning.js` — Full CRUD (GET list w/ pagination + status filter + sort, GET by id, POST, PATCH, DELETE) + `GET /stats`; mounted as `app.use('/api/learning', requireAuth, learningRouter)`
- `server/models/learning.model.js` — `listLearningItems`, `getLearningItemById`, `createLearningItem`, `patchLearningItem`, `deleteLearningItem`, `getLearningStats`

### Research
- `server/routes/research.js` — Full CRUD (GET list w/ pagination + type/status filter + sort, GET by id, POST, PATCH, DELETE) + `GET /stats`; mounted as `app.use('/api/research', requireAuth, researchRouter)`
- `server/models/research.model.js` — `listResearchEntries`, `getResearchEntryById`, `createResearchEntry`, `patchResearchEntry`, `deleteResearchEntry`, `getResearchStats`

---

## client/src/lib/api.js — Wired & Complete

Axios instance with:
- `baseURL` — `VITE_API_URL` env var, defaults to `http://localhost:3000`
- `withCredentials: true` — sends the `sid` session cookie cross-origin
- Response interceptor — unwraps `response.data` (standard envelope §6.4) on success
- 401 interceptor — calls `window.location.replace('/login')` on any 401 response, guarded against redirect loops on `/login` and `/register`

---

## client/src/App.jsx — Wired & Complete

Route tree:
- Public: `/login` → `Login`, `/register` → `Register` (no `AppLayout`, no `AuthGuard`)
- Protected: `AppLayout` → `AuthGuard` → `Dashboard | Todo | Finance | Finance sub-pages | Research | Learning`
  - Finance section: `/finance` (Transactions), `/finance/dashboard`, `/finance/accounts`, `/finance/receivables`, `/finance/payables`, `/finance/portfolio`, `/finance/budget`
- Catch-all `*` → `Navigate to="/" replace` (AuthGuard handles downstream redirect to `/login`)

`AppLayout` sidebar nav is grouped into labelled sections (`NAV_SECTIONS`): top-level (Dashboard, To-Do), **Finance** (Overview, Transactions, Accounts, Receivables, Payables, Portfolio, Budget), **Knowledge** (Research, Learning). `/finance` uses `end` so it isn't active on its sub-routes.

Client lib: `client/src/lib/formatIdr.js` — `formatIdr` (→ "Rp 1.500.000"), `parseIdrInput`, `formatIdrInput` (grouped digits for input fields). All finance money display goes through these.

---

## server/index.js — Wired & Complete

Entry point is fully implemented with:
- `cors` — origin `CLIENT_ORIGIN`, `credentials: true`
- `express-session` — `connect-pg-simple` store, `httpOnly` + `secure` (prod only) cookie named `sid`, 7-day TTL
- `trust proxy: 1` in production
- `GET /health` — public uptime check
- `app.use('/api/auth', authRouter)` — public
- `app.use('/api/todos', requireAuth, todosRouter)`
- `app.use('/api/finances', requireAuth, financesRouter)`
- `app.use('/api/learning', requireAuth, learningRouter)`
- `app.use('/api/research', requireAuth, researchRouter)`
- `app.use(errorHandler)` — last middleware

---

## Required .env vars

| Variable | Side | Notes |
|----------|------|-------|
| `DATABASE_URL` | server | Postgres connection string |
| `CLIENT_ORIGIN` | server | e.g. `http://localhost:5173` |
| `SESSION_SECRET` | server | Random 32+ char string |
| `PORT` | server | Defaults to `3000` |
| `NODE_ENV` | server | `development` \| `production` |
| `VITE_API_URL` | client | Defaults to `http://localhost:3000` |

---

## Server lib & middleware

- `server/lib/db.js` — shared `pg.Pool` (`max:10`, `idleTimeoutMillis:30000`, `connectionTimeoutMillis:2000`); exported both named (`{ pool }`) and default to satisfy all model import styles
- `server/lib/AppError.js` — operational error (`statusCode`, `code`, optional `field`) (§6.6)
- `server/middleware/errorHandler.js` — last middleware; standard error envelope; masks 500 details (§6.6)
- `server/middleware/validate.js` — `validate(schema)` zod body validation → `VALIDATION_ERROR` (§6.6b)
- `server/middleware/auth.js` — `requireAuth` (§6.6a)

---

## Audit Outcome (2026-05-31)

A full audit/hardening pass created the entire missing foundation (all `components/ui/*`, `useApi`/`useTheme`/`useToast`, `server/lib/*`, `errorHandler`/`validate`), fixed broken config (`index.css` had no Tailwind directives; `index.html` lacked the Inter font; missing `postcss.config.js`, Vite port/proxy; absent client/server deps; `server` was `type:commonjs` despite ESM code), and corrected bugs (router named-export mismatch in `index.js`; Dashboard stat-key mismatches `net`→`net_balance`, `spent_hours`→`total_spent_hours`, `citations`/`notes`→`citation`/`note`; removed a stray duplicate `client/AppLayout.jsx`). Hardening: `express.json({ limit:'1mb' })`, session `sameSite:'lax'`, pool sizing.

## Pending / Known Issues

- **Two justified inline `style` widths.** `LearningRow.jsx` and `RecentLearning.jsx` progress bars use `style={{ width: \`${pct}%\` }}` — a runtime 0–100% width has no static Tailwind equivalent. This is the sole accepted exception to §10 NEVER #2.