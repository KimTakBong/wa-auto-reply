import { getPool } from '../core/database.js';

/**
 * Mencari reply rule yang match dengan pesan masuk
 * Prioritas: regex dulu, lalu keyword exact
 * @param {string} message - Pesan dari user
 * @returns {object|null} Rule yang match atau null
 */
export async function getReply(message) {
  const db = getPool();
  const trimmedMessage = message.trim().toLowerCase();

  try {
    // 1. Cek regex rules dulu
    const [regexRules] = await db.query(
      'SELECT id, pattern, reply_text, type, image_url FROM reply_rules WHERE is_active = 1 AND type = "regex"',
    );

    for (const rule of regexRules) {
      try {
        const regex = new RegExp(rule.pattern, 'i');
        if (regex.test(trimmedMessage)) {
          return rule;
        }
      } catch (e) {
        // Skip invalid regex
        console.warn(`⚠️  Invalid regex pattern: ${rule.pattern}`);
      }
    }

    // 2. Cek keyword exact match
    const [keywordRules] = await db.query(
      'SELECT id, pattern, reply_text, type, image_url FROM reply_rules WHERE is_active = 1 AND type = "keyword"',
    );

    for (const rule of keywordRules) {
      if (trimmedMessage === rule.pattern.toLowerCase()) {
        return rule;
      }
    }

    // Tidak ada rule yang match
    return null;
  } catch (error) {
    console.error('❌ Error in getReply:', error.message);
    throw error;
  }
}

/**
 * Menambahkan reply rule baru
 */
export async function addRule(type, pattern, replyText) {
  const db = getPool();
  const [result] = await db.query(
    'INSERT INTO reply_rules (type, pattern, reply_text) VALUES (?, ?, ?)',
    [type, pattern, replyText],
  );
  return result.insertId;
}

/**
 * Mengambil semua reply rules
 */
export async function getAllRules() {
  const db = getPool();
  const [rows] = await db.query(
    'SELECT * FROM reply_rules ORDER BY created_at DESC',
  );
  return rows;
}

/**
 * Menghapus reply rule
 */
export async function deleteRule(id) {
  const db = getPool();
  await db.query('DELETE FROM reply_rules WHERE id = ?', [id]);
}

/**
 * Toggle active/inactive rule
 */
export async function toggleRule(id) {
  const db = getPool();
  await db.query(
    'UPDATE reply_rules SET is_active = NOT is_active WHERE id = ?',
    [id],
  );
}
