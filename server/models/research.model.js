// server/models/research.model.js
// All DB interactions for the research_entries table and its related tables
// (research_topics, research_entry_topics pivot, research_attachments).
// Uses snake_case keys throughout (§6.0 wire format convention).

import pool from '../lib/db.js';

/**
 * @typedef {Object} ResearchEntry
 * @param {number} id
 * @param {number} user_id
 * @param {string} title
 * @param {'journal'|'citation'|'note'} type
 * @param {'draft'|'active'|'archived'} status
 * @param {string|null} content
 * @param {string|null} source
 * @param {string|null} tags
 * @param {boolean} is_pinned
 * @param {string} created_at
 * @param {string} updated_at
 */

// ─── Shared helpers ───────────────────────────────────────────────────────────

/**
 * Attach a `topics` array (`[{ id, name, color }]`) to each entry row in place.
 * Runs a single pivot query keyed by the entry ids, so it avoids the row
 * multiplication a JOIN would cause on the main list query.
 * @param {ResearchEntry[]} rows
 * @returns {Promise<ResearchEntry[]>} the same rows, each with a `topics` field
 */
async function attachTopics(rows) {
  if (rows.length === 0) return rows;
  const ids = rows.map(r => r.id);
  const { rows: links } = await pool.query(
    `SELECT et.entry_id, t.id, t.name, t.color
       FROM research_entry_topics et
       JOIN research_topics t ON t.id = et.topic_id
      WHERE et.entry_id = ANY($1::int[])
      ORDER BY t.name ASC`,
    [ids]
  );
  const byEntry = new Map();
  for (const l of links) {
    if (!byEntry.has(l.entry_id)) byEntry.set(l.entry_id, []);
    byEntry.get(l.entry_id).push({ id: l.id, name: l.name, color: l.color });
  }
  for (const row of rows) {
    row.topics = byEntry.get(row.id) ?? [];
  }
  return rows;
}

// ─── Research entries ─────────────────────────────────────────────────────────

/**
 * List research entries for a user with filters, search, and pagination.
 * Each returned entry carries a `topics` array (`[{ id, name, color }]`).
 * @param {number} userId
 * @param {{
 *   type?: string, status?: string,
 *   q?: string, date_from?: string, date_to?: string,
 *   tags?: string, topic_id?: number, is_pinned?: boolean,
 *   page?: number, per_page?: number, sort?: string, order?: string
 * }} opts
 * @returns {Promise<{ rows: ResearchEntry[], total: number }>}
 */
export async function listResearchEntries(userId, opts = {}) {
  const {
    type,
    status,
    q,
    date_from,
    date_to,
    tags,
    topic_id,
    page = 1,
    per_page = 20,
    sort = 'created_at',
    order = 'desc',
  } = opts;

  const allowedSort = ['created_at', 'updated_at', 'title', 'type', 'status'];
  const safeSort = allowedSort.includes(sort) ? sort : 'created_at';
  const safeOrder = order === 'asc' ? 'ASC' : 'DESC';

  // All entry predicates are written against the `e` alias since topic_id needs a JOIN.
  const conditions = ['e.user_id = $1'];
  const params = [userId];
  let paramIdx = 2;

  if (type) {
    conditions.push(`e.type = $${paramIdx++}`);
    params.push(type);
  }
  if (status) {
    conditions.push(`e.status = $${paramIdx++}`);
    params.push(status);
  }
  if (q) {
    conditions.push(
      `(e.title ILIKE $${paramIdx} OR e.content ILIKE $${paramIdx} OR e.source ILIKE $${paramIdx} OR e.tags ILIKE $${paramIdx})`
    );
    params.push(`%${q}%`);
    paramIdx++;
  }
  if (date_from) {
    conditions.push(`e.created_at >= $${paramIdx++}`);
    params.push(date_from);
  }
  if (date_to) {
    conditions.push(`e.created_at <= $${paramIdx++}`);
    params.push(date_to);
  }
  // tags: comma-separated list; match entries whose tags column contains ANY of them.
  const tagList = (tags ?? '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);
  if (tagList.length > 0) {
    const tagClauses = tagList.map(() => `e.tags ILIKE $${paramIdx++}`);
    conditions.push(`(${tagClauses.join(' OR ')})`);
    tagList.forEach(t => params.push(`%${t}%`));
  }

  // topic_id requires joining the pivot. Kept as a separate join clause so the
  // base list (no topic filter) needs no join at all.
  let topicJoin = '';
  if (topic_id) {
    topicJoin = 'JOIN research_entry_topics et ON et.entry_id = e.id';
    conditions.push(`et.topic_id = $${paramIdx++}`);
    params.push(topic_id);
  }

  const where = conditions.join(' AND ');
  const offset = (page - 1) * per_page;

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM research_entries e ${topicJoin} WHERE ${where}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Pinned entries always sort to the top, then the requested sort order.
  const dataResult = await pool.query(
    `SELECT e.* FROM research_entries e ${topicJoin}
      WHERE ${where}
      ORDER BY e.is_pinned DESC, e.${safeSort} ${safeOrder}
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, per_page, offset]
  );

  await attachTopics(dataResult.rows);
  return { rows: dataResult.rows, total };
}

/**
 * Get a single research entry by id, scoped to the user. Includes `topics`.
 * @param {number} id
 * @param {number} userId
 * @returns {Promise<ResearchEntry|null>}
 */
export async function getResearchEntryById(id, userId) {
  const result = await pool.query(
    'SELECT * FROM research_entries WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  const entry = result.rows[0] ?? null;
  if (entry) await attachTopics([entry]);
  return entry;
}

/**
 * Create a new research entry. Optionally links it to topics via `topic_ids`.
 * @param {number} userId
 * @param {{ title: string, type: string, status: string, content?: string, source?: string, tags?: string, is_pinned?: boolean, topic_ids?: number[] }} data
 * @returns {Promise<ResearchEntry>}
 */
export async function createResearchEntry(userId, data) {
  const { title, type, status, content, source, tags, is_pinned, topic_ids } = data;
  const result = await pool.query(
    `INSERT INTO research_entries (user_id, title, type, status, content, source, tags, is_pinned)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [userId, title, type, status ?? 'draft', content ?? null, source ?? null, tags ?? null, is_pinned ?? false]
  );
  const entry = result.rows[0];

  if (Array.isArray(topic_ids)) {
    await addEntryToTopics(entry.id, topic_ids);
  }
  await attachTopics([entry]);
  return entry;
}

/**
 * Partial update (PATCH) a research entry. If `topic_ids` is present, the entry's
 * topic links are synced to exactly that set.
 * @param {number} id
 * @param {number} userId
 * @param {Partial<ResearchEntry> & { topic_ids?: number[] }} patch
 * @returns {Promise<ResearchEntry|null>}
 */
export async function patchResearchEntry(id, userId, patch) {
  const allowed = ['title', 'type', 'status', 'content', 'source', 'tags', 'is_pinned'];
  const fields = Object.keys(patch).filter(k => allowed.includes(k));

  if (fields.length > 0) {
    const setClauses = fields.map((f, i) => `${f} = $${i + 3}`).join(', ');
    const values = fields.map(f => patch[f]);
    const result = await pool.query(
      `UPDATE research_entries
       SET ${setClauses}
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId, ...values]
    );
    if (!result.rows[0]) return null;
  }

  // Sync topics if requested (independent of which scalar fields changed).
  if (Array.isArray(patch.topic_ids)) {
    await addEntryToTopics(id, patch.topic_ids);
  }

  return getResearchEntryById(id, userId);
}

/**
 * Delete a research entry. Pivot rows and attachments cascade via FK.
 * @param {number} id
 * @param {number} userId
 * @returns {Promise<boolean>} true if a row was deleted
 */
export async function deleteResearchEntry(id, userId) {
  const result = await pool.query(
    'DELETE FROM research_entries WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return result.rowCount > 0;
}

/**
 * Summary stats: counts per type and total.
 * @param {number} userId
 * @returns {Promise<{ total: number, journal: number, citation: number, note: number }>}
 */
export async function getResearchStats(userId) {
  const result = await pool.query(
    `SELECT
       COUNT(*)                                      AS total,
       COUNT(*) FILTER (WHERE type = 'journal')     AS journal,
       COUNT(*) FILTER (WHERE type = 'citation')    AS citation,
       COUNT(*) FILTER (WHERE type = 'note')        AS note
     FROM research_entries
     WHERE user_id = $1`,
    [userId]
  );
  const row = result.rows[0];
  return {
    total:    parseInt(row.total,    10),
    journal:  parseInt(row.journal,  10),
    citation: parseInt(row.citation, 10),
    note:     parseInt(row.note,     10),
  };
}

/**
 * Duplicate an entry: copies title/content/type/status/source/tags and topic
 * links into a fresh row (new id, new timestamps, is_pinned reset to false).
 * Attachments are NOT duplicated.
 * @param {number} id
 * @param {number} userId
 * @returns {Promise<ResearchEntry|null>} the new entry, or null if source not found
 */
export async function duplicateEntry(id, userId) {
  const source = await getResearchEntryById(id, userId);
  if (!source) return null;

  const copy = await createResearchEntry(userId, {
    title:    source.title,
    type:     source.type,
    status:   source.status,
    content:  source.content,
    source:   source.source,
    tags:     source.tags,
    is_pinned: false,
    topic_ids: (source.topics ?? []).map(t => t.id),
  });
  return copy;
}

/**
 * Bulk-update fields (e.g. status) across multiple entries owned by the user.
 * @param {number} userId
 * @param {number[]} ids
 * @param {Partial<ResearchEntry>} fields
 * @returns {Promise<number>} number of rows updated
 */
export async function bulkPatchEntries(userId, ids, fields) {
  if (!Array.isArray(ids) || ids.length === 0) return 0;
  const allowed = ['type', 'status', 'is_pinned'];
  const keys = Object.keys(fields).filter(k => allowed.includes(k));
  if (keys.length === 0) return 0;

  // $1 = userId, $2 = ids array, scalar fields start at $3.
  const setClauses = keys.map((k, i) => `${k} = $${i + 3}`).join(', ');
  const values = keys.map(k => fields[k]);

  const result = await pool.query(
    `UPDATE research_entries
       SET ${setClauses}
     WHERE user_id = $1 AND id = ANY($2::int[])`,
    [userId, ids, ...values]
  );
  return result.rowCount;
}

/**
 * Bulk-delete multiple entries owned by the user. Pivot/attachments cascade.
 * @param {number} userId
 * @param {number[]} ids
 * @returns {Promise<number>} number of rows deleted
 */
export async function bulkDeleteEntries(userId, ids) {
  if (!Array.isArray(ids) || ids.length === 0) return 0;
  const result = await pool.query(
    'DELETE FROM research_entries WHERE user_id = $1 AND id = ANY($2::int[])',
    [userId, ids]
  );
  return result.rowCount;
}

/**
 * Distinct tags across all of a user's entries, as a flat sorted array.
 * Tags are stored comma-separated per entry; this splits and de-duplicates them.
 * @param {number} userId
 * @returns {Promise<string[]>}
 */
export async function getDistinctTags(userId) {
  const { rows } = await pool.query(
    `SELECT DISTINCT btrim(tag) AS tag
       FROM research_entries,
            LATERAL unnest(string_to_array(tags, ',')) AS tag
      WHERE user_id = $1
        AND tags IS NOT NULL
        AND btrim(tag) <> ''
      ORDER BY tag ASC`,
    [userId]
  );
  return rows.map(r => r.tag);
}

// ─── Topics ───────────────────────────────────────────────────────────────────

/**
 * List a user's topics, optionally filtered by status.
 * @param {number} userId
 * @param {{ status?: string }} [opts]
 * @returns {Promise<Object[]>}
 */
export async function listTopics(userId, { status } = {}) {
  const conditions = ['user_id = $1'];
  const params = [userId];
  if (status) {
    conditions.push(`status = $${params.length + 1}`);
    params.push(status);
  }
  const { rows } = await pool.query(
    `SELECT * FROM research_topics
      WHERE ${conditions.join(' AND ')}
      ORDER BY name ASC`,
    params
  );
  return rows;
}

/**
 * Get a single topic by id, scoped to the user.
 * @param {number} id
 * @param {number} userId
 * @returns {Promise<Object|null>}
 */
export async function getTopicById(id, userId) {
  const { rows } = await pool.query(
    'SELECT * FROM research_topics WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return rows[0] ?? null;
}

/**
 * Create a topic.
 * @param {number} userId
 * @param {{ name: string, description?: string, color?: string }} data
 * @returns {Promise<Object>}
 */
export async function createTopic(userId, data) {
  const { name, description, color } = data;
  const { rows } = await pool.query(
    `INSERT INTO research_topics (user_id, name, description, color)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, name, description ?? null, color ?? '#10b981']
  );
  return rows[0];
}

/**
 * Partial update of a topic (name/description/color/status).
 * @param {number} id
 * @param {number} userId
 * @param {Partial<{ name: string, description: string, color: string, status: string }>} patch
 * @returns {Promise<Object|null>}
 */
export async function patchTopic(id, userId, patch) {
  const allowed = ['name', 'description', 'color', 'status'];
  const fields = Object.keys(patch).filter(k => allowed.includes(k));
  if (fields.length === 0) return getTopicById(id, userId);

  const setClauses = fields.map((f, i) => `${f} = $${i + 3}`).join(', ');
  const values = fields.map(f => patch[f]);

  const { rows } = await pool.query(
    `UPDATE research_topics
       SET ${setClauses}
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [id, userId, ...values]
  );
  return rows[0] ?? null;
}

/**
 * Delete a topic. Pivot rows cascade via FK.
 * @param {number} id
 * @param {number} userId
 * @returns {Promise<boolean>}
 */
export async function deleteTopic(id, userId) {
  const result = await pool.query(
    'DELETE FROM research_topics WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return result.rowCount > 0;
}

/**
 * Counts of entries within a topic, broken down by type and status.
 * Joins the pivot and scopes by user_id so a topic id from another user yields zeros.
 * @param {number} topicId
 * @param {number} userId
 * @returns {Promise<{ total: number, journal: number, citation: number, note: number, draft: number, active: number, archived: number }>}
 */
export async function getTopicStats(topicId, userId) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*)                                       AS total,
       COUNT(*) FILTER (WHERE e.type = 'journal')    AS journal,
       COUNT(*) FILTER (WHERE e.type = 'citation')   AS citation,
       COUNT(*) FILTER (WHERE e.type = 'note')       AS note,
       COUNT(*) FILTER (WHERE e.status = 'draft')    AS draft,
       COUNT(*) FILTER (WHERE e.status = 'active')   AS active,
       COUNT(*) FILTER (WHERE e.status = 'archived') AS archived
     FROM research_entry_topics et
     JOIN research_entries e ON e.id = et.entry_id
    WHERE et.topic_id = $1 AND e.user_id = $2`,
    [topicId, userId]
  );
  const r = rows[0];
  return {
    total:    parseInt(r.total,    10),
    journal:  parseInt(r.journal,  10),
    citation: parseInt(r.citation, 10),
    note:     parseInt(r.note,     10),
    draft:    parseInt(r.draft,    10),
    active:   parseInt(r.active,   10),
    archived: parseInt(r.archived, 10),
  };
}

/**
 * Sync an entry's topic links to exactly `topicIds` (delete existing, insert new).
 * @param {number} entryId
 * @param {number[]} topicIds
 * @returns {Promise<void>}
 */
export async function addEntryToTopics(entryId, topicIds) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM research_entry_topics WHERE entry_id = $1', [entryId]);

    const unique = [...new Set((topicIds ?? []).filter(n => Number.isInteger(n)))];
    if (unique.length > 0) {
      // Bulk insert via unnest; ON CONFLICT guards the composite PK.
      await client.query(
        `INSERT INTO research_entry_topics (entry_id, topic_id)
         SELECT $1, t FROM unnest($2::int[]) AS t
         ON CONFLICT DO NOTHING`,
        [entryId, unique]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Topics linked to a single entry.
 * @param {number} entryId
 * @returns {Promise<{ topic_id: number, name: string, color: string }[]>}
 */
export async function getTopicsForEntry(entryId) {
  const { rows } = await pool.query(
    `SELECT t.id AS topic_id, t.name, t.color
       FROM research_entry_topics et
       JOIN research_topics t ON t.id = et.topic_id
      WHERE et.entry_id = $1
      ORDER BY t.name ASC`,
    [entryId]
  );
  return rows;
}

/**
 * Paginated entries belonging to a topic. Reuses listResearchEntries by passing
 * topic_id through, so all the same filters/search/sort apply.
 * @param {number} topicId
 * @param {number} userId
 * @param {Object} opts
 * @returns {Promise<{ rows: ResearchEntry[], total: number }>}
 */
export async function getEntriesByTopic(topicId, userId, opts = {}) {
  return listResearchEntries(userId, { ...opts, topic_id: topicId });
}

// ─── Attachments ──────────────────────────────────────────────────────────────

/**
 * All attachments for an entry, newest first.
 * @param {number} entryId
 * @returns {Promise<Object[]>}
 */
export async function listAttachments(entryId) {
  const { rows } = await pool.query(
    'SELECT * FROM research_attachments WHERE entry_id = $1 ORDER BY created_at DESC',
    [entryId]
  );
  return rows;
}

/**
 * Insert an attachment metadata row (the bytes are written to disk by the route).
 * @param {number} entryId
 * @param {{ filename: string, original_name: string, file_path: string, mime_type?: string, size?: number }} fileInfo
 * @returns {Promise<Object>}
 */
export async function createAttachment(entryId, fileInfo) {
  const { filename, original_name, file_path, mime_type, size } = fileInfo;
  const { rows } = await pool.query(
    `INSERT INTO research_attachments (entry_id, filename, original_name, file_path, mime_type, size)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [entryId, filename, original_name, file_path, mime_type ?? null, size ?? null]
  );
  return rows[0];
}

/**
 * Fetch a single attachment row by id (used by the route to resolve the disk
 * path and verify ownership via the parent entry before deletion).
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
export async function getAttachmentById(id) {
  const { rows } = await pool.query(
    'SELECT * FROM research_attachments WHERE id = $1',
    [id]
  );
  return rows[0] ?? null;
}

/**
 * Delete an attachment row by id. The route removes the file from disk first.
 * @param {number} id
 * @returns {Promise<boolean>}
 */
export async function deleteAttachment(id) {
  const result = await pool.query(
    'DELETE FROM research_attachments WHERE id = $1',
    [id]
  );
  return result.rowCount > 0;
}
