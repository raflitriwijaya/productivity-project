// server/models/chat.model.js
// Roadmap Wave 7: persistence for AI chat conversations (chat_conversations table
// from migration 015). Messages live in a single JSONB column. Every query is
// user_id-scoped. pg returns JSONB pre-parsed, so `messages` comes back as a JS
// array without manual JSON.parse.

import pool from '../lib/db.js';

/**
 * List a user's conversations (newest first), with a derived message count.
 * @returns {Promise<{ data: object[], meta: { total: number, page: number, per_page: number } }>}
 */
export async function listConversations(userId, opts = {}) {
  const { page = 1, per_page = 20 } = opts;
  const offset = (page - 1) * per_page;

  const { rows: [c] } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM chat_conversations WHERE user_id = $1`,
    [userId]
  );
  const total = c.count;

  const { rows } = await pool.query(
    `SELECT id, title, model, context_entity_type, context_entity_id,
            jsonb_array_length(messages) AS message_count,
            temperature, top_p, created_at, updated_at
       FROM chat_conversations
      WHERE user_id = $1
      ORDER BY updated_at DESC
      LIMIT $2 OFFSET $3`,
    [userId, per_page, offset]
  );

  return { data: rows, meta: { total, page, per_page } };
}

/** Fetch one full conversation (including messages) owned by the user, or null. */
export async function getConversationById(userId, convoId) {
  const { rows } = await pool.query(
    `SELECT * FROM chat_conversations WHERE id = $1 AND user_id = $2`,
    [convoId, userId]
  );
  return rows[0] ?? null;
}

/** Insert a new conversation. Returns the created row. */
export async function createConversation(userId, data) {
  const {
    title,
    model = 'deepseek-v4-flash',
    messages = [],
    context_entity_type,
    context_entity_id,
    temperature = 0.7,
    top_p = 0.9,
  } = data;

  const { rows } = await pool.query(
    `INSERT INTO chat_conversations
       (user_id, title, model, messages, context_entity_type, context_entity_id, temperature, top_p)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)
     RETURNING *`,
    [
      userId,
      title ?? null,
      model,
      JSON.stringify(messages),
      context_entity_type ?? null,
      context_entity_id ?? null,
      temperature,
      top_p,
    ]
  );
  return rows[0];
}

/**
 * Partial update of a conversation (ownership-checked). `messages` is serialised
 * to JSONB when present. Returns the updated row, or null if not owned/missing.
 */
export async function updateConversation(userId, convoId, data) {
  const existing = await getConversationById(userId, convoId);
  if (!existing) return null;

  const fields = [];
  const params = [userId, convoId];
  let p = 3;

  for (const f of ['title', 'model', 'context_entity_type', 'context_entity_id', 'temperature', 'top_p']) {
    if (data[f] !== undefined) {
      fields.push(`${f} = $${p++}`);
      params.push(data[f]);
    }
  }

  if (data.messages !== undefined) {
    // `messages` is always the last appended param, so no trailing increment needed.
    fields.push(`messages = $${p}::jsonb`);
    params.push(JSON.stringify(data.messages));
  }

  if (!fields.length) return existing;

  const { rows } = await pool.query(
    `UPDATE chat_conversations SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $2 AND user_id = $1
      RETURNING *`,
    params
  );
  return rows[0] ?? null;
}

/** Delete a conversation (ownership-checked). Returns the deleted row, or null. */
export async function deleteConversation(userId, convoId) {
  const { rows } = await pool.query(
    `DELETE FROM chat_conversations WHERE id = $1 AND user_id = $2 RETURNING *`,
    [convoId, userId]
  );
  return rows[0] ?? null;
}

/**
 * Fetch a compact context object for the entity a conversation is anchored to, so
 * it can be injected as a system prompt. Only a known set of entity types is
 * supported; everything else (and any non-owned id) returns null. Every query is
 * user_id-scoped so a chat can never inject another user's data.
 */
export async function getContextForConversation(userId, contextType, contextId) {
  if (!contextType || !contextId) return null;

  const queries = {
    research_entry:   `SELECT title, content, type, tags FROM research_entries WHERE id = $1 AND user_id = $2`,
    engineer_project: `SELECT name AS title, description AS content, project_type FROM engineer_projects WHERE id = $1 AND user_id = $2`,
    book:             `SELECT title, author, notes AS content, genre FROM books WHERE id = $1 AND user_id = $2`,
    learning_item:    `SELECT title, notes AS content, type FROM learning_items WHERE id = $1 AND user_id = $2`,
    goal:             `SELECT title, description AS content, goal_type, unit FROM goals WHERE id = $1 AND user_id = $2`,
    idea:             `SELECT title, description AS content, tags FROM ideas WHERE id = $1 AND user_id = $2`,
  };

  const query = queries[contextType];
  if (!query) return null;

  const { rows } = await pool.query(query, [contextId, userId]);
  return rows[0] ?? null;
}
