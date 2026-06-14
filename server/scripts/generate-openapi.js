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
    { name: 'Contacts',    description: 'Startup founder CRM — clients, partners, and stakeholders' },
    { name: 'Ideas',       description: 'Ideas Tracker — capture ideas before they evaporate' },
    { name: 'Polymath',    description: 'Polymath Dashboard — multi-year cross-module growth' },
    { name: 'Roadmaps',    description: 'Custom Learning Roadmaps — user-defined learning paths with tracks and milestones' },
    { name: 'AI Chat',     description: 'DeepSeek-powered AI assistant chatbox' },
    { name: 'Export',      description: 'Universal data export — download all modules as a ZIP archive' },
    { name: 'Settings',       description: 'Server-side user preferences — theme, default AI model, notifications' },
    { name: 'Notifications',  description: 'Push notification subscriptions and due-item reminders' },
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
    { name: 'type',        in: 'query', schema: { type: 'string', enum: ['Income', 'Expense', 'Transfer', 'Balance Adjustment', 'Market Adjustment', 'Revenue'] } },
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
      type:              { type: 'string', enum: ['Income', 'Expense', 'Transfer', 'Balance Adjustment', 'Market Adjustment', 'Revenue'] },
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
      type:              { type: 'string', enum: ['Income', 'Expense', 'Transfer', 'Balance Adjustment', 'Market Adjustment', 'Revenue'] },
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

addPath('get', '/api/research/semantic-search', {
  tags: ['Research'],
  summary: 'Semantic search over entries by meaning (pgvector embeddings, Wave 6)',
  description: 'Embeds the query and ranks the user\'s research entries by cosine similarity. Each result carries a `similarity` score (0..1). Returns an empty list when no entries are indexed; requires an embedding API key to be configured server-side.',
  security: cookie,
  parameters: [
    { name: 'q', in: 'query', required: true, schema: { type: 'string', minLength: 1 }, description: 'Natural-language query' },
  ],
  responses: { ...ok200, ...r400, ...auth401 },
});

addPath('get', '/api/research/suggest-tags', {
  tags: ['Research'],
  summary: 'Auto-suggest tags from semantically similar entries (Wave 6)',
  description: 'Best-effort: always returns a 200 with an array (possibly empty) of suggested tags drawn from the nearest neighbours of the supplied title/content.',
  security: cookie,
  parameters: [
    { name: 'title',   in: 'query', schema: { type: 'string' } },
    { name: 'content', in: 'query', schema: { type: 'string' } },
  ],
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

addPath('get', '/api/engineer/projects/{id}/budget', {
  tags: ['Engineering'],
  summary: 'Project Budget vs Actual — sums current-month spend for each linked budget (Roadmap Wave 4)',
  security: cookie,
  parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'Project ID' }],
  responses: {
    '200': {
      description: 'Budgets linked to the project with budget/spent/remaining, plus totals',
      content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } },
    },
    ...auth401, ...r404,
  },
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
    'engineer_checkin', 'engineer_roadmap_skill', 'book', 'contact', 'idea',
    'time_entry', 'goal', 'chat',
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

// ═════════════════════════════════════════════════════════════════════════════
// CONTACTS (Startup Founder CRM — Roadmap Wave 4)
// ═════════════════════════════════════════════════════════════════════════════

const contactTypeEnum   = ['client', 'partner', 'supplier', 'investor', 'mentor', 'other'];
const contactStatusEnum = ['active', 'inactive', 'lead'];

addPath('get', '/api/contacts/stats', {
  tags: ['Contacts'],
  summary: 'Aggregate contact counts (total, clients, partners, active, leads)',
  security: cookie,
  responses: { ...ok200, ...auth401 },
});

addPath('get', '/api/contacts', {
  tags: ['Contacts'],
  summary: 'List contacts (paginated, filterable, searchable)',
  security: cookie,
  parameters: [
    ...pageParams,
    { name: 'type',   in: 'query', schema: { type: 'string', enum: contactTypeEnum } },
    { name: 'status', in: 'query', schema: { type: 'string', enum: contactStatusEnum } },
    { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Match name / company / email' },
  ],
  responses: { ...list200, ...auth401 },
});

addPath('post', '/api/contacts', {
  tags: ['Contacts'],
  summary: 'Create a contact',
  security: cookie,
  requestBody: jsonBody({
    type: 'object', required: ['name'],
    properties: {
      name:    { type: 'string', minLength: 1, maxLength: 200 },
      email:   { type: 'string', format: 'email', maxLength: 300, nullable: true },
      phone:   { type: 'string', maxLength: 50, nullable: true },
      company: { type: 'string', maxLength: 200, nullable: true },
      role:    { type: 'string', maxLength: 100, nullable: true },
      type:    { type: 'string', enum: contactTypeEnum, default: 'client' },
      status:  { type: 'string', enum: contactStatusEnum, default: 'active' },
      notes:   { type: 'string', nullable: true },
    },
  }),
  responses: { '201': { description: 'Created' }, ...r400, ...auth401 },
});

addPath('get', '/api/contacts/{id}', {
  tags: ['Contacts'],
  summary: 'Get contact by ID',
  security: cookie,
  parameters: idParam,
  responses: { ...ok200, ...auth401, ...r404 },
});

addPath('patch', '/api/contacts/{id}', {
  tags: ['Contacts'],
  summary: 'Update a contact (partial)',
  security: cookie,
  parameters: idParam,
  requestBody: jsonBody({
    type: 'object',
    properties: {
      name:           { type: 'string', minLength: 1, maxLength: 200 },
      email:          { type: 'string', format: 'email', maxLength: 300, nullable: true },
      phone:          { type: 'string', maxLength: 50, nullable: true },
      company:        { type: 'string', maxLength: 200, nullable: true },
      role:           { type: 'string', maxLength: 100, nullable: true },
      type:           { type: 'string', enum: contactTypeEnum },
      status:         { type: 'string', enum: contactStatusEnum },
      notes:          { type: 'string', nullable: true },
      last_contacted: { type: 'string', format: 'date-time', nullable: true },
    },
  }),
  responses: { ...ok200, ...r400, ...auth401, ...r404 },
});

addPath('delete', '/api/contacts/{id}', {
  tags: ['Contacts'],
  summary: 'Delete a contact',
  security: cookie,
  parameters: idParam,
  responses: { ...ok200, ...auth401, ...r404 },
});

// ═════════════════════════════════════════════════════════════════════════════
// IDEAS (Ideas Tracker — Roadmap Wave 4)
// ═════════════════════════════════════════════════════════════════════════════

const ideaStatusEnum = ['new', 'developing', 'validated', 'archived', 'converted'];

addPath('get', '/api/ideas/stats', {
  tags: ['Ideas'],
  summary: 'Aggregate idea counts by status (total, new, developing, validated, archived, converted)',
  security: cookie,
  responses: { ...ok200, ...auth401 },
});

addPath('get', '/api/ideas', {
  tags: ['Ideas'],
  summary: 'List ideas (paginated, filterable by status, searchable)',
  security: cookie,
  parameters: [
    ...pageParams,
    { name: 'status', in: 'query', schema: { type: 'string', enum: ideaStatusEnum } },
    { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Match title / description / tags' },
  ],
  responses: { ...list200, ...auth401 },
});

addPath('post', '/api/ideas', {
  tags: ['Ideas'],
  summary: 'Capture an idea',
  security: cookie,
  requestBody: jsonBody({
    type: 'object', required: ['title'],
    properties: {
      title:       { type: 'string', minLength: 1, maxLength: 500 },
      description: { type: 'string', nullable: true },
      status:      { type: 'string', enum: ideaStatusEnum, default: 'new' },
      tags:        { type: 'string', maxLength: 500, nullable: true },
      source:      { type: 'string', maxLength: 100, nullable: true },
    },
  }),
  responses: { '201': { description: 'Created' }, ...r400, ...auth401 },
});

addPath('get', '/api/ideas/{id}', {
  tags: ['Ideas'],
  summary: 'Get idea by ID',
  security: cookie,
  parameters: idParam,
  responses: { ...ok200, ...auth401, ...r404 },
});

addPath('patch', '/api/ideas/{id}', {
  tags: ['Ideas'],
  summary: 'Update an idea (partial). Convert-to flows set status/converted_to/converted_id.',
  security: cookie,
  parameters: idParam,
  requestBody: jsonBody({
    type: 'object',
    properties: {
      title:        { type: 'string', minLength: 1, maxLength: 500 },
      description:  { type: 'string', nullable: true },
      status:       { type: 'string', enum: ideaStatusEnum },
      tags:         { type: 'string', maxLength: 500, nullable: true },
      source:       { type: 'string', maxLength: 100, nullable: true },
      converted_to: { type: 'string', maxLength: 40, nullable: true },
      converted_id: { type: 'integer', minimum: 1, nullable: true },
    },
  }),
  responses: { ...ok200, ...r400, ...auth401, ...r404 },
});

addPath('delete', '/api/ideas/{id}', {
  tags: ['Ideas'],
  summary: 'Delete an idea',
  security: cookie,
  parameters: idParam,
  responses: { ...ok200, ...auth401, ...r404 },
});

// ═════════════════════════════════════════════════════════════════════════════
// TIME TRACKING (Roadmap Wave 5)
// ═════════════════════════════════════════════════════════════════════════════

const timeEntityTypes = ['todo', 'research_entry', 'learning_item', 'engineer_project', 'book'];

addPath('get', '/api/time/running', {
  tags: ['Time'],
  summary: 'Get the currently running timer (null when none)',
  security: cookie,
  responses: { ...ok200, ...auth401 },
});

addPath('get', '/api/time/summary', {
  tags: ['Time'],
  summary: 'Time totals grouped by entity type for a date range',
  security: cookie,
  parameters: [
    { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
    { name: 'to',   in: 'query', schema: { type: 'string', format: 'date' } },
  ],
  responses: { ...ok200, ...auth401 },
});

addPath('get', '/api/time', {
  tags: ['Time'],
  summary: 'List time entries (paginated, filterable)',
  security: cookie,
  parameters: [
    ...pageParams,
    { name: 'entity_type', in: 'query', schema: { type: 'string', enum: timeEntityTypes } },
    { name: 'entity_id',   in: 'query', schema: { type: 'integer' } },
    { name: 'from',        in: 'query', schema: { type: 'string', format: 'date' } },
    { name: 'to',          in: 'query', schema: { type: 'string', format: 'date' } },
  ],
  responses: { ...list200, ...auth401 },
});

addPath('post', '/api/time/start', {
  tags: ['Time'],
  summary: 'Start a timer (stops any running timer first)',
  security: cookie,
  requestBody: jsonBody({
    type: 'object', required: ['entity_type', 'entity_id'],
    properties: {
      entity_type: { type: 'string', enum: timeEntityTypes },
      entity_id:   { type: 'integer' },
      note:        { type: 'string', maxLength: 500, nullable: true },
    },
  }),
  responses: { '201': { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }, ...auth401, ...r400 },
});

addPath('post', '/api/time/stop', {
  tags: ['Time'],
  summary: 'Stop the running timer',
  security: cookie,
  responses: { ...ok200, ...auth401, ...r404 },
});

addPath('delete', '/api/time/{id}', {
  tags: ['Time'],
  summary: 'Delete a time entry',
  security: cookie,
  parameters: idParam,
  responses: { ...ok200, ...auth401, ...r404 },
});

// ═════════════════════════════════════════════════════════════════════════════
// REVIEW (Roadmap Wave 5)
// ═════════════════════════════════════════════════════════════════════════════

addPath('get', '/api/review/weekly', {
  tags: ['Review'],
  summary: 'Weekly accomplishments across all modules',
  security: cookie,
  parameters: [
    { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
    { name: 'to',   in: 'query', schema: { type: 'string', format: 'date' } },
  ],
  responses: { ...ok200, ...auth401 },
});

addPath('get', '/api/review/annual', {
  tags: ['Review'],
  summary: 'Yearly "Polymath Report" across all modules',
  security: cookie,
  parameters: [{ name: 'year', in: 'query', schema: { type: 'integer' } }],
  responses: { ...ok200, ...auth401 },
});

// ═════════════════════════════════════════════════════════════════════════════
// GOALS / OKRs (Roadmap Wave 5)
// ═════════════════════════════════════════════════════════════════════════════

const goalTypes      = ['target', 'milestone', 'habit', 'learning'];
const goalStatuses   = ['active', 'completed', 'abandoned', 'paused'];
const goalPriorities = ['low', 'medium', 'high', 'critical'];

const goalWriteProps = {
  title:        { type: 'string', maxLength: 500 },
  description:  { type: 'string', nullable: true },
  goal_type:    { type: 'string', enum: goalTypes },
  target_value: { type: 'number', nullable: true },
  current_value:{ type: 'number', nullable: true },
  unit:         { type: 'string', maxLength: 100, nullable: true },
  category:     { type: 'string', maxLength: 100, nullable: true },
  status:       { type: 'string', enum: goalStatuses },
  priority:     { type: 'string', enum: goalPriorities },
  start_date:   { type: 'string', format: 'date', nullable: true },
  target_date:  { type: 'string', format: 'date', nullable: true },
};

addPath('get', '/api/goals/stats', {
  tags: ['Goals'],
  summary: 'Goal statistics (active, completed, critical, on-track)',
  security: cookie,
  responses: { ...ok200, ...auth401 },
});

addPath('get', '/api/goals', {
  tags: ['Goals'],
  summary: 'List goals (paginated, filterable)',
  security: cookie,
  parameters: [
    ...pageParams,
    { name: 'status',   in: 'query', schema: { type: 'string', enum: goalStatuses } },
    { name: 'priority', in: 'query', schema: { type: 'string', enum: goalPriorities } },
  ],
  responses: { ...list200, ...auth401 },
});

addPath('post', '/api/goals', {
  tags: ['Goals'],
  summary: 'Create a goal',
  security: cookie,
  requestBody: jsonBody({ type: 'object', required: ['title'], properties: goalWriteProps }),
  responses: { '201': { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }, ...auth401, ...r400 },
});

addPath('get', '/api/goals/{id}', {
  tags: ['Goals'],
  summary: 'Get a goal by ID',
  security: cookie,
  parameters: idParam,
  responses: { ...ok200, ...auth401, ...r404 },
});

addPath('post', '/api/goals/{id}/recalc', {
  tags: ['Goals'],
  summary: 'Recalculate current_value from linked entities',
  security: cookie,
  parameters: idParam,
  responses: { ...ok200, ...auth401, ...r404 },
});

addPath('patch', '/api/goals/{id}', {
  tags: ['Goals'],
  summary: 'Update a goal (partial)',
  security: cookie,
  parameters: idParam,
  requestBody: jsonBody({ type: 'object', properties: goalWriteProps }),
  responses: { ...ok200, ...auth401, ...r404, ...r400 },
});

addPath('delete', '/api/goals/{id}', {
  tags: ['Goals'],
  summary: 'Delete a goal',
  security: cookie,
  parameters: idParam,
  responses: { ...ok200, ...auth401, ...r404 },
});

// ═════════════════════════════════════════════════════════════════════════════
// POLYMATH DASHBOARD (Roadmap Wave 6 — Moonshots)
// ═════════════════════════════════════════════════════════════════════════════

addPath('get', '/api/polymath', {
  tags: ['Polymath'],
  summary: 'Multi-year growth data across all modules for the Polymath Dashboard',
  description: 'Returns books/research/learning/projects/time aggregated by year, plus the top knowledge tags, for a long-term view of the user\'s polymath journey.',
  security: cookie,
  responses: { ...ok200, ...auth401 },
});

// ═════════════════════════════════════════════════════════════════════════════
// AI CHAT (Roadmap Wave 7 — DeepSeek-powered assistant)
// ═════════════════════════════════════════════════════════════════════════════

const chatModelEnum = ['deepseek-v4-flash', 'deepseek-v4-pro', 'deepseek-r1-local'];

addPath('get', '/api/chat/models', {
  tags: ['AI Chat'],
  summary: 'List available chat models and whether each is currently usable',
  security: cookie,
  responses: { ...ok200, ...auth401 },
});

addPath('get', '/api/chat/conversations', {
  tags: ['AI Chat'],
  summary: 'List the user\'s chat conversations (paginated, newest first)',
  security: cookie,
  parameters: [
    { name: 'page',     in: 'query', schema: { type: 'integer', default: 1 } },
    { name: 'per_page', in: 'query', schema: { type: 'integer', default: 20, maximum: 50 } },
  ],
  responses: { ...list200, ...auth401 },
});

addPath('get', '/api/chat/conversations/{id}', {
  tags: ['AI Chat'],
  summary: 'Get one conversation (including its full message log)',
  security: cookie,
  parameters: idParam,
  responses: { ...ok200, ...r400, ...auth401, ...r404 },
});

addPath('delete', '/api/chat/conversations/{id}', {
  tags: ['AI Chat'],
  summary: 'Delete a conversation',
  security: cookie,
  parameters: idParam,
  responses: { ...ok200, ...r400, ...auth401, ...r404 },
});

addPath('post', '/api/chat/send', {
  tags: ['AI Chat'],
  summary: 'Send a message and stream the assistant reply over SSE',
  description: 'Persists the user message, then streams the model reply token-by-token as Server-Sent Events (`text/event-stream`). Events: `{type:"conversation_id",id}`, `{type:"token",content}`, `{type:"done"}`, `{type:"error",message}`. Creates a new conversation when `conversation_id` is omitted.',
  security: cookie,
  requestBody: jsonBody({
    type: 'object', required: ['message'],
    properties: {
      conversation_id:     { type: 'integer', nullable: true, description: 'Omit/null to start a new conversation' },
      message:             { type: 'string', minLength: 1, maxLength: 10000 },
      model:               { type: 'string', enum: chatModelEnum, default: 'deepseek-v4-flash' },
      temperature:         { type: 'number', minimum: 0, maximum: 2, default: 0.7 },
      top_p:               { type: 'number', minimum: 0, maximum: 1, default: 0.9 },
      context_entity_type: { type: 'string', maxLength: 40, nullable: true },
      context_entity_id:   { type: 'integer', nullable: true },
    },
  }),
  responses: {
    '200': { description: 'SSE stream of the assistant reply', content: { 'text/event-stream': { schema: { type: 'string' } } } },
    ...r400, ...auth401, ...r404,
  },
});

// ═════════════════════════════════════════════════════════════════════════════
// EXPORT (Universal data export — all modules as ZIP)
// ═════════════════════════════════════════════════════════════════════════════

addPath('get', '/api/export', {
  tags: ['Export'],
  summary: 'Download all user data as a ZIP archive (JSON or CSV per module)',
  description: 'Exports todos, transactions, learning items, research entries, books, contacts, ideas, goals, time entries, and engineer projects. Returns a ZIP with one file per module plus a `_SUMMARY.json` manifest. Capped at 10 000 rows per module.',
  security: cookie,
  parameters: [
    { name: 'format', in: 'query', schema: { type: 'string', enum: ['json', 'csv'], default: 'json' }, description: 'File format for each module inside the ZIP' },
  ],
  responses: {
    '200': {
      description: 'ZIP archive download',
      content: { 'application/zip': { schema: { type: 'string', format: 'binary' } } },
    },
    ...r400,
    ...auth401,
  },
});

// ═════════════════════════════════════════════════════════════════════════════
// SETTINGS (Server-side user preferences — Post-V5)
// ═════════════════════════════════════════════════════════════════════════════

const settingsSchema = {
  type: 'object',
  properties: {
    theme:                 { type: 'string', enum: ['light', 'dark', 'system'], default: 'system' },
    default_model:         { type: 'string', maxLength: 50, default: 'deepseek-v4-flash' },
    notifications_enabled: { type: 'boolean', default: true },
  },
};

addPath('get', '/api/settings', {
  tags: ['Settings'],
  summary: 'Get the current user\'s preferences (created with defaults on first access)',
  security: cookie,
  responses: { ...ok200, ...auth401 },
});

addPath('put', '/api/settings', {
  tags: ['Settings'],
  summary: 'Update the current user\'s preferences (partial)',
  description: 'Upserts theme, default AI model, and/or the notification preference. At least one field is required.',
  security: cookie,
  requestBody: jsonBody(settingsSchema),
  responses: { ...ok200, ...r400, ...auth401 },
});

// ═════════════════════════════════════════════════════════════════════════════
// ENGINEER SPRINT BOARD (Roadmap Forward Phase 1.5)
// ═════════════════════════════════════════════════════════════════════════════

addPath('get', '/api/engineer/sprint', {
  tags: ['Engineering'],
  summary: 'Consolidated Sprint Board — active projects, open issues, and upcoming check-ins in one view',
  security: cookie,
  responses: { ...ok200, ...auth401 },
});

// ═════════════════════════════════════════════════════════════════════════════
// FINANCE OVERVIEW (Roadmap Forward Phase 1.5)
// ═════════════════════════════════════════════════════════════════════════════

addPath('get', '/api/finances/overview', {
  tags: ['Finances'],
  summary: 'One-screen financial review: summary, balances, budget progress, top categories, and upcoming payables/receivables',
  security: cookie,
  parameters: [
    { name: 'month', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 12 } },
    { name: 'year',  in: 'query', schema: { type: 'integer', minimum: 1900 } },
  ],
  responses: { ...ok200, ...r400, ...auth401 },
});

// ═════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS (Roadmap Forward Phase 1.3)
// ═════════════════════════════════════════════════════════════════════════════

addPath('post', '/api/notifications/subscribe', {
  tags: ['Notifications'],
  summary: 'Store (or refresh) a Web Push subscription for this user+endpoint',
  security: cookie,
  requestBody: jsonBody({
    type: 'object', required: ['endpoint', 'keys'],
    properties: {
      endpoint: { type: 'string', format: 'uri' },
      keys: {
        type: 'object', required: ['p256dh', 'auth'],
        properties: {
          p256dh: { type: 'string' },
          auth:   { type: 'string' },
        },
      },
    },
  }),
  responses: { ...ok200, ...r400, ...auth401 },
});

addPath('get', '/api/notifications/status', {
  tags: ['Notifications'],
  summary: 'Whether reminders are enabled (user_settings) + count of stored push endpoints',
  security: cookie,
  responses: { ...ok200, ...auth401 },
});

addPath('get', '/api/notifications/due', {
  tags: ['Notifications'],
  summary: 'Items due today through the next 7 days across all modules (todos, receivables, payables, check-ins, goals)',
  security: cookie,
  responses: { ...ok200, ...auth401 },
});

// ═════════════════════════════════════════════════════════════════════════════
// HABIT LOGS (Roadmap Forward Phase 1.4 — nested under Goals)
// ═════════════════════════════════════════════════════════════════════════════

addPath('post', '/api/goals/{id}/habit-log', {
  tags: ['Goals'],
  summary: 'Toggle today\'s check-in for a habit goal (insert if absent, delete if present)',
  security: cookie,
  parameters: idParam,
  responses: { ...ok200, ...auth401, ...r404 },
});

addPath('get', '/api/goals/{id}/habit-logs', {
  tags: ['Goals'],
  summary: 'Habit calendar data — log dates in range plus current streak, checked-today flag, and total days',
  security: cookie,
  parameters: [
    ...idParam,
    { name: 'from', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Start of date range (default: 89 days ago)' },
    { name: 'to',   in: 'query', schema: { type: 'string', format: 'date' }, description: 'End of date range (default: today)' },
  ],
  responses: { ...ok200, ...auth401, ...r404 },
});

// ═════════════════════════════════════════════════════════════════════════════
// ROADMAPS (Custom Learning Roadmaps)
// ═════════════════════════════════════════════════════════════════════════════

const trackIdParam     = [{ name: 'trackId',     in: 'path', required: true, schema: { type: 'integer' } }];
const milestoneIdParam = [{ name: 'milestoneId', in: 'path', required: true, schema: { type: 'integer' } }];

const milestoneProps = {
  title:           { type: 'string', minLength: 1, maxLength: 500 },
  description:     { type: 'string', nullable: true },
  status:          { type: 'string', enum: ['pending', 'in_progress', 'completed', 'skipped'] },
  priority:        { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
  sort_order:      { type: 'integer' },
  due_date:        { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', nullable: true },
  notes:           { type: 'string', nullable: true },
  resources:       { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, url: { type: 'string' }, type: { type: 'string' } } } },
  estimated_hours: { type: 'number', minimum: 0, nullable: true },
  actual_hours:    { type: 'number', minimum: 0, nullable: true },
};

addPath('get', '/api/roadmaps/stats', {
  tags: ['Roadmaps'],
  summary: 'Aggregate stats across all roadmaps (totals, by status, milestone counts)',
  security: cookie,
  responses: { ...ok200, ...auth401 },
});

addPath('get', '/api/roadmaps', {
  tags: ['Roadmaps'],
  summary: 'List roadmaps (flat, with track/milestone counts)',
  security: cookie,
  parameters: [
    { name: 'status',   in: 'query', schema: { type: 'string', enum: ['active', 'completed', 'archived', 'paused'] } },
    { name: 'category', in: 'query', schema: { type: 'string' } },
    { name: 'sort',     in: 'query', schema: { type: 'string' } },
    { name: 'order',    in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
  ],
  responses: { ...ok200, ...auth401 },
});

addPath('post', '/api/roadmaps', {
  tags: ['Roadmaps'],
  summary: 'Create a roadmap (optionally with inline starter tracks)',
  security: cookie,
  requestBody: jsonBody({
    type: 'object', required: ['title'],
    properties: {
      title:       { type: 'string', minLength: 1, maxLength: 300 },
      description: { type: 'string', nullable: true },
      category:    { type: 'string', maxLength: 100, nullable: true },
      status:      { type: 'string', enum: ['active', 'completed', 'archived', 'paused'], default: 'active' },
      icon:        { type: 'string', maxLength: 50, nullable: true },
      color:       { type: 'string', maxLength: 7, nullable: true },
      tracks:      { type: 'array', maxItems: 20, items: { type: 'object', required: ['title'], properties: { title: { type: 'string', maxLength: 300 }, description: { type: 'string', nullable: true }, color: { type: 'string', maxLength: 7, nullable: true } } } },
    },
  }),
  responses: { '201': { description: 'Created' }, ...r400, ...auth401 },
});

addPath('get', '/api/roadmaps/{id}', {
  tags: ['Roadmaps'],
  summary: 'Get a roadmap with its tracks and milestones nested',
  security: cookie,
  parameters: idParam,
  responses: { ...ok200, ...auth401, ...r404 },
});

addPath('patch', '/api/roadmaps/{id}', {
  tags: ['Roadmaps'],
  summary: 'Update a roadmap (metadata only — progress is auto-calculated)',
  security: cookie,
  parameters: idParam,
  requestBody: jsonBody({
    type: 'object',
    properties: {
      title:       { type: 'string', minLength: 1, maxLength: 300 },
      description: { type: 'string', nullable: true },
      category:    { type: 'string', maxLength: 100, nullable: true },
      status:      { type: 'string', enum: ['active', 'completed', 'archived', 'paused'] },
      icon:        { type: 'string', maxLength: 50, nullable: true },
      color:       { type: 'string', maxLength: 7, nullable: true },
    },
  }),
  responses: { ...ok200, ...r400, ...auth401, ...r404 },
});

addPath('delete', '/api/roadmaps/{id}', {
  tags: ['Roadmaps'],
  summary: 'Delete a roadmap (cascades to tracks + milestones)',
  security: cookie,
  parameters: idParam,
  responses: { ...ok200, ...auth401, ...r404 },
});

addPath('post', '/api/roadmaps/{id}/tracks', {
  tags: ['Roadmaps'],
  summary: 'Add a track (lane) to a roadmap',
  security: cookie,
  parameters: idParam,
  requestBody: jsonBody({
    type: 'object', required: ['title'],
    properties: {
      title:       { type: 'string', minLength: 1, maxLength: 300 },
      description: { type: 'string', nullable: true },
      color:       { type: 'string', maxLength: 7, nullable: true },
      sort_order:  { type: 'integer', nullable: true },
    },
  }),
  responses: { '201': { description: 'Created' }, ...r400, ...auth401, ...r404 },
});

addPath('post', '/api/roadmaps/{id}/recalc', {
  tags: ['Roadmaps'],
  summary: 'Force-recalculate roadmap + track progress from milestone statuses',
  security: cookie,
  parameters: idParam,
  responses: { ...ok200, ...auth401, ...r404 },
});

addPath('patch', '/api/roadmaps/tracks/{trackId}', {
  tags: ['Roadmaps'],
  summary: 'Update a track',
  security: cookie,
  parameters: trackIdParam,
  requestBody: jsonBody({
    type: 'object',
    properties: {
      title:       { type: 'string', minLength: 1, maxLength: 300 },
      description: { type: 'string', nullable: true },
      color:       { type: 'string', maxLength: 7, nullable: true },
      sort_order:  { type: 'integer' },
    },
  }),
  responses: { ...ok200, ...r400, ...auth401, ...r404 },
});

addPath('delete', '/api/roadmaps/tracks/{trackId}', {
  tags: ['Roadmaps'],
  summary: 'Delete a track (cascades to its milestones, recalculates progress)',
  security: cookie,
  parameters: trackIdParam,
  responses: { ...ok200, ...auth401, ...r404 },
});

addPath('post', '/api/roadmaps/tracks/{trackId}/milestones', {
  tags: ['Roadmaps'],
  summary: 'Add a milestone to a track',
  security: cookie,
  parameters: trackIdParam,
  requestBody: jsonBody({
    type: 'object', required: ['title'],
    properties: milestoneProps,
  }),
  responses: { '201': { description: 'Created' }, ...r400, ...auth401, ...r404 },
});

addPath('patch', '/api/roadmaps/milestones/{milestoneId}', {
  tags: ['Roadmaps'],
  summary: 'Update a milestone (status change auto-stamps completed_at + recalculates progress)',
  security: cookie,
  parameters: milestoneIdParam,
  requestBody: jsonBody({ type: 'object', properties: milestoneProps }),
  responses: { ...ok200, ...r400, ...auth401, ...r404 },
});

addPath('delete', '/api/roadmaps/milestones/{milestoneId}', {
  tags: ['Roadmaps'],
  summary: 'Delete a milestone (recalculates progress)',
  security: cookie,
  parameters: milestoneIdParam,
  responses: { ...ok200, ...auth401, ...r404 },
});

// ─── Write output ─────────────────────────────────────────────────────────────

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, JSON.stringify(spec, null, 2), 'utf8');

const pathCount = Object.keys(spec.paths).length;
console.log(`OpenAPI spec written to ${outFile} — ${pathCount} paths`);
