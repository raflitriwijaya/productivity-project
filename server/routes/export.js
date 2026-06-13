// server/routes/export.js
// GET /api/export          → ZIP archive of all user data as JSON files
// GET /api/export?format=csv → ZIP archive with CSV files per module
//
// Mounted in index.js as:
//   app.use('/api/export', requireAuth, exportRouter)

import path from 'path';
import fs from 'fs';
import { Router } from 'express';
import archiver from 'archiver';
import { logger } from '../lib/logger.js';
import { pool } from '../lib/db.js';
import { listTodos } from '../models/todo.model.js';
import { listTransactions } from '../models/finance.model.js';
import { listLearningItems } from '../models/learning.model.js';
import { listResearchEntries } from '../models/research.model.js';
import { listBooks } from '../models/reading.model.js';
import { listContacts } from '../models/contacts.model.js';
import { listIdeas } from '../models/ideas.model.js';
import { listGoals } from '../models/goals.model.js';
import { listTimeEntries } from '../models/time.model.js';
import { listProjects } from '../models/engineer.model.js';

const router = Router();

const EXPORT_MAX = 10000;

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function escapeCsv(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  return [
    cols.join(','),
    ...rows.map(r => cols.map(c => escapeCsv(r[c])).join(',')),
  ].join('\n');
}

// ─── Data fetchers ────────────────────────────────────────────────────────────

async function fetchAll(userId) {
  const opts = { per_page: EXPORT_MAX, page: 1 };
  const [
    todos,
    transactions,
    learning_items,
    research_entries,
    books,
    contacts,
    ideas,
    goals,
    time_entries,
    engineer_projects,
  ] = await Promise.all([
    listTodos(userId, opts).then(r => (r.rows ?? r)),
    listTransactions(userId, { ...opts, per_page: EXPORT_MAX }).then(r => (r.rows ?? r)),
    listLearningItems(userId, { perPage: EXPORT_MAX }).then(r => (r.rows ?? r)),
    listResearchEntries(userId, opts).then(r => (r.rows ?? r)),
    listBooks(userId, opts).then(r => (r.rows ?? r)),
    listContacts(userId, opts).then(r => (r.rows ?? r)),
    listIdeas(userId, opts).then(r => (r.rows ?? r)),
    listGoals(userId, opts).then(r => (r.rows ?? r)),
    listTimeEntries(userId, opts).then(r => (r.rows ?? r)),
    listProjects(userId, opts).then(r => (r.rows ?? r)),
  ]);

  return {
    todos,
    transactions,
    learning_items,
    research_entries,
    books,
    contacts,
    ideas,
    goals,
    time_entries,
    engineer_projects,
  };
}

// ─── GET /api/export ──────────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const format = (req.query.format || 'json').toLowerCase();
    if (format !== 'json' && format !== 'csv') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'format must be json or csv', field: 'format' },
      });
    }

    (req.log ?? logger).info(
      { event: 'EXPORT_ALL', userId: req.user.id, format, reqId: req.id },
      `User ${req.user.id} exported all data as ${format}`
    );

    const data = await fetchAll(req.user.id);

    const summary = {
      exported_at: new Date().toISOString(),
      user_id: req.user.id,
      format,
      modules: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0])
      ),
      attachments_exported: 0,
    };

    res.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="polymath-export-${Date.now()}.zip"`,
    });

    const archive = archiver('zip', { zlib: { level: 6 } });

    archive.on('error', (err) => {
      (req.log ?? logger).error({ err }, 'Archive error during export');
    });

    archive.pipe(res);

    for (const [module, rows] of Object.entries(data)) {
      const safeRows = Array.isArray(rows) ? rows : [];
      if (format === 'json') {
        archive.append(JSON.stringify(safeRows, null, 2), { name: `${module}.json` });
      } else {
        archive.append(toCsv(safeRows), { name: `${module}.csv` });
      }
    }

    // Bundle uploaded attachments
    try {
      const uploadsDir = path.resolve('uploads');
      if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir).filter(f =>
          fs.statSync(path.join(uploadsDir, f)).isFile()
        );
        const { rows: attachmentRows } = await pool.query(
          `SELECT filename, original_name FROM research_attachments WHERE user_id = $1`,
          [req.user.id]
        );
        const nameMap = {};
        for (const row of attachmentRows) {
          nameMap[row.filename] = row.original_name || row.filename;
        }

        const usedNames = new Set();
        for (const file of files) {
          let displayName = nameMap[file] || file;
          if (usedNames.has(displayName)) {
            const ext = path.extname(displayName);
            const base = path.basename(displayName, ext);
            let counter = 1;
            while (usedNames.has(`${base}_${counter}${ext}`)) counter++;
            displayName = `${base}_${counter}${ext}`;
          }
          usedNames.add(displayName);
          archive.file(path.join(uploadsDir, file), { name: `attachments/${displayName}` });
        }
        summary.attachments_exported = usedNames.size;
      }
    } catch (err) {
      (req.log ?? logger).error({ err }, 'Export attachment bundling error');
      archive.append(
        JSON.stringify({ error: err.message, section: 'attachments' }, null, 2),
        { name: 'attachments/_ERROR.txt' }
      );
    }

    // Summary manifest (after attachments so the count is final)
    archive.append(JSON.stringify(summary, null, 2), { name: '_SUMMARY.json' });

    await archive.finalize();
  } catch (err) {
    if (!res.headersSent) next(err);
    else (req.log ?? logger).error({ err }, 'Export stream error after headers sent');
  }
});

export { router as exportRouter };
export default router;
