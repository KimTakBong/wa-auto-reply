import { getPool } from '../core/database.js';

/**
 * Track pertanyaan yang belum ada rule-nya
 * Kalau udah ada yang mirip, increment count
 */
export async function trackUnanswered(question, aiAnswer) {
  const db = getPool();
  const normalizedQuestion = question.trim().toLowerCase();

  // Cek apakah pertanyaan serupa sudah ada
  const [existing] = await db.query(
    'SELECT id, occurrence_count FROM auto_rule_candidates WHERE LOWER(question) = ? AND is_processed = 0',
    [normalizedQuestion],
  );

  if (existing.length > 0) {
    // Increment count
    const candidate = existing[0];
    await db.query(
      'UPDATE auto_rule_candidates SET occurrence_count = occurrence_count + 1, ai_answer = ? WHERE id = ?',
      [aiAnswer, candidate.id],
    );
    return candidate.occurrence_count + 1;
  } else {
    // Insert new candidate
    await db.query(
      'INSERT INTO auto_rule_candidates (question, ai_answer, occurrence_count) VALUES (?, ?, 1)',
      [question, aiAnswer],
    );
    return 1;
  }
}

/**
 * Cek apakah pertanyaan sudah mencapai threshold untuk auto-create rule
 * @returns {object|null} { question, ai_answer, count } atau null
 */
export async function checkAutoRuleThreshold(question, threshold) {
  const db = getPool();
  const normalizedQuestion = question.trim().toLowerCase();

  const [candidates] = await db.query(
    'SELECT question, ai_answer, occurrence_count FROM auto_rule_candidates WHERE LOWER(question) = ? AND is_processed = 0',
    [normalizedQuestion],
  );

  if (candidates.length > 0 && candidates[0].occurrence_count >= threshold) {
    return candidates[0];
  }

  return null;
}

/**
 * Buat rule otomatis dari candidate
 */
export async function createAutoRule(question, aiAnswer) {
  const db = getPool();

  // Insert ke reply_rules
  const [result] = await db.query(
    'INSERT INTO reply_rules (type, pattern, reply_text) VALUES ("keyword", ?, ?)',
    [question, aiAnswer],
  );

  // Mark candidate as processed
  await db.query(
    'UPDATE auto_rule_candidates SET is_processed = 1 WHERE LOWER(question) = ?',
    [question.trim().toLowerCase()],
  );

  return result.insertId;
}

/**
 * Get all auto rule candidates (untuk dashboard)
 */
export async function getAutoRuleCandidates() {
  const db = getPool();
  const [rows] = await db.query(
    'SELECT * FROM auto_rule_candidates WHERE is_processed = 0 ORDER BY occurrence_count DESC, created_at DESC',
  );
  return rows;
}

/**
 * Delete candidate
 */
export async function deleteAutoRuleCandidate(id) {
  const db = getPool();
  await db.query('DELETE FROM auto_rule_candidates WHERE id = ?', [id]);
}
