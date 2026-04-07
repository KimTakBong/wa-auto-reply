/**
 * Cek apakah pesan mengandung blocked keyword
 * @returns {boolean} true kalau ada blocked keyword
 */
export function hasBlockedKeyword(message, blockedKeywords) {
  if (!blockedKeywords || blockedKeywords.trim() === '') return false;

  const keywords = blockedKeywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
  const messageWords = message.toLowerCase().split(/\s+/);

  return keywords.some(keyword => {
    // Split keyword into words, check if ALL words exist in message
    const keywordWords = keyword.split(/\s+/);
    return keywordWords.every(kw => messageWords.includes(kw));
  });
}

/**
 * Cek apakah pesan related dengan allowed topics
 * Kalau allowed_topics kosong → semua topik allowed
 * @returns {boolean} true kalau related atau no topic filter
 */
export function isTopicAllowed(message, allowedTopics) {
  if (!allowedTopics || allowedTopics.trim() === '') return true; // No filter = all allowed

  const topics = allowedTopics.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
  const messageWords = message.toLowerCase().split(/\s+/);

  return topics.some(topic => {
    // Split topic into words, check if ALL words exist in message
    const topicWords = topic.split(/\s+/);
    return topicWords.every(tw => messageWords.includes(tw));
  });
}

/**
 * Parse comma-separated string ke array
 */
export function parseKeywords(str) {
  if (!str) return [];
  return str.split(',').map(s => s.trim()).filter(Boolean);
}
