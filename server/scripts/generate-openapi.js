// server/scripts/generate-openapi.js
// Run: npm run openapi  (from server/)
// Writes docs/openapi.json covering ALL mounted routes.

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir    = resolve(__dirname, '../../docs');
const outFile   = resolve(outDir, 'openapi.json');

// ─── Spec skeleton ────────────────────────────────────────────────────────────

const spec = {
  openapi: '3.1.0',
  info: {
    title:       "Rafli's Productivity Suite API",
    version:     '1.0.0',
    description: 'REST API for the Productivity Suite. All protected routes require a valid session cookie (sid). See docs/ARCHITECTURE.md for the full data model.',
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Local dev' },
    { url: 'https://raflitriwijaya.my.id', description: 'Production (Cloudflare Tunnel)' },
  ],
  tags: [
    { name: 'System',      description: 'Health check and metrics' },
    { name: 'Auth',        description: 'Authentication and session management' },
    { name: 'Todos',       description: 'Task management' },
    { name: 'Finances',    description: 'Multi-account financial ledger' },
    { name: 'Learning',    description: 'Learning tracker' },
    { name: 'Research',    description: 'Research journal with topics, tags, and attachments' },
    { name: 'Engineering', description: 'IoT/Embedded/Robotics project toolkit' },
    { name: 'Links',       description: 'Universal cross-module entity linking' },
    { name: 'Dashboard',   description: 'Dashboard and daily briefing' },
    { name: 'Reading',     description: 'Reading tracker and library' },
    { name: 'Search',      description: 'Unified cross-module search' },
  ],
  components: {
    securitySchemes: {
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'sid' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', enum: [false] },
          error: {
            type: 'object',
            properties: {
              code:    { type: 'string', example: 'NOT_FOUND' },
              message: { type: 'string', example: 'Resource not found.' },
              reqId:   { type: 'string', description: 'Request ID for tracing' },
              field:   { type: 'string', description: 'Field that triggered validation error' },
            },
            required: ['code', 'message'],
          },
        },
      },
      Success: {
        type: 'object',
        properties: {
          success: { type: 'boolean', enum: [true] },
          data:    {},
        },
      },
      PaginatedList: {
        type: 'object',
        properties: {
          success: { type: 'boolean', enum: [true] },
          data:    { type: 'array', items: {} },
          meta: {
            type: 'object',
            properties: {
              total:    { type: 'integer' },
              page:     { type: 'integer' },
              per_page: { type: 'integer' },
            },
          },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: 'Not authenticated',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      NotFound: {
        description: 'Resource not found',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      BadRequest: {
        description: 'Validation error',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      RateLimited: {
        description: 'Too many requests',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
    },
  },
  paths: {},
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addPath(method, path, def) {
  if (!spec.paths[path]) spec.paths[path] = {};
  spec.paths[path][method] = def;
}

const auth401 = { '401': { $ref: '#/components/responses/Unauthorized' } };
const r404    = { '404': { $ref: '#/components/responses/NotFound' } };
const r400    = { '400': { $ref: '#/components/responses/BadRequest' } };
const ok200   = { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } } };
const list200 = { '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedList' } } } } };
const cookie  = [{ cookieAuth: [] }];

const pageParams = [
  { name: 'page',     in: 'query', schema: { type: 'integer', default: 1 } },
  { name: 'per_page', in: 'query', schema: { type: 'integer', default: 20 } },
  { name: 'sort',     in: 'query', schema: { type: 'string' } },
  { name: 'order',    in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
];

const idParam = [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }];

function jsonBody(schema) {
  return { required: true, content: { 'application/json': { schema } } };
}

// ═════════════════════════════════════════════════════════════════════════════
// SYSTEM
// ═════════════════════════════════════════════════════════════════════════════

addPath('get', '/health', {
  tags: ['System'],
  summary: 'Health check — also verifies DB connectivity',
  responses: {
    '200': { description: 'Healthy', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', enum: ['ok'] }, db: { type: 'string', enum: ['ok'] }, uptime: { type: 'number' } } } } } },
    '503': { description: 'Degraded — DB unreachable', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', enum: ['degraded'] }, db: { type: 'string', enum: ['error'] } } } } } },
  },
});

addPath('get', '/metrics', {
  tags: ['System'],
  summary: 'Prometheus metrics endpoint (IP-restricted in production)',
  responses: {
    '200': { description: 'Prometheus text-format metrics', content: { 'text/plain': { schema: { type: 'string' } } } },
  },
});

// ═════════════════════════════════════════════════════════════════════════════
// AUTH
// ═════════════════════════════════════════════════════════════════════════════

addPath('post', '/api/auth/register', {
  tags: ['Auth'],
  summary: 'Register a new user',
  requestBody: jsonBody({
    type: 'object', required: ['name', 'email', 'password'],
    properties: {
      name:     { type: 'string', minLength: 1, maxLength: 255 },
      email:    { type: 'string', format: 'email', maxLength: 255 },
      password: { type: 'string', minLength: 8 },
    },
  }),
  responses: {
    '201': { description: 'User created' },
    '400': { $ref: '#/components/responses/BadRequest' },
    '409': { description: 'Email already registered' },
    '429': { $ref: '#/components/responses/RateLimited' },
  },
});

addPath('post', '/api/auth/login', {
  tags: ['Auth'],
  summary: 'Log in — creates a session cookie',
  requestBody: jsonBody({
    type: 'object', required: ['email', 'password'],
    properties: {
      email:    { type: 'string', format: 'email' },
      password: { type: 'string' },
    },
  }),
  responses: {
    '200': { description: 'Authenticated — sets sid cookie' },
    '401': { description: 'Invalid credentials' },
    '429': { $ref: '#/components/responses/RateLimited' },
  },
});

addPath('post', '/api/auth/logout', {
  tags: ['Auth'],
  summary: 'Destroy the current session',
  responses: { '200': { description: 'Session destroyed' } },
});

addPath('get', '/api/auth/me', {
  tags: ['Auth'],
  summary: 'Return the current authenticated user',
  security: cookie,
  responses: { ...ok200, ...auth401 },
});

// ═════════════════════════════════════════════════════════════════════════════
// TODOS
// ═════════════════════════════════════════════════════════════════════════════

addPath('get', '/api/todos/stats', {
  tags: ['Todos'],
  summary: 'Aggregate counts by status and overdue count',
  security: cookie,
  responses: { ...ok200, ...auth401 },
});

addPath('get', '/api/todos', {
  tags: ['Todos'],
  summary: 'List todos (paginated)',
  security: cookie,
  parameters: [
    ...pageParams,
    { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'in_progress', 'done', 'overdue'] } },
  ],
  responses: { ...list200, ...auth401 },
});

addPath('get', '/api/todos/{id}', {
  tags: ['Todos'],
  summary: 'Get todo by ID',
  security: cookie,
  parameters: idParam,
  responses: { ...ok200, ...auth401, ...r404 },
});

addPath('post', '/api/todos', {
  tags: ['Todos'],
  summary: 'Create a todo',
  security: cookie,
  requestBody: jsonBody({
    type: 'object', required: ['title'],
    properties: {
      title:       { type: 'string', minLength: 1, maxLength: 255 },
      description: { type: 'string', maxLength: 2000, nullable: true },
      status:      { type: 'string', enum: ['pending', 'in_progress', 'done', 'overdue'], default: 'pending' },
      priority:    { type: 'integer', minimum: 1, maximum: 3, default: 2 },
      due_date:    { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', nullable: true },
    },
  }),
  responses: { '201': { description: 'Created' }, ...r400, ...auth401 },
});

addPath('patch', '/api/todos/{id}', {
  tags: ['Todos'],
  summary: 'Update a todo (partial)',
  security: cookie,
  parameters: idParam,
  requestBody: jsonBody({
    type: 'object',
    properties: {
      title:       { type: 'string', minLength: 1, maxLength: 255 },
      description: { type: 'string', maxLength: 2000, nullable: true },
      status:      { type: 'string', enum: ['pending', 'in_progress', 'done', 'overdue'] },
      priority:    { type: 'integer', minimum: 1, maximum: 3 },
      due_date:    { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', nullable: true },
    },
  }),
  responses: { ...ok200, ...r400, ...auth401, ...r404 },
});

addPath('delete', '/api/todos/{id}', {
  tags: ['Todos'],
  summary: 'Delete a todo',
  security: cookie,
  parameters: idParam,
  responses: { ...ok200, ...auth401, ...r404 },
});

// ═════════════════════════════════════════════════════════════════════════════
// FINANCES
// ═════════════════════════════════════════════════════════════════════════════

addPath('get', '/api/finances/summary', {
  tags: ['Finances'],
  summary: 'Income / expense / net summary. Omit month+year for all-time.',
  security: cookie,
  parameters: [
    { name: 'month', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 12 } },
    { name: 'year',  in: 'query', schema: { type: 'integer', minimum: 1900 } },
  ],
  responses: { ...ok200, ...r400, ...auth401 },
});

addPath('get', '/api/finances/balances', {
  tags: ['Finances'],
  summary: 'Per-account live balances and total net worth',
  security: cookie,
  responses: { ...ok200, ...auth401 },
});

addPath('get', '/api/finances/dashboard', {
  tags: ['Finances'],
  summary: '12-month trend, top categories, recent transactions',
  security: cookie,
  responses: { ...ok200, ...auth401 },
});

addPath('get', '/api/finances/accounts', {
  tags: ['Finances'],
  summary: 'List accounts (seeded on first access)',
  security: cookie,
  responses: { ...ok200, ...auth401 },
});

addPath('patch', '/api/finances/accounts/{id}', {
  tags: ['Finances'],
  summary: 'Rename an account or adjust its initial balance',
  security: cookie,
  parameters: idParam,
  requestBody: jsonBody({
    type: 'object',
    properties: {
      name:            { type: 'string', minLength: 1, maxLength: 100 },
      initial_balance: { type: 'number' },
    },
    description: 'At least one field required.',
  }),
  responses: { ...ok200, ...r400, ...auth401, ...r404 },
});

addPath('get', '/api/finances/categories', {
  tags: ['Finances'],
  summary: 'List categories, optionally filtered by kind',
  security: cookie,
  parameters: [
    { name: 'kind', in: 'query', schema: { type: 'string', enum: ['INCOME', 'EXPENSE', 'SYSTEM'] } },
  ],
  responses: { ...ok200, ...auth401 },
});

// Receivables

addPath('get', '/api/finances/receivables', {
  tags: ['Finances'],
  summary: 'List receivables',
  security: cookie,
  parameters: [
    { name: 'status', in: 'query', schema: { type: 'string', enum: ['outstanding', 'settled'] } },
  ],
  responses: { ...ok200, ...auth401 },
});

addPath('post', '/api/finances/receivables', {
  tags: ['Finances'],
  summary: 'Create a receivable',
  security: cookie,
  requestBody: jsonBody({
    type: 'object', required: ['person', 'amount'],
    properties: {
      person:      { type: 'string', minLength: 1, maxLength: 255 },
      description: { type: 'string', maxLength: 1000, nullable: true },
      amount:      { type: 'number', exclusiveMinimum: 0 },
      due_date:    { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', nullable: true },
      account_id:  { type: 'integer', nullable: true },
    },
  }),
  responses: { '201': { description: 'Created' }, ...r400, ...auth401 },
});

addPath('patch', '/api/finances/receivables/{id}', {
  tags: ['Finances'],
  summary: 'Update a receivable',
  security: cookie,
  parameters: idParam,
  requestBody: jsonBody({
    type: 'object',
    properties: {
      person:      { type: 'string', minLength: 1, maxLength: 255 },
      description: { type: 'string', maxLength: 1000, nullable: true },
      amount:      { type: 'number', exclusiveMinimum: 0 },
      due_date:    { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', nullable: true },
      account_id:  { type: 'integer', nullable: true },
      status:      { type: 'string', enum: ['outstanding', 'settled'] },
    },
  }),
  responses: { ...ok200, ...r400, ...auth401, ...r404 },
});

addPath('post', '/api/finances/receivables/{id}/settle', {
  tags: ['Finances'],
  summary: 'Settle a receivable — creates an Income transaction',
  security: cookie,
  parameters: idParam,
  requestBody: jsonBody({
    type: 'object',
    properties: {
      account_id: { type: 'integer', nullable: true },
      date:       { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', nullable: true },
    },
  }),
  responses: { ...ok200, ...r400, ...auth401, ...r404 },
});

addPath('delete', '/api/finances/receivables/{id}', {
  tags: ['Finances'],
  summary: 'Delete a receivable',
  security: cookie,
  parameters: idParam,
  responses: { ...ok200, ...auth401, ...r404 },
});

// Payables

addPath('get', '/api/finances/payables', {
  tags: ['Finances'],
  summary: 'List payables',
  security: cookie,
  parameters: [
    { name: 'status', in: 'query', schema: { type: 'string', enum: ['outstanding', 'settled'] } },
  ],
  responses: { ...ok200, ...auth401 },
});

addPath('post', '/api/finances/payables', {
  tags: ['Finances'],
  summary: 'Create a payable',
  security: cookie,
  requestBody: jsonBody({
    type: 'object', required: ['person', 'amount'],
    properties: {
      person:      { type: 'string', minLength: 1, maxLength: 255 },
      description: { type: 'string', maxLength: 1000, nullable: true },
      amount:      { type: 'number', exclusiveMinimum: 0 },
      due_date:    { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', nullable: true },
      account_id:  { type: 'integer', nullable: true },
    },
  }),
  responses: { '201': { description: 'Created' }, ...r400, ...auth401 },
});

addPath('patch', '/api/finances/payables/{id}', {
  tags: ['Finances'],
  summary: 'Update a payable',
  security: cookie,
  parameters: idParam,
  requestBody: jsonBody({
    type: 'object',
    properties: {
      person:      { type: 'string', minLength: 1, maxLength: 255 },
      description: { type: 'string', maxLength: 1000, nullable: true },
      amount:      { type: 'number', exclusiveMinimum: 0 },
      due_date:    { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', nullable: true },
      account_id:  { type: 'integer', nullable: true },
      status:      { type: 'string', enum: ['outstanding', 'settled'] },
    },
  }),
  responses: { ...ok200, ...r400, ...auth401, ...r404 },
});

addPath('post', '/api/finances/payables/{id}/settle', {
  tags: ['Finances'],
  summary: 'Settle a payable — creates an Expense transaction',
  security: cookie,
  parameters: idParam,
  requestBody: jsonBody({
    type: 'object',
    properties: {
      account_id: { type: 'integer', nullable: true },
      date:       { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', nullable: true },
    },
  }),
  responses: { ...ok200, ...r400, ...auth401, ...r404 },
});

addPath('delete', '/api/finances/payables/{id}', {
  tags: ['Finances'],
  summary: 'Delete a payable',
  security: cookie,
  parameters: idParam,
  responses: { ...ok200, ...auth401, ...r404 },
});

// Portfolio

addPath('get', '/api/finances/portfolio', {
  tags: ['Finances'],
  summary: 'List investment holdings',
  security: cookie,
  responses: { ...ok200, ...auth401 },
});

addPath('post', '/api/finances/portfolio', {
  tags: ['Finances'],
  summary: 'Add a new holding',
  security: cookie,
  requestBody: jsonBody({
    type: 'object', required: ['name'],
    properties: {
      name:          { type: 'string', minLength: 1, maxLength: 255 },
      symbol:        { type: 'string', maxLength: 50, nullable: true },
      quantity:      { type: 'number', minimum: 0, default: 0 },
      avg_price:     { type: 'number', minimum: 0, default: 0 },
      current_price: { type: 'number', minimum: 0, default: 0 },
    },
  }),
  responses: { '201': { description: 'Created' }, ...r400, ...auth401 },
});

addPath('patch', '/api/finances/portfolio/{id}', {
  tags: ['Finances'],
  summary: 'Update a holding (prices, quantity)',
  security: cookie,
  parameters: idParam,
  requestBody: jsonBody({
    type: 'object',
    properties: {
      name:          { type: 'string', minLength: 1, maxLength: 255 },
      symbol:        { type: 'string', maxLength: 50, nullable: true },
      quantity:      { type: 'number', minimum: 0 },
      avg_price:     { type: 'number', minimum: 0 },
      current_price: { type: 'number', minimum: 0 },
    },
  }),
  responses: { ...ok200, ...r400, ...auth401, ...r404 },
});

addPath('delete', '/api/finances/portfolio/{id}', {
  tags: ['Finances'],
  summary: 'Remove a holding',
  security: cookie,
  parameters: idParam,
  responses: { ...ok200, ...auth401, ...r404 },
});

// Budgets

addPath('get', '/api/finances/budgets', {
  tags: ['Finances'],
  summary: 'List expense categories with budget and actual spend',
  security: cookie,
  parameters: [
    { name: 'month', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 12 } },
    { name: 'year',  in: 'query', schema: { type: 'integer', minimum: 1900 } },
  ],
  responses: { ...ok200, ...r400, ...auth401 },
});

addPath('put', '/api/finances/budgets', {
  tags: ['Finances'],
  summary: 'Set (upsert) a monthly budget for one expense category',
  security: cookie,
  requestBody: jsonBody({
    type: 'object', required: ['category_id', 'amount'],
    properties: {
      category_id: { type: 'integer', minimum: 1 },
      amount:      { type: 'number', minimum: 0 },
    },
  }),
  responses: { ...ok200, ...r400, ...auth401 },
});

// Transactions (generic — declared last in route file)

addPath('get', '/api/finances', {
  tags: ['Finances'],
  summary: 'List transactions (paginated, filterable)',
  security: cookie,
  parameters: [
    { name: 'page',        in: 'query', schema: { type: 'integer', default: 1 } },
    { name: 'per_page',    in: 'query', schema: { type: 'integer', default: 50 } },
    { name: 'type',        in: 'query', schema: { type: 'string', enum: ['Income', 'Expense', 'Transfer', 'Balance Adjustment', 'Market Adjustment'] } },
    { name: 'category_id', in: 'query', schema: { type: 'integer' } },
    { name: 'account_id',  in: 'query', schema: { type: 'integer' } },
    { name: 'search',      in: 'query', schema: { type: 'string' } },
    { name: 'month',       in: 'query', schema: { type: 'integer', minimum: 1, maximum: 12 } },
    { name: 'year',        in: 'query', schema: { type: 'integer', minimum: 1900 } },
  ],
  responses: { ...list200, ...r400, ...auth401 },
});

addPath('get', '/api/finances/{id}', {
  tags: ['Finances'],
  summary: 'Get transaction by ID',
  security: cookie,
  parameters: idParam,
  responses: { ...ok200, ...auth401, ...r404 },
});

addPath('post', '/api/finances', {
  tags: ['Finances'],
  summary: 'Create a transaction',
  security: cookie,
  requestBody: jsonBody({
    type: 'object', required: ['type', 'amount', 'date'],
    properties: {
      type:              { type: 'string', enum: ['Income', 'Expense', 'Transfer', 'Balance Adjustment', 'Market Adjustment'] },
      amount:            { type: 'number', description: 'Non-zero. Must be > 0 except for Balance/Market Adjustments.' },
      description:       { type: 'string', maxLength: 1000, nullable: true },
      date:              { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      source_account_id: { type: 'integer', nullable: true },
      dest_account_id:   { type: 'integer', nullable: true },
      category_id:       { type: 'integer', nullable: true },
      reconciled:        { type: 'boolean', default: false },
    },
  }),
  responses: { '201': { description: 'Created' }, ...r400, ...auth401 },
});

addPath('patch', '/api/finances/{id}', {
  tags: ['Finances'],
  summary: 'Update a transaction (partial)',
  security: cookie,
  parameters: idParam,
  requestBody: jsonBody({
    type: 'object',
    properties: {
      type:              { type: 'string', enum: ['Income', 'Expense', 'Transfer', 'Balance Adjustment', 'Market Adjustment'] },
      amount:            { type: 'number' },
      description:       { type: 'string', maxLength: 1000, nullable: true },
      date:              { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      source_account_id: { type: 'integer', nullable: true },
      dest_account_id:   { type: 'integer', nullable: true },
      category_id:       { type: 'integer', nullable: true },
      reconciled:        { type: 'boolean' },
    },
  }),
  responses: { ...ok200, ...r400, ...auth401, ...r404 },
});

addPath('delete', '/api/finances/{id}', {
  tags: ['Finances'],
  summary: 'Delete a transaction',
  security: cookie,
  parameters: idParam,
  responses: { ...ok200, ...auth401, ...r404 },
});

// ═════════════════════════════════════════════════════════════════════════════
// LEARNING
// ═════════════════════════════════════════════════════════════════════════════

addPath('get', '/api/learning/stats', {
  tags: ['Learning'],
  summary: 'Aggregate counts by status, avg progress, total hours',
  security: cookie,
  responses: { ...ok200, ...auth401 },
});

addPath('get', '/api/learning', {
  tags: ['Learning'],
  summary: 'List learning items (paginated)',
  security: cookie,
  parameters: [
    ...pageParams,
    { name: 'status', in: 'query', schema: { type: 'string', enum: ['not_started', 'in_progress', 'completed', 'on_hold'] } },
  ],
  responses: { ...list200, ...auth401 },
});

addPath('get', '/api/learning/{id}', {
  tags: ['Learning'],
  summary: 'Get learning item by ID',
  security: cookie,
  parameters: idParam,
  responses: { ...ok200, ...auth401, ...r404 },
});

addPath('post', '/api/learning', {
  tags: ['Learning'],
  summary: 'Create a learning item',
  security: cookie,
  requestBody: jsonBody({
    type: 'object', required: ['title'],
    properties: {
      title:        { type: 'string', minLength: 1, maxLength: 255 },
      type:         { type: 'string', enum: ['course', 'book', 'video', 'article', 'other'], default: 'course' },
      source:       { type: 'string', maxLength: 255, nullable: true },
      status:       { type: 'string', enum: ['not_started', 'in_progress', 'completed', 'on_hold'], default: 'not_started' },
      priority:     { type: 'integer', minimum: 1, maximum: 3, default: 2 },
      progress:     { type: 'integer', minimum: 0, maximum: 100, default: 0 },
      total_hours:  { type: 'number', exclusiveMinimum: 0, nullable: true },
      spent_hours:  { type: 'number', minimum: 0, nullable: true },
      started_at:   { type: 'string', format: 'date', nullable: true },
      completed_at: { type: 'string', format: 'date', nullable: true },
      notes:        { type: 'string', nullable: true },
      url:          { type: 'string', format: 'uri', maxLength: 2048, nullable: true },
    },
  }),
  responses: { '201': { description: 'Created' }, ...r400, ...auth401 },
});

addPath('patch', '/api/learning/{id}', {
  tags: ['Learning'],
  summary: 'Update a learning item (partial)',
  security: cookie,
  parameters: idParam,
  requestBody: jsonBody({
    type: 'object',
    properties: {
      title:        { type: 'string', minLength: 1, maxLength: 255 },
      type:         { type: 'string', enum: ['course', 'book', 'video', 'article', 'other'] },
      source:       { type: 'string', maxLength: 255, nullable: true },
      status:       { type: 'string', enum: ['not_started', 'in_progress', 'completed', 'on_hold'] },
      priority:     { type: 'integer', minimum: 1, maximum: 3 },
      progress:     { type: 'integer', minimum: 0, maximum: 100 },
      total_hours:  { type: 'number', exclusiveMinimum: 0, nullable: true },
      spent_hours:  { type: 'number', minimum: 0, nullable: true },
      started_at:   { type: 'string', format: 'date', nullable: true },
      completed_at: { type: 'string', format: 'date', nullable: true },
      notes:        { type: 'string', nullable: true },
      url:          { type: 'string', format: 'uri', maxLength: 2048, nullable: true },
    },
  }),
  responses: { ...ok200, ...r400, ...auth401, ...r404 },
});

addPath('delete', '/api/learning/{id}', {
  tags: ['Learning'],
  summary: 'Delete a learning item',
  security: cookie,
  parameters: idParam,
  responses: { ...ok200, ...auth401, ...r404 },
});

// ═════════════════════════════════════════════════════════════════════════════
// RESEARCH
// ═════════════════════════════════════════════════════════════════════════════

const researchListParams = [
  ...pageParams,
  { name: 'type',      in: 'query', schema: { type: 'string', enum: ['journal', 'citation', 'note'] } },
  { name: 'status',    in: 'query', schema: { type: 'string', enum: ['draft', 'active', 'archived'] } },
  { name: 'q',         in: 'query', schema: { type: 'string' }, description: 'Full-text search' },
  { name: 'date_from', in: 'query', schema: { type: 'string', format: 'date' } },
  { name: 'date_to',   in: 'query', schema: { type: 'string', format: 'date' } },
  { name: 'tags',      in: 'query', schema: { type: 'string' }, description: 'Comma-separated tag filter' },
  { name: 'topic_id',  in: 'query', schema: { type: 'integer' } },
];

addPath('get', '/api/research/stats', {
  tags: ['Research'],
  summary: 'Entry counts by type and status',
  security: cookie,
  responses: { ...ok200, ...auth401 },
});

addPath('get', '/api/research/tags', {
  tags: ['Research'],
  summary: 'All distinct tags used by this user',
  security: cookie,
  responses: { ...ok200, ...auth401 },
});

addPath('get', '/api/research/export', {
  tags: ['Research'],
  summary: 'Export matching entries as JSON or CSV download',
  security: cookie,
  parameters: [
    { name: 'format',    in: 'query', required: true, schema: { type: 'string', enum: ['json', 'csv'] } },
    { name: 'q',         in: 'query', schema: { type: 'string' } },
    { name: 'tags',      in: 'query', schema: { type: 'string' } },
    { name: 'date_from', in: 'query', schema: { type: 'string', format: 'date' } },
    { name: 'date_to',   in: 'query', schema: { type: 'string', format: 'date' } },
    { name: 'topic_id',  in: 'query', schema: { type: 'integer' } },
  ],
  responses: {
    '200': { description: 'Downloadable file', content: { 'application/json': {}, 'text/csv': {} } },
    '400': { $ref: '#/components/responses/BadRequest' },
    '413': { description: 'Export too large — narrow the filters' },
    ...auth401,
  },
});

addPath('patch', '/api/research/bulk', {
  tags: ['Research'],
  summary: 'Bulk update entries (status / type / is_pinned)',
  security: cookie,
  requestBody: jsonBody({
    type: 'object', required: ['ids'],
    properties: {
      ids:       { type: 'array', items: { type: 'integer' }, minItems: 1 },
      status:    { type: 'string', enum: ['draft', 'active', 'archived'] },
      type:      { type: 'string', enum: ['journal', 'citation', 'note'] },
      is_pinned: { type: 'boolean' },
    },
    description: 'ids + at least one of status / type / is_pinned.',
  }),
  responses: { ...ok200, ...r400, ...auth401 },
});

addPath('delete', '/api/research/bulk', {
  tags: ['Research'],
  summary: 'Bulk delete entries by IDs',
  security: cookie,
  requestBody: jsonBody({
    type: 'object', required: ['ids'],
    properties: { ids: { type: 'array', items: { type: 'integer' }, minItems: 1 } },
  }),
  responses: { ...ok200, ...r400, ...auth401 },
});

addPath('get', '/api/research/topics', {
  tags: ['Research'],
  summary: 'List topics',
  security: cookie,
  parameters: [
    { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'archived'] } },
  ],
  responses: { ...ok200, ...auth401 },
});

addPath('post', '/api/research/topics', {
  tags: ['Research'],
  summary: 'Create a topic',
  security: cookie,
  requestBody: jsonBody({
    type: 'object', required: ['name'],
    properties: {
      name:        { type: 'string', minLength: 1, maxLength: 255 },
      description: { type: 'string', maxLength: 10000 },
      color:       { type: 'string', pattern: '^#[0-9a-fA-F]{6}$', example: '#10b981' },
    },
  }),
  responses: { '201': { description: 'Created' }, ...r400, ...auth401 },
});

addPath('get', '/api/research/topics/{id}/entries', {
  tags: ['Research'],
  summary: 'List entries belonging to a topic',
  security: cookie,
  parameters: [
    { name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'Topic ID' },
    ...researchListParams,
  ],
  responses: { ...list200, ...auth401, ...r404 },
});

addPath('get', '/api/research/topics/{id}', {
  tags: ['Research'],
  summary: 'Get topic + stats by ID',
  security: cookie,
  parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'Topic ID' }],
  responses: { ...ok200, ...auth401, ...r404 },
});

addPath('patch', '/api/research/topics/{id}', {
  tags: ['Research'],
  summary: 'Update a topic',
  security: cookie,
  parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'Topic ID' }],
  requestBody: jsonBody({
    type: 'object',
    properties: {
      name:        { type: 'string', minLength: 1, maxLength: 255 },
      description: { type: 'string', maxLength: 10000 },
      color:       { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
      status:      { type: 'string', enum: ['active', 'archived'] },
    },
  }),
  responses: { ...ok200, ...r400, ...auth401, ...r404 },
});

addPath('delete', '/api/research/topics/{id}', {
  tags: ['Research'],
  summary: 'Delete a topic',
  security: cookie,
  parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'Topic ID' }],
  responses: { ...ok200, ...auth401, ...r404 },
});

addPath('get', '/api/research/attachments/{id}/download', {
  tags: ['Research'],
  summary: 'Download an attachment file (ownership-checked)',
  security: cookie,
  parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'Attachment ID' }],
  responses: {
    '200': { description: 'File stream with Content-Disposition: attachment' },
    ...auth401,
    ...r404,
  },
});

addPath('delete', '/api/research/attachments/{id}', {
  tags: ['Research'],
  summary: 'Delete an attachment (removes file from disk and DB row)',
  security: cookie,
  parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'Attachment ID' }],
  responses: { ...ok200, ...auth401, ...r404 },
});

addPath('get', '/api/research', {
  tags: ['Research'],
  summary: 'List research entries (paginated, filterable)',
  security: cookie,
  parameters: researchListParams,
  responses: { ...list200, ...r400, ...auth401 },
});

addPath('post', '/api/research', {
  tags: ['Research'],
  summary: 'Create a research entry',
  security: cookie,
  requestBody: jsonBody({
    type: 'object', required: ['title', 'type'],
    properties: {
      title:     { type: 'string', minLength: 1, maxLength: 255 },
      type:      { type: 'string', enum: ['journal', 'citation', 'note'] },
      status:    { type: 'string', enum: ['draft', 'active', 'archived'], default: 'draft' },
      content:   { type: 'string', maxLength: 10000 },
      source:    { type: 'string', maxLength: 500 },
      tags:      { type: 'string', maxLength: 500, description: 'Comma-separated tag string' },
      is_pinned: { type: 'boolean' },
      topic_ids: { type: 'array', items: { type: 'integer' } },
    },
  }),
  responses: { '201': { description: 'Created' }, ...r400, ...auth401 },
});

addPath('get', '/api/research/{id}', {
  tags: ['Research'],
  summary: 'Get research entry by ID',
  security: cookie,
  parameters: idParam,
  responses: { ...ok200, ...auth401, ...r404 },
});

addPath('patch', '/api/research/{id}', {
  tags: ['Research'],
  summary: 'Update a research entry (partial)',
  security: cookie,
  parameters: idParam,
  requestBody: jsonBody({
    type: 'object',
    properties: {
      title:     { type: 'string', minLength: 1, maxLength: 255 },
      type:      { type: 'string', enum: ['journal', 'citation', 'note'] },
      status:    { type: 'string', enum: ['draft', 'active', 'archived'] },
      content:   { type: 'string', maxLength: 10000 },
      source:    { type: 'string', maxLength: 500 },
      tags:      { type: 'string', maxLength: 500 },
      is_pinned: { type: 'boolean' },
      topic_ids: { type: 'array', items: { type: 'integer' } },
    },
  }),
  responses: { ...ok200, ...r400, ...auth401, ...r404 },
});

addPath('delete', '/api/research/{id}', {
  tags: ['Research'],
  summary: 'Delete a research entry',
  security: cookie,
  parameters: idParam,
  responses: { ...ok200, ...auth401, ...r404 },
});

addPath('post', '/api/research/{id}/duplicate', {
  tags: ['Research'],
  summary: 'Duplicate an entry (copies content, creates as draft)',
  security: cookie,
  parameters: idParam,
  responses: { '201': { description: 'Duplicated entry' }, ...auth401, ...r404 },
});

addPath('post', '/api/research/{id}/topics', {
  tags: ['Research'],
  summary: 'Sync topic associations for an entry',
  security: cookie,
  parameters: idParam,
  requestBody: jsonBody({
    type: 'object', required: ['topic_ids'],
    properties: { topic_ids: { type: 'array', items: { type: 'integer' }, minItems: 1 } },
  }),
  responses: { ...ok200, ...r400, ...auth401, ...r404 },
});

addPath('get', '/api/research/{id}/topics', {
  tags: ['Research'],
  summary: 'Get all topics associated with an entry',
  security: cookie,
  parameters: idParam,
  responses: { ...ok200, ...auth401, ...r404 },
});

addPath('post', '/api/research/{id}/attachments', {
  tags: ['Research'],
  summary: 'Upload a file attachment (multipart/form-data, max 10 MB)',
  security: cookie,
  parameters: idParam,
  requestBody: {
    required: true,
    content: {
      'multipart/form-data': {
        schema: {
          type: 'object', required: ['file'],
          properties: { file: { type: 'string', format: 'binary' } },
        },
      },
    },
  },
  responses: { '201': { description: 'Uploaded' }, ...r400, ...auth401, ...r404 },
});

addPath('get', '/api/research/{id}/attachments', {
  tags: ['Research'],
  summary: 'List attachments for an entry',
  security: cookie,
  parameters: idParam,
  responses: { ...ok200, ...auth401, ...r404 },
});

// ═════════════════════════════════════════════════════════════════════════════
// ENGINEERING
// ═════════════════════════════════════════════════════════════════════════════

addPath('get', '/api/engineer/stats', {
  tags: ['Engineering'],
  summary: 'Project counts by status, issue counts by severity',
  security: cookie,
  responses: { ...ok200, ...auth401 },
});

addPath('get', '/api/engineer/templates', {
  tags: ['Engineering'],
  summary: 'List global project scaffold templates (seeded, read-only)',
  security: cookie,
  responses: { ...ok200, ...auth401 },
});

addPath('get', '/api/engineer/snippets', {
  tags: ['Engineering'],
  summary: 'List code snippets (paginated, searchable)',
  security: cookie,
  parameters: [
    { name: 'page',     in: 'query', schema: { type: 'integer', default: 1 } },
    { name: 'per_page', in: 'query', schema: { type: 'integer', default: 50 } },
    { name: 'sort',     in: 'query', schema: { type: 'string', default: 'updated_at' } },
    { name: 'order',    in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
    { name: 'q',        in: 'query', schema: { type: 'string' } },
    { name: 'category', in: 'query', schema: { type: 'string' } },
    { name: 'language', in: 'query', schema: { type: 'string' } },
  ],
  responses: { ...list200, ...auth401 },
});

addPath('post', '/api/engineer/snippets', {
  tags: ['Engineering'],
  summary: 'Create a code snippet',
  security: cookie,
  requestBody: jsonBody({
    type: 'object', required: ['title', 'category', 'code'],
    properties: {
      title:    { type: 'string', minLength: 1, maxLength: 255 },
      category: { type: 'string', minLength: 1, maxLength: 100 },
      language: { type: 'string', minLength: 1, maxLength: 50, default: 'cpp' },
      tags:     { type: 'string', maxLength: 500 },
      code:     { type: 'string', minLength: 1, maxLength: 50000 },
    },
  }),
  responses: { '201': { description: 'Created' }, ...r400, ...auth401 },
});

addPath('get', '/api/engineer/snippets/{id}', {
  tags: ['Engineering'],
  summary: 'Get snippet by ID',
  security: cookie,
  parameters: idParam,
  responses: { ...ok200, ...auth401, ...r404 },
});

addPath('patch', '/api/engineer/snippets/{id}', {
  tags: ['Engineering'],
  summary: 'Update a snippet',
  security: cookie,
  parameters: idParam,
  requestBody: jsonBody({
    type: 'object',
    properties: {
      title:    { type: 'string', minLength: 1, maxLength: 255 },
      category: { type: 'string', minLength: 1, maxLength: 100 },
      language: { type: 'string', minLength: 1, maxLength: 50 },
      tags:     { type: 'string', maxLength: 500 },
      code:     { type: 'string', minLength: 1, maxLength: 50000 },
    },
  }),
  responses: { ...ok200, ...r400, ...auth401, ...r404 },
});

addPath('delete', '/api/engineer/snippets/{id}', {
  tags: ['Engineering'],
  summary: 'Delete a snippet',
  security: cookie,
  parameters: idParam,
  responses: { ...ok200, ...auth401, ...r404 },
});

addPath('get', '/api/engineer/documents', {
  tags: ['Engineering'],
  summary: 'List all documents across all projects (global view)',
  security: cookie,
  responses: { ...ok200, ...auth401 },
});

addPath('patch', '/api/engineer/documents/{id}', {
  tags: ['Engineering'],
  summary: 'Update a document',
  security: cookie,
  parameters: idParam,
  requestBody: jsonBody({
    type: 'object',
    properties: {
      title:    { type: 'string', minLength: 1, maxLength: 255 },
      content:  { type: 'string', maxLength: 100000 },
      doc_type: { type: 'string', maxLength: 50 },
    },
  }),
  responses: { ...ok200, ...r400, ...auth401, ...r404 },
});

addPath('delete', '/api/engineer/documents/{id}', {
  tags: ['Engineering'],
  summary: 'Delete a document',
  security: cookie,
  parameters: idParam,
  responses: { ...ok200, ...auth401, ...r404 },
});

addPath('get', '/api/engineer/issues', {
  tags: ['Engineering'],
  summary: 'List open issues across all projects (severity-ordered, for the Today briefing)',
  security: cookie,
  parameters: [
    { name: 'severity', in: 'query', schema: { type: 'string' }, description: 'Comma-separated severities (P0-Critical, P1-High, …)' },
    { name: 'status',   in: 'query', schema: { type: 'string' }, description: 'Comma-separated statuses; defaults to open,in_progress' },
    { name: 'per_page', in: 'query', schema: { type: 'integer', default: 5 } },
  ],
  responses: { ...ok200, ...auth401 },
});

addPath('patch', '/api/engineer/issues/{id}', {
  tags: ['Engineering'],
  summary: 'Update an issue',
  security: cookie,
  parameters: idParam,
  requestBody: jsonBody({
    type: 'object',
    properties: {
      title:       { type: 'string', minLength: 1, maxLength: 255 },
      description: { type: 'string', maxLength: 10000 },
      severity:    { type: 'string', enum: ['P0-Critical', 'P1-High', 'P2-Medium', 'P3-Low'] },
      status:      { type: 'string', enum: ['open', 'in_progress', 'resolved'] },
      component:   { type: 'string', maxLength: 100 },
      assignee:    { type: 'string', maxLength: 100 },
    },
  }),
  responses: { ...ok200, ...r400, ...auth401, ...r404 },
});

addPath('delete', '/api/engineer/issues/{id}', {
  tags: ['Engineering'],
  summary: 'Delete an issue',
  security: cookie,
  parameters: idParam,
  responses: { ...ok200, ...auth401, ...r404 },
});

addPath('get', '/api/engineer/roadmap', {
  tags: ['Engineering'],
  summary: 'Get 12-month skills roadmap with completion state',
  security: cookie,
  responses: { ...ok200, ...auth401 },
});

addPath('patch', '/api/engineer/roadmap/skills/{id}', {
  tags: ['Engineering'],
  summary: 'Mark a roadmap skill as completed or not',
  security: cookie,
  parameters: idParam,
  requestBody: jsonBody({
    type: 'object', required: ['completed'],
    properties: { completed: { type: 'boolean' } },
  }),
  responses: { ...ok200, ...r400, ...auth401, ...r404 },
});

// Project sub-resources (nested under /projects/:id)

addPath('get', '/api/engineer/projects/{id}/documents', {
  tags: ['Engineering'],
  summary: 'List documents for a project',
  security: cookie,
  parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'Project ID' }],
  responses: { ...ok200, ...auth401, ...r404 },
});

addPath('post', '/api/engineer/projects/{id}/documents', {
  tags: ['Engineering'],
  summary: 'Create a document for a project',
  security: cookie,
  parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'Project ID' }],
  requestBody: jsonBody({
    type: 'object', required: ['title'],
    properties: {
      title:    { type: 'string', minLength: 1, maxLength: 255 },
      content:  { type: 'string', maxLength: 100000 },
      doc_type: { type: 'string', maxLength: 50 },
    },
  }),
  responses: { '201': { description: 'Created' }, ...r400, ...auth401, ...r404 },
});

addPath('get', '/api/engineer/projects/{id}/checkins', {
  tags: ['Engineering'],
  summary: 'List weekly check-ins for a project',
  security: cookie,
  parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'Project ID' }],
  responses: { ...ok200, ...auth401, ...r404 },
});

addPath('post', '/api/engineer/projects/{id}/checkins', {
  tags: ['Engineering'],
  summary: 'Create a weekly check-in for a project',
  security: cookie,
  parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'Project ID' }],
  requestBody: jsonBody({
    type: 'object', required: ['week_start'],
    properties: {
      week_start:      { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      achievements:    { type: 'string', maxLength: 10000 },
      plans_next:      { type: 'string', maxLength: 10000 },
      blockers:        { type: 'string', maxLength: 10000 },
      bugs_discovered: { type: 'string', maxLength: 10000 },
      concerns:        { type: 'string', maxLength: 10000 },
    },
  }),
  responses: { '201': { description: 'Created' }, ...r400, ...auth401, ...r404 },
});

addPath('get', '/api/engineer/projects/{id}/issues', {
  tags: ['Engineering'],
  summary: 'List issues for a project',
  security: cookie,
  parameters: [
    { name: 'id',       in: 'path',  required: true,  schema: { type: 'integer' }, description: 'Project ID' },
    { name: 'status',   in: 'query', schema: { type: 'string', enum: ['open', 'in_progress', 'resolved'] } },
    { name: 'severity', in: 'query', schema: { type: 'string', enum: ['P0-Critical', 'P1-High', 'P2-Medium', 'P3-Low'] } },
  ],
  responses: { ...ok200, ...auth401, ...r404 },
});

addPath('post', '/api/engineer/projects/{id}/issues', {
  tags: ['Engineering'],
  summary: 'Create an issue for a project',
  security: cookie,
  parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'Project ID' }],
  requestBody: jsonBody({
    type: 'object', required: ['title'],
    properties: {
      title:       { type: 'string', minLength: 1, maxLength: 255 },
      description: { type: 'string', maxLength: 10000 },
      severity:    { type: 'string', enum: ['P0-Critical', 'P1-High', 'P2-Medium', 'P3-Low'], default: 'P2-Medium' },
      status:      { type: 'string', enum: ['open', 'in_progress', 'resolved'], default: 'open' },
      component:   { type: 'string', maxLength: 100 },
      assignee:    { type: 'string', maxLength: 100 },
    },
  }),
  responses: { '201': { description: 'Created' }, ...r400, ...auth401, ...r404 },
});

// Projects CRUD (collection + item — registered last in route file)

addPath('get', '/api/engineer', {
  tags: ['Engineering'],
  summary: 'List projects (paginated, filterable)',
  security: cookie,
  parameters: [
    { name: 'page',         in: 'query', schema: { type: 'integer', default: 1 } },
    { name: 'per_page',     in: 'query', schema: { type: 'integer', default: 20 } },
    { name: 'sort',         in: 'query', schema: { type: 'string', default: 'updated_at' } },
    { name: 'order',        in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
    { name: 'project_type', in: 'query', schema: { type: 'string', enum: ['iot', 'embedded', 'robotics', 'other'] } },
    { name: 'status',       in: 'query', schema: { type: 'string', enum: ['idea', 'planning', 'development', 'testing', 'deployed', 'archived'] } },
  ],
  responses: { ...list200, ...auth401 },
});

addPath('post', '/api/engineer', {
  tags: ['Engineering'],
  summary: 'Create a new project',
  security: cookie,
  requestBody: jsonBody({
    type: 'object', required: ['name'],
    properties: {
      name:         { type: 'string', minLength: 1, maxLength: 255 },
      description:  { type: 'string', maxLength: 10000 },
      project_type: { type: 'string', enum: ['iot', 'embedded', 'robotics', 'other'], default: 'other' },
      platforms:    { type: 'string', maxLength: 500 },
      stack:        { type: 'string', maxLength: 500 },
      status:       { type: 'string', enum: ['idea', 'planning', 'development', 'testing', 'deployed', 'archived'], default: 'idea' },
      repo_url:     { type: 'string', maxLength: 500 },
    },
  }),
  responses: { '201': { description: 'Created' }, ...r400, ...auth401 },
});

addPath('get', '/api/engineer/{id}', {
  tags: ['Engineering'],
  summary: 'Get project by ID',
  security: cookie,
  parameters: idParam,
  responses: { ...ok200, ...auth401, ...r404 },
});

addPath('patch', '/api/engineer/{id}', {
  tags: ['Engineering'],
  summary: 'Update a project',
  security: cookie,
  parameters: idParam,
  requestBody: jsonBody({
    type: 'object',
    properties: {
      name:         { type: 'string', minLength: 1, maxLength: 255 },
      description:  { type: 'string', maxLength: 10000 },
      project_type: { type: 'string', enum: ['iot', 'embedded', 'robotics', 'other'] },
      platforms:    { type: 'string', maxLength: 500 },
      stack:        { type: 'string', maxLength: 500 },
      status:       { type: 'string', enum: ['idea', 'planning', 'development', 'testing', 'deployed', 'archived'] },
      repo_url:     { type: 'string', maxLength: 500 },
    },
  }),
  responses: { ...ok200, ...r400, ...auth401, ...r404 },
});

addPath('delete', '/api/engineer/{id}', {
  tags: ['Engineering'],
  summary: 'Delete a project',
  security: cookie,
  parameters: idParam,
  responses: { ...ok200, ...auth401, ...r404 },
});

// ═════════════════════════════════════════════════════════════════════════════
// LINKS (Universal cross-module linking — Roadmap Wave 1)
// ═════════════════════════════════════════════════════════════════════════════

const linkableTypeSchema = {
  type: 'string',
  enum: [
    'transaction', 'research_entry', 'learning_item', 'engineer_project', 'todo',
    'receivable', 'payable', 'portfolio', 'budget', 'account',
    'research_topic', 'engineer_snippet', 'engineer_document', 'engineer_issue',
    'engineer_checkin', 'engineer_roadmap_skill', 'book',
  ],
};

addPath('get', '/api/links', {
  tags: ['Links'],
  summary: 'List links touching an entity (forward, reverse, or both)',
  security: cookie,
  parameters: [
    { name: 'type',      in: 'query', required: true, schema: linkableTypeSchema, description: 'Anchor entity type' },
    { name: 'id',        in: 'query', required: true, schema: { type: 'integer' }, description: 'Anchor entity ID' },
    { name: 'direction', in: 'query', schema: { type: 'string', enum: ['from', 'to', 'both'], default: 'both' } },
  ],
  responses: { ...list200, ...r400, ...auth401, ...r404 },
});

addPath('post', '/api/links', {
  tags: ['Links'],
  summary: 'Create a link between two entities (ownership of both is verified)',
  security: cookie,
  requestBody: jsonBody({
    type: 'object', required: ['from_type', 'from_id', 'to_type', 'to_id'],
    properties: {
      from_type: linkableTypeSchema,
      from_id:   { type: 'integer', minimum: 1 },
      to_type:   linkableTypeSchema,
      to_id:     { type: 'integer', minimum: 1 },
      note:      { type: 'string', maxLength: 500, nullable: true },
    },
    description: 'A repeat (from,to) pair updates the note instead of erroring.',
  }),
  responses: { '201': { description: 'Created' }, ...r400, ...auth401, ...r404 },
});

addPath('delete', '/api/links/{id}', {
  tags: ['Links'],
  summary: 'Delete a link by ID',
  security: cookie,
  parameters: idParam,
  responses: { ...ok200, ...auth401, ...r404 },
});

// ═════════════════════════════════════════════════════════════════════════════
// DASHBOARD (Roadmap Wave 2 — Today briefing)
// ═════════════════════════════════════════════════════════════════════════════

addPath('get', '/api/dashboard/today', {
  tags: ['Dashboard'],
  summary: 'Get today briefing data across all modules (todos, finance, learning, engineer, research)',
  security: cookie,
  responses: {
    '200': { description: 'Today briefing data' },
    ...auth401,
  },
});

// ═════════════════════════════════════════════════════════════════════════════
// READING (Reading Tracker — Roadmap Wave 3)
// ═════════════════════════════════════════════════════════════════════════════

addPath('get', '/api/reading/stats', {
  tags: ['Reading'],
  summary: 'Reading statistics (shelf counts, finished-this-year, avg rating, pages)',
  security: cookie,
  responses: { ...ok200, ...auth401 },
});

addPath('get', '/api/reading', {
  tags: ['Reading'],
  summary: 'List books (paginated, filterable by shelf, searchable)',
  security: cookie,
  parameters: [
    ...pageParams,
    { name: 'shelf',  in: 'query', schema: { type: 'string', enum: ['want_to_read', 'reading', 'finished'] } },
    { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Match title / author / notes' },
  ],
  responses: { ...list200, ...auth401 },
});

addPath('post', '/api/reading', {
  tags: ['Reading'],
  summary: 'Add a book',
  security: cookie,
  requestBody: jsonBody({
    type: 'object', required: ['title'],
    properties: {
      title:       { type: 'string', minLength: 1, maxLength: 500 },
      author:      { type: 'string', maxLength: 300, nullable: true },
      shelf:       { type: 'string', enum: ['want_to_read', 'reading', 'finished'], default: 'want_to_read' },
      total_pages: { type: 'integer', exclusiveMinimum: 0, nullable: true },
      notes:       { type: 'string', nullable: true },
      cover_url:   { type: 'string', maxLength: 1000, nullable: true },
      genre:       { type: 'string', maxLength: 100, nullable: true },
    },
  }),
  responses: { '201': { description: 'Created' }, ...r400, ...auth401 },
});

addPath('get', '/api/reading/{id}', {
  tags: ['Reading'],
  summary: 'Get a book by ID',
  security: cookie,
  parameters: idParam,
  responses: { ...ok200, ...auth401, ...r404 },
});

addPath('patch', '/api/reading/{id}', {
  tags: ['Reading'],
  summary: 'Update a book (partial). Shelf transitions auto-stamp started_at/finished_at.',
  security: cookie,
  parameters: idParam,
  requestBody: jsonBody({
    type: 'object',
    properties: {
      title:        { type: 'string', minLength: 1, maxLength: 500 },
      author:       { type: 'string', maxLength: 300, nullable: true },
      shelf:        { type: 'string', enum: ['want_to_read', 'reading', 'finished'] },
      total_pages:  { type: 'integer', exclusiveMinimum: 0, nullable: true },
      current_page: { type: 'integer', minimum: 0 },
      rating:       { type: 'integer', minimum: 1, maximum: 5, nullable: true },
      notes:        { type: 'string', nullable: true },
      started_at:   { type: 'string', format: 'date-time', nullable: true },
      finished_at:  { type: 'string', format: 'date-time', nullable: true },
      cover_url:    { type: 'string', maxLength: 1000, nullable: true },
      genre:        { type: 'string', maxLength: 100, nullable: true },
    },
  }),
  responses: { ...ok200, ...r400, ...auth401, ...r404 },
});

addPath('delete', '/api/reading/{id}', {
  tags: ['Reading'],
  summary: 'Delete a book',
  security: cookie,
  parameters: idParam,
  responses: { ...ok200, ...auth401, ...r404 },
});

// ═════════════════════════════════════════════════════════════════════════════
// SEARCH (Unified cross-module search — Roadmap Wave 3)
// ═════════════════════════════════════════════════════════════════════════════

addPath('get', '/api/search', {
  tags: ['Search'],
  summary: 'Search across all modules (≤5 per module, ranked by recency)',
  security: cookie,
  parameters: [
    { name: 'q', in: 'query', required: true, schema: { type: 'string', minLength: 1, maxLength: 200 } },
  ],
  responses: { ...ok200, ...r400, ...auth401 },
});

// ─── Write output ─────────────────────────────────────────────────────────────

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, JSON.stringify(spec, null, 2), 'utf8');

const pathCount = Object.keys(spec.paths).length;
console.log(`OpenAPI spec written to ${outFile} — ${pathCount} paths`);
