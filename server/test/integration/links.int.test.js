// Roadmap Wave 1: Universal Links model integration tests against a real Postgres.
// Exercises the SHIPPED model functions (createLink / getLinksForEntity /
// getLinkById / deleteLink) so the migration, UNIQUE constraint, ON CONFLICT
// upsert, and bidirectional lookup are all proven. Skips cleanly with no DB.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { hasDb, setupDb, teardownDb, makeUser, cleanupUsers } from './db.setup.js';
import {
  createLink,
  getLinksForEntity,
  getLinkById,
  deleteLink,
  getLinkStats,
} from '../../models/links.model.js';

describe.skipIf(!hasDb)('Universal Links (real DB)', () => {
  let pool, user, otherUser, researchEntryId, learningItemId, linkId;

  beforeAll(async () => {
    pool = await setupDb();
    user = await makeUser(pool, `links_${Date.now()}@t.com`);
    otherUser = await makeUser(pool, `links_other_${Date.now()}@t.com`);

    // A research entry (the "from" side) and a learning item (the "to" side),
    // both owned by `user`. Enum values match the CHECK/columns in their tables.
    const { rows: [entry] } = await pool.query(
      `INSERT INTO research_entries (user_id, title, type, status, content)
       VALUES ($1, 'Link Test Entry', 'note', 'active', 'Test') RETURNING id`,
      [user]
    );
    researchEntryId = entry.id;

    const { rows: [item] } = await pool.query(
      `INSERT INTO learning_items (user_id, title, type, status)
       VALUES ($1, 'Link Test Learning', 'book', 'not_started') RETURNING id`,
      [user]
    );
    learningItemId = item.id;
  }, 120_000);

  afterAll(async () => {
    // ON DELETE CASCADE on entity_links.user_id removes the links with the user.
    await cleanupUsers(pool, [user, otherUser]);
    await teardownDb();
  });

  it('creates a link between two entities', async () => {
    const link = await createLink(user, {
      fromType: 'research_entry',
      fromId: researchEntryId,
      toType: 'learning_item',
      toId: learningItemId,
      note: 'Integration test link',
    });

    expect(link).toBeDefined();
    expect(link.from_type).toBe('research_entry');
    expect(link.to_type).toBe('learning_item');
    expect(link.note).toBe('Integration test link');
    linkId = link.id;
  });

  it('upserts (ON CONFLICT) instead of erroring on a duplicate pair', async () => {
    const link = await createLink(user, {
      fromType: 'research_entry',
      fromId: researchEntryId,
      toType: 'learning_item',
      toId: learningItemId,
      note: 'Updated note',
    });

    expect(link.id).toBe(linkId); // same row, updated
    expect(link.note).toBe('Updated note');
  });

  it('retrieves outgoing links for the source entity', async () => {
    const links = await getLinksForEntity(user, 'research_entry', researchEntryId, 'both');
    expect(links.length).toBeGreaterThanOrEqual(1);
    const match = links.find(l => l.id === linkId);
    expect(match).toBeDefined();
    expect(match.linked_type).toBe('learning_item');
    expect(match.linked_id).toBe(learningItemId);
    expect(match.direction).toBe('outgoing');
  });

  it('retrieves the same link as incoming from the target entity (reverse lookup)', async () => {
    const links = await getLinksForEntity(user, 'learning_item', learningItemId, 'both');
    const match = links.find(l => l.id === linkId);
    expect(match).toBeDefined();
    expect(match.linked_type).toBe('research_entry');
    expect(match.linked_id).toBe(researchEntryId);
    expect(match.direction).toBe('incoming');
  });

  it('reports per-type link stats', async () => {
    const stats = await getLinkStats(user);
    expect(stats.research_entry).toBeGreaterThanOrEqual(1);
    expect(stats.learning_item).toBeGreaterThanOrEqual(1);
  });

  it('does not leak another user\'s link via getLinkById', async () => {
    const notMine = await getLinkById(otherUser, linkId);
    expect(notMine).toBeNull();
  });

  it('does not delete another user\'s link', async () => {
    const result = await deleteLink(otherUser, linkId);
    expect(result).toBeNull();
    // Still there for the rightful owner.
    expect(await getLinkById(user, linkId)).not.toBeNull();
  });

  it('deletes a link for its owner', async () => {
    const deleted = await deleteLink(user, linkId);
    expect(deleted.id).toBe(linkId);
    expect(await getLinkById(user, linkId)).toBeNull();
  });

  it('returns null when getting a non-existent link', async () => {
    expect(await getLinkById(user, 999_999_999)).toBeNull();
  });
});
