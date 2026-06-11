import { getPool } from './src/core/database.js';

async function addOllamaColumns() {
  console.log('🔄 Adding Ollama columns to ai_settings...');
  
  const db = getPool();

  try {
    // Check if columns already exist
    const [columns] = await db.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'ai_settings'
      AND COLUMN_NAME IN ('ai_provider', 'ollama_url', 'ollama_model')
    `);

    const existingColumns = columns.map(c => c.COLUMN_NAME);
    console.log('📋 Existing columns:', existingColumns);

    // Add ai_provider if not exists
    if (!existingColumns.includes('ai_provider')) {
      console.log('➕ Adding ai_provider column...');
      await db.query(`
        ALTER TABLE ai_settings
        ADD COLUMN ai_provider ENUM('groq', 'ollama') DEFAULT 'groq' AFTER is_enabled
      `);
      console.log('✅ ai_provider added');
    }

    // Add ollama_url if not exists
    if (!existingColumns.includes('ollama_url')) {
      console.log('➕ Adding ollama_url column...');
      await db.query(`
        ALTER TABLE ai_settings
        ADD COLUMN ollama_url VARCHAR(255) DEFAULT 'http://localhost:11434' AFTER groq_model
      `);
      console.log('✅ ollama_url added');
    }

    // Add ollama_model if not exists
    if (!existingColumns.includes('ollama_model')) {
      console.log('➕ Adding ollama_model column...');
      await db.query(`
        ALTER TABLE ai_settings
        ADD COLUMN ollama_model VARCHAR(100) DEFAULT 'llama3' AFTER ollama_url
      `);
      console.log('✅ ollama_model added');
    }

    // Verify columns
    const [verifyColumns] = await db.query('DESCRIBE ai_settings');
    console.log('\n📊 Final ai_settings structure:');
    console.table(verifyColumns.map(col => ({
      Field: col.Field,
      Type: col.Type,
      Default: col.Default
    })));

    console.log('\n🎉 Ollama columns successfully added!');
  } catch (error) {
    console.error('❌ Failed to add columns:', error.message);
  } finally {
    await db.end();
    process.exit(0);
  }
}

addOllamaColumns();
