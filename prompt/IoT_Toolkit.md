## Phase 0 – Read the project's design system and conventions

Before writing any code, please read **both** of these files completely:

1. `PROJECT_STATE.md` — stack, existing routes, DB schema, deployment
2. `SKILL.md` — brand identity, design tokens, typography system, spacing/layout, component API specs (Button, Card, Input, DataTable, Modal, Toast, Badge, Skeleton, EmptyState, ErrorState, StatCard), state handling templates, module page template, route structure, and **all** ALWAYS / NEVER rules.

If you cannot read them in one go, summarize the key constraints and ask me to confirm before you generate any code.

---

## Phase 1 – New Module: Engineering Toolkit

Now add a new top-level group in the sidebar (see SKILL.md §9.3 `NAV_ITEMS` and `AppLayout.jsx`) called **"Engineering"**, placed after "Knowledge". The sidebar label must use Overline typography from SKILL.md §3.2.

The group contains these nav items (use lucide-react icons):

| Label      | Path                  | Icon              |
|------------|-----------------------|-------------------|
| Projects   | `/engineer`           | `Wrench`          |
| Snippets   | `/engineer/snippets`  | `Code`            |
| Docs       | `/engineer/docs`      | `FileText`        |
| Check-ins  | `/engineer/checkins`  | `ClipboardCheck`  |
| Issues     | `/engineer/issues`    | `Bug`             |
| Roadmap    | `/engineer/roadmap`   | `Map`             |

All routes follow the pattern of the existing protected routes (inside `<AuthGuard>` + `<AppLayout>`). Update `App.jsx` exactly as shown in SKILL.md §9.2 (but with new paths).

Every page must follow the **Module Page Template** from SKILL.md §8: imports order, state, data fetching with `useApi`, derived state, handlers, `DataTable` column contract, and render structure. All UI must use **only** the components defined in SKILL.md §5 and listed in §9a. No raw `<input>`, `<button>`, or `<table>` elements.

---

## Phase 2 – Database & Backend (PROJECT_STATE.md §6.5, §6.3, §6.4, §6.6)

Create a migration file `003_engineer_toolkit.sql` with the following tables (exact conventions: `SERIAL PRIMARY KEY`, `user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `VARCHAR` for status/type, `TIMESTAMPTZ`, `set_updated_at()` trigger, standard indexes).

### Tables

1. **`engineer_projects`**
   - `id`, `user_id`, `name` VARCHAR(255) NOT NULL, `description` TEXT, `project_type` VARCHAR(50) NOT NULL DEFAULT 'other' (values: `'iot'`,`'embedded'`,`'robotics'`,`'other'`), `platforms` TEXT (comma-separated), `stack` TEXT (comma-separated), `status` VARCHAR(50) NOT NULL DEFAULT 'idea' (`'idea'`,`'planning'`,`'development'`,`'testing'`,`'deployed'`,`'archived'`), `repo_url` VARCHAR(500), `created_at`, `updated_at`.

2. **`engineer_templates`**
   - `id`, `name` VARCHAR(255) NOT NULL, `description` TEXT, `domain` VARCHAR(50) NOT NULL DEFAULT 'general' (`'iot'`,`'embedded'`,`'robotics'`,`'general'`), `folder_structure` JSONB (array of `{path, content}`), `doc_templates` JSONB (array of `{title, doc_type, content}`), `created_at`.

3. **`engineer_snippets`**
   - `id`, `user_id`, `title` VARCHAR(255) NOT NULL, `category` VARCHAR(100) NOT NULL (extensible, see list in feature description), `language` VARCHAR(50) NOT NULL DEFAULT 'cpp', `tags` TEXT, `code` TEXT NOT NULL, `created_at`, `updated_at`.

4. **`engineer_documents`**
   - `id`, `project_id` INTEGER REFERENCES `engineer_projects(id) ON DELETE CASCADE` (nullable), `user_id` INTEGER NOT NULL REFERENCES `users(id)`, `title` VARCHAR(255) NOT NULL, `content` TEXT, `doc_type` VARCHAR(50), `updated_at`. No `created_at` needed? Add for consistency. (Better: add `created_at` as well.)

5. **`engineer_checkins`**
   - `id`, `project_id` INTEGER NOT NULL REFERENCES `engineer_projects(id) ON DELETE CASCADE`, `user_id` INTEGER NOT NULL REFERENCES `users(id)`, `week_start` DATE NOT NULL, `achievements` TEXT, `plans_next` TEXT, `blockers` TEXT, `bugs_discovered` TEXT, `concerns` TEXT, `created_at`.

6. **`engineer_issues`**
   - `id`, `project_id` INTEGER NOT NULL REFERENCES `engineer_projects(id) ON DELETE CASCADE`, `user_id` INTEGER NOT NULL REFERENCES `users(id)`, `title` VARCHAR(255) NOT NULL, `description` TEXT, `severity` VARCHAR(50) NOT NULL DEFAULT 'P2-Medium' (`'P0-Critical'`,`'P1-High'`,`'P2-Medium'`,`'P3-Low'`), `status` VARCHAR(50) NOT NULL DEFAULT 'open' (`'open'`,`'in_progress'`,`'resolved'`), `component` VARCHAR(100), `assignee` VARCHAR(100), `created_at`, `updated_at`.

7. **`engineer_roadmap_months`** (global — no `user_id`)
   - `id`, `month_number` INTEGER UNIQUE NOT NULL, `title` VARCHAR(255) NOT NULL, `description` TEXT.

8. **`engineer_roadmap_skills`** (per-user progress)
   - `id`, `month_id` INTEGER NOT NULL REFERENCES `engineer_roadmap_months(id) ON DELETE CASCADE`, `user_id` INTEGER NOT NULL REFERENCES `users(id)`, `category` VARCHAR(50) NOT NULL (`'hardware'`,`'software'`,`'process'`), `title` VARCHAR(255) NOT NULL, `completed` BOOLEAN NOT NULL DEFAULT false.

Add proper indexes for `user_id`, `project_id`, `status`, etc.

### Backend model & routes

Create `server/models/engineer.model.js` with all CRUD functions, and `server/routes/engineer.js` with Zod validation (SKILL.md §6.6b). Mount in `server/index.js` as `app.use('/api/engineer', requireAuth, engineerRouter)`.

All API responses must follow the envelope in SKILL.md §6.4: `{ success: true, data }` or paginated with `meta`. Use `AppError` for errors.

The following endpoints (full REST, with literal sub-paths before `:id`):

- Projects: CRUD + `GET /stats`, `GET /templates`
- Snippets: CRUD + search (`?q=`) + filter by category/language
- Documents: `GET /projects/:id/documents`, `POST /projects/:id/documents`, `PATCH /documents/:id`, `DELETE /documents/:id`. (Since docs can be global? keep scoped to project for now; if project_id is nullable, then also `GET /documents` for global docs.)
- Check-ins: `GET /projects/:id/checkins`, `POST /projects/:id/checkins`
- Issues: `GET /projects/:id/issues` (with filters), `POST /projects/:id/issues`, `PATCH /issues/:id`, `DELETE /issues/:id`
- Roadmap: `GET /roadmap` (returns months with skills for current user; lazily seed if no skills exist), `PATCH /roadmap/skills/:id` (toggle completed)

---

## Phase 3 – Frontend (Strict adherence to SKILL.md)

Create the following pages in `client/src/pages/`, each following the exact Module Page Template (§8). Use `useApi` for data fetching, `DataTable` with column contract, filter pills, and the four-state switch (skeleton, error, empty, data). Use `StatCard` for summary.

1. **`EngineerProjects.jsx`** — list with stat cards (total, active, deployed), type/status filter pills, DataTable with columns: name, type (badge), platforms (badges), status (badge), updated_at, actions (view/edit/delete). Create/edit modal using `Modal` component (§5.6), with form inside, using `Input`, `Select`, `Textarea` from `components/ui/Input.jsx`. When creating, allow picking a template → auto-fill.

2. **`EngineerProjectDetail.jsx`** — route `/engineer/:id`. Tabs (or sections) using `Card` components: Overview (description, platforms, stack, repo link), Documents, Check-ins, Issues.

3. **`EngineerSnippets.jsx`** — grid of `SnippetCard` (custom card showing title, category badge, tags, code preview with syntax highlighting). Use `prism-react-renderer` for syntax highlighting. Search input and category/language filters. Click to open full snippet in a `Modal` with copy button (use `navigator.clipboard` and toast). Create/edit modal with fields: title, category (Select), language (Select), tags, code (Textarea with `font-mono`).

4. **`EngineerDocs.jsx`** (or integrated in project detail) — list of documents per project. Markdown editor: use `@uiw/react-md-editor` (install in client). Must support dark mode (the editor accepts a `dark` prop or we toggle a class). Show preview.

5. **`EngineerCheckins.jsx`** — table of check-ins for a project (if `project_id` query param). Form for creating new check-in (modal or page) with `Textarea` fields, using `Date` input for week start. Health indicator: if latest check-in has blockers text, show red dot; else green.

6. **`EngineerIssues.jsx`** — DataTable with columns: title, severity (Badge with mapping: P0=red, P1=amber?, P2=amber?, P3=gray — follow §5.8 canonical mapping), status (Badge), component, assignee, actions. Create/edit modal. Allow creating from check-in (pre-fill from check-in data if passed via navigation state or query).

7. **`EngineerRoadmap.jsx`** — 12 cards (one per month) each with a progress bar (using `MiniProgressBar` component, which is like finance `ProgressBar` but adapted). Inside each card, a checklist grouped by category (hardware/software/process). Each skill is a checkbox that toggles `completed` via PATCH. Overall progress bar at top. Follows SKILL.md for loading/error handling.

### Reusable components (in `client/src/components/engineer/`)

All components must follow SKILL.md component patterns. Use `Button`, `Badge`, `Modal`, `Card`, `Input`, `Select`, `Textarea`, `Skeleton`, `EmptyState`, `ErrorState`, `StatCard` exclusively. No raw HTML except inside these UI components' implementation.

Create:
- `ProjectRow.jsx` — DataTable render helpers (TitleCell, StatusCell, etc.)
- `CreateProjectModal.jsx` — modal with controlled form, validation, calls API, uses toast for success/error.
- `SnippetCard.jsx` — card with code preview, copy button.
- `SnippetModal.jsx` — full snippet view modal.
- `CreateSnippetModal.jsx` — create/edit snippet modal.
- `CheckinForm.jsx` — form for check-in (can be used inside modal or page).
- `IssueRow.jsx` — DataTable render helpers.
- `CreateIssueModal.jsx` — create/edit issue modal.
- `RoadmapMonthCard.jsx` — month card with skills checklist.
- `MiniProgressBar.jsx` — a small progress bar that respects the finance `ProgressBar` design but generic. (Can reuse the same `ProgressBar` component from `components/finance/` if applicable, but adapt to not depend on finance logic.)

### Sidebar update

Modify `client/src/components/layout/AppLayout.jsx` to add the new nav group. The `NAV_ITEMS` array currently doesn't have groups; it's flat. In SKILL.md §9.3, the sidebar is flat. But the earlier prompt wanted groups. SKILL.md shows a flat list with icons. However, the existing `AppLayout.jsx` in the actual project (as per PROJECT_STATE.md) uses `NAV_SECTIONS` with groups (see `PROJECT_STATE.md` section "client/src/App.jsx — Wired & Complete" and "AppLayout sidebar nav is grouped into labelled sections (`NAV_SECTIONS`): top-level (Dashboard, To-Do), **Finance** (Overview, Transactions, Accounts, Receivables, Payables, Portfolio, Budget), **Knowledge** (Research, Learning)." So the actual code uses sections. The SKILL.md shows a flattened version for simplicity but the actual implementation uses sections. I'll follow the actual project structure: add a new section "Engineering" with the items above. That matches what the user expects. In SKILL.md §9.3, it's simplified; the project has sections. So the prompt should say: "Add a new section 'Engineering' to the `NAV_SECTIONS` array in `AppLayout.jsx`, with label 'Engineering' and items: ..."

### App.jsx routing

Add routes for the new pages, following the existing pattern (protected). Also add a catch-all for `/engineer` to `EngineerProjects`.

### Dependencies

Install in client: `prism-react-renderer`, `marked` (if needed for markdown fallback), `@uiw/react-md-editor`. Server: none new.

### Seed data

Provide SQL inserts (or seed file) for:
- 4 project templates (Heltec IoT, STM32 FreeRTOS, ROS2 Python package, Raspberry Pi Camera)
- At least 15 snippets covering various categories and languages
- 12 roadmap months with skills as described (detailed content)

---

## Phase 4 – Adherence to SKILL.md ALWAYS / NEVER

All generated code must follow **every** rule in SKILL.md §10, especially:

- Use only Tailwind classes, no inline styles (except approved progress bar width).
- Always include `dark:` variants for every color class.
- Four-state handling in every data-driven component.
- Use `useApi`, `useToast`, `useTheme` correctly.
- Modals via portal.
- No raw HTML elements for forms/buttons.
- `snake_case` in API communication.
- `PATCH` for partial edits.
- Error responses with `AppError`.
- And all other NEVER rules (no external libs, no spinners, etc.).

---

Now implement the complete Engineering Toolkit. Start by reading PROJECT_STATE.md and SKILL.md, then generate all files in the order: migration, model, routes, server registration, then frontend pages and components, then sidebar and routing updates. Output full file contents.