// server/routes/research.js
// Mount in server/index.js as:
//   app.use('/api/research', requireAuth, researchRouter)
//
// Route ordering (§ param-shadowing rule): every literal sub-path — /stats,
// /topics, /export, /bulk, /tags, /attachments/:id — is registered BEFORE the
// generic /:id group so the dynamic segment never swallows a static path.

import { Router } from 'express';
import { z } from 'zod';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto'; // Phase 1: UUID filenames prevent enumeration
import multer from 'multer';

import { validate } from '../middleware/validate.js';
import { AppError } from '../lib/AppError.js';
import { logger } from '../lib/logger.js';
import { ENTRY_TYPES, ENTRY_STATUSES, TOPIC_STATUSES, ALLOWED_EXT, ALLOWED_MIME } from '../lib/enums.js';
import {
  listResearchEntries,
  getResearchEntryById,
  createResearchEntry,
  patchResearchEntry,
  deleteResearchEntry,
  getResearchStats,
  duplicateEntry,
  bulkPatchEntries,
  bulkDeleteEntries,
  getDistinctTags,
  listTopics,
  getTopicById,
  createTopic,
  patchTopic,
  deleteTopic,
  getTopicStats,
  getEntriesByTopic,
  addEntryToTopics,
  getTopicsForEntry,
  listAttachments,
  createAttachment,
  getAttachmentById,
  deleteAttachment,
} from '../models/research.model.js';

const router = Router();

// ─── Uploads dir + multer config ─────────────────────────────────────────────
// Attachments are stored under server/uploads/ (resolved from this file's
// location so it's independent of the process CWD). Exported so index.js can
// ensure the directory exists and statically serve it.

export const uploadsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'uploads'
);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(uploadsDir, { recursive: true });
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Phase 1: crypto UUID eliminates timing/enumeration attacks on filenames.
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${randomUUID()}${ext}`);
  },
});

// Exported so the test exercises the SHIPPED filter, not a re-implemented copy.
export function researchFileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXT.has(ext) || !ALLOWED_MIME.has(file.mimetype)) {
    return cb(new AppError('Unsupported file type.', 400, 'VALIDATION_ERROR', 'file'));
  }
  cb(null, true);
}

export { ALLOWED_EXT, ALLOWED_MIME } from '../lib/enums.js';

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: researchFileFilter,
});

// ─── Zod schemas ────────────────────────────────────────────────────────────

const topicIdsSchema = z.array(z.number().int().positive()).optional();

const createSchema = z.object({
  title:   z.string().min(1, 'Title is required.').max(255),
  type:    z.enum(ENTRY_TYPES,    { errorMap: () => ({ message: 'Type must be journal, citation, or note.' }) }),
  status:  z.enum(ENTRY_STATUSES, { errorMap: () => ({ message: 'Status must be draft, active, or archived.' }) }).default('draft'),
  content: z.string().max(10000).optional(),
  source:  z.string().max(500).optional(),
  tags:    z.string().max(500).optional(),
  is_pinned: z.boolean().optional(),
  topic_ids: topicIdsSchema,
});

const patchSchema = z.object({
  title:   z.string().min(1).max(255).optional(),
  type:    z.enum(ENTRY_TYPES).optional(),
  status:  z.enum(ENTRY_STATUSES).optional(),
  content: z.string().max(10000).optional(),
  source:  z.string().max(500).optional(),
  tags:    z.string().max(500).optional(),
  is_pinned: z.boolean().optional(),
  topic_ids: topicIdsSchema,
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field is required.' });

const topicCreateSchema = z.object({
  name:        z.string().min(1, 'Name is required.').max(255),
  description: z.string().max(10000).optional(),
  color:       z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex string like #10b981.').optional(),
});

const topicPatchSchema = z.object({
  name:        z.string().min(1).max(255).optional(),
  description: z.string().max(10000).optional(),
  color:       z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex string like #10b981.').optional(),
  status:      z.enum(TOPIC_STATUSES).optional(),
}).refine(data => Object.keys(data).length > 0, { message: 'At least one field is required.' });

const entryTopicsSchema = z.object({
  topic_ids: z.array(z.number().int().positive()),
});

const bulkPatchSchema = z.object({
  ids:       z.array(z.number().int().positive()).min(1, 'At least one id is required.'),
  status:    z.enum(ENTRY_STATUSES).optional(),
  type:      z.enum(ENTRY_TYPES).optional(),
  is_pinned: z.boolean().optional(),
}).refine(
  data => data.status !== undefined || data.type !== undefined || data.is_pinned !== undefined,
  { message: 'Provide at least one field to update (status, type, or is_pinned).' }
);

const bulkDeleteSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'At least one id is required.'),
});

// ─── Pre-upload ownership guard ───────────────────────────────────────────────
// Phase 8: verify entry ownership BEFORE multer writes anything to disk, so a
// flood of uploads to non-owned :id values never churns the filesystem. Stashes
// the entry on req so the POST handler doesn't re-query.
async function requireOwnedEntry(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const entry = await getResearchEntryById(id, req.user.id);
    if (!entry) return next(new AppError('Research entry not found.', 404, 'NOT_FOUND'));
    req.ownedEntry = entry;
    next();
  } catch (err) {
    next(err);
  }
}

// ─── Shared query-param parsing for list-style endpoints ─────────────────────

function parseListOpts(query) {
  const { type, status, q, date_from, date_to, tags, topic_id, page, per_page, sort, order } = query;
  return {
    type:      type     || undefined,
    status:    status   || undefined,
    q:         q        || undefined,
    date_from: date_from || undefined,
    date_to:   date_to  || undefined,
    tags:      tags     || undefined,
    topic_id:  topic_id ? parseInt(topic_id, 10) : undefined,
    page:      page     ? parseInt(page, 10)     : 1,
    per_page:  per_page ? Math.min(parseInt(per_page, 10), 100) : 20,
    sort:      sort     || 'created_at',
    order:     order    || 'desc',
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// LITERAL SUB-PATHS (must precede /:id)
// ═════════════════════════════════════════════════════════════════════════════

// ─── GET /api/research/stats ─────────────────────────────────────────────────

router.get('/stats', async (req, res, next) => {
  try {
    const stats = await getResearchStats(req.user.id);
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/research/tags ──────────────────────────────────────────────────

router.get('/tags', async (req, res, next) => {
  try {
    const tags = await getDistinctTags(req.user.id);
    res.json({ success: true, data: tags });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/research/export ────────────────────────────────────────────────
// Exports the user's entries (honouring the same filters as the list) as a
// downloadable json or csv file.

router.get('/export', async (req, res, next) => {
  try {
    const format = (req.query.format || 'json').toLowerCase();
    if (format !== 'json' && format !== 'csv') {
      return next(new AppError('Format must be json or csv.', 400, 'VALIDATION_ERROR', 'format'));
    }

    (req.log ?? logger).info({
      event: 'EXPORT',
      userId: req.user.id,
      format,
      filters: { q: req.query.q, tags: req.query.tags, date_from: req.query.date_from, date_to: req.query.date_to, topic_id: req.query.topic_id },
      reqId: req.id,
    }, `User ${req.user.id} exported research data as ${format}`);

    // Phase 8: bound export memory — cap at EXPORT_MAX rows and reject larger
    // result sets with 413 so a single request can't pin the container heap.
    const EXPORT_MAX = 10000;
    const opts = { ...parseListOpts(req.query), page: 1, per_page: EXPORT_MAX };
    const { rows, total } = await listResearchEntries(req.user.id, opts);

    if (total > EXPORT_MAX) {
      return next(new AppError(
        `Export too large: ${total} entries match (max ${EXPORT_MAX}). Narrow the filters (type, topic, date range, or search) and try again.`,
        413, 'PAYLOAD_TOO_LARGE'
      ));
    }

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="research-export.json"');
      return res.send(JSON.stringify(rows)); // Phase 8: no pretty-print — halves payload + heap
    }

    // CSV
    const cols = ['id', 'title', 'type', 'status', 'source', 'tags', 'is_pinned', 'created_at', 'updated_at'];
    const escape = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      cols.join(','),
      ...rows.map(r => cols.map(c => escape(r[c])).join(',')),
    ];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="research-export.csv"');
    return res.send(lines.join('\n'));
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/research/bulk ────────────────────────────────────────────────

router.patch('/bulk', validate(bulkPatchSchema), async (req, res, next) => {
  try {
    const { ids, ...fields } = req.body;
    const updated = await bulkPatchEntries(req.user.id, ids, fields);
    res.json({ success: true, data: { updated } });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/research/bulk ───────────────────────────────────────────────

router.delete('/bulk', validate(bulkDeleteSchema), async (req, res, next) => {
  try {
    const deleted = await bulkDeleteEntries(req.user.id, req.body.ids);
    res.json({ success: true, data: { deleted } });
  } catch (err) {
    next(err);
  }
});

// ─── Topics ──────────────────────────────────────────────────────────────────

// GET /api/research/topics
router.get('/topics', async (req, res, next) => {
  try {
    const topics = await listTopics(req.user.id, { status: req.query.status || undefined });
    res.json({ success: true, data: topics });
  } catch (err) {
    next(err);
  }
});

// POST /api/research/topics
router.post('/topics', validate(topicCreateSchema), async (req, res, next) => {
  try {
    const topic = await createTopic(req.user.id, req.body);
    res.status(201).json({ success: true, data: topic });
  } catch (err) {
    next(err);
  }
});

// GET /api/research/topics/:id/entries  (more specific than /topics/:id)
router.get('/topics/:id/entries', async (req, res, next) => {
  try {
    const topicId = parseInt(req.params.id, 10);
    const topic = await getTopicById(topicId, req.user.id);
    if (!topic) return next(new AppError('Topic not found.', 404, 'NOT_FOUND'));

    const opts = parseListOpts(req.query);
    const { rows, total } = await getEntriesByTopic(topicId, req.user.id, opts);
    res.json({
      success: true,
      data: rows,
      meta: { total, page: opts.page, per_page: opts.per_page },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/research/topics/:id  → { topic, stats }
router.get('/topics/:id', async (req, res, next) => {
  try {
    const topicId = parseInt(req.params.id, 10);
    const topic = await getTopicById(topicId, req.user.id);
    if (!topic) return next(new AppError('Topic not found.', 404, 'NOT_FOUND'));

    const stats = await getTopicStats(topicId, req.user.id);
    res.json({ success: true, data: { topic, stats } });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/research/topics/:id
router.patch('/topics/:id', validate(topicPatchSchema), async (req, res, next) => {
  try {
    const topicId = parseInt(req.params.id, 10);
    const existing = await getTopicById(topicId, req.user.id);
    if (!existing) return next(new AppError('Topic not found.', 404, 'NOT_FOUND'));

    const updated = await patchTopic(topicId, req.user.id, req.body);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/research/topics/:id
router.delete('/topics/:id', async (req, res, next) => {
  try {
    const topicId = parseInt(req.params.id, 10);
    const deleted = await deleteTopic(topicId, req.user.id);
    if (!deleted) return next(new AppError('Topic not found.', 404, 'NOT_FOUND'));
    res.json({ success: true, data: { id: topicId } });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/research/attachments/:id/download ──────────────────────────────
// Phase 1: replaces the public /uploads static mount. Requires session auth
// (via requireAuth applied at the router level in index.js) and verifies that
// the attachment's parent research entry belongs to req.user before streaming.
// Returns 404 for both missing and non-owned attachments to avoid existence
// disclosure. Sets Content-Disposition: attachment so files are never rendered.

router.get('/attachments/:id/download', async (req, res, next) => {
  try {
    const attId = parseInt(req.params.id, 10);
    const attachment = await getAttachmentById(attId);
    if (!attachment) return next(new AppError('Not found.', 404, 'NOT_FOUND'));

    // Ownership check: the parent entry must belong to the requesting user.
    const entry = await getResearchEntryById(attachment.entry_id, req.user.id);
    if (!entry) return next(new AppError('Not found.', 404, 'NOT_FOUND'));

    // Reconstruct path from filename only — never trust a stored absolute path.
    const filePath = path.join(uploadsDir, attachment.filename);
    if (!fs.existsSync(filePath)) return next(new AppError('Not found.', 404, 'NOT_FOUND'));

    res.setHeader('Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(attachment.original_name)}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', attachment.mime_type || 'application/octet-stream');
    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/research/attachments/:id ────────────────────────────────────
// Literal "/attachments/:id" — registered before the generic "/:id". Ownership
// is verified via the parent entry before the file + row are removed.

router.delete('/attachments/:id', async (req, res, next) => {
  try {
    const attId = parseInt(req.params.id, 10);
    const attachment = await getAttachmentById(attId);
    if (!attachment) return next(new AppError('Attachment not found.', 404, 'NOT_FOUND'));

    // Ownership: the parent entry must belong to the requesting user.
    const entry = await getResearchEntryById(attachment.entry_id, req.user.id);
    if (!entry) return next(new AppError('Attachment not found.', 404, 'NOT_FOUND'));

    // Phase 8: reconstruct path from filename (matches the download route) —
    // never trust the stored absolute file_path, which breaks on a host/mount move.
    const filePath = path.join(uploadsDir, attachment.filename);
    try {
      await fs.promises.rm(filePath, { force: true });
    } catch (rmErr) {
      (req.log ?? logger).error({ err: rmErr, path: filePath }, 'Failed to remove attachment file');
    }
    await deleteAttachment(attId);

    res.json({ success: true, data: { id: attId } });
  } catch (err) {
    next(err);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// COLLECTION + GENERIC /:id ROUTES
// ═════════════════════════════════════════════════════════════════════════════

// ─── GET /api/research ───────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const opts = parseListOpts(req.query);
    const { rows, total } = await listResearchEntries(req.user.id, opts);
    res.json({
      success: true,
      data: rows,
      meta: { total, page: opts.page, per_page: opts.per_page },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/research ──────────────────────────────────────────────────────

router.post('/', validate(createSchema), async (req, res, next) => {
  try {
    const entry = await createResearchEntry(req.user.id, req.body);
    res.status(201).json({ success: true, data: entry });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/research/:id ───────────────────────────────────────────────────

router.get('/:id', async (req, res, next) => {
  try {
    const entry = await getResearchEntryById(parseInt(req.params.id, 10), req.user.id);
    if (!entry) return next(new AppError('Research entry not found.', 404, 'NOT_FOUND'));
    res.json({ success: true, data: entry });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/research/:id ─────────────────────────────────────────────────

router.patch('/:id', validate(patchSchema), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await getResearchEntryById(id, req.user.id);
    if (!existing) return next(new AppError('Research entry not found.', 404, 'NOT_FOUND'));

    const updated = await patchResearchEntry(id, req.user.id, req.body);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/research/:id ────────────────────────────────────────────────

router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const deleted = await deleteResearchEntry(id, req.user.id);
    if (!deleted) return next(new AppError('Research entry not found.', 404, 'NOT_FOUND'));
    (req.log ?? logger).info({ event: 'DELETE', userId: req.user.id, resource: 'research_entry', resourceId: id, reqId: req.id }, `User ${req.user.id} deleted research_entry ${id}`);
    res.json({ success: true, data: { id } });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/research/:id/duplicate ────────────────────────────────────────

router.post('/:id/duplicate', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const copy = await duplicateEntry(id, req.user.id);
    if (!copy) return next(new AppError('Research entry not found.', 404, 'NOT_FOUND'));
    res.status(201).json({ success: true, data: copy });
  } catch (err) {
    next(err);
  }
});

// ─── Entry ↔ topics ──────────────────────────────────────────────────────────

// POST /api/research/:id/topics  → sync the entry's topic links
router.post('/:id/topics', validate(entryTopicsSchema), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const entry = await getResearchEntryById(id, req.user.id);
    if (!entry) return next(new AppError('Research entry not found.', 404, 'NOT_FOUND'));

    await addEntryToTopics(id, req.body.topic_ids);
    const topics = await getTopicsForEntry(id);
    res.json({ success: true, data: topics });
  } catch (err) {
    next(err);
  }
});

// GET /api/research/:id/topics
router.get('/:id/topics', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const entry = await getResearchEntryById(id, req.user.id);
    if (!entry) return next(new AppError('Research entry not found.', 404, 'NOT_FOUND'));

    const topics = await getTopicsForEntry(id);
    res.json({ success: true, data: topics });
  } catch (err) {
    next(err);
  }
});

// ─── Entry attachments ───────────────────────────────────────────────────────

// POST /api/research/:id/attachments  → single-file upload
// Phase 8: requireOwnedEntry runs FIRST (no disk write for unauthorized callers),
// then multer, then persist. Any post-write failure cleans up with an awaited rm.
router.post('/:id/attachments', requireOwnedEntry, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError('File exceeds the 10 MB limit.', 400, 'VALIDATION_ERROR', 'file'));
      }
      return next(err); // AppError from fileFilter, or anything else
    }
    next();
  });
}, async (req, res, next) => {
  try {
    if (!req.file) return next(new AppError('No file uploaded.', 400, 'VALIDATION_ERROR', 'file'));

    const attachment = await createAttachment(req.ownedEntry.id, {
      filename:      req.file.filename,
      original_name: req.file.originalname,
      file_path:     req.file.filename,
      mime_type:     req.file.mimetype,
      size:          req.file.size,
    });
    res.status(201).json({ success: true, data: attachment });
  } catch (err) {
    // Phase 8: row insert failed but file is on disk — clean up, awaited + logged.
    if (req.file) {
      try {
        await fs.promises.rm(req.file.path, { force: true });
      } catch (rmErr) {
        (req.log ?? logger).error({ err: rmErr, path: req.file.path }, 'Failed to clean up orphaned upload');
      }
    }
    next(err);
  }
});

// GET /api/research/:id/attachments
router.get('/:id/attachments', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const entry = await getResearchEntryById(id, req.user.id);
    if (!entry) return next(new AppError('Research entry not found.', 404, 'NOT_FOUND'));

    const attachments = await listAttachments(id);
    res.json({ success: true, data: attachments });
  } catch (err) {
    next(err);
  }
});

// Named export matches `import { researchRouter }` in index.js; default kept for flexibility.
export { router as researchRouter };
export default router;
