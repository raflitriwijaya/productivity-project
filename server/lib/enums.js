// server/lib/enums.js — single source of truth for all domain enum constants.
// Imported by routes and models. Mirror to client where needed.

// --- Todos ---
export const TODO_STATUSES = ['pending', 'in_progress', 'done', 'overdue'];

// --- Learning ---
export const LEARNING_TYPES    = ['course', 'book', 'video', 'article', 'other'];
export const LEARNING_STATUSES = ['not_started', 'in_progress', 'completed', 'on_hold'];

// --- Research entries ---
export const ENTRY_TYPES    = ['journal', 'citation', 'note'];
export const ENTRY_STATUSES = ['draft', 'active', 'archived'];

// --- Research topics ---
export const TOPIC_STATUSES = ['active', 'archived'];

// --- Research attachments ---
export const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.pdf', '.txt', '.md', '.cpp', '.py', '.zip']);
export const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'application/pdf', 'text/plain', 'text/markdown',
  'text/x-c++src', 'text/x-python', 'application/zip', 'application/x-zip-compressed',
  'application/octet-stream',
]);

// --- Finances ---
export const TX_TYPES        = ['Income', 'Expense', 'Transfer', 'Balance Adjustment', 'Market Adjustment'];
export const LEDGER_STATUSES = ['outstanding', 'settled'];

// --- Engineering ---
export const PROJECT_TYPES    = ['iot', 'embedded', 'robotics', 'other'];
export const PROJECT_STATUSES = ['idea', 'planning', 'development', 'testing', 'deployed', 'archived'];
export const ISSUE_SEVERITIES = ['P0-Critical', 'P1-High', 'P2-Medium', 'P3-Low'];
export const ISSUE_STATUSES   = ['open', 'in_progress', 'resolved'];

// --- Universal Links (Roadmap Wave 1) ---
// Whitelist of entity types that can participate in a cross-module link. MUST stay
// in sync with the chk_entity_link_types CHECK in migration 007_entity_links.sql.
export const LINKABLE_TYPES = [
  'transaction', 'research_entry', 'learning_item', 'engineer_project', 'todo',
  'receivable', 'payable', 'portfolio', 'budget', 'account',
  'research_topic', 'engineer_snippet', 'engineer_document', 'engineer_issue',
  'engineer_checkin', 'engineer_roadmap_skill',
];
