I want to significantly upgrade the **Research module** of my productivity web app. The current implementation is basic CRUD for entries with types (journal, citation, note), statuses, and simple filtering. I want to transform it into a structured **Research Hub** where I can organize work into **Research Topics**.

**Before writing any code, please read these files thoroughly:**
- `PROJECT_STATE.md`
- `SKILL.md` (especially §2 Design Tokens, §3 Typography, §5 Component API, §7 State Handling, §8 Module Page Template, §10 ALWAYS/NEVER)
- `client/src/pages/Research.jsx`
- `server/routes/research.js`
- `server/models/research.model.js`
- `client/src/components/research/ResearchSummaryCards.jsx`
- `client/src/components/research/CreateResearchModal.jsx`
- `client/src/components/research/ResearchEntryRow.jsx`

After understanding the existing codebase and design system, implement the following **new features additively** — keep everything working, follow all existing patterns, and adhere strictly to **every rule in SKILL.md**, especially the design tokens, typography, component APIs, and ALWAYS/NEVER rules.

---

## New Feature: Research Topics

### Database Changes
1. Create table `research_topics`:
   - id SERIAL PRIMARY KEY
   - user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
   - name VARCHAR(255) NOT NULL
   - description TEXT
   - color VARCHAR(7) DEFAULT '#10b981' (hex color for badge — note: in UI we will map this to a Tailwind color class, not use the hex directly)
   - status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','archived'))
   - created_at TIMESTAMPTZ DEFAULT NOW()
   - updated_at TIMESTAMPTZ DEFAULT NOW()
   - Indexes: user_id, status

2. Create pivot table `research_entry_topics`:
   - entry_id INTEGER NOT NULL REFERENCES research_entries(id) ON DELETE CASCADE
   - topic_id INTEGER NOT NULL REFERENCES research_topics(id) ON DELETE CASCADE
   - PRIMARY KEY (entry_id, topic_id)

3. Migration file: `004_research_topics.sql` (include all DDL, triggers for updated_at on topics table, and indexes). Follow the migration conventions in PROJECT_STATE.md.

### Model Functions (in `research.model.js`)
Add these functions (using raw SQL via `pool`, same pattern as existing model):
- `listTopics(userId, { status? })` — returns all topics for user
- `getTopicById(id, userId)` — single topic with ownership check
- `createTopic(userId, { name, description, color? })`
- `patchTopic(id, userId, fields)` — update name/description/color/status
- `deleteTopic(id, userId)` — delete topic (cascade removes pivot rows)
- `getTopicStats(topicId, userId)` — counts of entries by type and status in that topic
- `addEntryToTopics(entryId, topicIds[])` — sync pivot rows (delete existing, insert new set)
- `getTopicsForEntry(entryId)` — return array of `{ topic_id, name, color }`
- `getEntriesByTopic(topicId, userId, opts)` — paginated entries for a topic, reusing list query with JOIN

**Also update existing entry queries** to include an array of topics in the returned JSON. When `listResearchEntries` is called, join through pivot table to include a `topics` field (e.g., `[{ id, name, color }]`). When creating/updating an entry, accept optional `topic_ids` array.

### API Endpoints (in `routes/research.js`)
All endpoints use Zod validation and follow the standard response envelope from SKILL.md §6.4.

#### Topics CRUD
- `GET    /api/research/topics`          → `listTopics`
- `GET    /api/research/topics/:id`      → `getTopicById` + stats (return `{ topic, stats }`)
- `POST   /api/research/topics`          → `createTopic` (zod: name required, description/color optional)
- `PATCH  /api/research/topics/:id`      → `patchTopic`
- `DELETE /api/research/topics/:id`      → `deleteTopic`
- `GET    /api/research/topics/:id/entries` → `getEntriesByTopic` (supports same query params as main list: type, status, q, page, sort, etc.)

#### Entry ↔ Topic association
- `POST   /api/research/:id/topics`      → body `{ topic_ids: number[] }`, calls `addEntryToTopics`
- `GET    /api/research/:id/topics`      → returns list of topics for entry

#### Update existing endpoints
- `GET /api/research` already returns entries; ensure each entry includes `topics: [...]`
- `POST /api/research` and `PATCH /api/research/:id` accept optional `topic_ids` array

### Frontend Implementation

**All UI must use only the components defined in SKILL.md §5 and listed in §9a.** No raw HTML form elements, no external component libraries. Typography, spacing, and colors must follow the exact tokens in SKILL.md §2–§4.

#### Layout Change
Modify `client/src/pages/Research.jsx` (follows SKILL.md §8 Module Page Template):

- **Topic sidebar**: On desktop, a fixed sidebar on the left (or a horizontal tab bar below the header on mobile). This replaces the current flat filter pills approach. The sidebar lists all topics with:
  - Color dot (use a small `<span>` with a background color class mapped from the topic's color; since the color is stored as hex, create a utility to map hex to the closest Tailwind color, or simply use inline style for the dot **only** — this is an accepted exception per SKILL.md §10 NEVER #2, since dynamic user-defined colors have no static Tailwind equivalent. But prefer to use a predefined set of Tailwind color classes and store the class name, not hex. For simplicity, store `color` as a Tailwind color name like `'emerald'`, `'blue'`, etc., and use `bg-{color}-500`. If we must keep hex, use inline style for the dot only.)
  - Topic name (Body Default typography)
  - Entry count (Caption typography)
  - Active state: use the same subtle emerald tint pill as sidebar nav (SKILL.md §5.5 NAV LINK active)
- "All Entries" item at top.
- "New Topic" button → opens `CreateTopicModal` (uses `Modal` component).
- When a topic is selected, the main content area shows only entries belonging to that topic. The summary cards update to reflect that topic's stats (call `GET /api/research/topics/:id` for stats, or filter the existing stats client-side if all data is loaded). **Breadcrumb or header shows topic name** (Page Title typography).
- **State handling:** The topic sidebar itself should handle loading (skeleton for list), error (inline error with retry), empty (a small empty state or just "No topics yet" text).

#### New Components (in `client/src/components/research/`)
Create these components following the exact patterns of existing module components (e.g., `CreateResearchModal.jsx`):

1. **`TopicSidebar.jsx`** — Desktop sidebar or horizontal tabs for topics.
   - Fetches topics via `useApi(GET /api/research/topics)`.
   - Renders a list of buttons/links for each topic.
   - Props: `selectedTopicId`, `onSelectTopic`.
   - Loading: show a few skeleton pills (use `Skeleton` component).
   - Empty: a subtle text "No topics yet" with a button to create one.

2. **`CreateTopicModal.jsx`** — Modal to create/edit a topic.
   - Uses `Modal` component (SKILL.md §5.6) with `size="sm"`.
   - Form fields: name (`Input`), description (`Textarea`), color (`Select` with predefined options like Emerald, Blue, Red, Amber, etc., or a simple color input). Use `Input` and `Select` from `components/ui/Input.jsx`.
   - Submit calls `POST /api/research/topics` or `PATCH`.
   - On success, calls `onClose` and a toast via `useToast()`.

3. **`TopicBadge.jsx`** — Small colored badge with topic name.
   - Props: `name`, `color`.
   - Uses a small `span` with a dynamic background color (inline style for the dot + Tailwind for text). Example: a 8px circle with `style={{ backgroundColor: color }}` and the name next to it in `text-xs font-medium text-stone-600 dark:text-gray-400`. This is an accepted inline style exception.

4. **`TopicSelector.jsx`** — Multi-select input for choosing topics in the entry form.
   - Fetches all topics.
   - Renders a list of checkboxes or toggle chips using the `Badge` component variant.
   - Selected topics are stored in an array of IDs.
   - Integrate into `CreateResearchModal.jsx` as an additional field "Topics".

#### Update Existing Components

- **`CreateResearchModal.jsx`**: Add the `TopicSelector` component. Add `topic_ids` to the submitted data.
- **`ResearchEntryRow.jsx`**: Show topic badges using `TopicBadge` component in a new cell or below the title. Add a `TopicsCell` renderer that maps `row.topics` to `TopicBadge` components.
- **`Research.jsx`**: Integrate `TopicSidebar`. Replace the static filter pills with the sidebar (on mobile, consider a dropdown or horizontal scrollable tabs). The main table now filters by selected topic (either via a separate API call to `/api/research/topics/:id/entries` or by client-side filtering if all entries are loaded — for simplicity, use a separate API call when a topic is selected to keep pagination consistent). Summary cards should also update: when a topic is selected, call `GET /api/research/topics/:id` to get stats, else use the global stats.

---

## Additional Features (integrate cleanly with Topics)

These features were previously discussed. Implement them alongside Topics, ensuring they respect topic context.

### 1. Full-text Search
- Add a search input at the top of the Research page (use `Input` component with a search icon).
- Backend: `GET /api/research?q=...` performs `ILIKE` on `title`, `content`, `source`, `tags`.
- Frontend: debounced input updates the `useApi` call. When a topic is selected, search within that topic.

### 2. Markdown Content Editor
- In `CreateResearchModal.jsx`, replace the `content` textarea with `@uiw/react-md-editor`.
- The editor must support dark mode (pass `dark` prop or wrap with dark class context). The editor's toolbar and preview must match the app's dark mode.
- Keep the modal height manageable; set `height={300}` on the editor.

### 3. Enhanced Tagging
- Add endpoint `GET /api/research/tags` returning distinct tags for the user (or for the current topic).
- In the entry form, add an autocomplete input for tags: as the user types, fetch matching tags and show suggestions. (Implement a simple `TagInput` component using `Input` and a dropdown list styled per SKILL.md — no external autocomplete library.)
- In the main table, turn each tag into a clickable `Badge`. Clicking a tag adds it to an "active tag filter" (state array). Show active tag filters above the table as removable pills.
- Client-side filtering when tags are selected (or server-side via `?tags=` param).

### 4. File Attachments
- Create table `research_attachments` (id, entry_id FK, filename, original_name, file_path, mime_type, size, created_at).
- Use `multer` in server. Configure storage in `server/uploads/` (add to `.gitignore`).
- Endpoints:
  - `POST /api/research/:id/attachments` — upload file(s)
  - `GET /api/research/:id/attachments` — list attachments
  - `DELETE /api/research/attachments/:id` — delete attachment
- Serve uploaded files statically: `app.use('/uploads', express.static('server/uploads'))` in `server/index.js`.
- In the entry detail (maybe expandable row or a modal), show a list of attachments with download and delete buttons.

### 5. Export
- Button "Export" in Research page header.
- `GET /api/research/export?format=json|csv&type=&status=&q=&topic_id=` returns filtered entries.
- JSON: `Content-Disposition: attachment; filename="research-export.json"`.
- CSV: build CSV string manually, send with `text/csv` header.
- Frontend: clicking Export opens a small menu (use a simple dropdown with `Button` and a `div` positioned absolutely, styled per design tokens) with JSON/CSV options.

### 6. Bulk Actions
- Add checkbox selection to the DataTable. Extend `DataTable` to support a `selectable` prop and manage `selectedIds` via a callback, OR manage selection state in `Research.jsx` and pass a custom left-most column with checkboxes. (Modifying `DataTable` itself must follow SKILL.md — do not break existing tables; make the feature opt-in.)
- If modifying `DataTable` is too invasive, implement a simpler approach: add a `selected` state in `Research.jsx` and a checkbox column in the columns definition.
- Bulk action bar appears when ≥1 rows selected, with buttons: "Archive Selected" (`PATCH /api/research/bulk { ids, status: 'archived' }`), "Delete Selected" (`DELETE /api/research/bulk { ids }` with confirmation modal). Use `Button` variants: Secondary for Archive, Danger for Delete.
- Backend endpoints validate ownership and perform operation.

### 7. Duplicate Entry
- "Duplicate" button in Actions cell (use `Button variant="ghost" size="sm"`).
- `POST /api/research/:id/duplicate` creates a new entry with same fields (title, content, type, tags, topic_ids) but new timestamps. Attachments are not duplicated (or optionally copied? simpler: skip attachments).
- On success, refetch list and show toast.

### 8. Favorite / Pin
- Add column `is_pinned BOOLEAN DEFAULT false` to `research_entries` via migration.
- In UI: pinned entries appear at the top of the list (sorted first). Add a pin/unpin toggle button (use `Pin` icon from lucide-react) in the Actions cell.
- `PATCH /api/research/:id` with `{ is_pinned: true/false }`.

### 9. Date Range Filter
- Add two date inputs (From / To) in the filter bar, using `Input` with `type="date"`.
- Send `date_from` and `date_to` as query params.
- Backend filters `created_at` accordingly.

### 10. Citation Quick-Copy
- For entries of type `journal` or `citation`, show a "Copy Citation" button (use `Clipboard` icon) in the Actions cell.
- Client-side utility function `generateCitation(entry, style)` that creates a formatted string. Support APA, MLA, IEEE styles. Use available fields: `title`, `source`, `tags`, `created_at` for year.
- Clicking copies to clipboard and shows a success toast (`useToast()`).

---

## Design & Code Quality Constraints (from SKILL.md)

- **Use only Tailwind classes.** No inline styles except the explicit exception for dynamic topic color dots and progress bar widths (see SKILL.md §10 NEVER #2).
- **Every color class must have a `dark:` variant.** Follow the exact color tokens in SKILL.md §2.1–§2.2.
- **Typography must use the predefined compound classes** from SKILL.md §3.2 (Page Title, Section Heading, Body Default, Caption, etc.). Do not invent new text styles.
- **Four-state handling:** Every data-driven component must handle loading (skeleton), error (ErrorState with retry), empty (EmptyState with CTA), and data states. Use the shared components from §5.9–§5.11.
- **Modals:** Always use the `Modal` component from `components/ui/Modal.jsx`. Never render modals inside the component tree.
- **Buttons:** Always use the `Button` component. No raw `<button>` elements.
- **Forms:** Use `Input`, `Textarea`, `Select` from `components/ui/Input.jsx`. No raw `<input>` or `<select>`.
- **Toast:** Use `useToast()` hook for success/error feedback.
- **Data fetching:** Use `useApi` hook.
- **Spacing:** Follow the spacing scale in SKILL.md §4.2. Use `space-y-6` for section gaps, `gap-4` for card grids, etc.
- **Dark mode:** Must work perfectly. Test every component with the `dark:` variants.
- **No external UI libraries** (no MUI, no shadcn, no Chakra). The only allowed third-party packages are `prism-react-renderer` (if used), `marked` (if used), `@uiw/react-md-editor`, and `multer` (server). For syntax highlighting in snippets (not in research), use `prism-react-renderer`. For research, the markdown editor is `@uiw/react-md-editor`.

---

## Implementation Order
1. Read all required files (PROJECT_STATE.md, SKILL.md, existing research files).
2. Create migration `004_research_topics.sql` (topics + pivot + attachments + is_pinned on entries).
3. Update `server/models/research.model.js` with new functions.
4. Update `server/routes/research.js` with new endpoints and validation.
5. Update `server/index.js` for static file serving (`uploads`).
6. Install packages: `npm install multer` in server, `npm install @uiw/react-md-editor` in client.
7. Build new frontend components (`TopicSidebar`, `CreateTopicModal`, `TopicBadge`, `TopicSelector`, etc.).
8. Modify `Research.jsx` to integrate topic sidebar and all new features.
9. Modify `CreateResearchModal.jsx` and `ResearchEntryRow.jsx`.
10. Test all states (loading, empty, error, data) for every component.

**Please produce all necessary file changes/additions. Show complete file contents or clear diffs. Start by reading the listed files.**