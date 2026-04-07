import config from '../core/config.js';

// In-memory rate limit store: { userJid: lastTimestamp }
const rateLimitStore = new Map();

/**
 * Cek apakah user boleh kirim pesan sekarang
 * @returns {boolean} true kalau boleh, false kalau masih dalam cooldown
 */
export function isRateLimited(userJid) {
  const now = Date.now();
  const lastTime = rateLimitStore.get(userJid) || 0;
  const cooldownMs = config.ai.rateLimitSeconds * 1000;

  if (now - lastTime < cooldownMs) {
    return true; // Masih dalam cooldown
  }

  // Update timestamp
  rateLimitStore.set(userJid, now);

  // Cleanup old entries (prevent memory leak)
  if (rateLimitStore.size > 1000) {
    cleanupRateLimitStore();
  }

  return false;
}

/**
 * Bersihkan entry lama di rate limit store
 */
function cleanupRateLimitStore() {
  const now = Date.now();
  const cooldownMs = config.ai.rateLimitSeconds * 1000;

  for (const [jid, timestamp] of rateLimitStore.entries()) {
    if (now - timestamp > cooldownMs * 2) {
      rateLimitStore.delete(jid);
    }
  }
}

/**
 * Bersihkan semua rate limit (untuk reset)
 */
export function clearRateLimits() {
  rateLimitStore.clear();
}
