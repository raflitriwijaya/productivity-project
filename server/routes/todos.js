// server/routes/todos.js
import { Router } from 'express';
import { z } from 'zod';
import { TODO_STATUSES } from '../lib/enums.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../lib/AppError.js';
import { logger } from '../lib/logger.js';
import {
  listTodos,
  getTodoById,
  createTodo,
  patchTodo,
  deleteTodo,
  getTodoStats,
} from '../models/todo.model.js';

const router = Router();

// ─── Zod schemas ────────────────────────────────────────────────────────────

const createTodoSchema = z.object({
  title:       z.string().min(1, 'Title is required.').max(255),
  description: z.string().max(2000).optional().nullable(),
  status:      z.enum(TODO_STATUSES).default('pending'),
  priority:    z.number().int().min(1).max(3).default(2),
  due_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'due_date must be YYYY-MM-DD.').optional().nullable(),
  due_time:    z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'due_time must be HH:MM or HH:MM:SS.').optional().nullable(),
});

const patchTodoSchema = createTodoSchema.partial();

// ─── GET /api/todos/stats ────────────────────────────────────────────────────
// IMPORTANT: must be registered BEFORE GET /:id — otherwise Express resolves
// the literal string "stats" as the :id param and hits the wrong handler.

router.get('/stats', async (req, res, next) => {
  try {
    const stats = await getTodoStats(req.user.id);
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/todos ──────────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const page    = Math.max(1, parseInt(req.query.page    ?? '1',  10));
    const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page ?? '20', 10)));
    const sort    = req.query.sort   ?? 'created_at';
    const order   = req.query.order  ?? 'desc';
    const status  = req.query.status ?? undefined;

    const { rows, total } = await listTodos(req.user.id, { page, perPage, sort, order, status });

    res.json({
      success: true,
      data: rows,
      meta: { total, page, per_page: perPage },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/todos/:id ──────────────────────────────────────────────────────

router.get('/:id', async (req, res, next) => {
  try {
    const todo = await getTodoById(parseInt(req.params.id, 10), req.user.id);
    if (!todo) throw new AppError('Todo not found.', 404, 'NOT_FOUND');
    res.json({ success: true, data: todo });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/todos ─────────────────────────────────────────────────────────

router.post('/', validate(createTodoSchema), async (req, res, next) => {
  try {
    const todo = await createTodo(req.user.id, req.body);
    res.status(201).json({ success: true, data: todo });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/todos/:id ────────────────────────────────────────────────────

router.patch('/:id', validate(patchTodoSchema), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);

    // Ownership check before update
    const existing = await getTodoById(id, req.user.id);
    if (!existing) throw new AppError('Todo not found.', 404, 'NOT_FOUND');

    const updated = await patchTodo(id, req.user.id, req.body);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/todos/:id ───────────────────────────────────────────────────

router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const deleted = await deleteTodo(id, req.user.id);
    if (!deleted) throw new AppError('Todo not found.', 404, 'NOT_FOUND');
    (req.log ?? logger).info({ event: 'DELETE', userId: req.user.id, resource: 'todo', resourceId: id, reqId: req.id }, `User ${req.user.id} deleted todo ${id}`);
    res.json({ success: true, data: null });
  } catch (err) {
    next(err);
  }
});

// Named export matches `import { todosRouter }` in index.js; default kept for flexibility.
export { router as todosRouter };
export default router;
