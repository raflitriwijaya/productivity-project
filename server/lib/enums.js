// server/lib/enums.js — single source of truth for all domain enum constants.
// Imported by routes and models. Mirror to client where needed.

// --- Todos ---
export const TODO_STATUSES = ['pending', 'in_progress', 'done', 'overdue'];

// --- Learning ---
export const LEARNING_TYPES    = ['course', 'book', 'video', 'article', 'other'];
export const LEARNING_STATUSES = ['not_started', 'in_progress', 'completed', 'on_hold'];

// --- Reading Tracker (Roadmap Wave 3) ---
export const BOOK_SHELVES = ['want_to_read', 'reading', 'finished'];

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
// 'Revenue' (Roadmap Wave 4) behaves like Income for balance purposes (credits the
// destination account) but is tracked separately so a founder can see startup
// revenue distinct from personal income. See CREDITS_DEST in finance.model.js and
// validateTransactionShape (treated alongside Income everywhere).
export const TX_TYPES        = ['Income', 'Expense', 'Transfer', 'Balance Adjustment', 'Market Adjustment', 'Revenue'];
export const LEDGER_STATUSES = ['outstanding', 'settled'];

// --- Contacts CRM (Roadmap Wave 4) ---
export const CONTACT_TYPES    = ['client', 'partner', 'supplier', 'investor', 'mentor', 'other'];
export const CONTACT_STATUSES = ['active', 'inactive', 'lead'];

// --- Ideas Tracker (Roadmap Wave 4) ---
export const IDEA_STATUSES = ['new', 'developing', 'validated', 'archived', 'converted'];

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
  'book',       // Roadmap Wave 3 — Reading Tracker (mirrors 008_reading_tracker.sql)
  'contact',    // Roadmap Wave 4 — Contacts CRM (mirrors 009_contacts.sql)
  'idea',       // Roadmap Wave 4 — Ideas Tracker (mirrors 011_ideas.sql)
  'time_entry', // Roadmap Wave 5 — Time Tracking (mirrors 012_time_entries.sql)
  'goal',       // Roadmap Wave 5 — Goals/OKRs (mirrors 013_goals.sql)
  'chat',       // Roadmap Wave 7 — AI Chat (mirrors 015_chat_history.sql)
  'learning_roadmap',  // Custom Learning Roadmaps (mirrors 019_learning_roadmaps.sql)
  'roadmap_milestone', // Custom Learning Roadmaps (mirrors 019_learning_roadmaps.sql)
];

// --- Time Tracking (Roadmap Wave 5) ---
export const TIME_ENTITY_TYPES = ['todo', 'research_entry', 'learning_item', 'engineer_project', 'book'];

// --- Goals/OKRs (Roadmap Wave 5) ---
export const GOAL_TYPES      = ['target', 'milestone', 'habit', 'learning'];
export const GOAL_STATUSES   = ['active', 'completed', 'abandoned', 'paused'];
export const GOAL_PRIORITIES = ['low', 'medium', 'high', 'critical'];

// --- Custom Learning Roadmaps ---
// User-defined learning paths for any discipline. Mirrors the CHECK constraints in
// 019_learning_roadmaps.sql. ROADMAP_STATUSES applies to learning_roadmaps; the
// milestone enums apply to roadmap_milestones (tracks have no status).
export const ROADMAP_STATUSES     = ['active', 'completed', 'archived', 'paused'];
export const MILESTONE_STATUSES   = ['pending', 'in_progress', 'completed', 'skipped'];
export const MILESTONE_PRIORITIES = ['low', 'medium', 'high', 'critical'];
export const RESOURCE_TYPES       = ['video', 'article', 'book', 'course', 'doc', 'other'];
