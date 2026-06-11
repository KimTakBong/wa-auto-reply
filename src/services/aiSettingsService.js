import { getPool } from '../core/database.js';

/**
 * Ambil AI settings (hanya 1 row)
 */
export async function getAISettings() {
  const db = getPool();
  const [rows] = await db.query('SELECT * FROM ai_settings LIMIT 1');
  return rows[0] || null;
}

/**
 * Update AI settings
 */
export async function updateAISettings(settings) {
  const db = getPool();

  const fields = [];
  const values = [];

  const allowedFields = [
    'is_enabled', 'ai_provider', 'groq_api_key', 'groq_model', 'ollama_url', 'ollama_model',
    'system_prompt', 'allowed_topics', 'blocked_keywords',
    'off_topic_reply', 'max_history', 'rate_limit_seconds',
    'fallback_reply', 'auto_create_rules', 'auto_rule_threshold',
    'reply_delay_min_ms', 'reply_delay_max_ms',
  ];

  for (const key of allowedFields) {
    if (settings[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(settings[key]);
    }
  }

  if (fields.length === 0) return;

  values.push(1); // WHERE id = 1
  await db.query(`UPDATE ai_settings SET ${fields.join(', ')} WHERE id = ?`, values);
}

/**
 * Reset AI settings ke default
 */
export async function resetAISettings() {
  const db = getPool();
  const defaultPrompt = `Kamu adalah customer service yang ramah, profesional, dan helpful. 
Gaya bicara semi-formal — sopan tapi tidak kaku. 
Ikuti bahasa yang digunakan user (Indonesia, English, atau campuran).
Jawab dengan singkat, jelas, dan langsung ke inti. Maksimal 3-4 kalimat kecuali user minta detail.
Jika kamu tidak tahu jawabannya, jangan mengarang. Katakan dengan jujur bahwa kamu tidak tahu dan tawarkan untuk membantu hal lain.
Jangan pernah memberikan informasi yang tidak kamu yakini kebenarannya.`;

  await db.query(
    `UPDATE ai_settings SET
      is_enabled = 1,
      ai_provider = 'groq',
      groq_api_key = NULL,
      groq_model = 'llama-3.3-70b-versatile',
      ollama_url = 'http://localhost:11434',
      ollama_model = 'llama3',
      system_prompt = ?,
      allowed_topics = '',
      blocked_keywords = '',
      off_topic_reply = 'Maaf, saya hanya bisa membantu tentang topik tertentu. Ada hal lain yang bisa dibantu?',
      max_history = 20,
      rate_limit_seconds = 5,
      fallback_reply = 'Maaf, saya sedang sibuk. Coba lagi dalam beberapa menit ya.',
      auto_create_rules = 0,
      auto_rule_threshold = 2,
      reply_delay_min_ms = 1000,
      reply_delay_max_ms = 3000
     WHERE id = 1`,
    [defaultPrompt],
  );
}
