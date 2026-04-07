import { getPool } from '../core/database.js';

/**
 * Log pesan ke database
 */
export async function logMessage({ fromNumber, toNumber, messageType, messageBody, direction, ruleId, replySource }) {
  const db = getPool();
  await db.query(
    `INSERT INTO message_logs (from_number, to_number, message_type, message_body, direction, rule_id, reply_source)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [fromNumber, toNumber, messageType, messageBody, direction, ruleId || null, replySource || null],
  );
}

/**
 * Extract nomor telepon dari Baileys message object
 */
export function extractPhoneNumber(message) {
  const remoteJid = message.key.remoteJid;
  if (!remoteJid) return null;

  // Handle berbagai format JID:
  // 628xxx@s.whatsapp.net → 628xxx
  // 628xxx@g.us → 628xxx
  // 223295433654517@lid → 223295433654517
  return remoteJid
    .replace('@s.whatsapp.net', '')
    .replace('@g.us', '')
    .replace('@lid', '')
    .replace(':1', ''); // Handle port suffix
}

/**
 * Cek apakah pesan adalah text message
 */
export function isTextMessage(message) {
  return !!(
    message.message?.conversation ||
    message.message?.extendedTextMessage?.text
  );
}

/**
 * Format nomor ke JID (628xxx → 628xxx@s.whatsapp.net)
 */
export function numberToJid(number) {
  return `${number}@s.whatsapp.net`;
}
