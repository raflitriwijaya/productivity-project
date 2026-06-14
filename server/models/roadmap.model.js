// server/models/roadmap.model.js
// Custom Learning Roadmaps (replaces the hardcoded 12-month engineer roadmap with
// user-defined learning paths for any discipline). Three nested levels:
//   learning_roadmaps → roadmap_tracks → roadmap_milestones
//
// Every query is scoped `WHERE user_id = $1` and parameterized (§6.5). Ownership of
// a parent is re-verified before a nested write. Progress is AUTO-CALCULATED, not
// user-set: any milestone status change (create / update / delete) triggers
// recalcProgress, which rewrites roadmap_tracks.progress and learning_roadmaps.progress
// from the underlying milestone counts (completed / non-skipped). Synchronous on the
// API call — fine for a single user (see Wave risk notes).
//
// Follows the (userId, …) argument order used across the codebase. JSONB (`resources`)
// comes back pre-parsed; on write it is JSON.stringify'd and cast `::jsonb` (mirrors
// engineer.model.seedSnippetsForUser).

import pool from '../lib/db.js';

// ── Field whitelists (snake_case wire format) ────────────────────────────────
const ROADMAP_UPDATABLE   = ['title', 'description', 'category', 'status', 'icon', 'color'];
const TRACK_UPDATABLE     = ['title', 'description', 'sort_order', 'color'];
const MILESTONE_UPDATABLE = [
  'title', 'description', 'status', 'priority', 'sort_order',
  'due_date', 'notes', 'resources', 'estimated_hours', 'actual_hours',
];

const ROADMAP_SORT = ['created_at', 'updated_at', 'title', 'status', 'category', 'progress'];

/** Coerce a pg COUNT/NUMERIC string to a JS number (null-safe). */
function num(v) {
  if (v === null || v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// ──────────────────────────────────────────────────────────────────────────────
// Roadmaps
// ──────────────────────────────────────────────────────────────────────────────

/**
 * List the user's roadmaps (flat) with aggregate track/milestone counts. The list
 * endpoint is intentionally flat — the nested tracks/milestones live on the detail
 * endpoint (getRoadmapById).
 * @param {number} userId
 * @param {{ status?: string, category?: string, sort?: string, order?: string }} [opts]
 * @returns {Promise<object[]>}
 */
export async function listRoadmaps(userId, opts = {}) {
  const { status, category, sort = 'updated_at', order = 'desc' } = opts;

  const sortCol   = ROADMAP_SORT.includes(sort) ? sort : 'updated_at';
  const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

  const conditions = ['r.user_id = $1'];
  const params = [userId];

  if (status)   { params.push(status);   conditions.push(`r.status = $${params.length}`); }
  if (category) { params.push(category); conditions.push(`r.category = $${params.length}`); }

  const { rows } = await pool.query(
    `SELECT r.*,
            COALESCE(tc.track_count, 0)     AS track_count,
            COALESCE(mc.milestone_total, 0) AS milestone_total,
            COALESCE(mc.milestone_done, 0)  AS milestone_done
       FROM learning_roadmaps r
       LEFT JOIN (
         SELECT roadmap_id, COUNT(*) AS track_count
           FROM roadmap_tracks WHERE user_id = $1 GROUP BY roadmap_id
       ) tc ON tc.roadmap_id = r.id
       LEFT JOIN (
         SELECT t.roadmap_id,
                COUNT(*)                                       AS milestone_total,
                COUNT(*) FILTER (WHERE m.status = 'completed') AS milestone_done
           FROM roadmap_milestones m
           JOIN roadmap_tracks t ON t.id = m.track_id
          WHERE m.user_id = $1
          GROUP BY t.roadmap_id
       ) mc ON mc.roadmap_id = r.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY r.${sortCol} ${sortOrder}`,
    params
  );

  return rows.map((r) => ({
    ...r,
    track_count:     num(r.track_count),
    milestone_total: num(r.milestone_total),
    milestone_done:  num(r.milestone_done),
  }));
}

/**
 * Plain roadmap row (no nesting/counts), scoped to the user. Used for ownership
 * checks and by the Universal Links ownership validator.
 * @param {number} userId
 * @param {number} id
 * @returns {Promise<object|null>}
 */
export async function getRoadmapRow(userId, id) {
  const { rows } = await pool.query(
    'SELECT * FROM learning_roadmaps WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return rows[0] ?? null;
}

/**
 * Get a single roadmap with its tracks and each track's milestones nested.
 * Tracks ordered by (sort_order, id); milestones ordered by (sort_order, id).
 * @param {number} userId
 * @param {number} id
 * @returns {Promise<object|null>}
 */
export async function getRoadmapById(userId, id) {
  const roadmap = await getRoadmapRow(userId, id);
  if (!roadmap) return null;

  const [tracksRes, milestonesRes] = await Promise.all([
    pool.query(
      `SELECT * FROM roadmap_tracks
         WHERE roadmap_id = $1 AND user_id = $2
         ORDER BY sort_order ASC, id ASC`,
      [id, userId]
    ),
    pool.query(
      `SELECT m.* FROM roadmap_milestones m
         JOIN roadmap_tracks t ON t.id = m.track_id
        WHERE t.roadmap_id = $1 AND m.user_id = $2
        ORDER BY m.sort_order ASC, m.id ASC`,
      [id, userId]
    ),
  ]);

  const byTrack = new Map();
  for (const m of milestonesRes.rows) {
    if (!byTrack.has(m.track_id)) byTrack.set(m.track_id, []);
    byTrack.get(m.track_id).push(m);
  }

  return {
    ...roadmap,
    tracks: tracksRes.rows.map((t) => ({
      ...t,
      milestones: byTrack.get(t.id) ?? [],
    })),
  };
}

/**
 * Create a roadmap, optionally with initial tracks (the create modal lets the user
 * add 1–5 tracks inline). Wrapped in a transaction so a partial create can't leak.
 * @param {number} userId
 * @param {object} data { title, description?, category?, status?, icon?, color?, tracks?: [{title, description?, color?}] }
 * @returns {Promise<object>} the new roadmap nested with any created tracks
 */
export async function createRoadmap(userId, data) {
  const {
    title, description = null, category = null,
    status = 'active', icon = null, color = '#4A7C59', tracks = [],
  } = data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO learning_roadmaps (user_id, title, description, category, status, icon, color)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [userId, title, description, category, status, icon, color ?? '#4A7C59']
    );
    const roadmap = rows[0];

    let order = 0;
    for (const t of tracks) {
      if (!t || !t.title) continue;
      await client.query(
        `INSERT INTO roadmap_tracks (roadmap_id, user_id, title, description, sort_order, color)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [roadmap.id, userId, t.title, t.description ?? null, order++, t.color ?? null]
      );
    }

    await client.query('COMMIT');
    return getRoadmapById(userId, roadmap.id);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Partial update of a roadmap's metadata (progress is auto-calculated, never set here).
 * Auto-manages completed timestamp is N/A for roadmaps. Returns null if not found/owned.
 * @param {number} userId
 * @param {number} id
 * @param {object} data
 * @returns {Promise<object|null>}
 */
export async function updateRoadmap(userId, id, data) {
  const existing = await getRoadmapRow(userId, id);
  if (!existing) return null;

  const fields = [];
  const params = [userId, id];
  let p = 3;

  for (const f of ROADMAP_UPDATABLE) {
    if (data[f] !== undefined) {
      fields.push(`${f} = $${p++}`);
      params.push(data[f]);
    }
  }

  if (fields.length === 0) return getRoadmapById(userId, id);

  await pool.query(
    `UPDATE learning_roadmaps SET ${fields.join(', ')} WHERE id = $2 AND user_id = $1`,
    params
  );
  return getRoadmapById(userId, id);
}

/**
 * Delete a roadmap. Cascades to its tracks and milestones (FK ON DELETE CASCADE).
 * @param {number} userId
 * @param {number} id
 * @returns {Promise<object|null>} the deleted row, or null if not found / not owned
 */
export async function deleteRoadmap(userId, id) {
  const { rows } = await pool.query(
    'DELETE FROM learning_roadmaps WHERE id = $1 AND user_id = $2 RETURNING *',
    [id, userId]
  );
  return rows[0] ?? null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Tracks
// ──────────────────────────────────────────────────────────────────────────────

/** Plain track row, scoped to the user. */
export async function getTrackRow(userId, trackId) {
  const { rows } = await pool.query(
    'SELECT * FROM roadmap_tracks WHERE id = $1 AND user_id = $2',
    [trackId, userId]
  );
  return rows[0] ?? null;
}

/**
 * Add a track to a roadmap. Verifies the roadmap is owned first (returns null if not).
 * When sort_order is omitted, appends after the current max.
 * @param {number} userId
 * @param {number} roadmapId
 * @param {object} data { title, description?, color?, sort_order? }
 * @returns {Promise<object|null>}
 */
export async function createTrack(userId, roadmapId, data) {
  const roadmap = await getRoadmapRow(userId, roadmapId);
  if (!roadmap) return null;

  const { title, description = null, color = null, sort_order } = data;

  const { rows } = await pool.query(
    `INSERT INTO roadmap_tracks (roadmap_id, user_id, title, description, color, sort_order)
     VALUES ($1, $2, $3, $4, $5,
             COALESCE($6, (SELECT COALESCE(MAX(sort_order) + 1, 0)
                             FROM roadmap_tracks WHERE roadmap_id = $1 AND user_id = $2)))
     RETURNING *`,
    [roadmapId, userId, title, description, color, sort_order ?? null]
  );
  return rows[0];
}

/**
 * Partial update of a track (title/description/sort_order/color). Returns null if
 * not found/owned.
 * @param {number} userId
 * @param {number} trackId
 * @param {object} data
 * @returns {Promise<object|null>}
 */
export async function updateTrack(userId, trackId, data) {
  const existing = await getTrackRow(userId, trackId);
  if (!existing) return null;

  const fields = [];
  const params = [userId, trackId];
  let p = 3;

  for (const f of TRACK_UPDATABLE) {
    if (data[f] !== undefined) {
      fields.push(`${f} = $${p++}`);
      params.push(data[f]);
    }
  }

  if (fields.length === 0) return existing;

  const { rows } = await pool.query(
    `UPDATE roadmap_tracks SET ${fields.join(', ')} WHERE id = $2 AND user_id = $1 RETURNING *`,
    params
  );
  return rows[0] ?? null;
}

/**
 * Delete a track. Cascades to its milestones, then recalculates the parent
 * roadmap's progress.
 * @param {number} userId
 * @param {number} trackId
 * @returns {Promise<object|null>} the deleted track, or null if not found / not owned
 */
export async function deleteTrack(userId, trackId) {
  const existing = await getTrackRow(userId, trackId);
  if (!existing) return null;

  await pool.query('DELETE FROM roadmap_tracks WHERE id = $1 AND user_id = $2', [trackId, userId]);
  await recalcProgress(userId, existing.roadmap_id);
  return existing;
}

// ──────────────────────────────────────────────────────────────────────────────
// Milestones
// ──────────────────────────────────────────────────────────────────────────────

/** Plain milestone row, scoped to the user. */
export async function getMilestoneRow(userId, milestoneId) {
  const { rows } = await pool.query(
    'SELECT * FROM roadmap_milestones WHERE id = $1 AND user_id = $2',
    [milestoneId, userId]
  );
  return rows[0] ?? null;
}

/** The roadmap_id that owns a given track (scoped), or null. */
async function roadmapIdForTrack(userId, trackId) {
  const { rows } = await pool.query(
    'SELECT roadmap_id FROM roadmap_tracks WHERE id = $1 AND user_id = $2',
    [trackId, userId]
  );
  return rows[0]?.roadmap_id ?? null;
}

/**
 * Add a milestone to a track. Verifies the track is owned (returns null if not).
 * completed_at is stamped when created directly as 'completed'. Recalculates the
 * roadmap's progress (a new milestone changes the denominator).
 * @param {number} userId
 * @param {number} trackId
 * @param {object} data
 * @returns {Promise<object|null>}
 */
export async function createMilestone(userId, trackId, data) {
  const roadmapId = await roadmapIdForTrack(userId, trackId);
  if (roadmapId == null) return null;

  const {
    title, description = null, status = 'pending', priority = 'medium',
    sort_order, due_date = null, notes = null, resources = [],
    estimated_hours = null, actual_hours = null,
  } = data;

  // Stamp completed_at in JS rather than a SQL CASE on $5 — reusing the status
  // parameter both as a column value (varchar) and in a comparison (text) makes
  // Postgres deduce inconsistent types for it (42P08).
  const completedAt = status === 'completed' ? new Date() : null;

  const { rows } = await pool.query(
    `INSERT INTO roadmap_milestones
       (track_id, user_id, title, description, status, priority, sort_order,
        due_date, completed_at, notes, resources, estimated_hours, actual_hours)
     VALUES ($1, $2, $3, $4, $5, $6,
             COALESCE($7, (SELECT COALESCE(MAX(sort_order) + 1, 0)
                             FROM roadmap_milestones WHERE track_id = $1 AND user_id = $2)),
             $8, $9, $10, $11::jsonb, $12, $13)
     RETURNING *`,
    [
      trackId, userId, title, description, status, priority, sort_order ?? null,
      due_date, completedAt, notes, JSON.stringify(resources ?? []), estimated_hours, actual_hours,
    ]
  );

  await recalcProgress(userId, roadmapId);
  return rows[0];
}

/**
 * Partial update of a milestone. Status changes auto-manage completed_at:
 * transitioning into 'completed' stamps NOW() (unless an explicit completed_at is
 * supplied); transitioning out of 'completed' clears it. Recalculates the parent
 * roadmap's progress after any change. Returns null if not found / not owned.
 * @param {number} userId
 * @param {number} milestoneId
 * @param {object} data
 * @returns {Promise<object|null>}
 */
export async function updateMilestone(userId, milestoneId, data) {
  const existing = await getMilestoneRow(userId, milestoneId);
  if (!existing) return null;

  const fields = [];
  const params = [userId, milestoneId];
  let p = 3;

  for (const f of MILESTONE_UPDATABLE) {
    if (data[f] === undefined) continue;
    if (f === 'resources') {
      fields.push(`resources = $${p++}::jsonb`);
      params.push(JSON.stringify(data.resources ?? []));
    } else {
      fields.push(`${f} = $${p++}`);
      params.push(data[f]);
    }
  }

  // Auto-stamp / clear completed_at on status transitions (unless caller set it).
  if (
    data.status === 'completed' &&
    data.completed_at === undefined &&
    existing.status !== 'completed'
  ) {
    fields.push('completed_at = NOW()');
  } else if (
    data.status !== undefined &&
    data.status !== 'completed' &&
    existing.completed_at
  ) {
    fields.push('completed_at = NULL');
  }

  if (fields.length > 0) {
    await pool.query(
      `UPDATE roadmap_milestones SET ${fields.join(', ')} WHERE id = $2 AND user_id = $1`,
      params
    );
  }

  const roadmapId = await roadmapIdForTrack(userId, existing.track_id);
  if (roadmapId != null) await recalcProgress(userId, roadmapId);

  return getMilestoneRow(userId, milestoneId);
}

/**
 * Delete a milestone, then recalculate the parent roadmap's progress.
 * @param {number} userId
 * @param {number} milestoneId
 * @returns {Promise<object|null>} the deleted milestone, or null if not found / not owned
 */
export async function deleteMilestone(userId, milestoneId) {
  const existing = await getMilestoneRow(userId, milestoneId);
  if (!existing) return null;

  await pool.query('DELETE FROM roadmap_milestones WHERE id = $1 AND user_id = $2', [milestoneId, userId]);

  const roadmapId = await roadmapIdForTrack(userId, existing.track_id);
  if (roadmapId != null) await recalcProgress(userId, roadmapId);

  return existing;
}

// ──────────────────────────────────────────────────────────────────────────────
// Progress + stats
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Recalculate progress for every track of a roadmap and the roadmap itself, from
 * the underlying milestone counts. Progress = completed / non-skipped × 100 (0 when
 * a track/roadmap has no countable milestones). Persists both levels and returns the
 * refreshed nested roadmap. No-op (returns null) if the roadmap isn't owned.
 * @param {number} userId
 * @param {number} roadmapId
 * @returns {Promise<object|null>}
 */
export async function recalcProgress(userId, roadmapId) {
  const roadmap = await getRoadmapRow(userId, roadmapId);
  if (!roadmap) return null;

  // Per-track: completed / non-skipped. Correlated subquery so empty tracks → 0.
  await pool.query(
    `UPDATE roadmap_tracks t SET progress = COALESCE((
       SELECT CASE
                WHEN COUNT(*) FILTER (WHERE m.status <> 'skipped') = 0 THEN 0
                ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE m.status = 'completed')
                                  / COUNT(*) FILTER (WHERE m.status <> 'skipped'), 2)
              END
         FROM roadmap_milestones m
        WHERE m.track_id = t.id AND m.user_id = $1
     ), 0)
     WHERE t.roadmap_id = $2 AND t.user_id = $1`,
    [userId, roadmapId]
  );

  // Roadmap-level: completed / non-skipped across all milestones (via tracks).
  await pool.query(
    `UPDATE learning_roadmaps r SET progress = COALESCE((
       SELECT CASE
                WHEN COUNT(*) FILTER (WHERE m.status <> 'skipped') = 0 THEN 0
                ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE m.status = 'completed')
                                  / COUNT(*) FILTER (WHERE m.status <> 'skipped'), 2)
              END
         FROM roadmap_milestones m
         JOIN roadmap_tracks t ON t.id = m.track_id
        WHERE t.roadmap_id = r.id AND m.user_id = $1
     ), 0)
     WHERE r.id = $2 AND r.user_id = $1`,
    [userId, roadmapId]
  );

  return getRoadmapById(userId, roadmapId);
}

/**
 * Aggregate stats across all of a user's roadmaps for the summary cards.
 * @param {number} userId
 * @returns {Promise<{ total, active, completed, archived, paused, total_tracks, total_milestones, milestones_done }>}
 */
export async function getRoadmapStats(userId) {
  const [roadmapRes, milestoneRes, trackRes] = await Promise.all([
    pool.query(
      `SELECT
         COUNT(*)                                     AS total,
         COUNT(*) FILTER (WHERE status = 'active')    AS active,
         COUNT(*) FILTER (WHERE status = 'completed') AS completed,
         COUNT(*) FILTER (WHERE status = 'archived')  AS archived,
         COUNT(*) FILTER (WHERE status = 'paused')    AS paused
       FROM learning_roadmaps WHERE user_id = $1`,
      [userId]
    ),
    pool.query(
      `SELECT
         COUNT(*)                                       AS total_milestones,
         COUNT(*) FILTER (WHERE status = 'completed')   AS milestones_done
       FROM roadmap_milestones WHERE user_id = $1`,
      [userId]
    ),
    pool.query('SELECT COUNT(*) AS total_tracks FROM roadmap_tracks WHERE user_id = $1', [userId]),
  ]);

  const r = roadmapRes.rows[0];
  const m = milestoneRes.rows[0];
  const t = trackRes.rows[0];

  return {
    total:            num(r.total),
    active:           num(r.active),
    completed:        num(r.completed),
    archived:         num(r.archived),
    paused:           num(r.paused),
    total_tracks:     num(t.total_tracks),
    total_milestones: num(m.total_milestones),
    milestones_done:  num(m.milestones_done),
  };
}
