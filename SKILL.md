# SKILL.MD — Rafli's Productivity Suite
### Version 2.0 — Comprehensive Design & Development Guide

> **Purpose**: This is the single source of truth for all AI-assisted code generation in this project. Any AI receiving this file must produce code that is visually, architecturally, and behaviorally identical to existing modules. No interpretation, no improvisation — follow every rule exactly.

---

## TABLE OF CONTENTS

1. [Brand Identity & Philosophy](#1-brand-identity--philosophy)
2. [Design Tokens — Complete Visual Language](#2-design-tokens--complete-visual-language)
3. [Typography System](#3-typography-system)
4. [Spacing & Layout System](#4-spacing--layout-system)
5. [Component API Specifications](#5-component-api-specifications)
6. [Full-Stack Conventions](#6-full-stack-conventions)
7. [State Handling Templates](#7-state-handling-templates)
8. [Module Page Template](#8-module-page-template)
9. [Routes & Navigation](#9-routes--navigation)
9a. [Component Index](#9a-component-index-canonical-location-of-every-referenced-component)
10. [AI Generation Rules — ALWAYS / NEVER](#10-ai-generation-rules--always--never)

---

## 1. Brand Identity & Philosophy

### Core Philosophy
**"The Researcher's Laboratory"** — Every screen is a workbench. Clean, purposeful, and free of distraction. The interface exists to serve thinking, not to impress.

### Persona
Rafli is an engineer, agritech founder, and future Nobel researcher. The UI must feel like the desk of a serious, disciplined person: organized, warm (not cold), and deeply functional. No decorative noise. No playful gradients. Precision over flair.

### Design Principles (in priority order)

| Priority | Principle | Implication |
|----------|-----------|-------------|
| 1 | **Intellectual Rigor** | Every UI element must earn its place. If it doesn't serve a function, remove it. |
| 2 | **Research-First** | Data display is paramount. Tables, metrics, and logs must be highly legible. |
| 3 | **Radical Efficiency** | Minimize clicks. Primary actions must always be reachable without scrolling. |
| 4 | **Independence** | No third-party UI libraries (shadcn, MUI, etc.). Build from Tailwind primitives only. |

---

## 2. Design Tokens — Complete Visual Language

### 2.1 Color System

Every color role below has four values: the semantic name, the hex code, its Tailwind utility class for light mode, and its Tailwind utility class for dark mode. **Always use the Tailwind class. Never hardcode hex values in JSX.**

#### Backgrounds

| Role | Light Hex | Light Tailwind | Dark Hex | Dark Tailwind |
|------|-----------|----------------|----------|---------------|
| Page Background | `#FAF8F5` | `bg-stone-50` | `#111827` | `dark:bg-gray-900` |
| Card / Panel | `#FFFFFF` | `bg-white` | `#1F2937` | `dark:bg-gray-800` |
| Subtle Surface (nested cards, code blocks) | `#F5F5F4` | `bg-stone-100` | `#374151` | `dark:bg-gray-700` |
| Sidebar | `#FFFFFF` | `bg-white` | `#1F2937` | `dark:bg-gray-800` |

#### Text

| Role | Light Hex | Light Tailwind | Dark Hex | Dark Tailwind |
|------|-----------|----------------|----------|---------------|
| Primary Text | `#1C1917` | `text-stone-900` | `#F9FAFB` | `dark:text-gray-50` |
| Secondary Text (labels, captions) | `#78716C` | `text-stone-500` | `#9CA3AF` | `dark:text-gray-400` |
| Disabled Text | `#A8A29E` | `text-stone-400` | `#6B7280` | `dark:text-gray-500` |
| Placeholder Text | `#A8A29E` | `placeholder-stone-400` | `#6B7280` | `dark:placeholder-gray-500` |
| Inverted Text (on accent bg) | `#FFFFFF` | `text-white` | `#FFFFFF` | `text-white` |

#### Borders & Dividers

| Role | Light Hex | Light Tailwind | Dark Hex | Dark Tailwind |
|------|-----------|----------------|----------|---------------|
| Default Border | `#E7E5E4` | `border-stone-200` | `#374151` | `dark:border-gray-700` |
| Subtle Divider | `#F5F5F4` | `divide-stone-100` | `#1F2937` | `dark:divide-gray-800` |
| Focus Ring (all interactive elements) | `#10B981` | `ring-emerald-500` | `#34D399` | `dark:ring-emerald-400` |
| Ring Offset (gap behind focus ring) | `#FFFFFF` | `ring-offset-white` | `#111827` | `dark:ring-offset-gray-900` |

#### Accent (Brand — Emerald)

There are two distinct accent uses. **Solid fill** = white text sits on the accent (buttons, active pills) → use a darker emerald in dark mode so white stays legible. **On-surface** = accent text/border/icon sits on a neutral surface → use a lighter emerald in dark mode for contrast. Do not mix them.

| Role | Light Hex | Light Tailwind | Dark Hex | Dark Tailwind |
|------|-----------|----------------|----------|---------------|
| Accent — Solid Fill (white text on it) | `#059669` | `bg-emerald-600` | `#10B981` | `dark:bg-emerald-500` |
| Accent — Solid Fill Hover | `#047857` | `hover:bg-emerald-700` | `#059669` | `dark:hover:bg-emerald-600` |
| Accent — Text / Icon (on a surface) | `#059669` | `text-emerald-600` | `#34D399` | `dark:text-emerald-400` |
| Accent — Border (on a surface) | `#6EE7B7` | `border-emerald-300` | `#065F46` | `dark:border-emerald-800` |
| Accent — Subtle BG | `#ECFDF5` | `bg-emerald-50` | `#064E3B` | `dark:bg-emerald-950` |

#### Semantic Status Colors

| Status | Light Tailwind (bg / text / border) | Dark Tailwind (bg / text / border) |
|--------|-------------------------------------|-------------------------------------|
| Success | `bg-emerald-50 text-emerald-700 border-emerald-200` | `dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800` |
| Warning | `bg-amber-50 text-amber-700 border-amber-200` | `dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800` |
| Error / Danger | `bg-red-50 text-red-700 border-red-200` | `dark:bg-red-950 dark:text-red-400 dark:border-red-800` |
| Info | `bg-blue-50 text-blue-700 border-blue-200` | `dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800` |
| Neutral | `bg-stone-50 text-stone-700 border-stone-200` | `dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700` |

---

## 3. Typography System

**UI font**: `Inter` for all interface text. **Monospace**: the default Tailwind mono stack (`font-mono`) is permitted **only** for code, IDs, and technical strings (see the Monospace row in §3.1). No other font families are permitted.

```html
<!-- In index.html -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### tailwind.config.js (complete — this is the single source of truth for Tailwind setup)

```js
/** @type {import('tailwindcss').Config} */
export default {
  // REQUIRED: 'class' strategy. The theme toggle adds/removes `.dark` on
  // <html> manually (see useTheme, §5.5). Without this line every `dark:`
  // variant would follow the OS setting and the toggle would do nothing.
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      keyframes: {
        'slide-up': {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-out': {
          '0%':   { opacity: '1' },
          '100%': { opacity: '0' },
        },
      },
      animation: {
        'slide-up': 'slide-up 150ms ease-out',
        'fade-out': 'fade-out 150ms ease-in forwards',
      },
    },
  },
  plugins: [],
};
```

### 3.1 Type Scale

| Role | Size | Tailwind Size | Weight | Tailwind Weight | Line Height | Letter Spacing | Usage |
|------|------|---------------|--------|-----------------|-------------|----------------|-------|
| Page Title | 24px | `text-2xl` | 700 | `font-bold` | 1.25 | `-0.02em` (`tracking-[-0.02em]`) | Page `<h1>` |
| Section Heading | 18px | `text-lg` | 600 | `font-semibold` | 1.3 | `-0.01em` (`tracking-[-0.01em]`) | Card headers, section `<h2>`, **modal titles** |
| Subsection Heading | 14px | `text-sm` | 600 | `font-semibold` | 1.4 | `0` | Table headers, sidebar nav labels |
| Body Default | 14px | `text-sm` | 400 | `font-normal` | 1.5 | `0` | General body copy, descriptions |
| Body Small | 12px | `text-xs` | 400 | `font-normal` | 1.5 | `0` | Secondary info, card subtitles |
| Caption | 11px | `text-[11px]` | 400 | `font-normal` | 1.4 | `0.01em` | Timestamps, metadata, footnotes |
| Overline | 10px | `text-[10px]` | 600 | `font-semibold` | 1.2 | `0.1em` (`tracking-widest`) | Sidebar section labels, logo subtext |
| Label | 12px | `text-xs` | 500 | `font-medium` | 1 | `0.025em` (`tracking-wide`) | Form labels, badge text |
| Monospace | 13px | `text-[13px] font-mono` | 400 | `font-normal` | 1.6 | `0` | Code, IDs, technical strings |

### 3.2 Tailwind Typography Utilities (Compound Classes)

Use these exact compound classes for common text patterns. Do not assemble ad-hoc:

```
Page Title:       "text-2xl font-bold text-stone-900 dark:text-gray-50 tracking-[-0.02em]"
Section Heading:  "text-lg font-semibold text-stone-900 dark:text-gray-50 tracking-[-0.01em]"
Modal Title:      "text-lg font-semibold text-stone-900 dark:text-gray-50 tracking-[-0.01em]"
Card Header:      "text-sm font-semibold text-stone-900 dark:text-gray-50"
Body Default:     "text-sm text-stone-900 dark:text-gray-50"
Body Muted:       "text-sm text-stone-500 dark:text-gray-400"
Body Small:       "text-xs text-stone-500 dark:text-gray-400"
Caption:          "text-[11px] text-stone-400 dark:text-gray-500"
Overline:         "text-[10px] font-semibold text-stone-400 dark:text-gray-500 tracking-widest uppercase"
Form Label:       "text-xs font-medium text-stone-700 dark:text-gray-300 tracking-wide uppercase"
```

---

## 4. Spacing & Layout System

### 4.1 Core Layout

The visual frame (sidebar + offset) is owned entirely by `AppLayout` (§9.3). **Page components never apply a sidebar offset themselves** — they only render the inner content wrapper below.

```
AppLayout main region:  lg:pl-64   (offsets content for the fixed sidebar at lg+ only;
                                     below lg the sidebar is an overlay drawer, no offset)
Page content wrapper:    max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6
Sidebar width:           w-64 (fixed, left, lg+ only)
Section gap:             space-y-6
```

### 4.2 Spacing Scale (in use)

| Token | Value | Tailwind | Use Case |
|-------|-------|----------|----------|
| xs | 4px | `gap-1` / `p-1` | Icon gaps, tight inline spacing |
| sm | 8px | `gap-2` / `p-2` | Badge padding, compact rows |
| md | 16px | `gap-4` / `p-4` | Standard element spacing |
| lg | 24px | `gap-6` / `p-6` | Card padding, section spacing |
| xl | 32px | `gap-8` / `p-8` | Page-level padding |
| 2xl | 48px | `gap-12` / `p-12` | Major section breaks |

### 4.3 Border Radius Scale

| Role | Value | Tailwind |
|------|-------|----------|
| Input, Button | 8px | `rounded-lg` |
| Card | 12px | `rounded-xl` |
| Modal panel | 12px | `rounded-xl` |
| Badge, Tag | 6px | `rounded-md` |
| Tooltip | 6px | `rounded-md` |
| Avatar (circle) | 50% | `rounded-full` |

### 4.4 Shadow Scale

| Role | Tailwind |
|------|----------|
| Card default | `shadow-sm` |
| Card hover / elevated | `shadow-md` |
| Modal overlay | `shadow-xl` |
| Dropdown | `shadow-lg` |
| Sidebar | none — separated by `border-r` only (no shadow) |

### 4.5 Z-Index Scale

Use **only** these values. No other `z-*` values are permitted.

| Layer | Tailwind | Notes |
|-------|----------|-------|
| Base content | (none) | Default stacking |
| Sidebar / sticky headers | `z-30` | Fixed sidebar |
| Dropdown / popover | `z-40` | Menus, selects-as-popover |
| Mobile sidebar drawer + its backdrop | `z-40` | Below modals |
| Modal backdrop + panel | `z-50` | Above everything except toasts |
| Toasts | `z-[60]` | Always on top so confirmations are never hidden behind a modal |

---

## 5. Component API Specifications

Each component section defines: all variants, all sizes, exact Tailwind class strings, and explicit behavior rules.

---

### 5.1 Button

#### Behavior Rules
- **Primary**: The single most important action on a page or modal. Always Emerald bg. One per view where possible.
- **Secondary**: Supporting actions (Cancel, Back, Export). White bg with border.
- **Danger**: Destructive actions (Delete, Archive). Red bg. Always preceded by a confirmation step.
- **Ghost**: Tertiary / inline actions (Edit, View). No bg, no border until hover.
- **Disabled**: Any button in a loading or unavailable state. Reduced opacity, `cursor-not-allowed`, no pointer events.
- All buttons: `font-medium`, transition on bg color, focus ring for accessibility, `inline-flex items-center gap-2`.

#### Variants × Sizes

**Size classes** (applied to all variants):

| Size | Tailwind Padding | Text Size | Use Case |
|------|-----------------|-----------|----------|
| `sm` | `px-3 py-1.5` | `text-xs` | Compact tables, inline row actions |
| `md` | `px-4 py-2` | `text-sm` | Default for forms and cards |
| `lg` | `px-6 py-2.5` | `text-sm` | Primary page actions, modal footers |

**Variant base classes** (combined with size):

```
PRIMARY (md):
  "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
   bg-emerald-600 text-white
   hover:bg-emerald-700
   focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400
   focus:ring-offset-2 ring-offset-white dark:ring-offset-gray-900
   dark:bg-emerald-500 dark:hover:bg-emerald-600
   transition-colors duration-150"

SECONDARY (md):
  "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
   bg-white text-stone-700 border border-stone-200
   hover:bg-stone-50 hover:border-stone-300
   focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400
   focus:ring-offset-2 ring-offset-white dark:ring-offset-gray-900
   dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600
   dark:hover:bg-gray-700
   transition-colors duration-150"

DANGER (md):
  "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
   bg-red-600 text-white
   hover:bg-red-700
   focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-red-400
   focus:ring-offset-2 ring-offset-white dark:ring-offset-gray-900
   dark:bg-red-500 dark:hover:bg-red-600
   transition-colors duration-150"

GHOST (md):
  "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
   bg-transparent text-stone-600
   hover:bg-stone-100 hover:text-stone-900
   focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400
   focus:ring-offset-2 ring-offset-white dark:ring-offset-gray-900
   dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100
   transition-colors duration-150"

DISABLED (any variant — add to the variant's base):
  "opacity-50 cursor-not-allowed pointer-events-none"
```

#### React Component

```jsx
// components/ui/Button.jsx
const variants = {
  primary: 'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-600 dark:focus:ring-emerald-400',
  secondary: 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-50 hover:border-stone-300 focus:ring-emerald-500 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700 dark:focus:ring-emerald-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 dark:bg-red-500 dark:hover:bg-red-600 dark:focus:ring-red-400',
  ghost: 'bg-transparent text-stone-600 hover:bg-stone-100 hover:text-stone-900 focus:ring-emerald-500 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100 dark:focus:ring-emerald-400',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-2.5 text-sm',
};

export function Button({ variant = 'primary', size = 'md', disabled = false, children, className = '', ...props }) {
  return (
    <button
      className={`
        inline-flex items-center gap-2 rounded-lg font-medium
        focus:outline-none focus:ring-2 focus:ring-offset-2 ring-offset-white dark:ring-offset-gray-900
        transition-colors duration-150
        ${variants[variant]}
        ${sizes[size]}
        ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}
        ${className}
      `}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
```

---

### 5.2 Card

#### Behavior Rules
- Cards are the primary content containers. Every distinct data group lives in its own card.
- Cards never nest more than one level deep. Use a subtle surface (`bg-stone-100 dark:bg-gray-700`) for inner groupings.
- The card header (`CardHeader`) contains the card title and optional actions (buttons, badges).
- The card body (`CardBody`) contains the main content with consistent internal padding.

#### Variants

```
DEFAULT:
  "bg-white dark:bg-gray-800
   rounded-xl border border-stone-200 dark:border-gray-700
   shadow-sm p-6"

FLAT (no shadow — for use inside another card/section):
  "bg-stone-50 dark:bg-gray-700
   rounded-xl border border-stone-200 dark:border-gray-600
   p-6"

HIGHLIGHT (accent border — for featured/important cards):
  "bg-white dark:bg-gray-800
   rounded-xl border-2 border-emerald-500 dark:border-emerald-400
   shadow-sm p-6"
```

#### React Component

```jsx
// components/ui/Card.jsx
export function Card({ variant = 'default', className = '', children }) {
  const variants = {
    default: 'bg-white dark:bg-gray-800 rounded-xl border border-stone-200 dark:border-gray-700 shadow-sm',
    flat: 'bg-stone-50 dark:bg-gray-700 rounded-xl border border-stone-200 dark:border-gray-600',
    highlight: 'bg-white dark:bg-gray-800 rounded-xl border-2 border-emerald-500 dark:border-emerald-400 shadow-sm',
  };
  return (
    <div className={`${variants[variant]} ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, className = '' }) {
  return (
    <div className={`flex items-start justify-between p-6 pb-0 ${className}`}>
      <div>
        <h3 className="text-sm font-semibold text-stone-900 dark:text-gray-50">{title}</h3>
        {subtitle && <p className="text-xs text-stone-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0 ml-4">{action}</div>}
    </div>
  );
}

export function CardBody({ className = '', children }) {
  return (
    <div className={`p-6 ${className}`}>
      {children}
    </div>
  );
}
```

---

### 5.3 Input

#### Behavior Rules
- Always pair with a `<label>`. Never use placeholder text as a substitute for a label.
- The label uses `Form Label` typography (see §3.2).
- Show inline error messages below the field in `text-xs text-red-600 dark:text-red-400`.
- Show helper text below the field in `text-xs text-stone-500 dark:text-gray-400`.
- On error state, the border becomes red (`border-red-300 dark:border-red-600`) and the focus ring becomes red.

#### Variants

```
DEFAULT:
  "w-full px-4 py-2 rounded-lg text-sm
   bg-white dark:bg-gray-700
   border border-stone-200 dark:border-gray-600
   text-stone-900 dark:text-gray-50
   placeholder-stone-400 dark:placeholder-gray-500
   focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400
   focus:border-transparent
   transition-colors duration-150"

ERROR:
  "w-full px-4 py-2 rounded-lg text-sm
   bg-white dark:bg-gray-700
   border border-red-300 dark:border-red-600
   text-stone-900 dark:text-gray-50
   placeholder-stone-400 dark:placeholder-gray-500
   focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-red-400
   focus:border-transparent
   transition-colors duration-150"

DISABLED:
  "opacity-50 cursor-not-allowed bg-stone-50 dark:bg-gray-800"
  (append to DEFAULT)
```

#### React Component

```jsx
// components/ui/Input.jsx
export function Input({ label, id, error, helperText, disabled = false, className = '', ...props }) {
  const baseClasses = `
    w-full px-4 py-2 rounded-lg text-sm
    bg-white dark:bg-gray-700
    text-stone-900 dark:text-gray-50
    placeholder-stone-400 dark:placeholder-gray-500
    focus:outline-none focus:ring-2 focus:border-transparent
    transition-colors duration-150
    ${disabled ? 'opacity-50 cursor-not-allowed bg-stone-50 dark:bg-gray-800' : ''}
  `;
  const stateClasses = error
    ? 'border border-red-300 dark:border-red-600 focus:ring-red-500 dark:focus:ring-red-400'
    : 'border border-stone-200 dark:border-gray-600 focus:ring-emerald-500 dark:focus:ring-emerald-400';

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-stone-700 dark:text-gray-300 tracking-wide uppercase mb-1.5">
          {label}
        </label>
      )}
      <input
        id={id}
        disabled={disabled}
        className={`${baseClasses} ${stateClasses} ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
      {helperText && !error && <p className="mt-1 text-xs text-stone-500 dark:text-gray-400">{helperText}</p>}
    </div>
  );
}

export function Textarea({ label, id, error, helperText, disabled = false, rows = 4, className = '', ...props }) {
  const baseClasses = `
    w-full px-4 py-2 rounded-lg text-sm resize-none
    bg-white dark:bg-gray-700
    text-stone-900 dark:text-gray-50
    placeholder-stone-400 dark:placeholder-gray-500
    focus:outline-none focus:ring-2 focus:border-transparent
    transition-colors duration-150
    ${disabled ? 'opacity-50 cursor-not-allowed bg-stone-50 dark:bg-gray-800' : ''}
  `;
  const stateClasses = error
    ? 'border border-red-300 dark:border-red-600 focus:ring-red-500 dark:focus:ring-red-400'
    : 'border border-stone-200 dark:border-gray-600 focus:ring-emerald-500 dark:focus:ring-emerald-400';

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-stone-700 dark:text-gray-300 tracking-wide uppercase mb-1.5">
          {label}
        </label>
      )}
      <textarea
        id={id}
        rows={rows}
        disabled={disabled}
        className={`${baseClasses} ${stateClasses} ${className}`}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
      {helperText && !error && <p className="mt-1 text-xs text-stone-500 dark:text-gray-400">{helperText}</p>}
    </div>
  );
}

export function Select({ label, id, error, helperText, disabled = false, children, className = '', ...props }) {
  const stateClasses = error
    ? 'border border-red-300 dark:border-red-600 focus:ring-red-500 dark:focus:ring-red-400'
    : 'border border-stone-200 dark:border-gray-600 focus:ring-emerald-500 dark:focus:ring-emerald-400';
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-stone-700 dark:text-gray-300 tracking-wide uppercase mb-1.5">
          {label}
        </label>
      )}
      <select
        id={id}
        disabled={disabled}
        className={`
          w-full px-4 py-2 rounded-lg text-sm
          bg-white dark:bg-gray-700
          text-stone-900 dark:text-gray-50
          focus:outline-none focus:ring-2 focus:border-transparent transition-colors duration-150
          ${disabled ? 'opacity-50 cursor-not-allowed bg-stone-50 dark:bg-gray-800' : ''}
          ${stateClasses}
          ${className}
        `}
        {...props}
      >
        {children}
      </select>
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
      {helperText && !error && <p className="mt-1 text-xs text-stone-500 dark:text-gray-400">{helperText}</p>}
    </div>
  );
}
```

---

### 5.4 Table

#### Behavior Rules
- Tables always have a `<thead>` with uppercase, letter-spaced headers using the `Form Label` style.
- Rows use zebra striping: odd rows white, even rows `bg-stone-50 dark:bg-gray-700/50`.
- The last column is always "Actions" for row-level operations (Edit, Delete).
- Tables are wrapped in a `Card` component with `overflow-x-auto` for responsiveness.
- Clicking a sortable column header adds an arrow indicator and re-sorts. Sorted column header gets `text-emerald-600 dark:text-emerald-400`.
- Empty state renders inside the table body (see §7).

#### Tailwind Classes

```
TABLE WRAPPER:    "w-full overflow-x-auto"
TABLE:            "w-full text-sm"
THEAD ROW:        "border-b border-stone-200 dark:border-gray-700"
TH:               "px-6 py-3 text-left text-xs font-medium text-stone-500 dark:text-gray-400
                   tracking-wide uppercase whitespace-nowrap"
TH SORTABLE:      add "cursor-pointer hover:text-stone-700 dark:hover:text-gray-200 select-none"
TH SORTED:        add "text-emerald-600 dark:text-emerald-400"
TBODY ROW (odd):  "bg-white dark:bg-gray-800"
TBODY ROW (even): "bg-stone-50 dark:bg-gray-700/50"
TBODY ROW HOVER:  add "hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors duration-100"
TD:               "px-6 py-4 whitespace-nowrap text-sm text-stone-900 dark:text-gray-50"
TD SECONDARY:     "px-6 py-4 whitespace-nowrap text-sm text-stone-500 dark:text-gray-400"
TD ACTIONS:       "px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2"
```

#### React Component — `DataTable`

This is the canonical table referenced throughout the spec (including the `<DataTable />` in §8). Always render tables through it — never hand-roll `<table>` markup in pages.

**`columns` contract** — an array of objects:

| Field | Type | Required | Meaning |
|-------|------|----------|---------|
| `key` | string | yes | Property on each row object (snake_case, e.g. `due_date`). Also the React key for the column. |
| `header` | string | yes | Column header label. |
| `sortable` | boolean | no | If `true`, header is clickable and sorts by `key`. Default `false`. |
| `align` | `'left' \| 'right'` | no | Cell alignment. Default `'left'`. Use `'right'` for the actions column. |
| `render` | `(row) => ReactNode` | no | Custom cell renderer. If omitted, `row[key]` is rendered as-is. |

```jsx
// components/ui/DataTable.jsx
import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

export function DataTable({ columns, items, initialSortKey = null }) {
  const [sort, setSort] = useState({ key: initialSortKey, dir: 'asc' });

  const sorted = useMemo(() => {
    if (!sort.key) return items;
    const col = columns.find(c => c.key === sort.key);
    if (!col?.sortable) return items;
    return [...items].sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      if (av === bv) return 0;
      const cmp = av > bv ? 1 : -1;
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [items, sort, columns]);

  const toggleSort = (key) =>
    setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-200 dark:border-gray-700">
            {columns.map(col => {
              const isSorted = sort.key === col.key;
              return (
                <th
                  key={col.key}
                  onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                  className={`px-6 py-3 text-xs font-medium tracking-wide uppercase whitespace-nowrap
                    ${col.align === 'right' ? 'text-right' : 'text-left'}
                    ${col.sortable ? 'cursor-pointer select-none hover:text-stone-700 dark:hover:text-gray-200' : ''}
                    ${isSorted ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-500 dark:text-gray-400'}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && isSorted && (
                      sort.dir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={row.id}
              className={`${i % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-stone-50 dark:bg-gray-700/50'}
                hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors duration-100`}
            >
              {columns.map(col => (
                <td
                  key={col.key}
                  className={`px-6 py-4 whitespace-nowrap text-sm text-stone-900 dark:text-gray-50
                    ${col.align === 'right' ? 'text-right font-medium space-x-2' : ''}`}
                >
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

> **Empty/loading/error are NOT handled inside `DataTable`.** The parent renders `LoadingSkeleton` / `ErrorState` / `EmptyState` (§5.9–5.11) and only mounts `DataTable` once `items.length > 0`, per the four-state rule in §7.

---

### 5.5 Sidebar

#### Behavior Rules
- The sidebar is fixed to the left and visible only at the `lg:` breakpoint and above (`hidden lg:flex`).
- Below `lg`, the sidebar is **not** rendered in place. The same inner content is rendered as an off-canvas drawer toggled by a hamburger button in the `TopBar`. The drawer + its backdrop are owned by `AppLayout` (§9.3), not by the `Sidebar` component itself.
- Navigation links use React Router's `NavLink`; active state is derived from `isActive`, never from manual `useLocation` comparisons.
- The active route link uses a **subtle emerald tint pill** (`bg-emerald-50 dark:bg-emerald-950/50`, emerald text) — not a solid fill. Inactive links are ghost with hover.
- The theme toggle (Light/Dark) lives at the bottom of the sidebar, above user info.
- Dark mode state is persisted to `localStorage` with key `"theme"` (see `useTheme`, §5.5 Dark Mode Logic).
- Logo/branding is at the top. Module navigation links are in the middle. Settings/Profile at the bottom.

#### Structure & Classes

```
SIDEBAR CONTAINER (desktop, lg+ only — the drawer variant in §9.3 reuses everything below it):
  "hidden lg:flex fixed left-0 top-0 h-full w-64
   bg-white dark:bg-gray-800
   border-r border-stone-200 dark:border-gray-700
   flex-col z-30"

SIDEBAR HEADER (logo area):
  "h-16 flex items-center px-6
   border-b border-stone-200 dark:border-gray-700"

LOGO TEXT:
  "text-sm font-bold text-stone-900 dark:text-gray-50 tracking-tight"
LOGO SUBTEXT:
  "text-[10px] text-stone-400 dark:text-gray-500 tracking-widest uppercase"

NAV SECTION:
  "flex-1 overflow-y-auto py-4 px-3 space-y-1"

NAV SECTION LABEL:
  "px-3 mb-1 text-[10px] font-semibold text-stone-400 dark:text-gray-500
   tracking-widest uppercase"

NAV LINK (inactive):
  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
   text-stone-600 dark:text-gray-400
   hover:bg-stone-100 dark:hover:bg-gray-700
   hover:text-stone-900 dark:hover:text-gray-100
   transition-colors duration-150"

NAV LINK (active):
  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
   bg-emerald-50 dark:bg-emerald-950/50
   text-emerald-700 dark:text-emerald-400"

SIDEBAR FOOTER:
  "p-4 border-t border-stone-200 dark:border-gray-700 space-y-2"

THEME TOGGLE BUTTON:
  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
   text-stone-600 dark:text-gray-400
   hover:bg-stone-100 dark:hover:bg-gray-700
   transition-colors duration-150"
```

#### Dark Mode Logic

```jsx
// hooks/useTheme.js
import { useState, useEffect } from 'react';

export function useTheme() {
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem('theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  return { isDark, toggle: () => setIsDark(d => !d) };
}
```

---

### 5.6 Modal

#### Behavior Rules
- Modals are rendered via a React portal to `document.body`, preventing z-index and overflow issues.
- The backdrop is `bg-black/50 backdrop-blur-sm`.
- Pressing `Escape` closes the modal. Clicking the backdrop closes the modal.
- The modal panel is centered both horizontally and vertically.
- Modals have three width sizes: `sm` (400px), `md` (560px), `lg` (720px).
- The modal footer always contains action buttons, right-aligned: Cancel (Secondary) on the left, Primary action on the right.
- Scroll the modal panel body (not the viewport) if content overflows.

#### Structure & Classes

```
BACKDROP:
  "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm
   flex items-center justify-center p-4"

PANEL (md = 560px):
  "relative w-full max-w-[560px] max-h-[90vh]
   bg-white dark:bg-gray-800
   rounded-xl shadow-xl
   flex flex-col overflow-hidden"

PANEL HEADER:
  "flex items-center justify-between px-6 py-4
   border-b border-stone-200 dark:border-gray-700 flex-shrink-0"

PANEL TITLE:
  "text-lg font-semibold text-stone-900 dark:text-gray-50 tracking-[-0.01em]"

CLOSE BUTTON:
  "p-1 rounded-md text-stone-400 hover:text-stone-600
   dark:text-gray-500 dark:hover:text-gray-300
   hover:bg-stone-100 dark:hover:bg-gray-700
   transition-colors duration-150"

PANEL BODY:
  "flex-1 overflow-y-auto px-6 py-4 space-y-4"

PANEL FOOTER:
  "flex items-center justify-end gap-3 px-6 py-4
   border-t border-stone-200 dark:border-gray-700 flex-shrink-0"
```

#### React Component

```jsx
// components/ui/Modal.jsx
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const sizeMap = { sm: 'max-w-[400px]', md: 'max-w-[560px]', lg: 'max-w-[720px]' };

export function Modal({ isOpen, onClose, title, size = 'md', children, footer }) {
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative w-full ${sizeMap[size]} max-h-[90vh] bg-white dark:bg-gray-800 rounded-xl shadow-xl flex flex-col overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 dark:border-gray-700 flex-shrink-0">
          <h2 id="modal-title" className="text-lg font-semibold text-stone-900 dark:text-gray-50 tracking-[-0.01em]">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-stone-400 hover:text-stone-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-stone-100 dark:hover:bg-gray-700 transition-colors duration-150"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {children}
        </div>
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-stone-200 dark:border-gray-700 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
```

---

### 5.7 Toast Notifications

#### Behavior Rules
- Toasts appear in the **bottom-right** corner of the viewport.
- Auto-dismiss after **4000ms**. Users can manually dismiss with an × button.
- Max **3 toasts** visible at once. Older ones push up as new ones appear.
- Four types: `success` (emerald), `error` (red), `warning` (amber), `info` (blue).
- Animate in with a slide-up + fade-in. Animate out with fade-out.

#### Classes

```
CONTAINER (fixed):
  "fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm w-full"

TOAST BASE:
  "flex items-start gap-3 p-4 rounded-xl shadow-lg border
   animate-slide-up"

TOAST success:  "bg-white dark:bg-gray-800 border-emerald-200 dark:border-emerald-800"
TOAST error:    "bg-white dark:bg-gray-800 border-red-200 dark:border-red-800"
TOAST warning:  "bg-white dark:bg-gray-800 border-amber-200 dark:border-amber-800"
TOAST info:     "bg-white dark:bg-gray-800 border-blue-200 dark:border-blue-800"

ICON DOT success: "w-2 h-2 rounded-full bg-emerald-500 mt-1 flex-shrink-0"
ICON DOT error:   "w-2 h-2 rounded-full bg-red-500 mt-1 flex-shrink-0"
ICON DOT warning: "w-2 h-2 rounded-full bg-amber-500 mt-1 flex-shrink-0"
ICON DOT info:    "w-2 h-2 rounded-full bg-blue-500 mt-1 flex-shrink-0"

TOAST TITLE:   "text-sm font-semibold text-stone-900 dark:text-gray-50"
TOAST MESSAGE: "text-xs text-stone-500 dark:text-gray-400 mt-0.5"
```

#### React Hook + Component

Toasts are **global**: `<ToastProvider>` wraps the app once (in `main.jsx`, outside the router), renders a single `<ToastContainer>`, and exposes `useToast()` via context. Calling `useToast()` anywhere returns the same `addToast`. Never instantiate toast state per-page.

```jsx
// hooks/useToast.jsx  (provider + hook live together)
import { createContext, useContext, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const ToastContext = createContext(null);
let toastIdCounter = 0;

const TYPE_DOT = {
  success: 'bg-emerald-500',
  error: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
};
const TYPE_BORDER = {
  success: 'border-emerald-200 dark:border-emerald-800',
  error: 'border-red-200 dark:border-red-800',
  warning: 'border-amber-200 dark:border-amber-800',
  info: 'border-blue-200 dark:border-blue-800',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]); // each: { id, type, title, message, leaving }

  const removeToast = useCallback((id) => {
    // trigger exit animation, then unmount after it finishes (150ms, matches animate-fade-out)
    setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 150);
  }, []);

  const addToast = useCallback(({ type = 'info', title, message, duration = 4000 }) => {
    const id = ++toastIdCounter;
    setToasts(prev => [...prev.slice(-2), { id, type, title, message, leaving: false }]); // cap at 3
    setTimeout(() => removeToast(id), duration);
    return id;
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

function ToastContainer({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;
  return createPortal(
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm w-full">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-start gap-3 p-4 rounded-xl shadow-lg border bg-white dark:bg-gray-800
            ${TYPE_BORDER[t.type]} ${t.leaving ? 'animate-fade-out' : 'animate-slide-up'}`}
        >
          <span className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${TYPE_DOT[t.type]}`} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-stone-900 dark:text-gray-50">{t.title}</p>
            {t.message && <p className="text-xs text-stone-500 dark:text-gray-400 mt-0.5">{t.message}</p>}
          </div>
          <button
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss notification"
            className="p-0.5 rounded-md text-stone-400 hover:text-stone-600 dark:text-gray-500 dark:hover:text-gray-300 flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
}
```

---

### 5.8 Badge / Tag

```
BASE:             "inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium"

emerald (success):"bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
red (danger):     "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400"
amber (warning):  "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
blue (info):      "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400"
gray (neutral):   "bg-stone-100 text-stone-700 dark:bg-gray-700 dark:text-gray-300"
```

#### React Component

```jsx
// components/ui/Badge.jsx
const variants = {
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
  red:     'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400',
  amber:   'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
  blue:    'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400',
  gray:    'bg-stone-100 text-stone-700 dark:bg-gray-700 dark:text-gray-300',
};

export function Badge({ variant = 'gray', children, className = '' }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
```

#### Canonical Status & Priority → Variant Mapping

Use these exact mappings so status/priority badges are identical across modules:

| Semantic value | Badge variant |
|----------------|---------------|
| status `done` / `completed` / `active` / `paid` | `emerald` |
| status `pending` / `draft` | `gray` |
| status `in_progress` / `scheduled` | `blue` |
| status `overdue` / `failed` / `cancelled` | `red` |
| status `on_hold` / `due_soon` | `amber` |
| priority `1` (high) | `red` |
| priority `2` (medium) | `amber` |
| priority `3` (low) | `gray` |

### 5.9 Empty State

Reusable component. The `icon` prop takes a Lucide icon **component** (not an element). Pass `action` as a `<Button>`.

```jsx
// components/ui/EmptyState.jsx
export function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      {Icon && (
        <div className="w-12 h-12 rounded-xl bg-stone-100 dark:bg-gray-700 flex items-center justify-center mb-4">
          <Icon className="w-6 h-6 text-stone-400 dark:text-gray-500" />
        </div>
      )}
      <h3 className="text-sm font-semibold text-stone-700 dark:text-gray-300 mb-1">{title}</h3>
      {message && <p className="text-xs text-stone-400 dark:text-gray-500 mb-6 max-w-xs">{message}</p>}
      {action}
    </div>
  );
}
```

### 5.10 Error State

```jsx
// components/ui/ErrorState.jsx
import { AlertCircle } from 'lucide-react';
import { Button } from './Button';

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center mb-4">
        <AlertCircle className="w-6 h-6 text-red-500 dark:text-red-400" />
      </div>
      <h3 className="text-sm font-semibold text-stone-700 dark:text-gray-300 mb-1">Something went wrong</h3>
      {message && <p className="text-xs text-stone-400 dark:text-gray-500 mb-6 max-w-xs">{message}</p>}
      {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>Try again</Button>}
    </div>
  );
}
```

### 5.11 Loading Skeleton

- Use skeleton placeholders that match the shape of the content they replace. Never a centered spinner (see §10, NEVER #14).
- All skeleton blocks use the base: `bg-stone-200 dark:bg-gray-700 rounded animate-pulse`. A fainter tone (`bg-stone-100 dark:bg-gray-700/50`) is used for secondary lines.

```jsx
// components/ui/Skeleton.jsx
export function Skeleton({ className = '' }) {
  return <div className={`bg-stone-200 dark:bg-gray-700 rounded animate-pulse ${className}`} />;
}

// Row-shaped skeleton for list/table loading states
export function ListSkeleton({ rows = 5 }) {
  return (
    <div className="p-6 space-y-4">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="w-4 h-4 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className={i % 2 === 0 ? 'h-4 w-3/4' : 'h-4 w-full'} />
            <div className="h-3 rounded bg-stone-100 dark:bg-gray-700/50 animate-pulse w-1/3" />
          </div>
          <Skeleton className="w-16 h-6 rounded-md" />
        </div>
      ))}
    </div>
  );
}
```

### 5.12 StatCard

Metric card used on dashboards and summary rows (referenced in §8). `delta` is optional; positive → emerald, negative → red.

```jsx
// components/ui/StatCard.jsx
import { Card, CardBody } from './Card';

export function StatCard({ label, value, delta, icon: Icon }) {
  const deltaColor = delta == null
    ? ''
    : delta >= 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-red-600 dark:text-red-400';
  return (
    <Card>
      <CardBody>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-stone-500 dark:text-gray-400 tracking-wide uppercase">{label}</p>
          {Icon && <Icon className="w-4 h-4 text-stone-400 dark:text-gray-500" />}
        </div>
        <p className="text-2xl font-bold text-stone-900 dark:text-gray-50 tracking-[-0.02em]">{value}</p>
        {delta != null && (
          <p className={`text-xs mt-1 ${deltaColor}`}>{delta >= 0 ? '+' : ''}{delta}%</p>
        )}
      </CardBody>
    </Card>
  );
}
```

---

## 6. Full-Stack Conventions

### 6.0 Environment, Ports & Serialization

**Runtime / ports**

| Process | Default port | Notes |
|---------|--------------|-------|
| Vite dev server (client) | `5173` | Vite default |
| Express API (server) | `3000` | Set via `PORT`; the client's `VITE_API_URL` default assumes this |

**Environment variables** — define these in `.env` files. Only `VITE_`-prefixed vars are exposed to the browser bundle; everything else is server-only.

| Variable | Side | Required | Example | Purpose |
|----------|------|----------|---------|---------|
| `VITE_API_URL` | client | no (defaults to `http://localhost:3000`) | `https://api.example.com` | Base URL for the axios client |
| `PORT` | server | no (defaults to `3000`) | `3000` | Express listen port |
| `DATABASE_URL` | server | **yes** | `postgres://user:pass@localhost:5432/app` | Postgres connection string for the `pg` pool |
| `CLIENT_ORIGIN` | server | **yes** | `http://localhost:5173` | Allowed CORS origin (credentials enabled) |
| `SESSION_SECRET` | server | **yes if auth enabled** | (random 32+ char string) | Signs the auth session cookie (§6.9) |
| `NODE_ENV` | server | no | `development` / `production` | Standard Node environment flag |

- **Never** commit a populated `.env`. Commit a `.env.example` with empty values. Secrets are server-side only (see §10, NEVER #8). `VITE_`-prefixed values are public by definition — never put a secret behind a `VITE_` name.

**JSON serialization convention (resolves snake_case vs camelCase ambiguity)**

> **API request and response bodies use `snake_case` keys** — identical to the database columns. There is no case-transform layer. The frontend reads fields exactly as stored (e.g. `todo.due_date`, `meta.per_page`), and POST/PATCH bodies send `snake_case` keys. JavaScript-side *local* variables still follow camelCase per §6.2; only the wire format is snake_case.

### 6.1 Project File Structure

```
project-root/
├── client/                         # React + Vite frontend
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                 # Atomic components: Button, Card, Input, etc.
│   │   │   ├── layout/             # Sidebar, TopBar, AppLayout
│   │   │   └── [module]/           # Module-specific components (e.g., todo/, finance/)
│   │   ├── pages/                  # One file per route: Dashboard.jsx, Todo.jsx, etc.
│   │   ├── hooks/                  # Custom hooks: useTheme.js, useToast.js, useApi.js
│   │   ├── lib/                    # Utilities: api.js (axios instance), formatters.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── tailwind.config.js
│   └── vite.config.js
│
└── server/                         # Node.js + Express backend
    ├── routes/                     # One file per resource: todos.js, finances.js
    ├── models/                     # DB query functions (no ORM): todo.model.js
    ├── middleware/                  # auth.js, errorHandler.js, validate.js
    ├── lib/                        # db.js (pg pool), helpers.js
    └── index.js                    # Entry point
```

### 6.2 File Naming

| Asset Type | Convention | Example |
|------------|------------|---------|
| React component | PascalCase `.jsx` | `TodoList.jsx` |
| React page | PascalCase `.jsx` | `FinanceTracker.jsx` |
| Hook | camelCase, `use` prefix | `useFinanceData.js` |
| Utility / lib | camelCase | `formatters.js` |
| Backend route | camelCase plural | `todos.js` |
| DB model | camelCase singular + `.model.js` | `todo.model.js` |
| DB migration | snake_case with timestamp | `20240101_create_todos.sql` |

### 6.3 API Endpoint Naming

Follow REST conventions strictly. All endpoints prefixed with `/api`.

| Action | Method | Endpoint | Example |
|--------|--------|----------|---------|
| List all | GET | `/api/{resource}` | `GET /api/todos` |
| Get one | GET | `/api/{resource}/:id` | `GET /api/todos/42` |
| Create | POST | `/api/{resource}` | `POST /api/todos` |
| Full update | PUT | `/api/{resource}/:id` | `PUT /api/todos/42` |
| Partial update | PATCH | `/api/{resource}/:id` | `PATCH /api/todos/42` |
| Delete | DELETE | `/api/{resource}/:id` | `DELETE /api/todos/42` |
| Nested resource | GET | `/api/{parent}/:id/{child}` | `GET /api/projects/5/tasks` |

**PUT vs PATCH (mandatory rule, no exceptions):**
- **`PATCH` is the default for all edits.** Send only the changed fields. The frontend edit handler uses `api.patch` (see §8).
- **`PUT` is used only to replace an entire resource representation** (all writable fields required; omitted fields are reset to defaults). If you are unsure, use `PATCH`. Do not offer both for the same UI action.

**List pagination (query params):** list endpoints accept `?page` (1-based, default `1`) and `?per_page` (default `20`, max `100`). When either is present the response **must** include the `meta` block (§6.4). Additional filtering/sorting params are `?sort=<column>`, `?order=asc|desc`, and resource-specific filters documented per route.

### 6.4 API Response Formats

**Every response must use one of these two shapes. No exceptions.**

Success:
```json
{
  "success": true,
  "data": {},
  "meta": {
    "total": 100,
    "page": 1,
    "per_page": 20
  }
}
```
(`meta` is optional; include only for paginated list responses)

Error:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Title is required.",
    "field": "title"
  }
}
```

HTTP Status codes: `200` OK, `201` Created, `400` Validation Error, `401` Unauthorized, `403` Forbidden, `404` Not Found, `500` Internal Server Error.

### 6.5 Database Schema Patterns

```sql
-- Every table follows this pattern exactly:
CREATE TABLE todos (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  status      VARCHAR(50) NOT NULL DEFAULT 'pending',  -- use VARCHAR enums, not ENUM type
  priority    SMALLINT NOT NULL DEFAULT 2,              -- 1=high, 2=medium, 3=low
  due_date    DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Always create an updated_at trigger:
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER todos_set_updated_at
  BEFORE UPDATE ON todos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Standard indexes:
CREATE INDEX idx_todos_user_id ON todos(user_id);
CREATE INDEX idx_todos_status ON todos(status);
```

**Naming rules**: table names are snake_case, plural. Column names are snake_case. No abbreviations except `id`, `url`, `api`.

### 6.6 Backend Middleware

```javascript
// middleware/errorHandler.js — Must be the LAST middleware registered (after all routes)
export function errorHandler(err, req, res, next) {
  console.error(`[${new Date().toISOString()}] ${err.stack}`);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: statusCode === 500 ? 'An unexpected error occurred.' : err.message,
      // `field` is only present on field-level validation errors (matches §6.4)
      ...(err.field ? { field: err.field } : {}),
    }
  });
}

// lib/AppError.js — Use for all thrown errors in route handlers
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'ERROR', field = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    if (field) this.field = field;
  }
}

// Usage in a route:
// throw new AppError('Todo not found.', 404, 'NOT_FOUND');
// throw new AppError('Title is required.', 400, 'VALIDATION_ERROR', 'title');
```

### 6.6a Auth Middleware

Auth uses a signed **httpOnly session cookie** (this is why the axios client sets `withCredentials: true`). The middleware attaches `req.user` and is mounted in front of every `/api/{resource}` route.

```javascript
// middleware/auth.js
import { AppError } from '../lib/AppError.js';

export function requireAuth(req, res, next) {
  const userId = req.session?.userId; // populated by the session cookie layer
  if (!userId) return next(new AppError('Authentication required.', 401, 'AUTH_REQUIRED'));
  req.user = { id: userId };
  next();
}
```

- Every resource router is mounted as `app.use('/api/todos', requireAuth, todosRouter)`. Handlers read the owner from `req.user.id` and must scope all queries by it (`WHERE user_id = $1`).
- A user requesting another user's row receives `403` (`FORBIDDEN`), a missing/invalid session receives `401` (`AUTH_REQUIRED`).

### 6.6b Validation Middleware

Request-body validation uses **`zod`** (the single approved validation library; do not hand-roll `if (!body.x)` checks in handlers). The `validate(schema)` middleware runs before the handler and converts the first failure into the standard `VALIDATION_ERROR` shape from §6.4.

```javascript
// middleware/validate.js
import { AppError } from '../lib/AppError.js';

export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const first = result.error.issues[0];
    return next(new AppError(first.message, 400, 'VALIDATION_ERROR', first.path.join('.')));
  }
  req.body = result.data; // parsed + coerced
  next();
};

// Usage:
// import { z } from 'zod';
// const createTodoSchema = z.object({ title: z.string().min(1), priority: z.number().int().min(1).max(3).default(2) });
// router.post('/', validate(createTodoSchema), createTodoHandler);
```

### 6.7 Frontend API Client

```javascript
// lib/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Intercept to unwrap the `data` field from our standard response shape
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.error?.message || 'An unexpected error occurred.';
    return Promise.reject(new Error(message));
  }
);

export default api;
```

### 6.8 Custom Data Fetching Hook

```javascript
// hooks/useApi.js
import { useState, useEffect, useCallback } from 'react';

export function useApi(fetchFn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  const execute = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const result = await fetchFn();
      setState({ data: result.data, loading: false, error: null });
    } catch (err) {
      setState({ data: null, loading: false, error: err.message });
    }
  }, deps);

  useEffect(() => { execute(); }, [execute]);

  return { ...state, refetch: execute };
}
```

---

## 7. State Handling Templates

Every data-driven component must handle four states: **Loading**, **Error**, **Empty**, and **Data**. Below are complete, copy-pasteable templates.

### 7.1 Full Page State Template

```jsx
// Example: pages/Todo.jsx
import { useApi } from '../hooks/useApi';
import api from '../lib/api';
import { Card, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ListSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
import { Plus, ClipboardCheck } from 'lucide-react';

export default function Todo() {
  const { data: todos, loading, error, refetch } = useApi(() => api.get('/api/todos'));

  return (
    // Page content wrapper only — the sidebar offset is owned by AppLayout (§9.3)
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
      {/* Page Header — always visible regardless of state */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-gray-50 tracking-[-0.02em]">
            To-Do List
          </h1>
          <p className="text-sm text-stone-500 dark:text-gray-400 mt-1">
            Track tasks and action items.
          </p>
        </div>
        <Button variant="primary" size="md">
          <Plus size={16} />
          New Task
        </Button>
      </div>

      {/* Content Area — the four-state switch (§7). Shared components from §5.9–5.11. */}
      <Card>
        <CardBody className="p-0">
          {loading && <ListSkeleton rows={5} />}
          {error && !loading && <ErrorState message={error} onRetry={refetch} />}
          {!loading && !error && todos?.length === 0 && (
            <EmptyState
              icon={ClipboardCheck}
              title="No tasks yet"
              message="Create your first task to get started."
              action={<Button variant="primary" size="sm"><Plus size={14} />New Task</Button>}
            />
          )}
          {!loading && !error && todos?.length > 0 && (
            <div className="divide-y divide-stone-100 dark:divide-gray-700">
              {todos.map(todo => <TodoRow key={todo.id} todo={todo} />)}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

// --- Module-specific row (lives in components/todo/TodoRow.jsx) ---
// Demonstrates the Badge status mapping from §5.8.
const STATUS_VARIANT = { done: 'emerald', pending: 'gray', in_progress: 'blue', overdue: 'red' };

function TodoRow({ todo }) {
  return (
    <div className="flex items-center gap-4 px-6 py-4 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors duration-100">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-stone-900 dark:text-gray-50 truncate">{todo.title}</p>
        {todo.due_date && (
          <p className="text-xs text-stone-500 dark:text-gray-400 mt-0.5">Due {todo.due_date}</p>
        )}
      </div>
      <Badge variant={STATUS_VARIANT[todo.status] ?? 'gray'}>{todo.status}</Badge>
    </div>
  );
}
```

### 7.2 Inline / Widget Loading State

For small widgets (stat cards, charts), use this inline skeleton:

```jsx
function StatCardSkeleton() {
  return (
    <Card>
      <CardBody>
        <div className="h-3 w-24 rounded bg-stone-200 dark:bg-gray-700 animate-pulse mb-3" />
        <div className="h-7 w-16 rounded bg-stone-200 dark:bg-gray-700 animate-pulse mb-1" />
        <div className="h-3 w-32 rounded bg-stone-100 dark:bg-gray-700/50 animate-pulse" />
      </CardBody>
    </Card>
  );
}
```

### 7.3 Form Submission State

Forms must handle: idle, submitting, success, and error.

```jsx
function useFormSubmit(submitFn) {
  const [status, setStatus] = useState('idle'); // 'idle' | 'submitting' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (data) => {
    setStatus('submitting');
    setErrorMessage('');
    try {
      await submitFn(data);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err.message);
    }
  };

  return { status, errorMessage, handleSubmit, isSubmitting: status === 'submitting' };
}
```

---

## 8. Module Page Template

Every new page must follow this exact structure:

```jsx
// pages/[ModuleName].jsx

// 1. IMPORTS — in this order: React, third-party, internal lib, hooks, components
import { useState } from 'react';
import { Plus, Filter, Inbox } from 'lucide-react';
import api from '../lib/api';
import { useApi } from '../hooks/useApi';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { StatCard } from '../components/ui/StatCard';
import { DataTable } from '../components/ui/DataTable';
import { ListSkeleton } from '../components/ui/Skeleton';
import { ErrorState } from '../components/ui/ErrorState';
import { EmptyState } from '../components/ui/EmptyState';
// import module-specific components (e.g., ./components/items/CreateModal) last

// 2. PAGE COMPONENT
export default function ModuleName() {
  // 2a. State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // 2b. Data fetching
  const { data: items, loading, error, refetch } = useApi(() => api.get('/api/items'));

  // 2c. Derived state / filters
  const filteredItems = items?.filter(/* predicate */) ?? [];

  // 2d. Handlers — edits use PATCH (partial) per §6.3; full replacement would use api.put
  const handleCreate = async (formData) => {
    await api.post('/api/items', formData);
    refetch();
    setIsModalOpen(false);
  };

  // 2d-i. Column contract for DataTable (§5.4)
  const columns = [
    { key: 'name', header: 'Name', sortable: true },
    { key: 'status', header: 'Status', render: (row) => <Badge variant="gray">{row.status}</Badge> },
    { key: 'created_at', header: 'Created', sortable: true },
    { key: 'actions', header: '', align: 'right',
      render: (row) => (
        <>
          <Button variant="ghost" size="sm" onClick={() => setSelectedItem(row)}>Edit</Button>
          <Button variant="ghost" size="sm">Delete</Button>
        </>
      ) },
  ];

  // 2e. Render
  return (
    // Page content wrapper only — sidebar offset is owned by AppLayout (§9.3)
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">

      {/* PAGE HEADER */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 dark:text-gray-50 tracking-[-0.02em]">
            Module Title
          </h1>
          <p className="text-sm text-stone-500 dark:text-gray-400 mt-1">
            One-line description of this module.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="md">
            <Filter size={16} />
            Filter
          </Button>
          <Button variant="primary" size="md" onClick={() => setIsModalOpen(true)}>
            <Plus size={16} />
            New Item
          </Button>
        </div>
      </div>

      {/* SUMMARY STATS ROW (optional, but recommended) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* <StatCard label="Total" value={filteredItems.length} /> × n */}
      </div>

      {/* MAIN CONTENT — four-state switch (§7). Shared components from §5.9–5.11. */}
      <Card>
        <CardHeader title="All Items" subtitle={`${filteredItems.length} total`} />
        <CardBody className="p-0">
          {loading && <ListSkeleton rows={5} />}
          {error && !loading && <ErrorState message={error} onRetry={refetch} />}
          {!loading && !error && filteredItems.length === 0 && (
            <EmptyState
              icon={Inbox}
              title="Nothing here yet"
              message="Create your first item to get started."
              action={<Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)}><Plus size={14} />New Item</Button>}
            />
          )}
          {!loading && !error && filteredItems.length > 0 && (
            <DataTable columns={columns} items={filteredItems} initialSortKey="created_at" />
          )}
        </CardBody>
      </Card>

      {/* MODALS — module-specific, lives in components/items/CreateModal.jsx */}
      {/* <CreateModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={handleCreate} /> */}
    </div>
  );
}
```

---

## 9. Routes & Navigation

### 9.1 Route Map

| Path | Page Component | Sidebar Label | Lucide Icon | Module Description |
|------|----------------|---------------|-------------|-------------------|
| `/` | `Dashboard.jsx` | Dashboard | `LayoutDashboard` | Overview: key metrics from all modules |
| `/todo` | `Todo.jsx` | To-Do | `CheckSquare` | Task management with priorities and due dates |
| `/finance` | `Finance.jsx` | Finance | `TrendingUp` | Income, expense tracking, and budget overview |
| `/research` | `Research.jsx` | Research | `BookOpen` | Journal entries, citations, and notes |
| `/learning` | `Learning.jsx` | Learning | `GraduationCap` | Courses, books, and skill progress tracking |

### 9.2 React Router Setup

```jsx
// App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Todo from './pages/Todo';
import Finance from './pages/Finance';
import Research from './pages/Research';
import Learning from './pages/Learning';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/todo" element={<Todo />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/research" element={<Research />} />
          <Route path="/learning" element={<Learning />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

### 9.3 AppLayout (owns the visual frame)

`AppLayout` is the only place that composes the sidebar, the mobile drawer, the top bar, and the routed page (`<Outlet />`). Pages never render the sidebar or apply a sidebar offset — they render only their content wrapper (see §7.1, §8). This is what makes the `lg:pl-64` offset and the mobile drawer consistent across every route.

```jsx
// components/layout/AppLayout.jsx
import { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Menu, X, Sun, Moon, LayoutDashboard, CheckSquare, TrendingUp, BookOpen, GraduationCap } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

// Single source of truth for nav — mirrors the §9.1 Route Map.
const NAV_ITEMS = [
  { to: '/',         label: 'Dashboard', icon: LayoutDashboard },
  { to: '/todo',     label: 'To-Do',     icon: CheckSquare },
  { to: '/finance',  label: 'Finance',   icon: TrendingUp },
  { to: '/research', label: 'Research',  icon: BookOpen },
  { to: '/learning', label: 'Learning',  icon: GraduationCap },
];

const navLinkClass = ({ isActive }) =>
  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${
    isActive
      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
      : 'text-stone-600 dark:text-gray-400 hover:bg-stone-100 dark:hover:bg-gray-700 hover:text-stone-900 dark:hover:text-gray-100'
  }`;

// Shared inner content for both the fixed desktop sidebar and the mobile drawer.
function SidebarContent({ onNavigate }) {
  const { isDark, toggle } = useTheme();
  return (
    <>
      <div className="h-16 flex items-center px-6 border-b border-stone-200 dark:border-gray-700">
        <div>
          <p className="text-sm font-bold text-stone-900 dark:text-gray-50 tracking-tight">Rafli's Suite</p>
          <p className="text-[10px] text-stone-400 dark:text-gray-500 tracking-widest uppercase">Laboratory</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={navLinkClass} onClick={onNavigate}>
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-stone-200 dark:border-gray-700 space-y-2">
        <button
          onClick={toggle}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-stone-600 dark:text-gray-400 hover:bg-stone-100 dark:hover:bg-gray-700 transition-colors duration-150"
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
          {isDark ? 'Light mode' : 'Dark mode'}
        </button>
      </div>
    </>
  );
}

export function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-gray-900">
      {/* Desktop sidebar — fixed, lg+ only */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-64 bg-white dark:bg-gray-800 border-r border-stone-200 dark:border-gray-700 flex-col z-30">
        <SidebarContent />
      </aside>

      {/* Mobile drawer + backdrop — below lg only, via portal */}
      {drawerOpen && createPortal(
        <div className="lg:hidden">
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <aside className="fixed left-0 top-0 h-full w-64 z-40 bg-white dark:bg-gray-800 border-r border-stone-200 dark:border-gray-700 flex flex-col">
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>,
        document.body
      )}

      {/* Main region — offset for the fixed sidebar at lg+ */}
      <div className="lg:pl-64">
        {/* Mobile top bar with hamburger — hidden at lg+ */}
        <header className="lg:hidden h-16 flex items-center gap-3 px-4 border-b border-stone-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            className="p-2 rounded-md text-stone-600 dark:text-gray-400 hover:bg-stone-100 dark:hover:bg-gray-700 transition-colors duration-150"
          >
            <Menu size={20} />
          </button>
          <p className="text-sm font-bold text-stone-900 dark:text-gray-50 tracking-tight">Rafli's Suite</p>
        </header>

        <main className="min-h-screen">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

> The standalone `X` import is reserved for the Modal close button; the mobile drawer closes via backdrop tap and on navigation, so it does not need its own close glyph. If a visible close button is added to the drawer, use `X` for consistency.

### 9.4 Application Entry (main.jsx)

`ToastProvider` wraps the whole app **outside** the router so any page can call `useToast()` (§5.7).

```jsx
// main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ToastProvider } from './hooks/useToast';
import './index.css'; // Tailwind directives

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>
);
```

---

## 9a. Component Index (canonical location of every referenced component)

Every component named anywhere in this file resolves to exactly one path. If a component is not in this table, it does not exist and must not be referenced.

| Component | Path | Defined in |
|-----------|------|-----------|
| `Button` | `components/ui/Button.jsx` | §5.1 |
| `Card`, `CardHeader`, `CardBody` | `components/ui/Card.jsx` | §5.2 |
| `Input`, `Textarea`, `Select` | `components/ui/Input.jsx` | §5.3 |
| `DataTable` | `components/ui/DataTable.jsx` | §5.4 |
| `Modal` | `components/ui/Modal.jsx` | §5.6 |
| `ToastProvider`, `useToast` | `hooks/useToast.jsx` | §5.7 |
| `Badge` | `components/ui/Badge.jsx` | §5.8 |
| `EmptyState` | `components/ui/EmptyState.jsx` | §5.9 |
| `ErrorState` | `components/ui/ErrorState.jsx` | §5.10 |
| `Skeleton`, `ListSkeleton` | `components/ui/Skeleton.jsx` | §5.11 |
| `StatCard` | `components/ui/StatCard.jsx` | §5.12 |
| `AppLayout` | `components/layout/AppLayout.jsx` | §9.3 |
| `useTheme` | `hooks/useTheme.js` | §5.5 |
| `useApi` | `hooks/useApi.js` | §6.8 |
| `useFormSubmit` | `hooks/useFormSubmit.js` | §7.3 |
| Module rows/modals (e.g. `TodoRow`, `CreateModal`) | `components/[module]/*.jsx` | module-specific, not global |

---

## 10. AI Generation Rules — ALWAYS / NEVER

This section is directed at any AI generating code for this project.

### ALWAYS ✅

1. **ALWAYS use Tailwind utility classes exclusively.** Never write inline `style={{}}` attributes for colors, spacing, or typography. If a value doesn't exist in Tailwind's default scale, use an arbitrary value class (e.g., `text-[11px]`).

2. **ALWAYS apply `dark:` variants for every color class.** For every `bg-*`, `text-*`, `border-*`, and `ring-*` class, there must be a corresponding `dark:` variant. No exceptions.

3. **ALWAYS handle all four data states**: Loading (skeleton), Error (with retry), Empty (with CTA), and Data. A component that only renders the happy path is incomplete.

4. **ALWAYS use the exact color tokens defined in §2.** Emerald for accent, Stone for neutrals in light mode, Gray for neutrals in dark mode. Do not use Slate, Zinc, or any other neutral scale.

5. **ALWAYS use `Inter` for UI text.** The only exception is the Monospace role (§3.1) — `font-mono` for code, IDs, and technical strings. No other font families.

6. **ALWAYS wrap form fields in the `Input` component** from `components/ui/Input.jsx`. Never write raw `<input>` elements in page components.

7. **ALWAYS use the standard response shapes from §6.4**: success → `{ success: true, data, meta? }`; error → `{ success: false, error: { code, message, field? } }`. A single response never contains both `data` and `error`. Every route handler is wrapped in try/catch that forwards to `next(err)`, and all thrown errors use `AppError` (§6.6).

8. **ALWAYS use `snake_case` for all database column and table names.**

9. **ALWAYS use `PascalCase` for React component file names** and `camelCase` for hooks, utilities, and backend files.

10. **ALWAYS render Modals using React portals** (`createPortal` to `document.body`). Never place modals inside the component tree.

11. **ALWAYS include a `key` prop** when rendering lists. The key must be a stable, unique ID (e.g., `item.id`), never the array index.

12. **ALWAYS use the `Button` component** from `components/ui/Button.jsx` for all clickable actions. Never use raw `<button>` elements in page or feature components.

13. **ALWAYS persist dark mode state to `localStorage`** with the key `"theme"`. Apply the `dark` class to `document.documentElement`.

14. **ALWAYS use `rounded-xl`** for Card containers and `rounded-lg` for inputs and buttons.

15. **ALWAYS validate request bodies** in Express routes. Respond with status `400` and `{ success: false, error: { code: "VALIDATION_ERROR", message: "..." } }` for invalid input.

---

### NEVER ❌

1. **NEVER use hardcoded hex color values** (e.g., `style={{ color: '#059669' }}`). Use Tailwind classes.

2. **NEVER use inline `style` attributes** for layout, spacing, typography, or color. Everything is Tailwind.

3. **NEVER use external component libraries** (shadcn/ui, Material UI, Ant Design, Chakra UI, etc.). Build from primitives.

4. **NEVER skip the `dark:` variant** on any color-bearing class. Incomplete dark mode is a broken component.

5. **NEVER use colors outside the defined palette.** Do not introduce Indigo, Purple, Teal, Cyan, or any color not defined in §2. The only accent color in this system is Emerald.

6. **NEVER use `Stone` for dark mode neutral classes.** In dark mode, use the `Gray` scale (`gray-700`, `gray-800`, `gray-900`).

7. **NEVER use `React.useEffect` to fetch data directly in page components.** Always use the `useApi` hook from `hooks/useApi.js`.

8. **NEVER put secret keys or credentials** in frontend code or `.env` files committed to version control. Backend env vars only.

9. **NEVER ship untyped props.** This project is JavaScript (JSX), so document every component's prop shape with a JSDoc `@param` block above the component. (If a file is ever migrated to TypeScript, `any` is still forbidden.)

10. **NEVER use `Array.index` as a `key` prop.** Always use a stable entity ID.

11. **NEVER add decorative UI elements** (gradients, illustrations, background patterns, hero images) to functional pages. This is a productivity tool, not a marketing site.

12. **NEVER create new font sizes outside the type scale defined in §3.** If a size is needed, use the nearest defined token. Avoid arbitrary `text-[15px]` unless it is explicitly listed in the scale.

13. **NEVER commit TODO comments** in final code output. Either implement the feature or leave a structured placeholder comment: `// [PENDING]: Description of what goes here`.

14. **NEVER render loading spinners as the primary loading state.** Always use skeleton placeholders that match the shape of the eventual content.

15. **NEVER use `!important` in any CSS or Tailwind arbitrary class.** If specificity is a problem, restructure the component hierarchy.

---

*End of SKILL.MD v2.1 (hardened) — Rafli's Productivity Suite*
