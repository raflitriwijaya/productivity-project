// server/models/search.model.js
// Unified cross-module search (Roadmap Wave 3). Returns up to 5 matches per module
// (ILIKE), unioned and capped at 30, most-recent first. Every branch is scoped by
// user_id. Result rows share one shape so the client renders them uniformly:
//   { id, entity_type, title, subtitle, color, updated_at }

import pool from '../lib/db.js';

/**
 * @param {number} userId
 * @param {string} query  raw search text (already length-validated at the route)
 * @returns {Promise<Array<{ id: number, entity_type: string, title: string, subtitle: string|null, color: string, updated_at: string }>>}
 */
export async function searchAll(userId, query) {
  const like = `%${query}%`;
  // $1 = userId, $2 = like (title/body), $3 = like (extra column e.g. category)
  const params = [userId, like, like];

  const { rows } = await pool.query(
    `SELECT * FROM (
       SELECT id, 'todo' AS entity_type, title, NULL::text AS subtitle, 'blue' AS color, updated_at
         FROM todos
        WHERE user_id = $1 AND (title ILIKE $2 OR description ILIKE $2)
        ORDER BY updated_at DESC LIMIT 5
     ) AS t1
     UNION ALL
     SELECT * FROM (
       SELECT id, 'research_entry' AS entity_type, title, COALESCE(type, 'note') AS subtitle, 'moss' AS color, updated_at
         FROM research_entries
        WHERE user_id = $1 AND (title ILIKE $2 OR content ILIKE $2 OR tags ILIKE $2)
        ORDER BY updated_at DESC LIMIT 5
     ) AS t2
     UNION ALL
     SELECT * FROM (
       SELECT id, 'learning_item' AS entity_type, title, type AS subtitle, 'ember' AS color, updated_at
         FROM learning_items
        WHERE user_id = $1 AND (title ILIKE $2 OR notes ILIKE $2)
        ORDER BY updated_at DESC LIMIT 5
     ) AS t3
     UNION ALL
     SELECT * FROM (
       SELECT id, 'transaction' AS entity_type, COALESCE(description, type) AS title, type AS subtitle, 'moss' AS color, updated_at
         FROM transactions
        WHERE user_id = $1 AND (description ILIKE $2 OR type ILIKE $2 OR category ILIKE $3)
        ORDER BY updated_at DESC LIMIT 5
     ) AS t4
     UNION ALL
     SELECT * FROM (
       SELECT id, 'engineer_project' AS entity_type, name AS title, project_type AS subtitle, 'terracotta' AS color, updated_at
         FROM engineer_projects
        WHERE user_id = $1 AND (name ILIKE $2 OR description ILIKE $2)
        ORDER BY updated_at DESC LIMIT 5
     ) AS t5
     UNION ALL
     SELECT * FROM (
       SELECT id, 'book' AS entity_type, title, author AS subtitle, 'ember' AS color, updated_at
         FROM books
        WHERE user_id = $1 AND (title ILIKE $2 OR author ILIKE $2 OR notes ILIKE $2)
        ORDER BY updated_at DESC LIMIT 5
     ) AS t6
     ORDER BY updated_at DESC
     LIMIT 30`,
    params
  );

  return rows;
}
