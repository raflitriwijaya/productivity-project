// client/src/lib/enums.js
// Client-side mirror of the canonical domain enums (Post-V5 fix for V5 §11.1 —
// "enums.js is server-only; the client re-declares its own maps"). Single source of
// truth for the Universal-Links display maps and the Contacts CRM badge maps, so a
// new linkable type only needs adding here (and in server/lib/enums.js), not in
// every component. Keep LINKABLE_TYPES in sync with LINKABLE_TYPES in
// server/lib/enums.js and the chk_entity_link_types CHECK in the migrations.

// ── Universal Links (Wave 1) — 22 linkable entity types ──────────────────────
export const LINKABLE_TYPES = [
  'transaction', 'research_entry', 'learning_item', 'engineer_project', 'todo',
  'receivable', 'payable', 'portfolio', 'budget', 'account',
  'research_topic', 'engineer_snippet', 'engineer_document', 'engineer_issue',
  'engineer_checkin', 'engineer_roadmap_skill', 'book', 'contact', 'idea',
  'time_entry', 'goal', 'chat',
];

// Friendly label per entity type (shown on link badges / rows).
export const TYPE_LABELS = {
  transaction: 'Transaction',
  research_entry: 'Research Entry',
  learning_item: 'Learning Item',
  engineer_project: 'Engineering Project',
  todo: 'Todo',
  receivable: 'Receivable',
  payable: 'Payable',
  portfolio: 'Portfolio',
  budget: 'Budget',
  account: 'Account',
  research_topic: 'Research Topic',
  engineer_snippet: 'Snippet',
  engineer_document: 'Document',
  engineer_issue: 'Issue',
  engineer_checkin: 'Check-in',
  engineer_roadmap_skill: 'Roadmap Skill',
  book: 'Book',
  contact: 'Contact',
  idea: 'Idea',
  time_entry: 'Time Entry',
  goal: 'Goal',
  chat: 'Chat',
};

// Map each type to a Badge variant (the canonical "Stoic Garden" accents).
export const TYPE_VARIANTS = {
  transaction: 'moss',
  research_entry: 'moss',
  research_topic: 'moss',
  learning_item: 'ember',
  portfolio: 'ember',
  engineer_project: 'terracotta',
  engineer_snippet: 'terracotta',
  engineer_document: 'terracotta',
  engineer_issue: 'terracotta',
  engineer_checkin: 'terracotta',
  engineer_roadmap_skill: 'terracotta',
  todo: 'blue',
  receivable: 'amber',
  payable: 'red',
  budget: 'amber',
  account: 'gray',
  book: 'ember',
  contact: 'moss',
  idea: 'ember',
  time_entry: 'gray',
  goal: 'ember',
  chat: 'moss',
};

// ── Contacts CRM (Wave 4) — badge maps shared by Contacts.jsx + ContactDetailModal
export const CONTACT_TYPE_VARIANTS = {
  client: 'moss', partner: 'terracotta', supplier: 'amber',
  investor: 'ember', mentor: 'blue', other: 'gray',
};
export const CONTACT_STATUS_VARIANTS = { active: 'moss', inactive: 'gray', lead: 'ember' };
