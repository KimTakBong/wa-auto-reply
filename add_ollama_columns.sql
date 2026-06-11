-- Manual SQL script to add Ollama columns to ai_settings table

-- Add ai_provider column
ALTER TABLE ai_settings
ADD COLUMN IF NOT EXISTS ai_provider ENUM('groq', 'ollama') DEFAULT 'groq' AFTER is_enabled;

-- Add ollama_url column
ALTER TABLE ai_settings
ADD COLUMN IF NOT EXISTS ollama_url VARCHAR(255) DEFAULT 'http://localhost:11434' AFTER groq_model;

-- Add ollama_model column
ALTER TABLE ai_settings
ADD COLUMN IF NOT EXISTS ollama_model VARCHAR(100) DEFAULT 'llama3' AFTER ollama_url;

-- Update existing records with default values
UPDATE ai_settings 
SET 
  ai_provider = COALESCE(ai_provider, 'groq'),
  ollama_url = COALESCE(ollama_url, 'http://localhost:11434'),
  ollama_model = COALESCE(ollama_model, 'llama3')
WHERE ai_provider IS NULL OR ollama_url IS NULL OR ollama_model IS NULL;

-- Verify columns exist
DESCRIBE ai_settings;
