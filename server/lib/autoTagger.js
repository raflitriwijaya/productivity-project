// server/lib/autoTagger.js
// Roadmap Wave 6 (Moonshots): local AI auto-tagging for research entries.
//
// Suggests tags for a new/edited entry by embedding it, finding the most
// semantically similar existing entries, and surfacing the tags those neighbours
// already carry — ranked by frequency. Entirely best-effort: any failure
// (no API key, no pgvector, upstream error) yields an empty list so the create/
// edit flow is never blocked.

import { generateEmbeddingForEntry } from './embeddings.js';
import { semanticSearch } from '../models/embeddings.model.js';

/**
 * Suggest up to 10 tags for an entry based on its nearest semantic neighbours.
 * @param {number} userId
 * @param {{ title?: string, content?: string, tags?: string, source?: string }} entry
 * @returns {Promise<string[]>} suggested tags (lowercased, frequency-ordered)
 */
export async function suggestTags(userId, entry) {
  try {
    const embedding = await generateEmbeddingForEntry(entry);
    // High threshold (0.5) — only genuinely similar entries should donate tags.
    const similar = await semanticSearch(userId, embedding, 10, 0.5);

    const tagCounts = {};
    for (const row of similar) {
      if (!row.tags) continue;
      for (const raw of row.tags.split(',')) {
        const tag = raw.trim().toLowerCase();
        if (tag.length > 1) {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        }
      }
    }

    return Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([tag]) => tag);
  } catch {
    return []; // best-effort — never block the caller
  }
}
