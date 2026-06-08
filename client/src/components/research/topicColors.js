// client/src/components/research/topicColors.js
// Canonical topic colour palette. The hex value is what's stored in the DB
// (research_topics.color); the label is what's shown in the colour <Select>.
// Kept in one place so CreateTopicModal options and any dot rendering agree.

export const TOPIC_COLORS = [
  { label: 'Emerald', value: '#10b981' },
  { label: 'Blue',    value: '#3b82f6' },
  { label: 'Red',     value: '#ef4444' },
  { label: 'Amber',   value: '#f59e0b' },
  { label: 'Purple',  value: '#8b5cf6' },
  { label: 'Gray',    value: '#6b7280' },
];

export const DEFAULT_TOPIC_COLOR = '#10b981';
