// server/routes/settings.js
// Server-side user preferences (Post-V5 fix; addresses V5 §12.2). Mount as:
//   app.use('/api/settings', requireAuth, settingsRouter)
//
// GET /api/settings → the user's settings (lazily created on first access)
// PUT /api/settings → upsert theme / default_model / notifications_enabled
//
// Standard envelope ({ success, data }), Zod-validated write body, user_id-scoped,
// audit logging on update (mirrors goals.js / contacts.js).

import { Router } from 'express';
import { z } from 'zod';
import { getSettings, upsertSettings } from '../models/settings.model.js';
import { validate } from '../middleware/validate.js';
import { logger } from '../lib/logger.js';

const router = Router();

const updateSchema = z.object({
  theme:                 z.enum(['light', 'dark', 'system']).optional(),
  default_model:         z.string().max(50).optional(),
  notifications_enabled: z.boolean().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'At least one field is required.' });

// ─── GET /api/settings ───────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const settings = await getSettings(req.user.id);
    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/settings ───────────────────────────────────────────────────────
router.put('/', validate(updateSchema), async (req, res, next) => {
  try {
    const settings = await upsertSettings(req.user.id, req.body);

    (req.log ?? logger).info(
      { event: 'SETTINGS_UPDATE', userId: req.user.id, changes: Object.keys(req.body), reqId: req.id },
      `User ${req.user.id} updated settings`
    );

    res.json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
});

export { router as settingsRouter };
export default router;
