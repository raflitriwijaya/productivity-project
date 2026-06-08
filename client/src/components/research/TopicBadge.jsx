// client/src/components/research/TopicBadge.jsx
// Small inline badge for a topic: a coloured dot + the topic name.
// The dot's background is a user-defined hex colour, so it uses the sanctioned
// inline-style exception (SKILL.md §10 NEVER #2 — runtime/user colour has no
// static Tailwind equivalent) and intentionally has no dark: variant.

import { DEFAULT_TOPIC_COLOR } from './topicColors';

/**
 * @param {{ name: string, color?: string, className?: string }} props
 */
export function TopicBadge({ name, color = DEFAULT_TOPIC_COLOR, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="text-xs font-medium text-stone-600 dark:text-gray-400">{name}</span>
    </span>
  );
}
