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

// ─── Single app-wide poll loop ────────────────────────────────────────────────
/**
 * Start the shared poll loop exactly once (idempotent under React StrictMode and
 * across multiple mounted bells). Each tick refreshes the store and fires an OS
 * notification for anything due today (only if permission was already granted).
 * @param {number} [intervalMs=3600000] one hour
 */
export function ensureDuePolling(intervalMs = 3600000) {
  if (pollTimer) return;
  const tick = async () => {
    await refreshDueItems();
    notifyDueToday();
  };
  tick();
  pollTimer = setInterval(tick, intervalMs);
}
