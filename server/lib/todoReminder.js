// server/lib/todoReminder.js
// In-process todo reminder scheduler. Every 5 minutes it scans for todos due
// within the next 30 minutes (per user) and sends a Telegram reminder, stamping
// reminded_at so the same todo isn't re-notified for an hour.
//
// Single-user, self-hosted scope: a plain setInterval in the Express process is
// the right amount of machinery. If this ever scales out, extract to a worker.

import { getTodosDueSoon, markReminded } from '../models/todo.model.js';
import { sendTelegramMessage, isTelegramConfigured } from './telegram.js';
import { pool } from './db.js';
import { logger } from './logger.js';

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const REMINDER_WINDOW_MINUTES = 30;      // remind for todos due within 30 min
// priority is a SMALLINT in this schema: 1=high, 2=medium, 3=low (not strings).
const PRIORITY_EMOJI = { 1: '🔴', 2: '🟡', 3: '🟢' };

let interval;

/**
 * Start the reminder scheduler. No-op (with a log line) when Telegram isn't
 * configured. Runs once immediately, then every CHECK_INTERVAL_MS.
 */
export function startTodoReminder() {
  if (interval) return; // idempotent
  if (!isTelegramConfigured()) {
    logger.info('[TodoReminder] Telegram not configured — reminders disabled');
    return;
  }

  logger.info('[TodoReminder] Started — checking every 5 minutes');

  checkAndRemind();
  interval = setInterval(checkAndRemind, CHECK_INTERVAL_MS);
  interval.unref(); // don't keep the process alive just for this timer
}

/** Stop the reminder scheduler (graceful shutdown). */
export function stopTodoReminder() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

async function checkAndRemind() {
  try {
    const { rows: users } = await pool.query('SELECT id FROM users');

    for (const user of users) {
      const todos = await getTodosDueSoon(user.id, REMINDER_WINDOW_MINUTES);
      if (todos.length === 0) continue;

      await sendTelegramMessage(buildMessage(todos));
      await markReminded(user.id, todos.map((t) => t.id));

      logger.info(
        { event: 'TODO_REMINDER', userId: user.id, count: todos.length },
        `Sent todo reminder for ${todos.length} task(s)`
      );
    }
  } catch (err) {
    logger.error({ err }, '[TodoReminder] Error checking reminders');
  }
}

/** Build the HTML Telegram message body for a batch of due todos. */
function buildMessage(todos) {
  const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  let message = `<b>⏰ Todo Reminder — ${timeStr} WIB</b>\n\n`;
  message += `<i>${todos.length} task(s) due soon:</i>\n\n`;

  for (const todo of todos) {
    const emoji = PRIORITY_EMOJI[todo.priority] || '⚪';
    const dueTime = todo.due_time ? todo.due_time.slice(0, 5) : '';
    message += `${emoji} <b>${escapeHtml(todo.title)}</b>\n`;
    message += `   ⏰ ${dueTime} WIB`;
    if (todo.description) {
      const desc = todo.description.length > 80
        ? todo.description.slice(0, 77) + '...'
        : todo.description;
      message += ` — ${escapeHtml(desc)}`;
    }
    message += '\n\n';
  }

  message += '<i>— Polymath OS</i>';
  return message;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
