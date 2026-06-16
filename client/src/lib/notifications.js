// client/src/lib/notifications.js
// Reminders (Roadmap Forward Phase 1). v1 uses the browser Notification API plus
// polling of GET /api/notifications/due — no service worker / VAPID yet.
//
// The bell can render in more than one place at a breakpoint (desktop sidebar +
// mobile top bar), so the due-items list lives in a tiny module-level store with
// a single shared poll loop. Every <NotificationBell> subscribes to the same data
// (one fetch, one interval, consistent badge) via the useDueItems hook.

import api from './api';

// ─── Local-calendar date helpers ──────────────────────────────────────────────
// Server sends due dates as 'YYYY-MM-DD' (to_char), but be defensive: a value may
// also arrive as a serialized timestamp. Always reduce to a LOCAL 'YYYY-MM-DD' so
// comparisons line up with the user's calendar (not UTC). Mirrors the dashboard's
// toDateStr/todayStr so "due today" means the same thing everywhere.
function pad(n) {
  return String(n).padStart(2, '0');
}

export function toDateStr(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ─── Shared due-items store ───────────────────────────────────────────────────
let dueItems = [];
let inFlight = null;
let pollTimer = null;
const subscribers = new Set();

export function getDueItems() {
  return dueItems;
}

export function subscribeDueItems(cb) {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

function emit() {
  for (const cb of subscribers) cb(dueItems);
}

/**
 * Fetch due items into the shared store and notify subscribers. Concurrent calls
 * share one in-flight request. Best-effort: a 401 is handled by the api
 * interceptor (redirect to /login); any other failure leaves the last data intact.
 * @returns {Promise<Array>}
 */
export function refreshDueItems() {
  if (inFlight) return inFlight;
  inFlight = api
    .get('/api/notifications/due')
    .then((res) => {
      dueItems = res.data || [];
      emit();
      return dueItems;
    })
    .catch(() => dueItems)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

// ─── Browser Notification permission ──────────────────────────────────────────
/**
 * Request OS notification permission. Only ever called from a user gesture (the
 * bell click) — auto-prompting on load is penalised by browsers. No-ops cleanly
 * when unsupported or already decided.
 * @returns {Promise<'granted'|'denied'|'default'|'unsupported'>}
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

// ─── OS notification for items due today ──────────────────────────────────────
const TYPE_EMOJI = { receivable: '💰', payable: '💳', goal: '🎯', checkin: '📊', todo: '📋' };

function notifyDueToday() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const today = todayStr();
  const todays = dueItems.filter((i) => toDateStr(i.due_date) === today);
  if (todays.length === 0) return;

  const body = todays
    .slice(0, 3)
    .map((i) => `${TYPE_EMOJI[i.type] ?? '📋'} ${i.title || 'Untitled'}`)
    .join('\n');

  // tag dedupes repeat notifications for the same day across polls.
  new Notification(`${todays.length} item(s) due today`, { body, icon: '/pwa-192x192.png', tag: 'due-today' });
}

// ─── OS notification for todos due within the next 30 minutes ─────────────────
// Browser half of the dual-channel reminder (the server sends the Telegram half).
// Reads the SHARED due-items store — the poll loop refreshes it immediately
// before calling this, so we honour the file's "one fetch, one interval" design
// instead of issuing a second /due round-trip. Fires a per-todo notification for
// anything 1–30 minutes out; requireInteraction keeps it on screen until
// dismissed, and the per-id tag means a re-poll replaces (not stacks) it.
const TODO_PRIORITY_EMOJI = { 1: '🔴', 2: '🟡', 3: '🟢' }; // priority is a SMALLINT 1/2/3

export function checkTodoReminders() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const now = new Date();
  for (const item of dueItems) {
    if (item.type !== 'todo' || !item.due_time) continue;
    // Build the due instant from LOCAL date + time parts — avoids the UTC skew of
    // `new Date('YYYY-MM-DD')` and matches this file's local-calendar approach.
    const [y, m, d] = String(item.due_date).split('-').map(Number);
    const [hh, mm] = item.due_time.split(':').map(Number);
    if ([y, m, d, hh, mm].some(Number.isNaN)) continue;
    const due = new Date(y, m - 1, d, hh, mm, 0, 0);
    const diffMin = Math.floor((due.getTime() - now.getTime()) / 60000);
    if (diffMin <= 0 || diffMin > 30) continue;

    const emoji = TODO_PRIORITY_EMOJI[item.priority] || '⚪';
    new Notification(`${emoji} Task Due Soon`, {
      body: `${item.title || 'Untitled'}\n⏰ Due at ${item.due_time.slice(0, 5)} WIB`,
      icon: '/pwa-192x192.png',
      tag: `todo-reminder-${item.id}`,
      requireInteraction: true,
    });
  }
}

// ─── Single app-wide poll loop ────────────────────────────────────────────────
/**
 * Start the shared poll loop exactly once (idempotent under React StrictMode and
 * across multiple mounted bells). Each tick refreshes the store, fires an OS
 * notification for anything due today, and checks for todos due within 30 min
 * (both only if permission was already granted).
 *
 * Interval dropped from 1 hour → 5 minutes so time-of-day todo reminders are
 * timely. The /due query is bounded (LIMIT 10 per type), so the cost is small.
 * @param {number} [intervalMs=300000] five minutes
 */
export function ensureDuePolling(intervalMs = 300000) {
  if (pollTimer) return;
  const tick = async () => {
    await refreshDueItems();
    notifyDueToday();
    checkTodoReminders();
  };
  tick();
  pollTimer = setInterval(tick, intervalMs);
}
