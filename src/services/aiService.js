import Groq from 'groq-sdk';
import config from '../core/config.js';
import { saveMemory, getHistory } from './memoryService.js';
import { getAISettings } from './aiSettingsService.js';
import { hasBlockedKeyword, isTopicAllowed } from './topicFilterService.js';

// Initialize Groq client (lazy - created when needed)
let groqClient = null;
let lastApiKey = null;

function getGroqClient() {
  const settings = getCachedSettings();
  const apiKey = settings?.groq_api_key || config.ai.groqApiKey;

  // Re-create client if API key changed
  if (!groqClient || apiKey !== lastApiKey) {
    groqClient = new Groq({ apiKey });
    lastApiKey = apiKey;
  }

  return groqClient;
}

/**
 * Cek apakah pesan boleh diproses AI (topic filter)
 * @returns {object} { allowed: boolean, reason: string }
 */
export function checkTopicFilter(message) {
  const settings = getCachedSettings();
  if (!settings) return { allowed: true, reason: 'no settings' };

  // Cek blocked keywords
  if (hasBlockedKeyword(message, settings.blocked_keywords)) {
    return { allowed: false, reason: 'blocked_keyword', reply: settings.off_topic_reply };
  }

  // Cek allowed topics
  if (!isTopicAllowed(message, settings.allowed_topics)) {
    return { allowed: false, reason: 'off_topic', reply: settings.off_topic_reply };
  }

  return { allowed: true, reason: 'ok' };
}

// Cache settings to avoid DB calls per message
let cachedSettings = null;
let cacheExpiry = 0;

export function getCachedSettings() {
  const now = Date.now();
  if (cachedSettings && now < cacheExpiry) {
    return cachedSettings;
  }
  // Sync cache (called from messageHandler)
  return null;
}

export async function refreshSettingsCache() {
  try {
    cachedSettings = await getAISettings();
    cacheExpiry = Date.now() + 30000; // 30s cache
  } catch (e) {
    console.error('Failed to refresh AI settings cache:', e.message);
  }
}

/**
 * Generate AI reply menggunakan Groq
 */
export async function getAIReply(userJid, userMessage) {
  try {
    // Refresh settings cache kalau perlu
    if (!cachedSettings || Date.now() >= cacheExpiry) {
      await refreshSettingsCache();
    }

    const settings = cachedSettings;
    if (!settings) {
      console.warn('⚠️ AI settings not found');
      return null;
    }

    // Cek apakah AI enabled
    if (!settings.is_enabled) {
      console.log('⏭️ AI is disabled in settings');
      return null;
    }

    if (!config.ai.groqApiKey && !settings?.groq_api_key) {
      console.warn('⚠️ GROQ_API_KEY tidak diset di .env maupun database.');
      return null;
    }

    // Simpan pesan user ke memory
    await saveMemory(userJid, 'user', userMessage);

    // Ambil conversation history
    const history = await getHistory(userJid);

    // Build dynamic system prompt
    let systemPrompt = settings.system_prompt || '';

    // Tambahkan topic constraint kalau ada allowed topics
    if (settings.allowed_topics && settings.allowed_topics.trim()) {
      const topics = settings.allowed_topics.split(',').map(t => t.trim()).filter(Boolean);
      systemPrompt += `\n\nKamu HANYA boleh menjawab pertanyaan tentang: ${topics.join(', ')}. Jika user bertanya di luar topik ini, tolak dengan sopan.`;
    }

    // Build messages array
    const messages = [
      { role: 'system', content: systemPrompt },
    ];

    // Tambahkan history
    for (const msg of history) {
      messages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      });
    }

    // Tambahkan pesan terbaru
    messages.push({ role: 'user', content: userMessage });

    console.log(`🤖 Sending to Groq (${messages.length} messages, model: ${settings.groq_model})...`);

    const client = getGroqClient();
    const completion = await client.chat.completions.create({
      messages,
      model: settings.groq_model || config.ai.groqModel,
      temperature: 0.7,
      max_tokens: 500,
      top_p: 1,
    });

    const aiReply = completion.choices[0]?.message?.content?.trim();

    if (!aiReply) {
      console.warn('⚠️ AI returned empty response');
      return null;
    }

    // Simpan AI reply ke memory
    await saveMemory(userJid, 'assistant', aiReply);

    console.log(`🤖 AI reply: ${aiReply.substring(0, 50)}...`);

    return aiReply;
  } catch (error) {
    console.error('❌ Groq API error:', error.message);

    if (error.status === 429) {
      console.warn('⚠️ Rate limited by Groq');
    } else if (error.status === 401) {
      console.error('❌ Invalid GROQ_API_KEY');
    }

    return null;
  }
}
