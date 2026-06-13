// server/routes/engineer.js
// Engineering Toolkit REST API. Mount in server/index.js as:
//   app.use('/api/engineer', requireAuth, engineerRouter)
//
// Route ordering rule (§6.3, mirrors finances.js): every literal sub-resource
// path is registered BEFORE the parameterised `/projects/:id` routes so that
// e.g. `/projects/stats` is never captured by `/projects/:id`.

import { Router } from 'express';
import { z } from 'zod';
import { PROJECT_TYPES, PROJECT_STATUSES, ISSUE_SEVERITIES, ISSUE_STATUSES } from '../lib/enums.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../lib/AppError.js';
import { logger } from '../lib/logger.js';
import pool from '../lib/db.js';
import { getLinksForEntity } from '../models/links.model.js';
import { getBudgetById } from '../models/finance.model.js';
import {
  // projects
  listProjects, getProjectById, createProject, patchProject, deleteProject,
  getProjectStats, listTemplates,
  // snippets
  listSnippets, getSnippetById, createSnippet, patchSnippet, deleteSnippet,
  // documents
  listProjectDocuments, listGlobalDocuments, getDocumentById,
  createDocument, patchDocument, deleteDocument,
  // check-ins
  listCheckins, createCheckin,
  // issues
  listIssues, listOpenIssues, getIssueById, createIssue, patchIssue, deleteIssue,
  // roadmap
  getRoadmap, getRoadmapSkillById, setRoadmapSkillCompleted,
} from '../models/engineer.model.js';

const router = Router();

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const createProjectSchema = z.object({
  name:         z.string().min(1, 'Name is required.').max(255),
  description:  z.string().max(10000).optional(),
  project_type: z.enum(PROJECT_TYPES, { errorMap: () => ({ message: 'Invalid project type.' }) }).default('other'),
  platforms:    z.string().max(500).optional(),
  stack:        z.string().max(500).optional(),
  status:       z.enum(PROJECT_STATUSES, { errorMap: () => ({ message: 'Invalid status.' }) }).default('idea'),
  repo_url:     z.string().max(500).optional(),
});

const patchProjectSchema = z.object({
  name:         z.string().min(1).max(255).optional(),
  description:  z.string().max(10000).optional(),
  project_type: z.enum(PROJECT_TYPES).optional(),
  platforms:    z.string().max(500).optional(),
  stack:        z.string().max(500).optional(),
  status:       z.enum(PROJECT_STATUSES).optional(),
  repo_url:     z.string().max(500).optional(),
}).refine(d => Object.keys(d).length > 0, { message: 'At least one field is required.' });

const createSnippetSchema = z.object({
  title:    z.string().min(1, 'Title is required.').max(255),
  category: z.string().min(1, 'Category is required.').max(100),
  language: z.string().min(1).max(50).default('cpp'),
  tags:     z.string().max(500).optional(),
  code:     z.string().min(1, 'Code is required.').max(50000),
});

const patchSnippetSchema = z.object({
  title:    z.string().min(1).max(255).optional(),
  category: z.string().min(1).max(100).optional(),
  language: z.string().min(1).max(50).optional(),
  tags:     z.string().max(500).optional(),
  code:     z.string().min(1).max(50000).optional(),
}).refine(d => Object.keys(d).length > 0, { message: 'At least one field is required.' });

const createDocumentSchema = z.object({
  title:    z.string().min(1, 'Title is required.').max(255),
  content:  z.string().max(100000).optional(),
  doc_type: z.string().max(50).optional(),
});

const patchDocumentSchema = z.object({
  title:    z.string().min(1).max(255).optional(),
  content:  z.string().max(100000).optional(),
  doc_type: z.string().max(50).optional(),
}).refine(d => Object.keys(d).length > 0, { message: 'At least one field is required.' });

const createCheckinSchema = z.object({
  week_start:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Week start must be a YYYY-MM-DD date.'),
  achievements:    z.string().max(10000).optional(),
  plans_next:      z.string().max(10000).optional(),
  blockers:        z.string().max(10000).optional(),
  bugs_discovered: z.string().max(10000).optional(),
  concerns:        z.string().max(10000).optional(),
});

const createIssueSchema = z.object({
  title:       z.string().min(1, 'Title is required.').max(255),
  description: z.string().max(10000).optional(),
  severity:    z.enum(ISSUE_SEVERITIES, { errorMap: () => ({ message: 'Invalid severity.' }) }).default('P2-Medium'),
  status:      z.enum(ISSUE_STATUSES, { errorMap: () => ({ message: 'Invalid status.' }) }).default('open'),
  component:   z.string().max(100).optional(),
  assignee:    z.string().max(100).optional(),
});

const patchIssueSchema = z.object({
  title:       z.string().min(1).max(255).optional(),
  description: z.string().max(10000).optional(),
  severity:    z.enum(ISSUE_SEVERITIES).optional(),
  status:      z.enum(ISSUE_STATUSES).optional(),
  component:   z.string().max(100).optional(),
  assignee:    z.string().max(100).optional(),
}).refine(d => Object.keys(d).length > 0, { message: 'At least one field is required.' });

const patchSkillSchema = z.object({
  completed: z.boolean({ errorMap: () => ({ message: 'completed must be a boolean.' }) }),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse `:id`-style params; throws a 400 for non-numeric ids. */
function parseId(raw, label = 'id') {
  const id = parseInt(raw, 10);
  if (Number.isNaN(id)) throw new AppError(`Invalid ${label}.`, 400, 'VALIDATION_ERROR', label);
  return id;
}

/** Load a project owned by the user or throw 404. Used to guard nested writes. */
async function requireOwnedProject(projectId, userId) {
  const project = await getProjectById(projectId, userId);
  if (!project) throw new AppError('Project not found.', 404, 'NOT_FOUND');
  return project;
}

// ══════════════════════════════════════════════════════════════════════════════
// LITERAL SUB-PATHS FIRST (must precede `/projects/:id`)
// ══════════════════════════════════════════════════════════════════════════════

// ─── GET /api/engineer/stats ──────────────────────────────────────────────────
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await getProjectStats(req.user.id);
    res.json({ success: true, data: stats });
  } catch (err) { next(err); }
});

// ─── GET /api/engineer/templates ──────────────────────────────────────────────
router.get('/templates', async (_req, res, next) => {
  try {
    const templates = await listTemplates();
    res.json({ success: true, data: templates });
  } catch (err) { next(err); }
});

// ─── GET /api/engineer/sprint — consolidated Sprint Board (V6 §13.2) ───────────
// One payload that answers "what am I working on now, what's blocked, what did I
// do this week, and what's next?" so planning a sprint no longer means hopping
// between Projects / Issues / Check-ins / Roadmap. Additive — the detail pages
// stay untouched. Reuses listOpenIssues() and getRoadmap() (the latter lazily
// seeds the per-user skill checklist) so behaviour matches the existing pages.
router.get('/sprint', async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [statsRes, criticalCountRes, projectsRes, criticalIssues, checkinRes, roadmap] =
      await Promise.all([
        pool.query(
          `SELECT
             COUNT(*) FILTER (WHERE status IN ('planning','development','testing')) AS active,
             COUNT(*) FILTER (WHERE status = 'deployed')                            AS deployed,
             COUNT(*) FILTER (WHERE status = 'archived')                            AS archived
           FROM engineer_projects WHERE user_id = $1`,
          [userId]
        ),
        pool.query(
          `SELECT COUNT(*) AS c FROM engineer_issues
           WHERE user_id = $1 AND severity IN ('P0-Critical','P1-High')
             AND status IN ('open','in_progress')`,
          [userId]
        ),
        pool.query(
          `SELECT id, name, project_type, status, updated_at FROM engineer_projects
           WHERE user_id = $1 AND status IN ('planning','development','testing')
           ORDER BY (status = 'development') DESC, updated_at DESC
           LIMIT 10`,
          [userId]
        ),
        // Reuse the tested cross-project open-issue query (severity-ordered, carries
        // project_name). Capped at 15 rows for the board; the stat card uses the
        // exact count above.
        listOpenIssues(userId, {
          severities: ['P0-Critical', 'P1-High'],
          statuses:   ['open', 'in_progress'],
          limit:      15,
        }),
        // This week's check-in (Monday-anchored, matching getTodayEngineerStats).
        // Check-ins are per-project; the board surfaces the most recent one logged
        // this week, with its project name.
        pool.query(
          `SELECT ec.id, ec.project_id, ec.week_start, ec.achievements, ec.plans_next,
                  ec.blockers, ec.bugs_discovered, ec.concerns, ep.name AS project_name
           FROM engineer_checkins ec
           LEFT JOIN engineer_projects ep ON ep.id = ec.project_id
           WHERE ec.user_id = $1 AND ec.week_start = DATE_TRUNC('week', CURRENT_DATE)::date
           ORDER BY ec.created_at DESC
           LIMIT 1`,
          [userId]
        ),
        getRoadmap(userId),
      ]);

    // Open P0/P1 count per project (keyed by id — names aren't unique).
    const issueCounts = {};
    for (const i of criticalIssues) {
      issueCounts[i.project_id] = (issueCounts[i.project_id] || 0) + 1;
    }

    // "Upcoming skills" = the first 2 roadmap months that still have an incomplete
    // skill — i.e. where the user is in the 12-month curriculum.
    const upcomingMonths = roadmap
      .filter(m => m.skills.some(s => !s.completed))
      .slice(0, 2)
      .map(m => ({ month_number: m.month_number, month_title: m.title, skills: m.skills }));

    const s = statsRes.rows[0];
    res.json({
      success: true,
      data: {
        stats: {
          active:        parseInt(s.active, 10),
          deployed:      parseInt(s.deployed, 10),
          archived:      parseInt(s.archived, 10),
          open_critical: parseInt(criticalCountRes.rows[0].c, 10),
        },
        projects: projectsRes.rows.map(p => ({ ...p, open_issues: issueCounts[p.id] || 0 })),
        critical_issues: criticalIssues,
        checkin: checkinRes.rows[0] || null,
        roadmap_months: upcomingMonths,
      },
    });
  } catch (err) { next(err); }
});

// ─── Snippets ─────────────────────────────────────────────────────────────────

router.get('/snippets', async (req, res, next) => {
  try {
    const { q, category, language, page, per_page, sort, order } = req.query;
    const opts = {
      q:        q || undefined,
      category: category || undefined,
      language: language || undefined,
      page:     page ? parseInt(page, 10) : 1,
      per_page: per_page ? Math.min(parseInt(per_page, 10), 100) : 50,
      sort:     sort || 'updated_at',
      order:    order || 'desc',
    };
    const { rows, total } = await listSnippets(req.user.id, opts);
    res.json({ success: true, data: rows, meta: { total, page: opts.page, per_page: opts.per_page } });
  } catch (err) { next(err); }
});

router.post('/snippets', validate(createSnippetSchema), async (req, res, next) => {
  try {
    const snippet = await createSnippet(req.user.id, req.body);
    res.status(201).json({ success: true, data: snippet });
  } catch (err) { next(err); }
});

router.get('/snippets/:id', async (req, res, next) => {
  try {
    const snippet = await getSnippetById(parseId(req.params.id), req.user.id);
    if (!snippet) return next(new AppError('Snippet not found.', 404, 'NOT_FOUND'));
    res.json({ success: true, data: snippet });
  } catch (err) { next(err); }
});

router.patch('/snippets/:id', validate(patchSnippetSchema), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const existing = await getSnippetById(id, req.user.id);
    if (!existing) return next(new AppError('Snippet not found.', 404, 'NOT_FOUND'));
    const updated = await patchSnippet(id, req.user.id, req.body);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

router.delete('/snippets/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const deleted = await deleteSnippet(id, req.user.id);
    if (!deleted) return next(new AppError('Snippet not found.', 404, 'NOT_FOUND'));
    (req.log ?? logger).info({ event: 'DELETE', userId: req.user.id, resource: 'snippet', resourceId: id, reqId: req.id }, `User ${req.user.id} deleted snippet ${id}`);
    res.json({ success: true, data: { id } });
  } catch (err) { next(err); }
});

// ─── Documents (global list + by-id ops) ──────────────────────────────────────

router.get('/documents', async (req, res, next) => {
  try {
    const docs = await listGlobalDocuments(req.user.id);
    res.json({ success: true, data: docs });
  } catch (err) { next(err); }
});

router.patch('/documents/:id', validate(patchDocumentSchema), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const existing = await getDocumentById(id, req.user.id);
    if (!existing) return next(new AppError('Document not found.', 404, 'NOT_FOUND'));
    const updated = await patchDocument(id, req.user.id, req.body);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

router.delete('/documents/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const deleted = await deleteDocument(id, req.user.id);
    if (!deleted) return next(new AppError('Document not found.', 404, 'NOT_FOUND'));
    (req.log ?? logger).info({ event: 'DELETE', userId: req.user.id, resource: 'document', resourceId: id, reqId: req.id }, `User ${req.user.id} deleted document ${id}`);
    res.json({ success: true, data: { id } });
  } catch (err) { next(err); }
});

// ─── Issues (by-id ops; creation/per-project listing is nested under a project) ─

// GET /api/engineer/issues — cross-project open-issue list for the Today
// Dashboard (Roadmap Wave 2). `severity` and `status` accept comma-separated
// values; invalid tokens are dropped. Defaults to open + in_progress issues.
router.get('/issues', async (req, res, next) => {
  try {
    const parseList = (raw, allowed) =>
      typeof raw === 'string'
        ? raw.split(',').map(s => s.trim()).filter(s => allowed.includes(s))
        : [];

    const severities = parseList(req.query.severity, ISSUE_SEVERITIES);
    const statuses   = parseList(req.query.status, ISSUE_STATUSES);
    const perPage    = Math.min(50, Math.max(1, parseInt(req.query.per_page ?? '5', 10)));

    const issues = await listOpenIssues(req.user.id, {
      severities: severities.length ? severities : undefined,
      statuses:   statuses.length ? statuses : ['open', 'in_progress'],
      limit:      perPage,
    });
    res.json({ success: true, data: issues });
  } catch (err) { next(err); }
});

router.patch('/issues/:id', validate(patchIssueSchema), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const existing = await getIssueById(id, req.user.id);
    if (!existing) return next(new AppError('Issue not found.', 404, 'NOT_FOUND'));
    const updated = await patchIssue(id, req.user.id, req.body);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

router.delete('/issues/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const deleted = await deleteIssue(id, req.user.id);
    if (!deleted) return next(new AppError('Issue not found.', 404, 'NOT_FOUND'));
    (req.log ?? logger).info({ event: 'DELETE', userId: req.user.id, resource: 'issue', resourceId: id, reqId: req.id }, `User ${req.user.id} deleted issue ${id}`);
    res.json({ success: true, data: { id } });
  } catch (err) { next(err); }
});

// ─── Roadmap ──────────────────────────────────────────────────────────────────

router.get('/roadmap', async (req, res, next) => {
  try {
    const months = await getRoadmap(req.user.id);
    res.json({ success: true, data: months });
  } catch (err) { next(err); }
});

router.patch('/roadmap/skills/:id', validate(patchSkillSchema), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const existing = await getRoadmapSkillById(id, req.user.id);
    if (!existing) return next(new AppError('Roadmap skill not found.', 404, 'NOT_FOUND'));
    const updated = await setRoadmapSkillCompleted(id, req.user.id, req.body.completed);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// ─── Nested project sub-resources (literal child segment after the :id) ───────

router.get('/projects/:id/documents', async (req, res, next) => {
  try {
    const projectId = parseId(req.params.id);
    await requireOwnedProject(projectId, req.user.id);
    const docs = await listProjectDocuments(projectId, req.user.id);
    res.json({ success: true, data: docs });
  } catch (err) { next(err); }
});

router.post('/projects/:id/documents', validate(createDocumentSchema), async (req, res, next) => {
  try {
    const projectId = parseId(req.params.id);
    await requireOwnedProject(projectId, req.user.id);
    const doc = await createDocument(req.user.id, projectId, req.body);
    res.status(201).json({ success: true, data: doc });
  } catch (err) { next(err); }
});

router.get('/projects/:id/checkins', async (req, res, next) => {
  try {
    const projectId = parseId(req.params.id);
    await requireOwnedProject(projectId, req.user.id);
    const checkins = await listCheckins(projectId, req.user.id);
    res.json({ success: true, data: checkins });
  } catch (err) { next(err); }
});

router.post('/projects/:id/checkins', validate(createCheckinSchema), async (req, res, next) => {
  try {
    const projectId = parseId(req.params.id);
    await requireOwnedProject(projectId, req.user.id);
    const checkin = await createCheckin(req.user.id, projectId, req.body);
    res.status(201).json({ success: true, data: checkin });
  } catch (err) { next(err); }
});

router.get('/projects/:id/issues', async (req, res, next) => {
  try {
    const projectId = parseId(req.params.id);
    await requireOwnedProject(projectId, req.user.id);
    const { status, severity } = req.query;
    const issues = await listIssues(projectId, req.user.id, {
      status:   status   || undefined,
      severity: severity || undefined,
    });
    res.json({ success: true, data: issues });
  } catch (err) { next(err); }
});

router.post('/projects/:id/issues', validate(createIssueSchema), async (req, res, next) => {
  try {
    const projectId = parseId(req.params.id);
    await requireOwnedProject(projectId, req.user.id);
    const issue = await createIssue(req.user.id, projectId, req.body);
    res.status(201).json({ success: true, data: issue });
  } catch (err) { next(err); }
});

// ─── GET /api/engineer/projects/:id/budget — Budget vs Actual (Wave 4) ────────
// Sums current-month Expense transactions in each linked budget's category and
// reports budget/spent/remaining. Budgets are connected to the project via
// Universal Links (Wave 1), so no new table is needed.
router.get('/projects/:id/budget', async (req, res, next) => {
  try {
    const projectId = parseId(req.params.id);
    await requireOwnedProject(projectId, req.user.id);

    const links = await getLinksForEntity(req.user.id, 'engineer_project', projectId, 'both');
    const budgetLinks = links.filter(l => l.linked_type === 'budget');

    if (budgetLinks.length === 0) {
      return res.json({ success: true, data: { budgets: [], total_budget: 0, total_spent: 0 } });
    }

    const budgets = (await Promise.all(budgetLinks.map(async (link) => {
      const budget = await getBudgetById(req.user.id, link.linked_id);
      if (!budget) return null; // link dangling (budget deleted) — skip

      const { rows } = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS spent
         FROM transactions
         WHERE user_id = $1 AND category_id = $2 AND type = 'Expense'
           AND date >= DATE_TRUNC('month', CURRENT_DATE)`,
        [req.user.id, budget.category_id]
      );

      const budgetAmount = parseFloat(budget.amount);
      const spent = parseFloat(rows[0].spent);
      return {
        budget_id:     budget.id,
        category_id:   budget.category_id,
        category_name: budget.category_name,
        budget_amount: budgetAmount,
        spent,
        remaining:     budgetAmount - spent,
      };
    }))).filter(Boolean);

    res.json({
      success: true,
      data: {
        budgets,
        total_budget: budgets.reduce((s, b) => s + b.budget_amount, 0),
        total_spent:  budgets.reduce((s, b) => s + b.spent, 0),
      },
    });
  } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════════════════════════
// PROJECTS (collection + parameterised — registered LAST)
// ══════════════════════════════════════════════════════════════════════════════

router.get('/', async (req, res, next) => {
  try {
    const { project_type, status, page, per_page, sort, order } = req.query;
    const opts = {
      project_type: project_type || undefined,
      status:       status || undefined,
      page:         page ? parseInt(page, 10) : 1,
      per_page:     per_page ? Math.min(parseInt(per_page, 10), 100) : 20,
      sort:         sort || 'updated_at',
      order:        order || 'desc',
    };
    const { rows, total } = await listProjects(req.user.id, opts);
    res.json({ success: true, data: rows, meta: { total, page: opts.page, per_page: opts.per_page } });
  } catch (err) { next(err); }
});

router.post('/', validate(createProjectSchema), async (req, res, next) => {
  try {
    const project = await createProject(req.user.id, req.body);
    res.status(201).json({ success: true, data: project });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const project = await getProjectById(parseId(req.params.id), req.user.id);
    if (!project) return next(new AppError('Project not found.', 404, 'NOT_FOUND'));
    res.json({ success: true, data: project });
  } catch (err) { next(err); }
});

router.patch('/:id', validate(patchProjectSchema), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const existing = await getProjectById(id, req.user.id);
    if (!existing) return next(new AppError('Project not found.', 404, 'NOT_FOUND'));
    const updated = await patchProject(id, req.user.id, req.body);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const deleted = await deleteProject(id, req.user.id);
    if (!deleted) return next(new AppError('Project not found.', 404, 'NOT_FOUND'));
    (req.log ?? logger).info({ event: 'DELETE', userId: req.user.id, resource: 'project', resourceId: id, reqId: req.id }, `User ${req.user.id} deleted project ${id}`);
    res.json({ success: true, data: { id } });
  } catch (err) { next(err); }
});

// Named export matches `import { engineerRouter }` in index.js; default kept for flexibility.
export { router as engineerRouter };
export default router;
