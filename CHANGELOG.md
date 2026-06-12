# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Roadmap Wave 7 — AI Assistant (2026-06-12)

> The finishing touch. After six waves, Polymath OS gets its brain: an integrated DeepSeek-powered chatbox for brainstorming, research, and capturing insights without leaving the system.

#### AI Chat (DeepSeek)
- **New `chat_conversations` table** (migration `015_chat_history.sql`) — stores conversations with the full message log as `JSONB`, the `model` used, an optional `context_entity_type`/`context_entity_id` (the module item a chat was opened from), and `temperature`/`top_p`. `user_id` FK ON DELETE CASCADE, the shared `set_updated_at()` trigger, and indexes for per-user lists, recency, and context lookups. The same migration extends `entity_links.chk_entity_link_types` to whitelist `'chat'`.
- **New chat API** — `server/models/chat.model.js` (`listConversations`, `getConversationById`, `createConversation`, `updateConversation`, `deleteConversation`, `getContextForConversation`; all `user_id`-scoped) and `server/routes/chat.js` mounted `app.use('/api/chat', requireAuth, chatRouter)`. Endpoints: `GET /api/chat/models`, `GET /api/chat/conversations` (paginated), `GET /api/chat/conversations/:id`, `DELETE /api/chat/conversations/:id`, and `POST /api/chat/send`. Audit events `CHAT_MESSAGE`/`CHAT_DELETE`.
- **Streaming via SSE** — `POST /api/chat/send` persists the user message, then streams the assistant reply token-by-token as Server-Sent Events (`{type:"conversation_id"|"token"|"done"|"error"}`), and persists the assistant reply on completion. Dual backend: the cloud **DeepSeek** API (OpenAI-compatible, reusing the Wave 6 `DEEPSEEK_API_KEY` auth pattern) or a local **Ollama** instance for the on-device R1 model. Once the SSE headers are sent, the outer error path guards on `res.headersSent` so the global error handler never throws on an in-flight stream.
- **Context injection** — when a chat is opened from a module item, the first message injects a compact, `user_id`-scoped snapshot of that entity (research entry / engineer project / book / learning item / goal / idea) as a system prompt so the model has relevant context.
- **New AI Chat page `/ai-chat`** (`client/src/pages/AIChat.jsx`) — a conversation-list sidebar (new/select/delete), a streaming message view (token-by-token with a live cursor), a model selector + temperature/top-p sliders, and an input with Enter-to-send / Shift+Enter-newline / ⌘J-to-focus. Per-message **Copy** and **Save to Research** (caps content to the 10k research limit). Streaming uses a raw `fetch` against the API base so the SSE `ReadableStream` can be read directly; all other calls use the axios client. All four data states. Added to the sidebar top group.
- **"Ask AI" deep links** — `EntryDetailModal`, `BookDetailModal`, `IdeaDetailModal`, and `EngineerProjectDetail` each gained an **Ask AI** button that navigates to `/ai-chat?context=<type>&id=<id>`; the chat page reads those params and injects the entity as context on the first message.
- **`'chat'` registered in `LINKABLE_TYPES`** (`enums.js`) with an ownership validator in `links.js` (adapting `getConversationById(userId, id)`), so a saved conversation can participate in Universal Links.

#### Infra & Docs
- **nginx SSE** (`client/nginx.docker.conf`) — a dedicated `location /api/chat/send` block with `proxy_buffering off` (+ `proxy_cache off`, long `proxy_read_timeout`, cleared `Connection` header) so token streaming isn't held back by proxy buffering. The longer prefix wins over the generic `/api` block.
- **OpenAPI** (`generate-openapi.js`) — added the `AI Chat` tag, the 5 chat paths, and `'chat'`/`'time_entry'`/`'goal'` to the links type enum.
- **`.env.docker.example` + `docker-compose.yml`** — documented and wired `DEEPSEEK_API_KEY` (shared with embeddings), `DEEPSEEK_BASE_URL`, and `OLLAMA_BASE_URL` into the `api` service.

### Roadmap Wave 6 — Moonshots (2026-06-12)

> The most technically ambitious wave: a vector database for meaning-based search, an installable offline-capable PWA, local AI auto-tagging, and a long-horizon Polymath Dashboard.

#### Semantic Search (pgvector)
- **New `research_embeddings` table** (migration `014_pgvector.sql`) — one OpenAI-compatible `vector(1536)` embedding per research entry (`UNIQUE (entry_id)`, FK ON DELETE CASCADE), with an `ivfflat` cosine index. The migration enables the `vector` extension and is **guarded**: it only creates the extension/table when `pg_available_extensions` lists `vector`, otherwise it `RAISE NOTICE`s and skips — so CI's stock `postgres:16-alpine` and any non-pgvector dev DB still migrate cleanly (semantic search + auto-tag then degrade gracefully). Production uses the **`pgvector/pgvector:pg16`** image (`docker-compose.yml`).
- **New embeddings layer** — `server/lib/embeddings.js` (`generateEmbedding`, `generateEmbeddingForEntry`, `embeddingsConfigured`, `embeddingModel`) calls an OpenAI-compatible `/embeddings` endpoint (DeepSeek by default), configured entirely via env (`EMBEDDING_API_URL`/`EMBEDDING_API_KEY`/`DEEPSEEK_API_KEY`/`EMBEDDING_MODEL`/`EMBEDDING_DIMENSIONS`). `server/models/embeddings.model.js` (`storeEmbedding` upsert, `getEmbedding`, `semanticSearch` cosine ranking, `deleteEmbedding`) tolerates the table being absent (Postgres `42P01`) by no-op/empty so nothing 500s without pgvector.
- **New `GET /api/research/semantic-search?q=`** (`server/routes/research.js`, registered before `/:id`) — embeds the query and returns entries ranked by cosine similarity, each with a `similarity` (0..1) score.
- **Background indexing** — `POST /api/research` and `PATCH /api/research/:id` now fire-and-forget an embedding generation (`setTimeout(…, 0)`, never blocks the response; skipped silently when no key is configured, logs a warning on failure).
- **Research page semantic toggle** (`client/src/pages/Research.jsx`) — a Keyword/Semantic segmented control by the search box. In Semantic mode a non-empty query hits `/semantic-search` (ignoring topic/tag/date filters, which don't apply to a vector search) and a **Match %** column shows each result's similarity.

#### Local AI Auto-Tag
- **New `server/lib/autoTagger.js`** (`suggestTags`) — embeds an entry, finds its nearest semantic neighbours (`semanticSearch`, threshold 0.5), and returns up to 10 frequency-ranked tags those neighbours carry. Best-effort: any failure yields `[]`.
- **New `GET /api/research/suggest-tags?title=&content=`** — always 200 with a (possibly empty) tag array.
- **"✨ Suggest" button** in `CreateResearchModal` — merges suggested tags into the existing tag string (de-duplicated) and toasts the result.

#### PWA + Offline Support
- **`vite-plugin-pwa`** added (`client/vite.config.js`) — `registerType: 'autoUpdate'`, `injectRegister: 'auto'` (no manual SW code in `main.jsx`), a full web manifest (name/short_name/theme/icons), precaching of build assets, an SPA `navigateFallback` to `index.html`, and a `NetworkFirst` runtime cache for `/api/*` GETs so the app still renders last-known data offline (stale by design). New `pwa-192x192.png` / `pwa-512x512.png` icons and `client/public/offline.html` fallback.
- **nginx PWA caching** (`client/nginx.docker.conf`) — `no-cache` location blocks for `/sw.js`, `/registerSW.js`, `/manifest.webmanifest` (served as `application/manifest+json`), and `/offline.html`, ahead of the immutable hashed-asset rule so the service worker and manifest are always re-validated.

#### Polymath Dashboard
- **New `GET /api/polymath`** (`server/routes/polymath.js`, mounted `app.use('/api/polymath', requireAuth, polymathRouter)`) — a parallel fan-out returning books/research/learning/projects/time aggregated **by year**, plus the top 20 knowledge tags. Read-only, all `user_id`-scoped.
- **New Polymath page `/polymath`** (`client/src/pages/PolymathDashboard.jsx`) — a moss→ember hero band (years tracked + lifetime headline numbers), year-over-year stat cards with trend deltas, dependency-free year-by-year growth bar charts, a lifetime activity-allocation donut (reusing the Finance `DonutChart`), a frequency-scaled knowledge-tag cloud, and achievement highlights (most productive year / top topic / lifetime focus). All four data states incl. a "your polymath journey starts now" empty state. Added to the sidebar **Reflect** section.

#### Docs
- **OpenAPI** (`generate-openapi.js`) — added the `Polymath` tag and paths for `GET /api/research/semantic-search`, `GET /api/research/suggest-tags`, and `GET /api/polymath`.
- **`.env.docker.example`** — documented the five embedding env vars (all optional; blank disables semantic search/auto-tag); wired into the `api` service in `docker-compose.yml`.

### Roadmap Wave 5 — Refleksi & Pertumbuhan (2026-06-12)

> "Tools for becoming." Time tracking, a weekly review, cross-module goals/OKRs, and a yearly Polymath Report close the reflection loop.

#### Time Tracking
- **New `time_entries` table** (migration `012_time_entries.sql`) — tracks time spent on any of `todo`/`research_entry`/`learning_item`/`engineer_project`/`book` via its own `entity_type`/`entity_id` columns (NOT `entity_links` — time entries are tightly coupled to one entity). `started_at`/`ended_at`/`duration_seconds`, CHECK constraints (`ended_at > started_at`, `duration_seconds > 0`, entity-type whitelist), `user_id` FK ON DELETE CASCADE, the shared `set_updated_at()` trigger, and indexes for per-user lists, per-entity lookups, recency, plus a partial index on the running timer. The same migration extends `entity_links.chk_entity_link_types` to whitelist `'time_entry'` and `'goal'`.
- **New Time API** — `server/models/time.model.js` (`startTimer`, `stopRunningTimer`, `getRunningTimer`, `getTimeEntryById`, `listTimeEntries`, `deleteTimeEntry`, `getTimeSummary`, `getTodayHours`; all `user_id`-scoped). Only one timer runs at a time — `startTimer` stops any running timer first; `duration_seconds` is computed server-side on stop (client clock never trusted). `server/routes/time.js` mounted `app.use('/api/time', requireAuth, timeRouter)`. Endpoints: `GET /api/time` (filter/paginate), `GET /api/time/running`, `GET /api/time/summary` (grouped by entity type + `today_hours`), `POST /api/time/start`, `POST /api/time/stop`, `DELETE /api/time/:id`. Audit events `TIMER_START`/`TIMER_STOP`/`TIME_DELETE`.
- **New `Timer` component** (`client/src/components/shared/Timer.jsx`) — a reusable start/stop timer with a live-ticking elapsed display. Embedded in `BookDetailModal`, `EntryDetailModal`, and the `EngineerProjectDetail` Overview tab. When a timer is running elsewhere, Start is disabled with a hint (only one timer at a time).

#### Weekly Review
- **New `GET /api/review/weekly?from=&to=`** (`server/routes/review.js`) — a parallel fan-out of COUNT/SUM queries across todos (status `done`), finance (`Income`+`Revenue` vs `Expense`), research, learning hours, books finished, time logged, and resolved issues. Defaults to the last 7 days.
- **New Weekly Review page `/review`** (`client/src/pages/WeeklyReview.jsx`) — Monday→Sunday week navigation (prev/next/Today), seven summary stat cards, a time-breakdown bar chart by entity type (from `/api/time/summary`), and all four data states. Added to a new sidebar **Reflect** section.

#### Goals / OKRs
- **New `goals` table** (migration `013_goals.sql`) — cross-module goals with CHECK-constrained `goal_type` (`target`/`milestone`/`habit`/`learning`), `status` (`active`/`completed`/`abandoned`/`paused`), `priority` (`low`/`medium`/`high`/`critical`), `target_value`/`current_value`/`unit`/`category`, and `start_date`/`target_date`/`completed_at`. `user_id` FK ON DELETE CASCADE, shared trigger, indexes for per-user lists, status/priority filters, and target-date sort.
- **New Goals API** — `server/models/goals.model.js` (`listGoals`, `getGoalById`, `createGoal`, `updateGoal`, `deleteGoal`, `getGoalStats`, `recalcGoalProgress`) and `server/routes/goals.js` mounted `app.use('/api/goals', requireAuth, goalsRouter)`. `updateGoal` auto-stamps/clears `completed_at` on status transitions. `recalcGoalProgress` (exposed as `POST /api/goals/:id/recalc`) re-derives `current_value` from entities linked to the goal (Wave 1 links): counts finished books / deployed projects / done todos / completed learning items / created research entries, plus summed hours from linked time entries. `getGoalStats` computes an "on track" count (progress pace ≥ elapsed-time pace). Endpoints: `GET /api/goals`, `GET /api/goals/stats`, `POST`, `GET/PATCH/DELETE /api/goals/:id`, `POST /api/goals/:id/recalc`. Audit events `GOAL_CREATE`/`GOAL_UPDATE`/`GOAL_DELETE`/`GOAL_RECALC`.
- **New Goals page `/goals`** (`client/src/pages/Goals.jsx`) — four stat cards (Active/Completed/Critical/On Track), status + priority filter pills, a responsive grid of `GoalCard`s with progress bars and overdue flags, a create/edit modal (`CreateGoalModal`), and a detail modal (`GoalDetailModal`) with a "Recalculate from links" action and embedded `LinkedItems`. In the sidebar **Reflect** section.

#### Annual Report
- **New `GET /api/review/annual?year=`** (`server/routes/review.js`) — yearly aggregates across reading (books/pages/avg rating), research (entries/journals/citations), learning (completed/hours), engineering (projects/deployed), tasks, time, finance (income/expense/net), and goals achieved.
- **New Annual Report page `/report`** (`client/src/pages/AnnualReport.jsx`) — a year selector, a gradient hero band of headline numbers, and per-module breakdown sections. In the sidebar **Reflect** section.

#### Links & Docs
- **`'time_entry'` and `'goal'` registered in `LINKABLE_TYPES`** (+ `TIME_ENTITY_TYPES`, `GOAL_TYPES`/`GOAL_STATUSES`/`GOAL_PRIORITIES`) in `enums.js`, with ownership validators in `links.js` (adapting `getTimeEntryById`/`getGoalById` to the `(id, userId)` signature). `LinkedItems` learned the `time_entry` (gray) / `goal` (ember) labels+variants and `LinkPickerModal` gained a **Goals** module, so any goal can link to the entities that feed its progress.
- **OpenAPI** (`generate-openapi.js`) — added the `Time`, `Review`, and `Goals` tags with 6 time paths, 2 review paths, and 6 goal paths (84 paths total).

### Roadmap Wave 4 — Startup Founder OS (2026-06-12)

#### Contacts CRM (lite)
- **New `contacts` table** (migration `009_contacts.sql`) — tracks clients, partners, suppliers, investors, mentors, and "other" stakeholders with `email`/`phone`/`company`/`role`, a CHECK-constrained `type` and `status` (`active`/`inactive`/`lead`), `notes`, and `last_contacted`. `user_id` FK ON DELETE CASCADE, the shared `set_updated_at()` trigger, and indexes for per-user lists, type/status filters, and name sort. The same migration extends `entity_links.chk_entity_link_types` to whitelist `'contact'`.
- **New Contacts API** — `server/models/contacts.model.js` (`listContacts`, `getContactById`, `createContact`, `updateContact`, `deleteContact`, `getContactStats`; all `user_id`-scoped, stats coerced to numbers, sort-column allow-list) and `server/routes/contacts.js` mounted `app.use('/api/contacts', requireAuth, contactsRouter)`. Endpoints: `GET /api/contacts` (type/status/search/sort/paginate), `GET /api/contacts/stats`, `POST`, `GET/PATCH/DELETE /api/contacts/:id`. Audit events `CONTACT_CREATE`/`CONTACT_UPDATE`/`CONTACT_DELETE`.
- **New Contacts page `/contacts`** (`client/src/pages/Contacts.jsx`) — five stat cards (Total/Active/Clients/Partners/Leads), type filter tabs, debounced search, a `DataTable` with clickable names, create/edit modal (`CreateContactModal`), and a detail modal (`ContactDetailModal`) with mailto/tel links and embedded `LinkedItems`. Added to a new sidebar **Business** section.

#### Contacts links (Wave 1 extension)
- **`'contact'` registered in `LINKABLE_TYPES`** (`server/lib/enums.js`) and given an ownership validator in `server/routes/links.js` (adapts `getContactById(userId, id)` to the `(id, userId)` validator signature). `LinkedItems` learned the `contact` label/variant and `LinkPickerModal` gained a **Contacts** module, so a contact can link to projects, receivables, and payables.

#### Revenue tracking
- **`'Revenue'` added to `TX_TYPES`** (`server/lib/enums.js`) — a destination-only inflow that behaves like Income for balances/net worth (added to `CREDITS_DEST` and `validateTransactionShape`), but is tracked distinctly. Folded into `getSummary` (income + net worth), the 12-month `getDashboard` trend income line, and surfaced separately as `today_revenue` in `getTodayDashboard`. The Zod schemas in `finances.js` already cover it via `TX_TYPES`.
- **Migration `010_revenue_tx_type.sql`** — extends the `transactions.type` CHECK constraint (originally defined inline in `002_finance_upgrade.sql`) to include `'Revenue'`, so the DB accepts revenue rows. Re-runnable: drops `transactions_type_check` IF EXISTS, then re-adds it named with the extended vocabulary.
- **Frontend** — `CreateTransactionModal` offers Revenue (destination + income categories), `TransactionRow` maps it to an `ember` badge with a `+` amount tone, `Finance.jsx` gains a Revenue filter tab, and `TodayFinanceSummary` shows a "Revenue today" row and includes it in the net figure.

#### Project Budget vs Actual
- **New `GET /api/engineer/projects/:id/budget`** — for each Finance budget linked to the project (via Universal Links), sums the current-month `Expense` transactions in that budget's category and returns `budget_amount`/`spent`/`remaining` plus totals. No new table. Added `getBudgetById(userId, budgetId)` to `finance.model.js`.
- **New Budget tab on `EngineerProjectDetail`** — color-coded progress bars (moss < 80% / amber 80–99% / red ≥ 100%), budget/spent/remaining totals, and a "Link Budget" button that opens `LinkPickerModal` constrained to the Budgets module via a new `lockedType` prop. The picker learned per-module `idKey`/`labelKey`/`filter` overrides so the category-shaped budgets endpoint (nullable `budget_id`) lists correctly.

#### Receivable / Payable reminders
- **`getTodayDashboard` extended** — alongside the existing aggregate counts, it now returns itemized `receivables_due` / `payables_due` arrays (≤5 each, `person`/`amount`/`due_date`, ordered by due date). `TodayFinanceSummary` lists who/what is due this week (with dates), falling back to the legacy aggregate display if the arrays are absent.

#### Ideas Tracker ("don't let ideas evaporate")
- **New `ideas` table** (migration `011_ideas.sql`) — captures impulsive ideas with a CHECK-constrained `status` (`new`/`developing`/`validated`/`archived`/`converted`), `description`, comma-separated `tags`, `source`, and `converted_to`/`converted_id` provenance. `user_id` FK ON DELETE CASCADE, the shared `set_updated_at()` trigger, indexes for per-user lists/status/recency. The same migration extends `entity_links.chk_entity_link_types` to whitelist `'idea'`. (Numbered `011` — `010` was taken by the Wave 4 Revenue CHECK migration.)
- **New Ideas API** — `server/models/ideas.model.js` (`listIdeas`, `getIdeaById`, `createIdea`, `updateIdea`, `deleteIdea`, `getIdeaStats`; all `user_id`-scoped, stats coerced to numbers, sort-column allow-list) and `server/routes/ideas.js` mounted `app.use('/api/ideas', requireAuth, ideasRouter)`. Endpoints: `GET /api/ideas`, `GET /api/ideas/stats`, `POST`, `GET/PATCH/DELETE /api/ideas/:id`. Audit events `IDEA_CREATE`/`IDEA_UPDATE`/`IDEA_DELETE`.
- **New Ideas board `/ideas`** (`client/src/pages/Ideas.jsx`) — a visual card grid (`IdeaCard`, sticky-note style) with five stat cards, status filter tabs, debounced search, create/edit modal (`CreateIdeaModal`), and a detail modal (`IdeaDetailModal`) with embedded `LinkedItems` and a **"Convert to…"** action that spawns a Project / Research Note / Todo / Learning Item, links it back to the idea, and flips the idea to `converted` with `converted_to`/`converted_id`. Added to the sidebar **Business** section. Refetches on the `quick-capture-created` event.
- **QuickCapture gained a fourth "Idea" mode** (`client/src/components/shared/QuickCapture.jsx`) — `MODE_ORDER = ['todo','research','idea','search']`; Tab now cycles Task → Research → Idea → Search. Idea mode `POST`s the input to `/api/ideas` and dispatches `quick-capture-created`.
- **Links extension** — `'idea'` added to `LINKABLE_TYPES` (+ `IDEA_STATUSES`) in `enums.js` and to `OWNERSHIP_VALIDATORS` (`links.js`, adapting `getIdeaById(userId, id)`); `LinkedItems` learned the `idea` label/`ember` variant and `LinkPickerModal` gained a searchable Ideas module.

#### API & Docs
- **OpenAPI** (`generate-openapi.js`) — added the `Contacts` + `Ideas` tags, six `/api/contacts*` and six `/api/ideas*` paths, the `/api/engineer/projects/{id}/budget` path, `'Revenue'` in the transaction type enums, and `'contact'`/`'idea'` in the linkable-type enum (72 paths total).
- **Tests** — `server/test/dashboard.today.test.js` updated for the new `today_revenue` field and itemized due lists.

### Roadmap Wave 3 — Polymath Toolkit (2026-06-12)

#### Reading Tracker
- **New `books` table** (migration `008_reading_tracker.sql`) — tracks books across three shelves (`want_to_read` / `reading` / `finished`) with `current_page`/`total_pages`, `rating` (1–5), `notes`, `genre`, and auto-stamped `started_at`/`finished_at`. CHECK-constrained enums, `user_id` FK ON DELETE CASCADE, the shared `set_updated_at()` trigger, and indexes for per-user lists, shelf filter, recency, and a partial index for "finished this year". The same migration extends `entity_links.chk_entity_link_types` to whitelist `'book'`.
- **New Reading API** — `server/models/reading.model.js` (`listBooks`, `getBookById`, `createBook`, `updateBook`, `deleteBook`, `getReadingStats`; all `user_id`-scoped, stats coerced to numbers) and `server/routes/reading.js` mounted `app.use('/api/reading', requireAuth, readingRouter)`. Endpoints: `GET /api/reading` (shelf/search/sort/paginate), `GET /api/reading/stats`, `POST`, `GET/PATCH/DELETE /api/reading/:id`. Moving a book to `reading` stamps `started_at`; moving to `finished` stamps `finished_at` and back-fills `current_page` to `total_pages` (guarded so an explicit field never double-assigns).
- **New Reading page `/reading`** (`client/src/pages/Reading.jsx`) — four stat cards, shelf tabs, debounced search, a responsive book grid (`BookCard`), create/edit modal (`CreateBookModal`), and a detail modal (`BookDetailModal`) with progress, star rating, and notes. Added to the sidebar **Knowledge** section. Handles all four data states.

#### Reading → Research links (Wave 1 extension)
- **`'book'` registered in `LINKABLE_TYPES`** (`server/lib/enums.js`) and given an ownership validator in `server/routes/links.js` (adapts `getBookById(userId, id)` to the `(id, userId)` validator signature). `BookDetailModal` embeds `<LinkedItems entityType="book">`, and `LinkPickerModal` + `LinkedItems` learned the `book` type, so any book can link to Research entries (chapter notes, highlights).

#### Unified Search
- **New `GET /api/search?q=`** — `server/models/search.model.js` (`searchAll`) unions ILIKE matches across todos, research entries, learning items, transactions, engineering projects, and books (≤5 per module, capped at 30, recency-ranked, `user_id`-scoped) and `server/routes/search.js` mounted `app.use('/api/search', requireAuth, searchRouter)`.
- **QuickCapture gained a third "Search" mode** (`client/src/components/shared/QuickCapture.jsx`) — Tab now cycles Task → Research → Search. In search mode the palette queries `/api/search` (debounced 300 ms) and navigates to the chosen result (`useNavigate`); Enter opens the first result. Task/Research capture is unchanged.

#### API & Docs
- **OpenAPI** (`generate-openapi.js`) — added the `Reading` and `Search` tags, six `/api/reading*` paths, `/api/search`, and `'book'` in the linkable-type enum.
- **Tests** — `server/test/reading.test.js` (stat coercion, list shape + sort-injection guard, shelf-transition auto-stamping incl. the duplicate-assignment guard; DB-mocked). `client/src/test/QuickCapture.test.jsx` now wraps renders in `MemoryRouter` (the palette uses `useNavigate`).

### Roadmap Wave 2 — Today Dashboard & Quick Capture (2026-06-11)

#### Today Dashboard
- **New unified endpoint `GET /api/dashboard/today`** (`server/routes/dashboard.js`, mounted `app.use('/api/dashboard', requireAuth, dashboardRouter)`) — fans out to all five modules in parallel (`Promise.all`) and returns one briefing payload (`{ todos, finance, learning, engineer, research, date }`), replacing four separate client round-trips.
- **New home page `TodayDashboard.jsx`** now renders at `/` — a date-scoped daily briefing (five stat cards + four action-item widgets) answering "what should I do today?". The legacy lifetime-statistics **`Dashboard` is preserved at `/dashboard`**.
- **The Engineering module finally appears on the dashboard** — open P0 issue count, this-week check-in status, and active-project count.
- **New widgets** (`client/src/components/dashboard/`): `TodayTodoList` (tasks due today/overdue), `TodayFinanceSummary` (today's income/expense/net + receivables/payables due within 7 days), `TodayLearningList` (in-progress items with an hours-progress bar), `TodayEngineerIssues` (open P0/P1 issues across all projects + check-in status). Each handles all four data states via `useApi`.
- **New date-scoped model functions:** `getTodayStats` (`todo.model.js` — pending/in_progress/completed_today/overdue; note status is `done`, not `completed`), `getTodayDashboard` (`finance.model.js`), `getActiveLearningStats` (`learning.model.js`), `getTodayEngineerStats` + cross-project `listOpenIssues` (`engineer.model.js`).
- **New route `GET /api/engineer/issues`** — cross-project open-issue list (severity-ordered, comma-separated `severity`/`status` filters, default `open,in_progress`) for the dashboard action list, since the existing issues endpoint is nested per project.
- **`StatCard` gained an optional `subtitle` prop** (additive, backward-compatible) for the briefing captions.

#### Quick Capture (Cmd/Ctrl+K)
- **New `QuickCapture.jsx`** (`client/src/components/shared/`) — a global command palette mounted once in `AppLayout` so a single Cmd/Ctrl+K listener owns the shortcut app-wide. Captures an idea instantly as a **Todo task** (`POST /api/todos` with server defaults) or a **Research note** (`POST /api/research` `type: note`) without navigating away. **Tab** switches mode, **Enter** submits, **Esc** closes.
- **Opens** via Cmd/Ctrl+K, the sidebar "Quick capture ⌘K" button, or the dashboard header button (all dispatch an `open-quick-capture` window event); **on success** dispatches a `quick-capture-created` event so the Today Dashboard refetches.

#### API & Docs
- **OpenAPI** (`generate-openapi.js`) — added the `Dashboard` tag and the `/api/dashboard/today` and `/api/engineer/issues` paths (61 paths total).
- **Tests** — `server/test/dashboard.today.test.js` (model shape/coercion, DB-mocked) and `client/src/test/QuickCapture.test.jsx` (closed render + open via event/shortcut).

### Roadmap Wave 1 — Universal Links (2026-06-11)
- **Added the `entity_links` table** (migration `007_entity_links.sql`) — a polymorphic soft-reference that connects any entity (transaction, research_entry, learning_item, engineer_project, todo, and 11 more types) to any other, scoped by `user_id`. Constraints: `uq_entity_link` UNIQUE `(user_id, from_type, from_id, to_type, to_id)` to block duplicates, `chk_entity_link_types` CHECK whitelisting both type columns (mirrors `LINKABLE_TYPES` in `server/lib/enums.js`). Indexes for forward lookup (`idx_entity_links_from`), reverse lookup (`idx_entity_links_to`), and recency (`idx_entity_links_created`); shared `set_updated_at()` trigger on `updated_at`.
- **Added `LINKABLE_TYPES`** to `server/lib/enums.js` (16 types) — single source of truth shared by the Zod schema, route validation, and the CHECK constraint.
- **Added the Links API** — `server/models/links.model.js` (`createLink` idempotent upsert, `getLinksForEntity` bidirectional, `getLinkById`, `deleteLink`, `getLinkStats`) and `server/routes/links.js` mounted `app.use('/api/links', requireAuth, linksRouter)`. Endpoints: `GET /api/links?type=&id=&direction=from|to|both`, `POST /api/links`, `DELETE /api/links/:id`. **Ownership of *both* referenced entities is verified before a link is created** (via each module's `get*ById`); missing/non-owned entities return `404` (never `403`, to avoid existence disclosure). `LINK_CREATE`/`LINK_DELETE` audit events logged with `userId`+`reqId`.
- **Added `<LinkedItems>` + `<LinkPickerModal>`** (`client/src/components/shared/`) — a reusable, four-state links section (uses `useApi`) embedded in the Research entry detail modal and the Engineering project detail Overview tab. The picker browses/searches five modules (research, finance, learning, engineering, todos) and adds an optional note per link.
- **Added integration tests** (`server/test/integration/links.int.test.js`, 9 tests) covering create/upsert/bidirectional lookup/stats/cross-user isolation/delete; and **three OpenAPI paths** under a new `Links` tag.

## [Phase 13–15] — 2026-06-11

### Phase 13 — Observability & Metrics
- **Added `prom-client` metrics endpoint at `/metrics`** with HTTP request histogram, request counter, and pool saturation gauge (`total`/`idle`/`waiting`, sampled every 15s)
- **Added pool metrics module** (`server/lib/poolMetrics.js`) with lifecycle (`startPoolMetrics`/`stopPoolMetrics`) tied to server start/shutdown
- **Added audit-trail structured logging** for `LOGIN_SUCCESS`, `LOGIN_FAILURE`, `LOGOUT`, `REGISTER_SUCCESS`, `EXPORT`, `SETTLE`, `TRANSACTION_CREATE`, and `DELETE` across all routers — each with `userId`+`reqId`
- **Added pino `redact`** for `req.headers.cookie` and `req.headers.authorization` to prevent secret leakage into logs
- **Added alerting runbook** (`docs/RUNBOOK.md` §6) with 6 Prometheus alert expressions: high error rate, p99 latency, pool exhaustion, pool near-capacity, `/health` 503s, and scrape-down

### Phase 14 — E2E Testing & Accessibility
- **Installed Playwright** with 30 tests across `chromium-desktop` and `chromium-mobile` projects (`smoke.spec.js` 8 tests, `a11y.spec.js` 7 pages × 2 viewports)
- **Installed `@axe-core/playwright`** for WCAG AA accessibility audits on Dashboard, Todo, Finance, Finance Dashboard, Accounts, Learning, and Research
- **Rewrote `Modal.jsx` with full focus trap:** Tab/Shift+Tab cycle within dialog, body scroll lock, auto-focus first element, restore focus to opener on close
- **Added `useDocumentTitle` hook** with per-route titles ("Page Name — Rafli's Productivity Suite") on all 20 pages
- **Added `data-testid="stat-card"`** to StatCard component for e2e selectors
- **Added dedicated e2e CI job** with Postgres service, server/client boot, Playwright execution, and screenshot artifact upload on failure

### Phase 15 — API Documentation & Code Cleanup
- **Regenerated OpenAPI spec to 57 paths** (up from 14) via `server/scripts/generate-openapi.js` (94 `addPath` calls), covering all auth, todos, finances (transactions/receivables/payables/portfolio/budgets/accounts/categories/dashboard), learning, research (entries/topics/tags/stats/attachments/export/bulk), engineer (projects/snippets/documents/checkins/issues/roadmap), `/health`, and `/metrics`
- **Added CI gate** that fails the build if `addPath` count drops below 75
- **Extracted `server/lib/enums.js`** — centralized `TX_TYPES`, `ACCOUNT_TYPES`, `TODO_STATUSES`, `LEARNING_*`, `ENTRY_*`, `TOPIC_STATUSES`, `ALLOWED_EXT/MIME`, `PROJECT_*`, `ISSUE_*`, `ROADMAP_CATEGORIES` — replacing duplicated magic strings across routes and models
- **Demoted `PROJECT_STATE.md` to chronological phase log** and made `docs/ARCHITECTURE.md` the canonical architecture reference
- **Stopped writing legacy absolute `file_path`** in attachment creation (`file.filename` only)


### Phase 12 — Audit V3 Quick-Wins: Health DB Check, Dedup NULL Fix, Container Hardening, Coverage, Redact, Pool Env (2026-06-10)

#### Fixed
- **`GET /health` returns 200 even when Postgres is unreachable (§2.1 High)** — the endpoint previously returned a static `{ status: 'ok' }`. Docker healthcheck and nginx `depends_on: service_healthy` both gate on it, so a DB outage left the container "healthy" while every request 500'd. The route now runs `await pool.query('SELECT 1')` and returns `503 { status: 'degraded', db: 'disconnected' }` on failure, restoring the auto-restart / readiness guarantee.
- **Transfer-dedup index has a NULL hole (§3.1 High)** — `idx_transactions_transfer_dedup` treated `description = NULL` as distinct from itself (Postgres default), so two identical Transfers with no description both succeeded. Migration `006_fix_dedup_nulls.sql` drops and recreates the index with `NULLS NOT DISTINCT` (Postgres 15+), making `NULL = NULL` for dedup purposes. A new integration test asserts that the second NULL-description Transfer raises `23505 idx_transactions_transfer_dedup`.
- **Server container runs as root (§7.1 Medium)** — `server/Dockerfile` now adds `RUN chown -R node:node /app` + `USER node` after the COPY step, using the built-in non-root user that `node:22-alpine` provides.
- **CI pins Node 20 while prod image uses Node 22 (§7.2 Medium)** — both server and client `setup-node` steps in `.github/workflows/ci.yml` updated to `node-version: 22`.
- **No coverage tooling (§6.1 Medium)** — `server/package.json` gains `"test:coverage": "vitest run --coverage"`; CI server job gains a `Run tests with coverage` step (`continue-on-error: true` until a floor is set).
- **pino logs `cookie` / `authorization` headers in plaintext (§8.2 Low)** — `server/lib/logger.js` pino instance now includes `redact: ['req.headers.cookie', 'req.headers.authorization']`.
- **Pool `max: 10` hardcoded (§2.3 Low)** — `server/lib/db.js` now reads `parseInt(process.env.PG_POOL_MAX ?? '10', 10)` so ops can tune without a code change.
- **Pool errors logged via `console.error` instead of pino (§2.6 Low)** — pool `error` event now calls `logger.error({ err }, …)` for structured log output consistent with the rest of the server.
- **`generalLimiter` applied per-router, after body parsers (§2.4 Low)** — moved to a global `app.use(generalLimiter)` before `express.json()` and `express.urlencoded()`, so flood payloads are rejected before the JSON parser allocates memory. Rate limiter definitions moved above the global mount to avoid the TDZ. `authLimiter` remains per-route on `/api/auth/login` and `/api/auth/register`.

### Phase 11 — Frontend Optimization: Lazy-load Research, Vendor-split Editor, Duplicate-Transfer Error (2026-06-10)

#### Fixed
- **`Research` page loaded eagerly, inflating the main bundle (§2)** — `Research` was imported at the top of `App.jsx` alongside the non-lazy pages, which pulled `CreateResearchModal` → `EntryDetailModal` → `MarkdownEditor` → `@uiw/react-md-editor` into the main `index-*.js` chunk on every page load. `Research` is now `React.lazy`-loaded and its `/research` route is wrapped in `<Suspense fallback={<PageFallback />}>` (identical pattern to the Engineering routes). The `PageFallback` skeleton renders inside `<AppLayout>`'s `<Outlet />` so the sidebar stays mounted during chunk download.
- **`@uiw/react-md-editor` and `prism-react-renderer` not vendor-split (§2)** — `client/vite.config.js` had no `build.rollupOptions.output.manualChunks`. Both heavy packages now land in their own cacheable chunks (`mdeditor-*.js`, `prism-*.js`) via a function-based `manualChunks` (required by Vite 8 / rolldown). The main `index-*.js` drops from ~304 kB to ~243 kB; `mdeditor-*.js` is ~1,060 kB (cached after first visit to `/research` or `/engineer/docs`); `prism-*.js` is ~85 kB.
- **Inaccurate App.jsx comment claimed Engineering was the only md-editor consumer (§2)** — the comment said Engineering routes "are the only routes that pull in the heavy `@uiw/react-md-editor`", which was false (Research also uses it). Rewritten to name both Engineering and Research as code-split routes and to note the Phase 11 Research lazy-load.
- **Generic 409 for duplicate Transfer blocks legitimate re-submissions (§4-NEW/§3)** — `idx_transactions_transfer_dedup` can reject a second genuinely-intended identical Transfer (same day, accounts, amount, blank description) with the same generic "A record with this value already exists." message as every other `23505`. `errorHandler.js` now branches on `err.constraint === 'idx_transactions_transfer_dedup'` before the generic fallback and returns `{ code: 'DUPLICATE_TRANSFER', message: 'This looks like a duplicate transfer … add or change the description to record it as a separate transfer.', field: 'description' }`. All other unique-constraint violations keep the existing generic `CONFLICT` path.

### Phase 10 — Integration Test Suite: Real-DB Tests, Real Multer Filter, De-brittle Settle Test (2026-06-10)

#### Added
- **Real-Postgres integration suite (`server/test/integration/`)** — three new test files exercise the riskiest DB guarantees that the mocked unit tests cannot verify:
  - `isolation.int.test.js` — user A cannot read user B's transaction (`getTransactionById` returns `null` when queried with a foreign `user_id`).
  - `settle.int.test.js` — a `settleLedger` call that receives a non-owned account ID rolls back completely; the receivable row stays `outstanding` with `settled_at = null`.
  - `constraints.int.test.js` — a zero-amount `INSERT` on `transactions` fires `23514` (`transactions_amount_nonzero` CHECK); a duplicate Transfer `INSERT` fires `23505` on `idx_transactions_transfer_dedup`.
  - `db.setup.js` — shared harness: runs `db/migrate.js` once via `execFileSync`, creates a `pg.Pool`, and provides `makeUser`/`cleanupUsers` helpers. All suites are wrapped in `describe.skipIf(!hasDb)` so `npm test` remains green on any machine without `DATABASE_URL`.
- **`npm run test:integration`** script (`"vitest run test/integration"`) for running only the integration suite.

#### Fixed
- **`upload.filter.test.js` tested a copy, not the shipped filter (§7)** — the test re-declared `ALLOWED_EXT`, `ALLOWED_MIME`, and a fresh `multer({…})` instead of importing from `research.js`. A regression in the real filter would not have failed the test. Fix: `research.js` now exports `researchFileFilter` (and the two allowlist Sets); the test imports and mounts the real function with `multer.memoryStorage()` so no disk writes occur. All six assertion cases are retained.
- **`settle.atomicity.test.js` brittle positional mock chain (§7)** — the three tests chained `mockResolvedValueOnce` in the exact query-call order; any reordering of equally-correct SQL would desync the chain without a real defect. Replaced with `mockImplementation` that branches on SQL content (`/FROM receivables/i`, `'BEGIN'`, `'COMMIT'`, etc.) so the mock is order-independent. Outcome assertions (`ROLLBACK` present, `COMMIT` absent/present, `result.status`) are unchanged.

### Phase 9 — DevOps: Client Sentry Docker, Env Parameterization, Server Lint, CI Postgres (2026-06-10)

#### Fixed
- **Client Sentry dead in Docker (§6-N1)** — `client/Dockerfile` now accepts `ARG VITE_SENTRY_DSN` (empty default → no-op without config) and exposes it as an `ENV` so `main.jsx`'s `Sentry.init` guard actually compiles the DSN into the bundle when one is provided. `docker-compose.yml` passes it as a build arg via the long-form `build.args` block. `client/nginx.docker.conf` CSP `connect-src` extended with `https://*.ingest.sentry.io` so the browser can POST events when the DSN is set. `SECURITY.md` client error-reporting row updated to state the build-arg requirement.
- **Hardcoded `CLIENT_ORIGIN` and `VITE_API_URL` (§6)** — `docker-compose.yml` api service `CLIENT_ORIGIN` is now `${CLIENT_ORIGIN:-https://raflitriwijaya.my.id}`, and the nginx build uses `${VITE_API_URL:-https://raflitriwijaya.my.id}` as a build arg. Both vars documented in `.env.docker.example`. Staging or any other domain is now a `.env` change only — no tracked-file edits required.
- **Server linting silently skipped in CI (§6/§7)** — `server/package.json` gains a `"lint": "eslint . --max-warnings 0"` script backed by a new `server/eslint.config.js` (ESLint 9 flat config, Node ESM + vitest globals). Five pre-existing lint errors fixed: unused import of `getLedgerById`/`getPortfolioById` in `finances.js`; unused `USER_B` in `ownership.test.js`; unused `beforeEach` import in `upload.filter.test.js`; useless post-increment of `i` in `engineer.model.js`. CI server job Lint step drops `--if-present` — lint now fails the build on errors.
- **No Postgres in server CI (§6/§7)** — server CI job gains a `postgres:16-alpine` service with healthcheck; `DATABASE_URL`, `SESSION_SECRET`, `CLIENT_ORIGIN`, and `NODE_ENV` are set at job level; a "Migrate test DB" step (`npm run migrate`) runs before the test suite so the Phase 10 integration suite can use a fully-migrated schema. Existing mocked unit tests are unaffected.
- **Stray `hehe.md` in repo root (§1)** — raw audit-prompt file moved to `docs/prompt/AUDIT_PROMPT_ARCHIVE.md` alongside the existing phase-solve prompts; repo root is clean.

---

### Phase 8 — Backend Resilience: Export Cap, Pre-Upload Ownership, Host-Independent Delete, Strict Month/Year (2026-06-10)

#### Fixed
- **Export memory unbounded (§3)** — `/api/research/export` previously requested up to 100,000 rows and `JSON.stringify(rows, null, 2)`'d the whole result set into memory. Now capped at `EXPORT_MAX = 10000`; if `total > EXPORT_MAX` the endpoint returns `413 PAYLOAD_TOO_LARGE` with a message instructing the user to narrow filters. JSON export drops the `null, 2` pretty-print (halves payload + heap). CSV path shares the same cap via the 413 guard.
- **Disk-churn DoS on upload to non-owned entry (§3/§9)** — `POST /api/research/:id/attachments` previously ran multer (writing bytes to disk) before verifying entry ownership. A flood of POSTs to a foreign `:id` would churn `server/uploads/` and silently swallow cleanup errors. Fix: a new `requireOwnedEntry` middleware (mirrors the existing `requireOwnedProject` pattern in `engineer.js`) now runs *before* `upload.single('file')`, so unauthorized callers are rejected before multer opens a file handle. The entry is stashed on `req.ownedEntry` to avoid a second DB query in the handler. Any post-write cleanup (rare insert failure) is now `await`ed via `fs.promises.rm` and logs on failure rather than being swallowed.
- **Attachment DELETE trusts stored absolute `file_path` (§4)** — the `DELETE /api/research/attachments/:id` handler called `fs.rm(attachment.file_path, …)`, trusting the stored absolute path. The download route had already been fixed to reconstruct from `path.join(uploadsDir, attachment.filename)`. DELETE now does the same — host/mount-independent. Removal is `await`ed via `fs.promises.rm` and logs on failure. `attachment.file_path` is no longer read anywhere in `research.js`.
- **`?month=13` silently returns all-time data (§9)** — `parseMonthYear` in `finances.js` previously returned `{}` (all-time) for any present-but-invalid month/year (out-of-range, missing partner, non-integer), making `GET /api/finances?month=13` look like a successful filter. Now distinguishes absent (→ `{}`, all-time, unchanged) from present-but-invalid (→ throws `AppError(400, VALIDATION_ERROR)`). The three model functions that accept month/year (`listTransactions`, `getSummary`, `listBudgets`) now call a new `assertMonthYear` guard at entry so a direct caller passing `month: 13` gets a clean 400 instead of a `make_date` 500.

---

### Phase 7 — Data Durability & Secret Hygiene (2026-06-10)

#### Fixed
- **Data loss guard on `002_finance_upgrade.sql` (§4)** — inserted a `DO $$ … RAISE EXCEPTION` block immediately before the `DROP TABLE` cascade. If `transactions` already exists and contains rows the migration aborts loudly with a row count and a pointer to the runbook, so an accidental re-run (cleared `schema_migrations`, manual invocation, partial restore) cannot wipe the ledger. Fresh installs pass through (`to_regclass` returns `NULL` when the table is absent). Intentional resets still work via `TRUNCATE transactions` first.
- **Single-host backup risk (§6)** — extended the `db_backup` sidecar to optionally push each nightly dump to S3 / Cloudflare R2 after writing it locally. Conditional on `BACKUP_S3_BUCKET`; with that var absent behaviour is identical to before (local-only). `--endpoint-url` makes it work against R2 as well as AWS S3. Five new optional `BACKUP_S3_*` vars documented in `.env.docker.example`.
- **Dev secrets treated as compromised (§8)** — added explicit "generate fresh, never reuse dev" warnings to both `.env.docker.example` and `server/.env.example`; extended `docs/RUNBOOK.md §3` with the exact `openssl rand` commands and the rule that the dev `SESSION_SECRET`/DB password must never be promoted to production.

#### Added
- **`docs/RUNBOOK.md §1a`** — "Off-host backups & monthly restore drill": how to verify both local and off-host copies, and a step-by-step monthly restore procedure against a throwaway Postgres container.

---

### Phase 6 — Rate-Limit Self-Lockout Fix (2026-06-10)

#### Fixed
- **Critical: `/api/auth/me` self-lockout (§3-N1)** — `GET /api/auth/me` and `POST /api/auth/logout` were mounted behind `authLimiter` (5 req / 15 min / IP) along with `login` and `register`. Because `useAuth()` calls `/me` on every protected-route mount, six page loads / refreshes / open tabs in 15 minutes triggered a `429` self-lockout. Fix: `authLimiter` is now applied only to `/api/auth/login` and `/api/auth/register` via path-specific `app.use` mounts registered before the router; the router itself runs under `generalLimiter` (100/min), so `/me` and `/logout` are no longer counted against the credential-guessing budget.
- **Critical: `429` cascade to `/login` (§5/§8/§9)** — a `429` from the axios interceptor previously fell through to the generic error path, which caused `useAuth` to return `user: null` and `AuthGuard` to redirect to `/login` — which is on the same exhausted limiter, deepening the lockout. Fix: the interceptor now has an explicit `429` branch that surfaces the server's "slow down" message without redirecting; the rejected `Error` carries `err.status`; `useAuth` exposes a `throttled` flag (`error?.status === 429`); `AuthGuard` shows the loading skeleton (not a redirect) when `throttled` is true.

---

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
