import { getReply } from '../services/replyService.js';
import { getAIReply, checkTopicFilter, refreshSettingsCache, getCachedSettings } from '../services/aiService.js';
import { isRateLimited } from '../services/rateLimitService.js';
import { trackUnanswered, checkAutoRuleThreshold, createAutoRule } from '../services/autoRuleService.js';
import { logMessage, extractPhoneNumber, isTextMessage } from '../utils/helpers.js';
import config from '../core/config.js';

// Refresh settings cache on startup
refreshSettingsCache().catch(() => {});

/**
 * Handler untuk pesan masuk (Hybrid: Rule → Topic Filter → AI)
 */
export async function handleMessage(sock, message) {
  try {
    // Hanya proses text message
    if (!isTextMessage(message)) {
      console.log('⏭️  Skipping: not a text message');
      return;
    }

    const senderJid = message.key.remoteJid;
    const from = extractPhoneNumber(message);
    const body = message.message?.conversation || message.message?.extendedTextMessage?.text || '';

    if (!from || !body || !senderJid) {
      console.log('⏭️  Skipping: no sender, body, or jid');
      return;
    }

    console.log(`📩 Message from ${from} (${senderJid}): ${body.substring(0, 50)}${body.length > 50 ? '...' : ''}`);

    // Log pesan masuk
    await logMessage({
      fromNumber: from,
      toNumber: sock.user?.id?.split(':')[0] || '',
      messageType: 'text',
      messageBody: body,
      direction: 'in',
    });

    // === STEP 1: Rule-based (hemat token) ===
    console.log(`🔍 Checking rules for: "${body}"`);
    const ruleReply = await getReply(body);

    if (ruleReply) {
      console.log(`💡 Rule matched: [${ruleReply.type}] "${ruleReply.pattern}"`);
      await sendReply(sock, senderJid, from, ruleReply.reply_text, ruleReply.id, 'rule', ruleReply.image_url);
      return;
    }

    // === STEP 2: Rate limit ===
    if (isRateLimited(senderJid)) {
      console.log(`⏳ Rate limited: ${senderJid}`);
      return;
    }

    // === STEP 3: Topic filter (sebelum AI) ===
    const topicCheck = checkTopicFilter(body);

    if (!topicCheck.allowed) {
      console.log(`🚫 Topic blocked: ${topicCheck.reason}`);
      await sendReply(sock, senderJid, from, topicCheck.reply, null, 'off_topic');
      return;
    }

    // === STEP 4: AI reply ===
    console.log(`🤖 No rule matched, falling back to AI...`);
    const aiReply = await getAIReply(senderJid, body);

    if (aiReply) {
      await sendReply(sock, senderJid, from, aiReply, null, 'ai');

      // === STEP 5: Auto-create rules tracking ===
      const settings = getCachedSettings();
      if (settings?.auto_create_rules) {
        const threshold = settings.auto_rule_threshold || 2;

        // Track pertanyaan ini
        const count = await trackUnanswered(body, aiReply);
        console.log(`📊 Question tracked: "${body}" (count: ${count}/${threshold})`);

        // Cek apakah udah mencapai threshold
        const candidate = await checkAutoRuleThreshold(body, threshold);
        if (candidate) {
          const ruleId = await createAutoRule(candidate.question, candidate.ai_answer);
          console.log(`🤖 Auto-created rule #${ruleId} for: "${candidate.question}"`);
        }
      }
    } else {
      console.log(`⚠️  AI failed, sending fallback reply`);
      await sendReply(sock, senderJid, from, config.ai.fallbackReply, null, 'fallback');
    }
  } catch (error) {
    console.error('❌ Error in handleMessage:', error.message);
    console.error(error.stack);
  }
}

/**
 * Helper: kirim reply + log dengan delay random
 */
async function sendReply(sock, senderJid, from, text, ruleId, replySource, imageUrl = null) {
  try {
    // Random delay biar keliatan seperti manusia
    const settings = getCachedSettings();
    const minDelay = settings?.reply_delay_min_ms ?? 1000;
    const maxDelay = settings?.reply_delay_max_ms ?? 3000;
    const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

    console.log(`⏳ Typing delay: ${delay}ms`);
    await new Promise(resolve => setTimeout(resolve, delay));

    console.log(`📤 Sending reply to: ${senderJid} [source: ${replySource}]`);

    // Kalau ada image_url, kirim gambar + caption
    if (imageUrl && imageUrl.trim()) {
      await sock.sendMessage(senderJid, {
        image: { url: imageUrl },
        caption: text,
      });
      console.log('✅ Image reply sent successfully');
    } else {
      // Text only
      await sock.sendMessage(senderJid, { text });
      console.log('✅ Reply sent successfully');
    }

    await logMessage({
      fromNumber: sock.user?.id?.split(':')[0] || '',
      toNumber: from,
      messageType: imageUrl ? 'image' : 'text',
      messageBody: text,
      direction: 'out',
      ruleId,
      replySource,
    });
  } catch (sendError) {
    console.error('❌ Failed to send reply:', sendError.message);
  }
}
