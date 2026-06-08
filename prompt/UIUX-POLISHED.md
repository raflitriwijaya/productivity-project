# Stoic Garden — UI/UX Modernization Prompt

---

## Phase 0 – Foundation

Read **PROJECT_STATE.md** and **SKILL.md** in full. Confirm understanding of:
- Existing stack, routes, DB schema, deployment
- All design tokens, typography system, spacing/layout
- Component API specs (Button, Card, Input, DataTable, Modal, Toast, Badge, Skeleton, EmptyState, ErrorState, StatCard)
- State handling patterns, module page template, routing
- **ALL** ALWAYS / NEVER rules

---

## Phase 1 – Design Philosophy: "The Stoic Garden"

Reframe the entire UI around this philosophy:
- **Nature (Agritech)** – growth, patience, sustainability
- **Engineering** – precision, structure, logic
- **Entrepreneurship** – fire, energy, innovation
- **Philosophy** – depth, contemplation, meaning

The new visual identity must feel like a **modern laboratory in a garden** — calm, professional, grounded, with moments of warm energy.

---

## Phase 2 – New Color Palette (Replace Emerald entirely)

### Primary Accent: Moss Green
- Represents nature, persistence, agritech roots.
- Use **custom Tailwind colors** under `moss` namespace.
- Base: `#4A7C59` → `moss-500`

### Secondary Accent: Terracotta
- Represents earth, craft, hardware engineering.
- Namespace: `terracotta`, base `#C67A4B` → `terracotta-500`

### Tertiary / Highlight: Amber Ember
- Represents fire of innovation, call-to-action.
- Namespace: `ember`, base `#E8A838` → `ember-500`

### Design Tokens (full replacement for §2.1)

All existing `emerald`-based classes must be replaced according to this mapping:

| Old Role | New Role |
|----------|----------|
| `emerald` accent solid fill | `moss` solid fill |
| `emerald` text/icon | `moss` text/icon |
| `emerald` border | `moss` border |
| `emerald` subtle bg | `moss` subtle bg |
| `emerald` focus ring | `moss` focus ring |
| Danger/Delete | `red` (unchanged) |
| Warning | `amber` (unchanged) |
| Info | `blue` (unchanged) |
| Success (status) | `moss` (instead of emerald) |

Additionally:
- Introduce **terracotta** for secondary elements (e.g., badges for hardware/embedded categories, progress bars, subtle highlights).
- Introduce **ember** for primary action buttons, active states, and key highlights (replacing the role of solid accent for CTA; moss remains for less urgent actions or state indicators).

**Button mapping:**
- `primary` variant → background `ember`, hover `ember-600`, text white
- `secondary` variant → unchanged base style
- `danger` → unchanged
- `ghost` → unchanged
- Focus ring for all buttons → `moss`

**Badge mapping update:**
- New category-specific badge variants: `moss` (agritech/nature), `terracotta` (hardware), `ember` (startup/innovation), plus existing red/amber/blue/gray for statuses.

---

### Custom Color Definitions for tailwind.config.js

```js
colors: {
  moss: {
    50: '#EDF2EE',
    100: '#D4E3D7',
    200: '#B5CFBB',
    300: '#8FB996',
    400: '#6BA37A',
    500: '#4A7C59',  // base
    600: '#3D6548',
    700: '#304F39',
    800: '#233A2A',
    900: '#17271C',
    950: '#0E1912',
  },
  terracotta: {
    50: '#F9F2EC',
    100: '#F2E3D6',
    200: '#E6C7AD',
    300: '#D9AA84',
    400: '#CD8E5B',
    500: '#C67A4B',  // base
    600: '#B36640',
    700: '#8F4E32',
    800: '#6B3A25',
    900: '#472618',
    950: '#2E1810',
  },
  ember: {
    50: '#FEF7EB',
    100: '#FCEDC6',
    200: '#F9DFA0',
    300: '#F5CE7A',
    400: '#F0BB54',
    500: '#E8A838',  // base
    600: '#D4942E',
    700: '#B07A25',
    800: '#8C601D',
    900: '#684715',
    950: '#2E1F0A',
  },
}
```

These colors must be added to `tailwind.config.js` under `theme.extend.colors`. The existing `fontFamily` and `animation` extensions remain untouched.

---

### Light/Dark Tokens Table (to be implemented in every component)

#### Backgrounds (unchanged structure, just ensure consistency)
- Page: `bg-stone-50 dark:bg-gray-900`
- Card: `bg-white dark:bg-gray-800`
- Subtle: `bg-stone-100 dark:bg-gray-700`

#### Text (unchanged)

#### Accent Usage Table

| Role | Light | Dark |
|------|-------|------|
| **Primary Button** | `bg-ember-500 text-white hover:bg-ember-600` | `dark:bg-ember-500 dark:hover:bg-ember-600` |
| **Secondary Button** | `bg-white border-stone-200 text-stone-700 hover:bg-stone-50` | `dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700` |
| **Moss Solid Fill** (used for active sidebar, selected tabs, success states) | `bg-moss-500 text-white` | `dark:bg-moss-500` |
| **Moss Text/Icon** | `text-moss-600` | `dark:text-moss-400` |
| **Terracotta Solid** (used for engineering/hardware badges) | `bg-terracotta-500 text-white` | `dark:bg-terracotta-500` |
| **Terracotta Text** | `text-terracotta-600` | `dark:text-terracotta-400` |
| **Focus Ring** | `ring-moss-500` | `dark:ring-moss-400` |
| **Sidebar Active** | `bg-moss-50 text-moss-700` | `dark:bg-moss-950/50 dark:text-moss-400` |

---

### General UX Improvements (Modernization)

While updating colors, enhance the UI with subtle modern touches:
1. **Micro-interactions**: Add `transition-all duration-200` to cards on hover (slight scale `hover:scale-[1.01]` with shadow increase).
2. **Skeleton loaders**: Use `moss` tint for pulse (instead of stone/gray) to feel more alive.
3. **Empty states**: Introduce illustrations using Lucide icons with `moss` accent.
4. **DataTables**: Add subtle `hover:bg-moss-50/30` on rows.
5. **Modals**: Slightly increase border radius to `rounded-2xl` for a modern soft feel.
6. **Toast notifications**: Use `moss` for success, `ember` for info, keep red/amber for error/warning.
7. **Sidebar**: Group labels use `text-terracotta-400` for a warm touch. Logo can use `moss` with `ember` dot.
8. **Stat cards**: Add gradient underline accent (using `bg-gradient-to-r from-moss-500 to-ember-500` for the bottom border).
9. **Progress bars**: Update `ProgressBar.jsx` to use `moss` for fill and `terracotta` for warning thresholds (instead of emerald/amber).

---

## Phase 3 – Implementation Scope

**ALL files containing `emerald` must be updated.** This includes, but is not limited to:

### Tailwind Configuration
- `client/tailwind.config.js` — add custom colors

### UI Components (atomic)
- `components/ui/Button.jsx` — replace variant color classes
- `components/ui/Badge.jsx` — add `moss`, `terracotta`, `ember` variants
- `components/ui/Card.jsx` — adjust highlight variant to `moss` border
- `components/ui/Input.jsx` — focus ring to `moss`
- `components/ui/Modal.jsx` — radius, focus
- `components/ui/DataTable.jsx` — row hover, sorted header color
- `components/ui/Skeleton.jsx` — pulse tint
- `components/ui/StatCard.jsx` — accent underline
- `components/ui/EmptyState.jsx` — icon color
- `components/ui/ErrorState.jsx` — icon color

### Layout
- `components/layout/AppLayout.jsx` — sidebar nav active color, theme toggle hover

### Module-specific Components (all that reference emerald)
- `components/todo/TodoRow.jsx`
- `components/todo/CreateTodoModal.jsx`
- `components/finance/TransactionRow.jsx`
- `components/finance/CreateTransactionModal.jsx`
- `components/finance/FinanceSummaryCards.jsx`
- `components/finance/ProgressBar.jsx` — update color scale
- `components/finance/charts/TrendChart.jsx`, `DonutChart.jsx` — replace fill colors
- `components/learning/LearningRow.jsx`
- `components/learning/CreateLearningModal.jsx`
- `components/research/ResearchEntryRow.jsx`
- `components/research/CreateResearchModal.jsx`
- `components/research/ResearchSummaryCards.jsx`
- `components/engineer/*` (all files created earlier) — use new colors

### Pages
- All pages that use StatCard, Badge, Button with specific variant mapping (e.g., priority badges) must be checked for color consistency.

### Hooks
- `useToast.jsx` — toast variant colors

---

## Phase 4 – Adherence to Rules

- **Every** color-bearing class must have a `dark:` variant.
- Maintain **four-state handling** (loading, error, empty, data).
- No hardcoded hex colors; use the custom Tailwind classes.
- No external UI libraries.
- All components remain responsive.
- Keep `snake_case` for API communication.
- Use `useApi` / `useToast` / `useTheme` as before.
- PATCH for edits.
- All existing functionalities must remain unchanged — only visual and UX improvements.

---

## Phase 5 – Deliverables

Produce the complete updated content for:
1. `client/tailwind.config.js`
2. All UI components listed above
3. All module components that contain color classes
4. Layout components
5. Any page-level adjustments needed

If a file only needs a few class replacements, output the entire file for safety. Ensure consistency across the entire application.

**Goal**: A cohesive, modern, "Stoic Garden" aesthetic that embodies agritech, engineering, startup fire, and philosophical depth — across every pixel of the application.