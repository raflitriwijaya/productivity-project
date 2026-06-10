# Project State

> **Living status doc.** Durable architecture — routes, DB schema, data flow, design decisions — lives in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Operational procedures (backup, restore, secret rotation, migrations) live in [docs/RUNBOOK.md](docs/RUNBOOK.md).

## Stack
- Frontend: React + Vite (port 5173)
- Backend: Node.js + Express (port 3000)
- DB: PostgreSQL

---

## npm packages

**Server** (`server/package.json`, `"type": "module"`): `express`, `cors`, `express-session`, `connect-pg-simple`, `bcryptjs` (Phase 2/3: replaced `bcrypt` — drop-in API-compatible, pure JS, eliminates the `tar`/`node-pre-gyp` high-severity transitive vulns), `pg`, `zod`, `dotenv`, `multer` (research attachment uploads), `helmet`, `express-rate-limit`, `pino`, `pino-http` (Phase 3: structured logging). Requires Node `>=18`. Scripts: `dev` (`node --watch index.js`), `start`, `migrate` (`node db/migrate.js`).

**Client** (`client/package.json`, `"type": "module"`): runtime — `react`, `react-dom`, `react-router-dom`, `axios`, `lucide-react`, `prism-react-renderer` (snippet syntax highlighting), `@uiw/react-md-editor` **4.1.1** (pinned exact — `^` removed; Docs markdown editor), `rehype-sanitize` (Phase 1: strips unsafe HTML/JS from rendered markdown); build — `vite`, `@vitejs/plugin-react`, `tailwindcss` (v3), `postcss`, `autoprefixer`, eslint toolchain.

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
- `/research` → `client/src/pages/Research.jsx` — Research hub with **topics** (colour-coded folders), **full-text search**, and **clickable tag filters**. Three filter dimensions plus search: a **TopicSidebar** (desktop: fixed `w-64` left list; mobile: horizontal scrollable tabs above the header), the type pills, and server-side tag filters. Selecting a topic scopes the whole page via `GET /api/research/topics/:id/entries` (table) + `GET /api/research/topics/:id` (`{topic,stats}` summary cards + section heading); "All Entries" uses the global `GET /api/research` + `/stats`. **Search**: a debounced (300ms) input in the header passes `?q=` to the entries fetch (works within a selected topic too). **Tag filters**: clicking a tag chip in the new **Tags** column (`TagsCell`) adds it to `activeTagFilters`, shown as removable emerald pills below the type pills and sent as `?tags=` (server-side, **any-match**, keeps pagination correct). `buildQuery({q,tags,topicId})` composes the query string for the entries fetch (q/tags only — topic is in the URL path) and the export URL (adds `topic_id`). Sidebar entry-counts are derived client-side from an always-global `?per_page=100` fetch (`topicsVersion`-keyed). Create/edit entry modal includes `TopicSelector`, a `TagInput` autocomplete, and a **markdown editor** for content. **Detail view**: clicking an entry title opens `EntryDetailModal` (rendered markdown + topics/tags/source + attachments, with an Edit handoff). **Export**: a secondary "Export" button in the header opens a dropdown (JSON/CSV) that `window.open`s `/api/research/export` with the current filters. **Bulk actions**: a leftmost checkbox column (+ select-all in the header cell) drives `selectedIds`; when any are selected, a bulk bar appears with "Archive Selected" (`PATCH /bulk` status=archived) and "Delete Selected" (confirm modal → `DELETE /bulk` with body). **Row actions** (in the Actions cell): a **pin** toggle (emerald when pinned; `PATCH {is_pinned}`; backend sorts pinned first), **duplicate** (`POST /:id/duplicate`), and a **copy-citation** control for `journal`/`citation` entries (clicking copies APA; a chevron expands an MLA/IEEE sub-menu; uses `navigator.clipboard`), alongside Edit/Delete. **Date-range filter**: From/To `<input type=date>` in the filter bar send `date_from`/`date_to` (the `date_to` value is pushed to end-of-day so "To: today" is inclusive), with a Clear button. Stat cards, type pills, create/edit/delete confirmation all retained.

### Engineering Toolkit module (migration `003_engineer_toolkit.sql`)

- `/engineer` → `client/src/pages/EngineerProjects.jsx` — Projects landing: stat cards (total/active/deployed/ideas), type + status filter pills, DataTable (name, type badge, platform badges, status badge, updated, view/edit/delete), create/edit modal with **template picker** auto-fill, delete confirmation
- `/engineer/:id` → `client/src/pages/EngineerProjectDetail.jsx` — Tabbed detail (Overview / Documents / Check-ins / Issues); Overview shows description, platform/stack badges, repo link; nested tabs show compact embedded lists with a "Manage" link to the dedicated scoped page
- `/engineer/snippets` → `client/src/pages/EngineerSnippets.jsx` — Responsive grid of `SnippetCard` (prism-highlighted preview + copy), search + category/language filters, full-view `SnippetModal` (copy/edit/delete), create/edit modal with monospace code field
- `/engineer/docs` → `client/src/pages/EngineerDocs.jsx` — Project-scoped (`?project=`) master–detail markdown docs using `@uiw/react-md-editor` (dark mode via `data-color-mode`); list + editor with title/doc_type, edit/preview toggle, save (POST/PATCH), delete
- `/engineer/checkins` → `client/src/pages/EngineerCheckins.jsx` — Project-scoped (`?project=`) weekly check-ins; DataTable (week, health dot, achievements preview), `CheckinForm` modal, read modal, **health indicator** (red if latest check-in has blockers), "To Issue" promotion via navigation state
- `/engineer/issues` → `client/src/pages/EngineerIssues.jsx` — Project-scoped (`?project=`) issue tracker; severity + status filter pills, DataTable (title, severity badge, status badge, component, assignee, edit/delete), create/edit modal, pre-fill from check-in via navigation state
- `/engineer/roadmap` → `client/src/pages/EngineerRoadmap.jsx` — 12 month cards (one per `engineer_roadmap_months` row) each with a `MiniProgressBar` and a checklist grouped by category (hardware/software/process); per-skill toggle PATCHes `/roadmap/skills/:id`; overall progress bar at top. Skills are seeded lazily per-user on first load.

---

## Existing DB Tables

- `users` — id, email, password_hash, name, created_at, updated_at
- `user_sessions` — managed automatically by `connect-pg-simple` (`createTableIfMissing: true` in `server/index.js`); no manual migration needed
- `todos` — id, user_id, title, description, status, priority, due_date, created_at, updated_at
- `transactions` — id, user_id, type, category, description, amount, date, created_at, updated_at
- `learning_items` — id, user_id, title, type, source, status, priority, progress, total_hours, spent_hours, started_at, completed_at, notes, url, created_at, updated_at
- `research_entries` — id, user_id, title, type (`journal|citation|note`), status (`draft|active|archived`), content, source, tags, **is_pinned** (BOOLEAN, default false — pinned entries sort first), created_at, updated_at

### Research module upgrade (migration `004_research_topics.sql`)

3 new tables + 1 column, all following §6.5:

- `research_topics` — id, user_id, name, description, `color` (VARCHAR(7) hex, default `#10b981`), `status` (`active|archived`), created/updated. Colour-coded folders for grouping entries. Indexes on `user_id`, `status`.
- `research_entry_topics` — pivot, `PRIMARY KEY (entry_id, topic_id)`; both FKs `ON DELETE CASCADE` so deleting an entry **or** a topic auto-cleans the links (entries survive a topic delete, just detached). Indexes on both columns.
- `research_attachments` — id, entry_id FK (CASCADE), filename (stored/random), original_name, file_path (absolute, on disk under `server/uploads/`), mime_type, size, created_at. Index on `entry_id`.
- `research_entries.is_pinned` — added via `ADD COLUMN IF NOT EXISTS`.

### Finance module (upgraded — migration `002_finance_upgrade.sql`)

The original flat `transactions` table was **replaced** by a multi-account general ledger (7 tables, all `user_id`-scoped, pre-upgrade transaction rows not migrated):

- `accounts` — id, user_id, name, type (`CASH|ATM|DANA|SHOPEEPAY|GOPAY|INVESTMENT`), initial_balance, …; `UNIQUE(user_id, type)`. The 6 standard accounts are seeded lazily by the model (`ensureDefaults`).
- `categories` — id, user_id, name, kind (`INCOME|EXPENSE|SYSTEM`); `UNIQUE(user_id, name)`. 14 standard categories seeded lazily.
- `transactions` — id, user_id, type (`Income|Expense|Transfer|Balance Adjustment|Market Adjustment`), amount, description, date, source_account_id, dest_account_id, category_id, reconciled, … . `amount` is **not** constrained `> 0` (adjustments may be negative).
- `receivables` / `payables` — id, user_id, person, description, amount, due_date, status (`outstanding|settled`), account_id, settled_at, … . Settling posts a matching Income/Expense transaction.
- `portfolio` — id, user_id, name, symbol, quantity, avg_price, current_price, … (market value / gain derived in queries).
- `budgets` — id, user_id, category_id, amount; `UNIQUE(user_id, category_id)` — one recurring monthly budget per category.

**Balance rule** (in `getBalances`/`getSummary`): Income→+dest, Expense→−source, Transfer→−source+dest, Balance/Market Adjustment→+dest.

### Engineering Toolkit module (migration `003_engineer_toolkit.sql`)

8 tables following §6.5 (SERIAL PK, `user_id` FK `ON DELETE CASCADE` except the two global tables, VARCHAR enums via CHECK, `TIMESTAMPTZ`, shared `set_updated_at()` trigger, `idx_{table}_{col}` indexes):

- `engineer_projects` — id, user_id, name, description, `project_type` (`iot|embedded|robotics|other`), platforms (csv text), stack (csv text), `status` (`idea|planning|development|testing|deployed|archived`), repo_url, created/updated.
- `engineer_templates` — **global** (no user_id). name, description, `domain` (`iot|embedded|robotics|general`), `folder_structure` JSONB (`[{path,content}]`), `doc_templates` JSONB (`[{title,doc_type,content}]`). Seeded by the migration (4 templates: Heltec IoT, STM32 FreeRTOS, ROS2 Python, Raspberry Pi Camera).
- `engineer_snippets` — id, user_id, title, `category` (extensible free-text), `language` (default `cpp`), tags (csv), code, created/updated. **16 starter snippets seeded lazily per-user** by the model (`seedSnippetsForUser`, ON first `listSnippets`).
- `engineer_documents` — id, **nullable** `project_id` FK (global doc when null), user_id, title, content, doc_type, created/updated.
- `engineer_checkins` — id, project_id FK, user_id, `week_start` DATE, achievements, plans_next, blockers, bugs_discovered, concerns, created.
- `engineer_issues` — id, project_id FK, user_id, title, description, `severity` (`P0-Critical|P1-High|P2-Medium|P3-Low`), `status` (`open|in_progress|resolved`), component, assignee, created/updated.
- `engineer_roadmap_months` — **global** (no user_id). `month_number` UNIQUE, title, description. Seeded by the migration (12 months).
- `engineer_roadmap_skills` — id, month_id FK, user_id, `category` (`hardware|software|process`), title, `completed` BOOLEAN. **Seeded lazily per-user** by the model (`seedRoadmapSkillsForUser`, on first `getRoadmap` — 3 skills/month = 36 total).

---

## Existing DB Migrations

Migrations live under `server/db/migrations/` (not `server/migrations/`). All follow §6.5: SERIAL PK, `user_id` FK `ON DELETE CASCADE` (except `users`), VARCHAR status/type columns (no ENUM types), `TIMESTAMPTZ` timestamps, a shared `set_updated_at()` trigger, and `idx_{table}_user_id` / `idx_{table}_status` indexes.

- `20240101_create_users.sql` — `users` table, `set_updated_at()` trigger, unique index on `email`
- `20240101_create_todos.sql` — `todos`; indexes on `user_id`, `status`, `due_date`
- `20240102_create_transactions.sql` — `transactions`; CHECK on `type`/`amount`; indexes on `user_id`, `type`, `date`
- `20240103_create_learning.sql` — `learning_items`; CHECK on `progress`; indexes on `user_id`, `status`, `type`
- `20240101_create_research_entries.sql` — `research_entries`; indexes on `user_id`, `type`, `status`
- `002_finance_upgrade.sql` — drops the old `transactions` table and creates the 7 finance-ledger tables above (re-runnable: every CREATE is preceded by `DROP … IF EXISTS`).
- `003_engineer_toolkit.sql` — creates the 8 `engineer_*` tables above plus their indexes/triggers, and seeds the two global tables (4 templates, 12 roadmap months). Re-runnable: every CREATE is preceded by `DROP … IF EXISTS CASCADE`, and the global seed rows are re-inserted each run. Per-user rows (snippets, roadmap skills) are seeded lazily by the model, not here.
- `004_research_topics.sql` — adds `research_topics`, `research_entry_topics` (pivot), `research_attachments`, and the `research_entries.is_pinned` column. Re-runnable: `DROP … IF EXISTS CASCADE` before each CREATE, `ADD COLUMN IF NOT EXISTS` for the column.
- `005_idempotency_guards.sql` — Phase 2: adds `CHECK (amount <> 0)` on `transactions.amount`; adds partial UNIQUE index `idx_transactions_transfer_dedup` on `(user_id, date, amount, source_account_id, dest_account_id, description) WHERE type = 'Transfer'` to reject exact duplicate Transfer rows at the DB level.

**Migration runner** — `server/db/migrate.js` (`npm run migrate`). Tracks applied files in a `schema_migrations` table; applies each pending `*.sql` in its own transaction. Handles two cases: a pre-existing DB where the v1 tables were created out-of-band (a CREATE that fails with "already exists" is recorded as applied), and dependency ordering on a fresh DB (a file referencing a not-yet-created table is deferred and retried in a later pass). Date-prefixed v1 files sort before the `NNN_` v2+ series so `002_finance_upgrade.sql` runs after the base tables. **Phase 2:** the runner now acquires a Postgres advisory lock (`pg_advisory_lock(7391842)`) for the lifetime of each run, released in a `finally` block, so concurrent replicas on rolling deploys cannot race and double-apply migrations.

---

## Existing Components (custom/module-specific)

### UI (atomic — `client/src/components/ui/`, per SKILL.md §9a)
- `Button.jsx` (§5.1), `Card.jsx` → `Card`/`CardHeader`/`CardBody` (§5.2), `Input.jsx` → `Input`/`Textarea`/`Select` (§5.3), `DataTable.jsx` (§5.4), `Modal.jsx` (§5.6 — portal to `document.body`), `Badge.jsx` (§5.8), `EmptyState.jsx` (§5.9), `ErrorState.jsx` (§5.10), `Skeleton.jsx` → `Skeleton`/`ListSkeleton` (§5.11), `StatCard.jsx` (§5.12)

### Error boundary
- `client/src/components/ErrorBoundary.jsx` — **Phase 2:** class-based `ErrorBoundary` (required for `componentDidCatch`/`getDerivedStateFromError` in React 19); renders `ErrorState` with `window.location.reload()` as the retry action on any uncaught render error. Wrapped around `<App />` in `main.jsx` outside `<ToastProvider>` so a provider crash is also caught.

### Layout
- `client/src/components/layout/AppLayout.jsx` — Owns the visual frame (desktop sidebar, mobile drawer, top bar, `<Outlet />`). Sidebar footer has the theme toggle and a **Log out** `Button` → `POST /api/auth/logout` then `navigate('/login', { replace: true })` (toasts on success/failure; redirects even if the request fails).
- `client/src/components/layout/AuthGuard.jsx` — Wraps all protected routes; calls `useAuth` to check session via `GET /api/auth/me`; renders full-screen skeleton while loading **or throttled (429)**; redirects to `/login` (replace) if no user and not throttled; renders `<Outlet />` when authenticated. **Phase 6:** redirect is gated on `!throttled` to prevent a rate-limit from ejecting a valid session.

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
- `client/src/components/research/ResearchEntryRow.jsx` — Exports `TitleCell`, `TypeCell`, `StatusCell`, `SourceCell`, **`TopicsCell`**, **`TagsCell(onTagClick)`**, `ActionsCell`, plus `splitTags()` and the `TYPE_*`/`STATUS_*` maps. **`ActionsCell(row, actions)`** takes an actions object (`onEdit`/`onDelete`/`onDuplicate`/`onTogglePin`/`onCopyCitation`) and renders the internal `RowActions` component: a pin toggle (filled/emerald when pinned), a copy-citation control with an APA button + chevron-expanded MLA/IEEE sub-menu (shown only for `journal`/`citation` types, outside-click closes), a duplicate button, then Edit/Delete. (`TitleCell` is the plain title; in `Research.jsx` the title is rendered as a button opening the detail modal, so `TitleCell` is currently unused by the page.)
- `client/src/components/research/CreateResearchModal.jsx` — Create & edit modal (mode toggled via `entry` prop). Includes `TopicSelector` (sends `topic_ids`, initialised from `entry.topics`), a `TagInput` autocomplete (replaces the plain tags Input), and the engineer `MarkdownEditor` for the content field (replaces the `<Textarea>`; dark mode synced via the wrapper's `data-color-mode`)
- `client/src/components/research/ResearchSummaryCards.jsx` — Stat cards for total entries, journal count, citation count, and note count (the topic-scoped `{stats}` object is a superset, so the same cards render unchanged when a topic is selected)
- `client/src/components/research/topicColors.js` — Canonical topic colour palette (`TOPIC_COLORS` = 6 label→hex pairs: Emerald `#10b981`, Blue `#3b82f6`, Red `#ef4444`, Amber `#f59e0b`, Purple `#8b5cf6`, Gray `#6b7280`; `DEFAULT_TOPIC_COLOR`). Shared by the colour `<Select>` and dots.
- `client/src/components/research/TopicBadge.jsx` — small inline chip: a `style`-coloured dot (sanctioned §10 inline-style exception, no `dark:` for the user colour) + name in muted text
- `client/src/components/research/CreateTopicModal.jsx` — create/edit topic modal (`size="sm"`, mode via `topic` prop); name (Input) / color (Select over `TOPIC_COLORS`) / description (Textarea); POST or PATCH `/api/research/topics`, toast on success, `onSaved` callback
- `client/src/components/research/TopicSelector.jsx` — multi-select topic chips (Badge-in-`<button>`: selected=emerald, unselected=gray) for the entry modal; own four-state topics fetch; controlled via `selectedIds`/`onChange`
- `client/src/components/research/TopicSidebar.jsx` — second filter dimension. Owns its topics fetch (four-state: 3 skeleton pills / `ErrorState` / "No topics yet" / data), the "All Entries" item, per-topic items (colour dot + name + count + hover edit/delete on desktop), "New Topic" button, embedded `CreateTopicModal`, and a `DeleteTopicConfirm` modal (notes entries survive, just detach). Props `selectedTopicId`/`onSelectTopic`, optional `topicCounts`/`allCount`/`onTopicsChanged`. Desktop = vertical `w-64`; mobile = horizontal `overflow-x-auto flex` tab strip.
- `client/src/components/research/TagInput.jsx` — tag editor with autocomplete; drop-in for the plain tags Input (comma-separated `value`/`onChange`). Chosen tags render as removable `Badge` chips; typing shows a client-filtered dropdown of the user's distinct tags (`GET /api/research/tags`, minus chosen), four-state (loading/empty/results); Enter or comma commits the draft, Backspace-on-empty removes the last chip, outside-click closes. Dropdown styled to match (`bg-white dark:bg-gray-800`, border, `shadow-lg`).
- `client/src/components/research/EntryDetailModal.jsx` — read view (`size="lg"`) of an entry: type/status badges, `TopicBadge` chips, tag badges, source (link if URL), rendered markdown via the engineer `MarkdownPreview`, and the attachments section (`AttachmentUploader` + `AttachmentList`). Footer "Edit" calls `onEdit` to hand off to the create/edit modal. Owns an `attachVersion` counter to refresh the list after upload/delete.
- `client/src/components/research/AttachmentList.jsx` — four-state list of an entry's attachments (`GET /api/research/:id/attachments`); each row shows `original_name` + human-readable size, an authenticated **download button** (Phase 1: calls `GET /api/research/attachments/:id/download` via axios with `responseType: 'blob'`, then creates a temporary object URL — no unauthenticated `/uploads/` href), and a delete button (`DELETE /api/research/attachments/:id`). `refreshKey` prop forces re-fetch.
- `client/src/components/research/AttachmentUploader.jsx` — hidden `<input type=file>` triggered by a Button; POSTs `FormData` to `/api/research/:id/attachments` (axios sets the multipart boundary, overriding the default JSON content-type). Client-side accept allowlist + 10 MB pre-check mirror the server `fileFilter`; toasts on result; `onUploaded` callback.

### Engineering Toolkit (`client/src/components/engineer/`)
- `ProjectRow.jsx` — DataTable render helpers (`TitleCell`, `TypeCell`, `PlatformsCell`, `StatusCell`, `UpdatedCell`, `ActionsCell`, `RepoLink`) + `TYPE_VARIANT/LABEL`, `STATUS_VARIANT/LABEL`, and `splitTags()`
- `IssueRow.jsx` — DataTable render helpers (`TitleCell`, `SeverityCell`, `StatusCell`, `TextCell`, `ActionsCell`) + `SEVERITY_VARIANT/LABEL` (P0=red, P1=amber, P2=blue, P3=gray — distinct within the §2 palette) and `STATUS_VARIANT/LABEL`
- `CreateProjectModal.jsx` — create/edit project; template picker auto-fills name/description/type; toasts on result
- `SnippetCard.jsx` — grid card with prism preview + copy button; `SnippetModal.jsx` — full view with copy/edit/delete; `CreateSnippetModal.jsx` — create/edit with monospace code field
- `CodeBlock.jsx` — prism-react-renderer wrapper (vsLight/vsDark by theme); `snippetConstants.js` — category + language option lists
- `CheckinForm.jsx` — self-contained weekly check-in form (defaults week_start to current Monday); `CreateIssueModal.jsx` — create/edit issue, supports `prefill` from a check-in
- `MarkdownEditor.jsx` — `@uiw/react-md-editor` wrapper (`MarkdownEditor` + `MarkdownPreview`), dark mode via `data-color-mode`; Phase 1: `rehypeSanitize` applied to both the editor live-preview (`previewOptions`) and the standalone `MarkdownPreview` to block `<img onerror=...>` and any inline event handler in user content
- `RoadmapMonthCard.jsx` — month card with `MiniProgressBar` + category-grouped skill checklist (toggle as styled `<button role="checkbox">`)
- `MiniProgressBar.jsx` — generic 0–100% emerald meter (sanctioned dynamic-width style exception); `ProjectScopePicker.jsx` — shared project `<Select>` for the `?project=`-scoped pages

---

## Existing Hooks

- `client/src/hooks/useApi.js` — Generic data-fetching hook; returns `{ data, loading, error, refetch }`; used by all pages and `useAuth`. Includes an `isMounted` ref guard against setState-after-unmount.
- `client/src/hooks/useTheme.js` — Dark mode toggle; persists to `localStorage` key `"theme"`; applies/removes `.dark` on `document.documentElement`
- `client/src/hooks/useToast.jsx` — `ToastProvider` + `useToast()`; global, portal-rendered, bottom-right, cap 3, auto-dismiss 4s (§5.7). Wraps the app in `main.jsx` outside the router.
- `client/src/hooks/useAuth.js` — Calls `GET /api/auth/me` via `useApi`; returns `{ user, loading, error, throttled }`; `user` is `null` when unauthenticated or on 401; **Phase 6:** `throttled` is `true` when `error.status === 429` so callers can distinguish rate-limited from logged-out

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

### Research (upgraded — migration `004_research_topics.sql`)
- `server/routes/research.js` — mounted as `app.use('/api/research', requireAuth, researchRouter)`. Zod-validated, standard envelope + `AppError`. **All literal sub-paths registered before `/:id`** (critical under Express 5): `GET /stats`, `GET /tags`, `GET /export` (`?format=json|csv` + filters → downloadable file), `PATCH /bulk` + `DELETE /bulk`; topics — `GET|POST /topics`, `GET /topics/:id/entries`, `GET /topics/:id` (`{topic,stats}`), `PATCH|DELETE /topics/:id`; **Phase 1:** `GET /attachments/:id/download` (auth + ownership check, streams file with `Content-Disposition: attachment`, returns 404 for non-owned/missing to avoid existence disclosure), `DELETE /attachments/:id`. Then entries — `GET /` (list w/ pagination + `type`/`status`/`q`/`date_from`/`date_to`/`tags`/`topic_id` filters + sort), `POST /`, `GET|PATCH|DELETE /:id`, `POST /:id/duplicate`, `POST|GET /:id/topics`, `POST|GET /:id/attachments`. **Multer** is configured here (exports `uploadsDir`): single-file upload to `server/uploads/`, 10 MB cap, ext+MIME allowlist (jpg/png/pdf/txt/md/cpp/py/zip), **Phase 1:** filenames generated via `crypto.randomUUID()` (replaces `Date.now()`-based names); rejects → 400 `VALIDATION_ERROR`, orphan file cleaned up if the entry isn't owned.
- `server/models/research.model.js` — existing `listResearchEntries` (now JOIN-free topic attach via a keyed pivot query + `q`/date/`tags`/`topic_id` filters + `is_pinned DESC` default sort), `getResearchEntryById`, `createResearchEntry`/`patchResearchEntry` (sync `topic_ids`), `deleteResearchEntry`, `getResearchStats`. New: topics (`listTopics`, `getTopicById`, `createTopic`, `patchTopic`, `deleteTopic`, `getTopicStats`, `addEntryToTopics` [transactional pivot sync], `getTopicsForEntry`, `getEntriesByTopic`); attachments (`listAttachments`, `createAttachment`, `getAttachmentById`, `deleteAttachment`); utilities (`duplicateEntry`, `bulkPatchEntries`, `bulkDeleteEntries`, `getDistinctTags`). Every per-user query scoped by `user_id`.

### Engineering Toolkit
- `server/routes/engineer.js` — mounted as `app.use('/api/engineer', requireAuth, engineerRouter)`. Zod-validated. **All literal sub-paths registered before `/:id`** (mirrors finances.js): `GET /stats`, `GET /templates`; snippets CRUD (`/snippets`, `?q=`/`?category=`/`?language=`); `GET /documents`, `PATCH/DELETE /documents/:id`; `PATCH/DELETE /issues/:id`; `GET /roadmap`, `PATCH /roadmap/skills/:id`; nested `GET|POST /projects/:id/documents|checkins|issues` (ownership-guarded via `requireOwnedProject`); then projects CRUD (`/`, `/:id`). Standard envelope + `AppError`.
- `server/models/engineer.model.js` — projects CRUD + `getProjectStats`; `listTemplates`; snippets CRUD + `seedSnippetsForUser` (lazy 16-snippet seed); documents CRUD (project-scoped + global); `listCheckins`/`createCheckin`; issues CRUD; roadmap `getRoadmap` + `seedRoadmapSkillsForUser` (lazy) + `setRoadmapSkillCompleted`. Every per-user query scoped by `user_id`.

---

## client/src/lib/api.js — Wired & Complete

Axios instance with:
- `baseURL` — `VITE_API_URL` env var, defaults to `http://localhost:3000`
- `withCredentials: true` — sends the `sid` session cookie cross-origin
- Response interceptor — unwraps `response.data` (standard envelope §6.4) on success
- 401 interceptor — calls `window.location.replace('/login')` on any 401 response, guarded against redirect loops on `/login` and `/register`
- **Phase 6:** 429 interceptor — surfaces the server's rate-limit message without redirecting; attaches `err.status` to the rejected `Error` so `useAuth` / `AuthGuard` can distinguish throttled from unauthenticated

---

## client/src/App.jsx — Wired & Complete

Route tree:
- Public: `/login` → `Login`, `/register` → `Register` (no `AppLayout`, no `AuthGuard`)
- Protected: `AppLayout` → `AuthGuard` → `Dashboard | Todo | Finance | Finance sub-pages | Research | Learning | Engineering sub-pages`
  - Finance section: `/finance` (Transactions), `/finance/dashboard`, `/finance/accounts`, `/finance/receivables`, `/finance/payables`, `/finance/portfolio`, `/finance/budget`
  - Engineering section: `/engineer` (Projects), `/engineer/snippets`, `/engineer/docs`, `/engineer/checkins`, `/engineer/issues`, `/engineer/roadmap`, and `/engineer/:id` (detail — registered after the literal sub-routes so static segments match first)
- Catch-all `*` → `Navigate to="/" replace` (AuthGuard handles downstream redirect to `/login`)

`AppLayout` sidebar nav is grouped into labelled sections (`NAV_SECTIONS`): top-level (Dashboard, To-Do), **Finance** (Overview, Transactions, Accounts, Receivables, Payables, Portfolio, Budget), **Knowledge** (Research, Learning), **Engineering** (Projects, Snippets, Docs, Check-ins, Issues, Roadmap). `/finance` and `/engineer` use `end` so they aren't active on their sub-routes.

Client lib: `client/src/lib/formatIdr.js` — `formatIdr` (→ "Rp 1.500.000"), `parseIdrInput`, `formatIdrInput` (grouped digits for input fields). All finance money display goes through these.

`client/src/lib/generateCitation.js` — `generateCitation(entry, style)` formats an entry as an `apa`|`mla`|`ieee` citation string from title/source/tags/created_at (best-effort; `source` is treated as author unless it's a URL, then appended as a retrieval/Available trailer). Exports `CITATION_STYLES` for the row-action sub-menu. Used by the Research copy-citation control.

---

## server/index.js — Wired & Complete

Entry point is fully implemented with:
- `cors` — origin `CLIENT_ORIGIN`, `credentials: true`
- `express-session` — `connect-pg-simple` store, `httpOnly` + `secure` (prod only) cookie named `sid`, 7-day TTL
- `trust proxy: 1` in production
- **Phase 1:** `helmet` (CSP, HSTS in prod, X-Frame-Options, etc.) + `express-rate-limit` (`authLimiter` 5/15min on login+register, `generalLimiter` 100/min on all other routes)
- **Phase 3:** `pino-http` structured per-request logging (assigns `req.id`; used by error handler)
- **Uploads** — `fs.mkdirSync(uploadsDir, { recursive: true })` on startup; static mount removed (Phase 1) — downloads go through authenticated route in `research.js`
- `GET /health` — public uptime check
- **Phase 6 auth mount:** `app.use('/api/auth/login', authLimiter)` + `app.use('/api/auth/register', authLimiter)` (credential-guessing guard) registered *before* `app.use('/api/auth', generalLimiter, authRouter)` — `/me` and `/logout` run under `generalLimiter` only and do not consume the 5-req/15-min credential budget
- `app.use('/api/todos|finances|learning|research|engineer', generalLimiter, requireAuth, …Router)`
- `app.use(errorHandler)` — last middleware
- **Phase 2: graceful shutdown** — `app.listen` return value captured as `server`; `SIGTERM`/`SIGINT` handlers call `server.close()` → `pool.end()` → `process.exit(0)`; 10 s force-exit fallback via `setTimeout(...).unref()`

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
- `server/lib/logger.js` — **Phase 3:** shared `pino` instance (stdout JSON in prod, pretty-printed in dev); imported by `index.js` for `pino-http` and by `errorHandler.js`
- `server/middleware/errorHandler.js` — last middleware; standard error envelope; masks 500 details (§6.6). **Phase 2:** catches pg error code `23505` (unique violation) and maps to a clean `409 CONFLICT` before any other handling. **Phase 3:** uses `req.log ?? logger` (pino) instead of `console.error`; echoes `req.id` in error responses so users can quote it in bug reports.
- `server/middleware/validate.js` — `validate(schema)` zod body validation → `VALIDATION_ERROR` (§6.6b)
- `server/middleware/auth.js` — `requireAuth` (§6.6a)

---

## Deployment

Repository is live at: https://github.com/raflitriwijaya/productivity-project

Two production deployment options are available:

### Option A — Docker (recommended)

All containers defined in `docker-compose.yml` at project root. Four services (Phase 2/3):
- `db` — `postgres:16-alpine`; data persisted in `postgres_data` Docker volume; healthcheck gates `api` start
- `api` — built from `server/Dockerfile` (`node:22-alpine`, production deps only via `npm ci --omit=dev`); **Phase 2:** CMD is now `node db/migrate.js && node index.js` — migrations run automatically on every deploy; attachments persisted in `uploads_data` named volume; **Phase 3:** healthcheck (`wget /health`) lets nginx wait for a healthy API before serving
- `nginx` — built from `client/Dockerfile` (multi-stage: `node:22-alpine` builds React, `nginx:alpine` serves static + proxies `/api` and `/health` to `api:3000`); exposes port `80`; **Phase 3:** `depends_on: api: condition: service_healthy`
- `db_backup` — **Phase 3:** `postgres:16-alpine` sidecar; runs `pg_dump` on a cron schedule (default `0 2 * * *`, overridable via `BACKUP_SCHEDULE` env var) and gzips dumps into `postgres_backups` named volume

Named volumes: `postgres_data`, `uploads_data` (Phase 2 — attachments survive rebuilds), `postgres_backups` (Phase 3)

Nginx config for Docker lives at `client/nginx.docker.conf` (separate from the manual-deploy config). **Phase 3:** emits security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, CSP) and `Cache-Control: public, immutable` / `expires 1y` for Vite-hashed static assets.

`.env.docker.example` at root — only two vars needed: `DB_PASSWORD` and `SESSION_SECRET`. `DATABASE_URL` and other vars are constructed inline in `docker-compose.yml`.

```bash
cp .env.docker.example .env   # fill DB_PASSWORD and SESSION_SECRET
docker compose up --build -d
# migrations run automatically — no manual step needed
```

### Option B — Manual (Nginx + PM2)

For deployments without Docker. Configs live in `deploy/`:
- `deploy/nginx.conf` — Nginx server block; serves `client/dist` as root, proxies `/api` and `/health` to `localhost:3000`, sets `X-Forwarded-Proto: https` for Express trust-proxy
- `ecosystem.config.cjs` at root — PM2 app config; `name: productivity-api`, `script: ./server/index.js`, `env_production: { NODE_ENV: production }`

### Cloudflare Tunnel

`deploy/cloudflared-config.yml` — template config pointing `raflitriwijaya.my.id` → `http://localhost:80`. Works with both deployment options above since both expose port 80.

---

## Audit Outcome (2026-05-31)

A full audit/hardening pass created the entire missing foundation (all `components/ui/*`, `useApi`/`useTheme`/`useToast`, `server/lib/*`, `errorHandler`/`validate`), fixed broken config (`index.css` had no Tailwind directives; `index.html` lacked the Inter font; missing `postcss.config.js`, Vite port/proxy; absent client/server deps; `server` was `type:commonjs` despite ESM code), and corrected bugs (router named-export mismatch in `index.js`; Dashboard stat-key mismatches `net`→`net_balance`, `spent_hours`→`total_spent_hours`, `citations`/`notes`→`citation`/`note`; removed a stray duplicate `client/AppLayout.jsx`). Hardening: `express.json({ limit:'1mb' })`, session `sameSite:'lax'`, pool sizing.

## Deployment Setup (2026-06-01)

Project pushed to GitHub. Added full production deployment setup: Docker + Docker Compose (3-container stack), manual Nginx + PM2 configs, and Cloudflare Tunnel config for exposing the local server to the internet without opening router ports. README rewritten in English covering both deployment options.

## Research Upgrade — Phase 1 & 2 (2026-06-02)

**Phase 1 (backend):** migration `004_research_topics.sql` (topics, entry↔topic pivot, attachments, `is_pinned`); `research.model.js` extended (topics/attachments CRUD, topic-attach on list, search/date/tags/topic filters, `duplicateEntry`, bulk patch/delete, distinct tags); `research.js` routes (topics, attachments via multer, export json/csv, bulk, duplicate, tags — literal paths before `/:id`); `index.js` ensures + serves `server/uploads/`; `multer` installed; `server/uploads/` gitignored. Migration applied; verified end-to-end via authenticated API smoke tests (topics CRUD, topic linking, filters, stats, export, bulk, file upload type-allowlist + static serve + delete, cascade-detach).

**Phase 2 (frontend):** `topicColors.js`, `TopicBadge.jsx`, `CreateTopicModal.jsx`, `TopicSelector.jsx`, `TopicSidebar.jsx` created; `TopicsCell` added to `ResearchEntryRow.jsx`; `TopicSelector` wired into `CreateResearchModal.jsx`; `Research.jsx` reworked (sidebar + main flex layout, mobile horizontal tabs, topic-scoped fetching, client-derived sidebar counts, selected-topic heading). `vite build` passes. Flow verified at the API level (create topic → assign → topic-scoped table/summary → topics column → edit/unlink → delete-topic cascade). **Not yet visually click-tested in a browser** (no browser-automation tooling in this environment) — recommend a manual pass with `npm run dev` in both `client/` and `server/`.

**Phase 3 (frontend features):** `TagInput.jsx` created; `TagsCell`/`splitTags` added to `ResearchEntryRow.jsx`; `CreateResearchModal.jsx` now uses `TagInput` + the engineer `MarkdownEditor` for content; `Research.jsx` gained a debounced (300ms) header search (`?q=`), clickable tag filters (`?tags=`, server-side any-match, removable emerald pills + "Clear all"), a Tags column, and a filter-aware empty state. `vite build` passes. Server-side filtering verified via API (`?q=` on title+content+source+tags, `?tags=` any-match, both on global **and** topic-scoped endpoints; distinct-tags feed; markdown content round-trip). Same browser-verification caveat as Phase 2.

**Phase 4 (attachments, export, bulk):** `EntryDetailModal.jsx`, `AttachmentList.jsx`, `AttachmentUploader.jsx` created. `Research.jsx`: title is now a button opening the detail modal; a header Export dropdown `window.open`s `/api/research/export` (JSON/CSV) with the current filters; a leftmost checkbox column (+ select-all header) drives `selectedIds`, with a bulk bar (Archive → `PATCH /bulk`, Delete → confirm modal → `DELETE /bulk` with body). `vite build` passes. Verified via API: full attachment lifecycle (upload → list → static serve → delete), filtered JSON/CSV export, bulk archive (`{updated}`), bulk delete with request body (`{deleted}`). Same browser-verification caveat.

**Phase 5 (final touches):** `lib/generateCitation.js` created (apa/mla/ieee). `ActionsCell` refactored to an actions-object and given pin-toggle, duplicate, and copy-citation controls (`RowActions` sub-component). `Research.jsx`: handlers for duplicate (`POST /:id/duplicate`), pin (`PATCH {is_pinned}`), and clipboard citation copy; a From/To date-range filter (`date_from`/`date_to`, `date_to` pushed to end-of-day for an inclusive boundary) with Clear; `buildQuery` extended for dates. `vite build` passes. Verified: citation generator output across 3 styles × 3 field shapes (Node unit run); pin persists + sorts first; duplicate resets pin; date-range boundaries (incl. the end-of-day fix for `date_to`). Same browser-verification caveat. **The Research Upgrade (Phases 1–5) is now feature-complete.**

## "Stoic Garden" UI Re-theme (2026-06-02)

A full visual re-theme replacing the original **Emerald** accent system with a three-colour "Stoic Garden" palette. **This intentionally overrides SKILL.md §2.1 (Emerald accent) and the related NEVER #5 (single accent) / NEVER #11 (no decorative accents) rules** — the prompt is the new colour authority. All *other* SKILL.md rules remain in force (every colour class keeps a `dark:` variant; four-state handling, `useApi`/`useToast`/`useTheme`, PATCH, no external UI libs, snake_case, no inline hex in JSX, responsiveness all untouched).

**Palette** (added to `tailwind.config.js` under `theme.extend.colors`; `fontFamily`/`keyframes`/`animation` untouched):
- `moss` (base `#4A7C59`) — nature/agritech + **all former emerald roles**: success states, active sidebar/tabs/pills, focus rings, sorted-table header, row hover (`hover:bg-moss-50/30`), money-positive, links, progress fills.
- `terracotta` (base `#C67A4B`) — hardware/craft: sidebar **group labels**, the **embedded** project-type badge, **snippet category** badges, and the `ProgressBar` warning threshold (0.8–1.0, was amber).
- `ember` (base `#E8A838`) — innovation/CTA: **primary `Button`** fill (`bg-ember-500 hover:bg-ember-600`), toast **info** accent, the logo dot, and the right end of the StatCard gradient underline.

**Component-API changes:**
- `Badge` variants are now `moss | terracotta | ember | red | amber | blue | gray` (the `emerald` key was **renamed to `moss`** — every call site and every `STATUS_VARIANT`/`TYPE_VARIANT`/`SEVERITY_VARIANT` map across todo/finance/learning/research/engineer/dashboard updated to match).
- `Button` primary → ember; all variants' focus ring → moss.
- Modernization touches per the prompt: `Modal` panel radius `rounded-xl`→`rounded-2xl`; `StatCard` gained a `from-moss-500 to-ember-500` gradient underline (card made `relative overflow-hidden`); `Skeleton` pulse tinted moss; `EmptyState` icon tinted moss; `DataTable` row hover `hover:bg-moss-50/30`; toast success→moss / info→ember; `DonutChart` slice palette reworked to moss/blue/terracotta/red/gray/moss-700/blue-700/ember; `TrendChart` income bars→moss.

**Scope:** 48 files updated (1 config + 10 `components/ui/*` + `AppLayout` + `useToast` + all finance/todo/learning/research/engineer/dashboard module components + all colour-bearing pages). **Verified:** `vite build` passes (2450 modules); grep confirms **0 `emerald` occurrences** remain in `client/src` and **0 in the built CSS**, while `moss`/`terracotta`/`ember` utilities are present in the generated CSS across bg/text/border/ring/fill. ESLint shows only the **pre-existing** baseline errors (hooks `set-state-in-effect`, unused imports, `useMemo` deps) — none on changed colour lines. **Not browser-verified** (no browser-automation tooling here) — recommend a manual light/dark pass with `npm run dev`.

## Security Hardening — Phase 1 (2026-06-10)

Closed the four critical/high audit findings (§2, §3, §8 of `docs/AUDIT_REPORT.md`):

- **Rate limiting** — `express-rate-limit` installed. `authLimiter` (5 req / 15 min / IP, `standardHeaders`, custom `{ success: false, error: { code: 'RATE_LIMITED', ... } }` handler) applied to `/api/auth`; `generalLimiter` (100 req / min / IP) applied to all five protected routers.
- **Helmet + CSP** — `helmet` installed. `app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } }, hsts: isProd ? {...} : false }))` added after trust-proxy; emits `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, HSTS (prod only). CORS setup unchanged.
- **Authenticated attachment downloads** — Public `app.use('/uploads', express.static(uploadsDir))` removed. New `GET /api/research/attachments/:id/download` route added (before `/:id`): verifies session via `requireAuth` (inherited from the router mount), checks attachment ownership via parent entry, reconstructs path from `uploadsDir + filename` only, sets `Content-Disposition: attachment; filename*=UTF-8''...` + `X-Content-Type-Options: nosniff`, streams file. Returns `404` for both non-owned and missing to avoid existence disclosure. Upload filenames switched from `Date.now()-rand` to `crypto.randomUUID()`. `AttachmentList.jsx` download `<a href>` replaced with an axios blob fetch → object URL → programmatic click.
- **Markdown XSS** — `rehype-sanitize` installed. Applied to `MarkdownEditor` live preview (`previewOptions: { rehypePlugins: [[rehypeSanitize]] }`) and `MarkdownPreview` (`rehypePlugins={[[rehypeSanitize]]}`). `@uiw/react-md-editor` pinned to exact `4.1.1` (caret removed).

## Data Integrity & Resilience Hardening — Phase 2 (2026-06-09)

Six data-integrity and resilience gaps from the audit closed:

1. **Named Docker volume for uploads** — `uploads_data` volume added to `docker-compose.yml` and mounted at `/app/uploads`; attachments no longer wiped on `docker compose up --build`.
2. **Graceful shutdown** — `server/index.js` captures the `server` handle; `SIGTERM`/`SIGINT` drain in-flight HTTP connections via `server.close()`, then drain the pg pool via `pool.end()`, then exit 0; 10 s force-exit timer (`.unref()`'d) prevents a hung connection blocking shutdown forever.
3. **Auto-run migrations on deploy** — `server/Dockerfile` CMD changed to `node db/migrate.js && node index.js`; `migrate.js` acquires `pg_advisory_lock(7391842)` for the lifetime of each run, released in `finally`, so concurrent replicas don't race.
4. **React ErrorBoundary** — `client/src/components/ErrorBoundary.jsx` (class-based, React 19-compatible) wraps `<App />` in `main.jsx`; a render-time throw shows `ErrorState` with a Reload button instead of a white screen.
5. **Email lowercase normalization + pg 23505 → 409** — `/register` normalizes email before `findByEmail`; `bcrypt` replaced with `bcryptjs` (pure JS, eliminates `tar` transitive vuln); `errorHandler.js` maps pg code `23505` to a clean `409 CONFLICT`.
6. **Idempotency guard** — migration `005_idempotency_guards.sql` adds `CHECK (amount <> 0)` on `transactions.amount` and partial UNIQUE index `idx_transactions_transfer_dedup` on Transfer rows; client finance modals already had `disabled={submitting}` on all submit buttons.

## Operational Hardening — Phase 3 (2026-06-09)

- **bcrypt → bcryptjs** — `bcrypt` uninstalled; `bcryptjs` (pure JS, drop-in API-compatible) installed; `server/routes/auth.js` import updated. Eliminates the `tar`/`@mapbox/node-pre-gyp` high-severity transitive vulnerabilities. `npm audit --audit-level=high` now reports clean.
- **CI pipeline** — `.github/workflows/ci.yml` (new). Triggers on push + PR to `main`. Two parallel jobs (`server`, `client`): `npm ci` → `npm audit --audit-level=high` (gates the build on any high advisory) → `npm run lint --if-present` → client `npm run build` → tolerant test step (runs `npm test` only if a `test` script is wired, so Phase 4 tests are picked up without editing this file). To enforce the gate: set both jobs as required status checks under **Settings → Branches → Branch protection rules**.
- **Structured logging** — `server/lib/logger.js` (pino instance, JSON in prod / pretty-printed in dev); `pino-http` middleware in `index.js` assigns `req.id` to every request; `errorHandler.js` uses `req.log ?? logger` and echoes `req.id` in error responses.
- **Healthchecks** — `api` container: `wget /health` every 30 s, 10 s start period; `nginx` container: `wget /` every 30 s; nginx `depends_on: api: condition: service_healthy`.
- **Nginx security + cache headers** — `client/nginx.docker.conf` now emits `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a strict CSP (`default-src 'self'`, `frame-ancestors 'none'`). Hashed static assets (`*.js|css|svg|png|woff2|woff|ttf|ico`) get `Cache-Control: public, immutable` with a 1-year `expires`.
- **DB backup sidecar** — `db_backup` service in `docker-compose.yml` runs `pg_dump` on cron (default `0 2 * * *`, overridable via `BACKUP_SCHEDULE`) and gzips dumps into `postgres_backups` named volume; restore command documented in the compose file comment.

## Pending / Known Issues

- **Two justified inline `style` widths.** `LearningRow.jsx` and `RecentLearning.jsx` progress bars use `style={{ width: \`${pct}%\` }}` — a runtime 0–100% width has no static Tailwind equivalent. This is the sole accepted exception to §10 NEVER #2.
- **Research inline `style` colours.** `TopicBadge.jsx`, `TopicSidebar.jsx`, `TopicSelector.jsx`, and the `Research.jsx` topic heading set a topic's dot/swatch via `style={{ backgroundColor: color }}` — a user-defined hex with no static Tailwind equivalent (same sanctioned §10 exception; no `dark:` variant by design).
- **Research Phases 2–5 not browser-verified.** Build + API/unit flows pass; the rendered page (mobile tab strip, hover actions, dark mode, markdown editor, tag autocomplete, export dropdown, detail modal, bulk checkboxes/bar, pin/duplicate/citation controls, native date pickers) has not been eyeballed. `navigator.clipboard` requires a secure context — confirm on the deployed origin.
- **MDEditor inflates the Research bundle.** Importing `MarkdownEditor` into `CreateResearchModal` pulls `@uiw/react-md-editor` into the main Research chunk, pushing `index-*.js` past 1.4 MB. Functionally fine; lazy-load the editor (`React.lazy`) if load time matters.