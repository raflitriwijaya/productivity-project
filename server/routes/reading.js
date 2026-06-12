// server/routes/reading.js
// Reading Tracker (Roadmap Wave 3). Mount as:
//   app.use('/api/reading', requireAuth, readingRouter)
//
// Standard envelope ({ success, data[, meta] }), Zod validation on write bodies,
// audit logging on create/update/delete, literal routes (/stats) before the
// parameterized /:id to avoid shadowing.

import { Router } from 'express';
import { z } from 'zod';
import { BOOK_SHELVES } from '../lib/enums.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../lib/AppError.js';
import { logger } from '../lib/logger.js';
import {
  listBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
  getReadingStats,
} from '../models/reading.model.js';

const router = Router();

// ─── Zod schemas (request bodies) ────────────────────────────────────────────

const createBookSchema = z.object({
  title:       z.string().min(1, 'Title is required.').max(500),
  author:      z.string().max(300).optional().nullable(),
  shelf:       z.enum(BOOK_SHELVES).default('want_to_read'),
  total_pages: z.number().int().positive().optional().nullable(),
  notes:       z.string().optional().nullable(),
  cover_url:   z.string().max(1000).optional().nullable(),
  genre:       z.string().max(100).optional().nullable(),
});

const updateBookSchema = z.object({
  title:        z.string().min(1).max(500).optional(),
  author:       z.string().max(300).optional().nullable(),
  shelf:        z.enum(BOOK_SHELVES).optional(),
  total_pages:  z.number().int().positive().optional().nullable(),
  current_page: z.number().int().min(0).optional(),
  rating:       z.number().int().min(1).max(5).optional().nullable(),
  notes:        z.string().optional().nullable(),
  started_at:   z.string().datetime().optional().nullable(),
  finished_at:  z.string().datetime().optional().nullable(),
  cover_url:    z.string().max(1000).optional().nullable(),
  genre:        z.string().max(100).optional().nullable(),
});

// ─── GET /api/reading/stats ──────────────────────────────────────────────────
// Declared before /:id to avoid route shadowing.
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await getReadingStats(req.user.id);
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/reading ────────────────────────────────────────────────────────
// Query params parsed by hand (validate() only covers req.body), mirroring
// learning.js — keeps a bad query out of the 500 path.
router.get('/', async (req, res, next) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page ?? '1', 10));
    const per_page  = Math.min(100, Math.max(1, parseInt(req.query.per_page ?? '20', 10)));
    const shelf    = BOOK_SHELVES.includes(req.query.shelf) ? req.query.shelf : undefined;
    const sort     = req.query.sort  ?? 'created_at';
    const order    = req.query.order ?? 'desc';
    const search   = typeof req.query.search === 'string' ? req.query.search : undefined;

    const { data, meta } = await listBooks(req.user.id, { shelf, sort, order, page, per_page, search });
    res.json({ success: true, data, meta });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/reading ───────────────────────────────────────────────────────
router.post('/', validate(createBookSchema), async (req, res, next) => {
  try {
    const book = await createBook(req.user.id, req.body);

    (req.log ?? logger).info(
      { event: 'BOOK_CREATE', userId: req.user.id, bookId: book.id, shelf: book.shelf, reqId: req.id },
      `User ${req.user.id} added book: ${book.title}`
    );

    res.status(201).json({ success: true, data: book });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/reading/:id ────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) throw new AppError('Invalid book ID.', 400, 'VALIDATION_ERROR', 'id');

    const book = await getBookById(req.user.id, id);
    if (!book) throw new AppError('Book not found.', 404, 'NOT_FOUND');

    res.json({ success: true, data: book });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/reading/:id ──────────────────────────────────────────────────
router.patch('/:id', validate(updateBookSchema), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) throw new AppError('Invalid book ID.', 400, 'VALIDATION_ERROR', 'id');

    const book = await updateBook(req.user.id, id, req.body);
    if (!book) throw new AppError('Book not found.', 404, 'NOT_FOUND');

    (req.log ?? logger).info(
      { event: 'BOOK_UPDATE', userId: req.user.id, bookId: id, changes: Object.keys(req.body), reqId: req.id },
      `User ${req.user.id} updated book ${id}`
    );

    res.json({ success: true, data: book });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/reading/:id ─────────────────────────────────────────────────
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) throw new AppError('Invalid book ID.', 400, 'VALIDATION_ERROR', 'id');

    const book = await deleteBook(req.user.id, id);
    if (!book) throw new AppError('Book not found.', 404, 'NOT_FOUND');

    (req.log ?? logger).info(
      { event: 'BOOK_DELETE', userId: req.user.id, bookId: id, reqId: req.id },
      `User ${req.user.id} deleted book: ${book.title}`
    );

    res.json({ success: true, data: { id } });
  } catch (err) {
    next(err);
  }
});

export { router as readingRouter };
export default router;
