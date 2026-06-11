import { getPool, testConnection } from './database.js';
import bcrypt from 'bcryptjs';

/**
 * Migration script untuk membuat tabel yang diperlukan
 * Jalankan: npm run migrate
 */
async function migrate() {
  console.log('🔄 Running migrations...');

  const connected = await testConnection();
  if (!connected) {
    console.error('❌ Cannot connect to database. Check your .env config.');
    process.exit(1);
  }

  const db = getPool();

  try {
    // Tabel untuk reply rules
    await db.query(`
      CREATE TABLE IF NOT EXISTS reply_rules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        type ENUM('keyword', 'regex') NOT NULL DEFAULT 'keyword',
        pattern VARCHAR(255) NOT NULL,
        reply_text TEXT NOT NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_pattern (pattern),
        INDEX idx_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Table "reply_rules" created');

    // Tambah kolom image_url kalau belum ada
    await db.query(`
      ALTER TABLE reply_rules 
      ADD COLUMN IF NOT EXISTS image_url TEXT NULL AFTER reply_text
    `).catch(() => {});
    console.log('✅ Column "image_url" added to reply_rules');

    // Tabel untuk message logs
    await db.query(`
      CREATE TABLE IF NOT EXISTS message_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        from_number VARCHAR(50) NOT NULL,
        to_number VARCHAR(50) NOT NULL,
        message_type VARCHAR(50) DEFAULT 'text',
        message_body TEXT,
        direction ENUM('in', 'out') DEFAULT 'in',
        rule_id INT NULL,
        reply_source ENUM('rule', 'ai', 'fallback') NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_from (from_number),
        INDEX idx_direction (direction),
        INDEX idx_created (created_at),
        FOREIGN KEY (rule_id) REFERENCES reply_rules(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Table "message_logs" created');

    // Tambah kolom reply_source kalau tabel udah ada tapi belum punya kolom ini
    await db.query(`
      ALTER TABLE message_logs 
      ADD COLUMN IF NOT EXISTS reply_source ENUM('rule', 'ai', 'fallback', 'off_topic') NULL AFTER rule_id
    `).catch(() => {});
    // Fix existing column kalau enum-nya nggak ada 'off_topic'
    await db.query(`
      ALTER TABLE message_logs 
      MODIFY COLUMN reply_source ENUM('rule', 'ai', 'fallback', 'off_topic') NULL
    `).catch(() => {});
    console.log('✅ Column "reply_source" updated');

    // Tabel untuk chat memory (AI conversation history)
    await db.query(`
      CREATE TABLE IF NOT EXISTS chat_memory (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_jid VARCHAR(50) NOT NULL,
        role ENUM('user', 'assistant') NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_jid (user_jid),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Table "chat_memory" created');

    // Tabel untuk users (auth)
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        role ENUM('admin', 'operator') NOT NULL DEFAULT 'admin',
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Table "users" created');

    // Tabel untuk AI settings
    await db.query(`
      CREATE TABLE IF NOT EXISTS ai_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        is_enabled TINYINT(1) DEFAULT 1,
        groq_api_key VARCHAR(255) NULL,
        groq_model VARCHAR(100) DEFAULT 'llama-3.3-70b-versatile',
        system_prompt TEXT NOT NULL,
        allowed_topics TEXT NULL COMMENT 'Comma-separated keywords',
        blocked_keywords TEXT NULL COMMENT 'Comma-separated keywords',
        off_topic_reply TEXT NOT NULL,
        max_history INT DEFAULT 20,
        rate_limit_seconds INT DEFAULT 5,
        fallback_reply TEXT NOT NULL,
        auto_create_rules TINYINT(1) DEFAULT 0,
        auto_rule_threshold INT DEFAULT 2,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Table "ai_settings" created');

    // Tambah kolom groq_api_key kalau tabel udah ada tapi belum punya
    await db.query(`
      ALTER TABLE ai_settings 
      ADD COLUMN IF NOT EXISTS groq_api_key VARCHAR(255) NULL AFTER is_enabled
    `).catch(() => {});
    console.log('✅ Column "groq_api_key" added to ai_settings');

    // Tambah kolom auto_create_rules & auto_rule_threshold
    await db.query(`
      ALTER TABLE ai_settings
      ADD COLUMN IF NOT EXISTS auto_create_rules TINYINT(1) DEFAULT 0 AFTER fallback_reply,
      ADD COLUMN IF NOT EXISTS auto_rule_threshold INT DEFAULT 2 AFTER auto_create_rules,
      ADD COLUMN IF NOT EXISTS reply_delay_min_ms INT DEFAULT 1000 AFTER auto_rule_threshold,
      ADD COLUMN IF NOT EXISTS reply_delay_max_ms INT DEFAULT 3000 AFTER reply_delay_min_ms
    `).catch(() => {});
    console.log('✅ Columns "auto_create_rules", "auto_rule_threshold", "reply_delay_min_ms", "reply_delay_max_ms" added to ai_settings');

    // Tambah kolom untuk Ollama support
    await db.query(`
      ALTER TABLE ai_settings
      ADD COLUMN IF NOT EXISTS ai_provider ENUM('groq', 'ollama') DEFAULT 'groq' AFTER is_enabled,
      ADD COLUMN IF NOT EXISTS ollama_url VARCHAR(255) DEFAULT 'http://localhost:11434' AFTER groq_model,
      ADD COLUMN IF NOT EXISTS ollama_model VARCHAR(100) DEFAULT 'llama3' AFTER ollama_url
    `).catch(() => {});
    console.log('✅ Columns "ai_provider", "ollama_url", "ollama_model" added to ai_settings');

    // Insert default AI settings
    const [existingSettings] = await db.query('SELECT id FROM ai_settings LIMIT 1');
    if (existingSettings.length === 0) {
      const defaultPrompt = `Kamu adalah customer service yang ramah, profesional, dan helpful. 
Gaya bicara semi-formal — sopan tapi tidak kaku. 
Ikuti bahasa yang digunakan user (Indonesia, English, atau campuran).
Jawab dengan singkat, jelas, dan langsung ke inti. Maksimal 3-4 kalimat kecuali user minta detail.
Jika kamu tidak tahu jawabannya, jangan mengarang. Katakan dengan jujur bahwa kamu tidak tahu dan tawarkan untuk membantu hal lain.
Jangan pernah memberikan informasi yang tidak kamu yakini kebenarannya.`;

      await db.query(
        `INSERT INTO ai_settings (is_enabled, ai_provider, system_prompt, allowed_topics, blocked_keywords, off_topic_reply, max_history, rate_limit_seconds, fallback_reply, groq_model, ollama_url, ollama_model)
         VALUES (1, 'groq', ?, '', '', 'Maaf, saya hanya bisa membantu tentang topik tertentu. Ada hal lain yang bisa dibantu?', 20, 5, 'Maaf, saya sedang sibuk. Coba lagi dalam beberapa menit ya.', 'llama-3.3-70b-versatile', 'http://localhost:11434', 'llama3')`,
        [defaultPrompt],
      );
      console.log('✅ Default AI settings inserted');
    } else {
      console.log('ℹ️  AI settings already exist');
    }

    // Tabel untuk auto rule candidates (pertanyaan yang sering muncul)
    await db.query(`
      CREATE TABLE IF NOT EXISTS auto_rule_candidates (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        question TEXT NOT NULL,
        ai_answer TEXT NOT NULL,
        occurrence_count INT DEFAULT 1,
        is_processed TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_question (question(100)),
        INDEX idx_processed (is_processed)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Table "auto_rule_candidates" created');

    // Insert default admin user (password: admin123)
    const [existingUsers] = await db.query('SELECT id FROM users WHERE username = ?', ['admin']);
    if (existingUsers.length === 0) {
      const passwordHash = await bcrypt.hash('admin123', 10);
      await db.query(
        'INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)',
        ['admin', passwordHash, 'Administrator', 'admin'],
      );
      console.log('✅ Default admin user created (username: admin, password: admin123)');
    } else {
      console.log('ℹ️  Default admin user already exists');
    }

    console.log('🎉 Migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await db.end();
  }
}

migrate();
