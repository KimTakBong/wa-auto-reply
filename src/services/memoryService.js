import { getPool } from '../core/database.js';
import config from '../core/config.js';

/**
 * Menyimpan pesan ke chat memory
 */
export async function saveMemory(userJid, role, content) {
  const db = getPool();
  await db.query(
    'INSERT INTO chat_memory (user_jid, role, content) VALUES (?, ?, ?)',
    [userJid, role, content],
  );
}

/**
 * Mengambil conversation history user (terbaru dulu, lalu di-reverse)
 */
export async function getHistory(userJid) {
  const db = getPool();
  const maxHistory = config.ai.maxHistory;

  const [rows] = await db.query(
    'SELECT role, content FROM chat_memory WHERE user_jid = ? ORDER BY created_at DESC LIMIT ?',
    [userJid, maxHistory],
  );

  // Reverse supaya urut dari lama ke baru
  return rows.reverse();
}

/**
 * Membersihkan chat memory untuk user tertentu
 */
export async function clearMemory(userJid) {
  const db = getPool();
  await db.query('DELETE FROM chat_memory WHERE user_jid = ?', [userJid]);
}

/**
 * Membersihkan chat memory lama (lebih dari X hari)
 */
export async function cleanupOldMemory(days = 7) {
  const db = getPool();
  const [result] = await db.query(
    'DELETE FROM chat_memory WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
    [days],
  );
  return result.affectedRows;
}
