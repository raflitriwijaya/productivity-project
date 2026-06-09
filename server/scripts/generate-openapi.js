// server/scripts/generate-openapi.js
// Generates an OpenAPI 3.1 spec from the existing Zod schemas and writes it to docs/openapi.json.
// Run: npm run openapi  (from server/)
// Phase 5: uses @asteasolutions/zod-to-openapi to derive the spec without modifying route handlers.

import { z } from 'zod';
import { OpenAPIRegistry, OpenApiGeneratorV31, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

// Phase 5: must call before any registry.register() so Zod schemas gain .openapi()
extendZodWithOpenApi(z);
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const registry = new OpenAPIRegistry();

// ─── Reusable response schemas ────────────────────────────────────────────────

const ErrorSchema = registry.register(
  'Error',
  z.object({
    success: z.literal(false),
    error: z.object({
      code:    z.string(),
      message: z.string(),
      reqId:   z.string().optional(),
      field:   z.string().optional(),
    }),
  })
);

const MetaSchema = registry.register(
  'Meta',
  z.object({
    total:    z.number().int(),
    page:     z.number().int(),
    per_page: z.number().int(),
  })
);

// ─── Auth schemas ─────────────────────────────────────────────────────────────

const RegisterBodySchema = registry.register(
  'RegisterBody',
  z.object({
    name:     z.string().min(1).max(255),
    email:    z.string().email().max(255),
    password: z.string().min(8),
  })
);

const LoginBodySchema = registry.register(
  'LoginBody',
  z.object({
    email:    z.string().email(),
    password: z.string().min(1),
  })
);

const UserSchema = registry.register(
  'User',
  z.object({
    id:         z.number().int(),
    name:       z.string(),
    email:      z.string().email(),
    created_at: z.string().datetime(),
  })
);

// ─── Todo schemas ─────────────────────────────────────────────────────────────

const TodoSchema = registry.register(
  'Todo',
  z.object({
    id:          z.number().int(),
    user_id:     z.number().int(),
    title:       z.string(),
    description: z.string().nullable(),
    status:      z.enum(['pending', 'in_progress', 'done', 'overdue']),
    priority:    z.number().int().min(1).max(3),
    due_date:    z.string().nullable(),
    created_at:  z.string().datetime(),
    updated_at:  z.string().datetime(),
  })
);

const CreateTodoBodySchema = registry.register(
  'CreateTodoBody',
  z.object({
    title:       z.string().min(1).max(255),
    description: z.string().max(2000).optional().nullable(),
    status:      z.enum(['pending', 'in_progress', 'done', 'overdue']).default('pending'),
    priority:    z.number().int().min(1).max(3).default(2),
    due_date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  })
);

// ─── Transaction schemas ──────────────────────────────────────────────────────

const TransactionSchema = registry.register(
  'Transaction',
  z.object({
    id:                z.number().int(),
    user_id:           z.number().int(),
    type:              z.enum(['Income', 'Expense', 'Transfer', 'Balance Adjustment', 'Market Adjustment']),
    amount:            z.number(),
    description:       z.string().nullable(),
    date:              z.string(),
    source_account_id: z.number().int().nullable(),
    dest_account_id:   z.number().int().nullable(),
    category_id:       z.number().int().nullable(),
    reconciled:        z.boolean(),
    created_at:        z.string().datetime(),
    updated_at:        z.string().datetime(),
  })
);

// ─── Research schemas ─────────────────────────────────────────────────────────

const ResearchEntrySchema = registry.register(
  'ResearchEntry',
  z.object({
    id:         z.number().int(),
    user_id:    z.number().int(),
    title:      z.string(),
    type:       z.enum(['journal', 'citation', 'note']),
    status:     z.enum(['draft', 'active', 'archived']),
    content:    z.string().nullable(),
    source:     z.string().nullable(),
    tags:       z.string().nullable(),
    is_pinned:  z.boolean(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
  })
);

// ─── Learning schemas ─────────────────────────────────────────────────────────

const LearningItemSchema = registry.register(
  'LearningItem',
  z.object({
    id:           z.number().int(),
    user_id:      z.number().int(),
    title:        z.string(),
    type:         z.string(),
    source:       z.string().nullable(),
    status:       z.enum(['not_started', 'in_progress', 'completed', 'on_hold']),
    priority:     z.number().int(),
    progress:     z.number().int().min(0).max(100),
    total_hours:  z.number().nullable(),
    spent_hours:  z.number().nullable(),
    started_at:   z.string().nullable(),
    completed_at: z.string().nullable(),
    notes:        z.string().nullable(),
    url:          z.string().nullable(),
    created_at:   z.string().datetime(),
    updated_at:   z.string().datetime(),
  })
);

// ─── Route registrations ──────────────────────────────────────────────────────

// Auth
registry.registerPath({
  method: 'post', path: '/api/auth/register', tags: ['Auth'],
  summary: 'Register a new user',
  request: { body: { content: { 'application/json': { schema: RegisterBodySchema } } } },
  responses: {
    201: { description: 'User created', content: { 'application/json': { schema: z.object({ success: z.literal(true), data: UserSchema }) } } },
    409: { description: 'Email already in use', content: { 'application/json': { schema: ErrorSchema } } },
  },
});

registry.registerPath({
  method: 'post', path: '/api/auth/login', tags: ['Auth'],
  summary: 'Authenticate and open a session',
  request: { body: { content: { 'application/json': { schema: LoginBodySchema } } } },
  responses: {
    200: { description: 'Authenticated', content: { 'application/json': { schema: z.object({ success: z.literal(true), data: UserSchema }) } } },
    401: { description: 'Invalid credentials', content: { 'application/json': { schema: ErrorSchema } } },
  },
});

registry.registerPath({
  method: 'post', path: '/api/auth/logout', tags: ['Auth'],
  summary: 'Destroy the current session',
  responses: { 200: { description: 'Logged out' } },
});

registry.registerPath({
  method: 'get', path: '/api/auth/me', tags: ['Auth'],
  summary: 'Return the current authenticated user',
  responses: {
    200: { description: 'Current user', content: { 'application/json': { schema: z.object({ success: z.literal(true), data: UserSchema }) } } },
    401: { description: 'Not authenticated', content: { 'application/json': { schema: ErrorSchema } } },
  },
});

// Todos
registry.registerPath({
  method: 'get', path: '/api/todos', tags: ['Todos'],
  summary: 'List todos (paginated)',
  security: [{ cookieAuth: [] }],
  request: { query: z.object({ page: z.string().optional(), per_page: z.string().optional(), status: z.string().optional(), sort: z.string().optional(), order: z.enum(['asc','desc']).optional() }) },
  responses: {
    200: { description: 'Paginated todo list', content: { 'application/json': { schema: z.object({ success: z.literal(true), data: z.array(TodoSchema), meta: MetaSchema }) } } },
  },
});

registry.registerPath({
  method: 'post', path: '/api/todos', tags: ['Todos'],
  summary: 'Create a todo',
  security: [{ cookieAuth: [] }],
  request: { body: { content: { 'application/json': { schema: CreateTodoBodySchema } } } },
  responses: {
    201: { description: 'Created todo', content: { 'application/json': { schema: z.object({ success: z.literal(true), data: TodoSchema }) } } },
  },
});

registry.registerPath({
  method: 'patch', path: '/api/todos/{id}', tags: ['Todos'],
  summary: 'Update a todo (partial)',
  security: [{ cookieAuth: [] }],
  request: { params: z.object({ id: z.string() }), body: { content: { 'application/json': { schema: CreateTodoBodySchema.partial() } } } },
  responses: {
    200: { description: 'Updated todo', content: { 'application/json': { schema: z.object({ success: z.literal(true), data: TodoSchema }) } } },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorSchema } } },
  },
});

registry.registerPath({
  method: 'delete', path: '/api/todos/{id}', tags: ['Todos'],
  summary: 'Delete a todo',
  security: [{ cookieAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { description: 'Deleted' },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorSchema } } },
  },
});

// Finances (representative endpoints)
registry.registerPath({
  method: 'get', path: '/api/finances', tags: ['Finances'],
  summary: 'List transactions (paginated, filterable)',
  security: [{ cookieAuth: [] }],
  responses: { 200: { description: 'Transaction list', content: { 'application/json': { schema: z.object({ success: z.literal(true), data: z.array(TransactionSchema), meta: MetaSchema }) } } } },
});

registry.registerPath({
  method: 'get', path: '/api/finances/summary', tags: ['Finances'],
  summary: 'Monthly income / expense / net summary',
  security: [{ cookieAuth: [] }],
  responses: { 200: { description: 'Summary', content: { 'application/json': { schema: z.object({ success: z.literal(true), data: z.object({ income: z.number(), expense: z.number(), net_balance: z.number() }) }) } } } },
});

registry.registerPath({
  method: 'get', path: '/api/finances/balances', tags: ['Finances'],
  summary: 'Per-account balances and net worth',
  security: [{ cookieAuth: [] }],
  responses: { 200: { description: 'Balances' } },
});

// Research (representative endpoints)
registry.registerPath({
  method: 'get', path: '/api/research', tags: ['Research'],
  summary: 'List research entries (paginated, filterable by q/type/status/tags/topic)',
  security: [{ cookieAuth: [] }],
  responses: { 200: { description: 'Entry list', content: { 'application/json': { schema: z.object({ success: z.literal(true), data: z.array(ResearchEntrySchema), meta: MetaSchema }) } } } },
});

registry.registerPath({
  method: 'get', path: '/api/research/export', tags: ['Research'],
  summary: 'Export entries as JSON or CSV',
  security: [{ cookieAuth: [] }],
  request: { query: z.object({ format: z.enum(['json', 'csv']).optional() }) },
  responses: { 200: { description: 'Downloadable file' } },
});

// Learning (representative endpoints)
registry.registerPath({
  method: 'get', path: '/api/learning', tags: ['Learning'],
  summary: 'List learning items (paginated)',
  security: [{ cookieAuth: [] }],
  responses: { 200: { description: 'Learning item list', content: { 'application/json': { schema: z.object({ success: z.literal(true), data: z.array(LearningItemSchema), meta: MetaSchema }) } } } },
});

// Engineering
registry.registerPath({
  method: 'get', path: '/api/engineer/projects', tags: ['Engineering'],
  summary: 'List engineering projects',
  security: [{ cookieAuth: [] }],
  responses: { 200: { description: 'Project list' } },
});

registry.registerPath({
  method: 'get', path: '/api/engineer/snippets', tags: ['Engineering'],
  summary: 'List code snippets',
  security: [{ cookieAuth: [] }],
  responses: { 200: { description: 'Snippet list' } },
});

// Health
registry.registerPath({
  method: 'get', path: '/health', tags: ['System'],
  summary: 'Uptime health check (no auth)',
  responses: { 200: { description: 'Server alive', content: { 'application/json': { schema: z.object({ status: z.literal('ok'), ts: z.string().datetime() }) } } } },
});

// ─── Generate and write ───────────────────────────────────────────────────────

const generator = new OpenApiGeneratorV31(registry.definitions);

const document = generator.generateDocument({
  openapi: '3.1.0',
  info: {
    title:       "Rafli's Productivity Suite API",
    version:     '1.0.0',
    description: 'REST API for the Productivity Suite. All protected routes require a valid session cookie (`sid`). See docs/ARCHITECTURE.md for the full data model.',
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Local dev' },
  ],
  components: {
    securitySchemes: {
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'sid' },
    },
  },
});

const outDir  = resolve(__dirname, '../../docs');
const outFile = resolve(outDir, 'openapi.json');

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, JSON.stringify(document, null, 2), 'utf8');

console.log(`OpenAPI spec written to ${outFile}`);
