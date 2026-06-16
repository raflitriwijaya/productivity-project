// server/lib/telegram.js
// Minimal Telegram Bot API wrapper. Reuses the SAME bot token + chat ID that
// Uptime Kuma and the restic backup script already use — one bot, one chat, all
// notifications in one place. Entirely optional: with no token/chat configured,
// every call is a silent no-op so dev/CI and unconfigured deploys never break.

import { logger } from './logger.js';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

/**
 * Send a message via the Telegram Bot API.
 * @param {string} text HTML-formatted message body (parse_mode: HTML).
 * @returns {Promise<object|null>} The parsed API response, or null when Telegram
 *   is not configured or the request fails (best-effort — never throws).
 */
export async function sendTelegramMessage(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    return null; // Silently skip — Telegram is optional.
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      }
    );
    return response.json();
  } catch (err) {
    logger.error({ err }, '[Telegram] Failed to send message');
    return null;
  }
}

/**
 * Whether a bot token AND chat ID are both configured.
 * @returns {boolean}
 */
export function isTelegramConfigured() {
  return !!(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID);
}
