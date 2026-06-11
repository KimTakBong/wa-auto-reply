/**
 * Ollama API Client
 * Simple HTTP client untuk komunikasi dengan Ollama API
 */

/**
 * Generate chat completion menggunakan Ollama API
 * @param {string} baseUrl - Ollama server URL (e.g., http://localhost:11434)
 * @param {string} model - Model name (e.g., llama3, mistral, dll)
 * @param {Array} messages - Array of {role, content} messages
 * @param {object} options - Additional options (temperature, max_tokens, etc)
 * @returns {Promise<string|null>} AI response text
 */
export async function generateCompletion(baseUrl, model, messages, options = {}) {
  try {
    const url = `${baseUrl}/api/chat`;
    
    const payload = {
      model,
      messages,
      stream: false,
      options: {
        temperature: options.temperature || 0.7,
        num_predict: options.max_tokens || 500,
        top_p: options.top_p || 1,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: options.signal || null,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.message || !data.message.content) {
      console.warn('⚠️ Ollama returned empty response');
      return null;
    }

    return data.message.content.trim();
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('❌ Ollama request timeout');
    } else {
      console.error('❌ Ollama API error:', error.message);
    }
    throw error;
  }
}

/**
 * Test koneksi ke Ollama server
 * @param {string} baseUrl - Ollama server URL
 * @returns {Promise<boolean>} Connection status
 */
export async function testConnection(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      method: 'GET',
    });
    
    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return Array.isArray(data.models);
  } catch (error) {
    console.error('❌ Ollama connection test failed:', error.message);
    return false;
  }
}

/**
 * Get list available models dari Ollama
 * @param {string} baseUrl - Ollama server URL
 * @returns {Promise<Array>} Array of model names
 */
export async function listModels(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models (${response.status})`);
    }

    const data = await response.json();
    return data.models?.map(m => m.name) || [];
  } catch (error) {
    console.error('❌ Failed to list Ollama models:', error.message);
    return [];
  }
}
