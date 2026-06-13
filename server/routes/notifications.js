// server/routes/notifications.js
// Reminders / notifications (Roadmap Forward Phase 1 / Audit V6 §13.5). Mount as:
//   app.use('/api/notifications', requireAuth, notificationsRouter)
//
// v1 surfaces due items in-app (the bell dropdown) and via the browser
// Notification API on the client. GET /due aggregates date-bearing items across
// modules into one envelope so the client makes a single round-trip.
//
// /subscribe + /status are the substrate for true Web Push (VAPID) later — the
// subscription is stored now so a future server-side push job can use it.
//
// Standard envelope ({ success, data }), Zod validation on the write body, dates
// normalised to 'YYYY-MM-DD' via to_char so the client's string comparisons line
// up with its local calendar regardless of how pg serialises DATE columns.

import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../lib/db.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// ─── Zod schema (POST /subscribe body) ───────────────────────────────────────
const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});

// ─── POST /api/notifications/subscribe ────────────────────────────────────────
// Store (or refresh) a Web Push subscription for this user+endpoint.
router.post('/subscribe', validate(subscribeSchema), async (req, res, next) => {
  try {
    const { endpoint, keys } = req.body;
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, keys, user_agent)
         VALUES ($1, $2, $3::jsonb, $4)
       ON CONFLICT (user_id, endpoint)
         DO UPDATE SET keys = EXCLUDED.keys, updated_at = NOW()`,
      [req.user.id, endpoint, JSON.stringify(keys), req.headers['user-agent'] ?? null]
    );
    res.json({ success: true, data: { subscribed: true } });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/notifications/status ────────────────────────────────────────────
// Whether reminders are enabled (user_settings) + how many push endpoints exist.
router.get('/status', async (req, res, next) => {
  try {
    const [{ rows: [settings] }, { rows: [count] }] = await Promise.all([
      pool.query('SELECT notifications_enabled FROM user_settings WHERE user_id = $1', [req.user.id]),
      pool.query('SELECT COUNT(*)::int AS total FROM push_subscriptions WHERE user_id = $1', [req.user.id]),
    ]);
    res.json({
      success: true,
      data: {
        enabled: settings?.notifications_enabled ?? true,
        subscriptions: count.total,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/notifications/due ───────────────────────────────────────────────
// Date-bearing items due today through the next 7 days, across modules. The
// 7-day window and CURRENT_DATE comparison mirror finance.model.js's due-soon
// queries; the client decides what counts as "today" against its local calendar.
router.get('/due', async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [todos, receivables, payables, checkins, goals] = await Promise.all([
      pool.query(
        `SELECT id, title, to_char(due_date, 'YYYY-MM-DD') AS due_date
           FROM todos
          WHERE user_id = $1 AND status != 'done'
            AND due_date IS NOT NULL AND due_date <= CURRENT_DATE + INTERVAL '7 days'
          ORDER BY due_date ASC LIMIT 10`,
        [userId]
      ),
      pool.query(
        `SELECT id, person AS title, amount, to_char(due_date, 'YYYY-MM-DD') AS due_date
           FROM receivables
          WHERE user_id = $1 AND status = 'outstanding'
            AND due_date IS NOT NULL AND due_date <= CURRENT_DATE + INTERVAL '7 days'
          ORDER BY due_date ASC LIMIT 10`,
        [userId]
      ),
      pool.query(
        `SELECT id, person AS title, amount, to_char(due_date, 'YYYY-MM-DD') AS due_date
           FROM payables
          WHERE user_id = $1 AND status = 'outstanding'
            AND due_date IS NOT NULL AND due_date <= CURRENT_DATE + INTERVAL '7 days'
          ORDER BY due_date ASC LIMIT 10`,
        [userId]
      ),
      pool.query(
        `SELECT id, 'Weekly check-in' AS title, to_char(week_start, 'YYYY-MM-DD') AS due_date
           FROM engineer_checkins
          WHERE user_id = $1 AND week_start = CURRENT_DATE
          LIMIT 1`,
        [userId]
      ),
      pool.query(
        `SELECT id, title, to_char(target_date, 'YYYY-MM-DD') AS due_date
           FROM goals
          WHERE user_id = $1 AND status = 'active'
            AND target_date IS NOT NULL AND target_date <= CURRENT_DATE + INTERVAL '7 days'
          ORDER BY target_date ASC LIMIT 10`,
        [userId]
      ),
    ]);

    const dueItems = [
      ...todos.rows.map((r) => ({ ...r, type: 'todo', amount: null })),
      ...receivables.rows.map((r) => ({ ...r, type: 'receivable', amount: parseFloat(r.amount) })),
      ...payables.rows.map((r) => ({ ...r, type: 'payable', amount: parseFloat(r.amount) })),
      ...checkins.rows.map((r) => ({ ...r, type: 'checkin', amount: null })),
      ...goals.rows.map((r) => ({ ...r, type: 'goal', amount: null })),
    ].sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));

    res.json({ success: true, data: dueItems });
  } catch (err) {
    next(err);
  }
});

// Named export matches the `import { notificationsRouter }` convention in index.js.
export { router as notificationsRouter };
export default router;
