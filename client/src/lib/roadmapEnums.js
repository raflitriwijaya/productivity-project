// client/src/lib/roadmapEnums.js
// Client-side badge maps and presets for Custom Learning Roadmaps. Pure constants
// (mirrors client/src/lib/enums.js) so the roadmap components share one source of
// truth for labels/variants and the create-modal picker presets. Keep in sync with
// ROADMAP_STATUSES / MILESTONE_STATUSES / MILESTONE_PRIORITIES in server/lib/enums.js.

// ── Roadmap status ───────────────────────────────────────────────────────────
export const ROADMAP_STATUS_VARIANT = { active: 'moss', completed: 'ember', archived: 'gray', paused: 'amber' };
export const ROADMAP_STATUS_LABEL   = { active: 'Active', completed: 'Completed', archived: 'Archived', paused: 'Paused' };

// ── Milestone status ─────────────────────────────────────────────────────────
export const MILESTONE_STATUS_VARIANT = { pending: 'gray', in_progress: 'blue', completed: 'moss', skipped: 'amber' };
export const MILESTONE_STATUS_LABEL   = { pending: 'Pending', in_progress: 'In Progress', completed: 'Completed', skipped: 'Skipped' };

// ── Milestone priority ───────────────────────────────────────────────────────
export const MILESTONE_PRIORITY_VARIANT = { low: 'gray', medium: 'blue', high: 'amber', critical: 'red' };
export const MILESTONE_PRIORITY_LABEL   = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };

// ── Resource type (free-form, but these get an icon hint) ─────────────────────
export const RESOURCE_TYPES = ['video', 'article', 'book', 'course', 'doc', 'other'];

// ── Create-modal presets ─────────────────────────────────────────────────────
// Suggested categories — the field is a free-text input, these are just chips.
export const CATEGORY_SUGGESTIONS = [
  'embedded', 'robotics', 'agriculture', 'automotive', 'software', 'languages', 'science', 'craft',
];

// Six preset card colors drawn from the Stoic Garden palette + a couple of accents.
export const COLOR_PRESETS = [
  '#4A7C59', // moss (default)
  '#C2703D', // terracotta
  '#E07B39', // ember
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#64748B', // stone
];

// Emoji quick-pick for the icon field (also accepts any typed emoji / short name).
export const ICON_PRESETS = ['🔌', '🤖', '🌱', '🚗', '💻', '🧠', '📐', '🛰️', '⚙️', '🔧', '📚', '🧪'];

/** Rounded numeric progress (0–100) for a roadmap/track row (NUMERIC comes back as a string). */
export function pct(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : 0;
}
