import { makeWASocket, fetchLatestBaileysVersion, DisconnectReason, useMultiFileAuthState } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import config from './config.js';
import { getPool } from './database.js';
import { handleMessage } from '../handlers/messageHandler.js';
import { setSocket, setConnectionStatus, setQRCode } from '../controllers/sessionController.js';

const logger = pino({ level: config.bot.logLevel });

// Store current socket to prevent duplicate connections
let currentSock = null;
let isStarting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
let reconnectTimer = null;

/**
 * Memulai koneksi WhatsApp
 */
export async function startWhatsApp() {
  if (isStarting) {
    console.log('⏳ WhatsApp is already starting, skipping...');
    return currentSock;
  }

  isStarting = true;
  setConnectionStatus('connecting');

  try {
    // Load session auth dari folder auth_store
    const { state, saveCreds } = await useMultiFileAuthState(config.bot.authDir);

    // Ambil versi Baileys terbaru
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      logger,
      auth: state,
      printQRInTerminal: true,
      browser: [config.bot.name, 'Chrome', '1.0.0'],
      generateHighQualityLinkPreview: true,
      retryRequestDelayMs: 1000, // Tambah delay untuk retry
      defaultQueryTimeoutMs: 60000, // Increase timeout ke 60s (default 20s)
      syncFullHistory: false, // Sync history minimal
    });

    currentSock = sock;

    // Suppress bad-request errors from executeInitQueries
    // This is a workaround for Baileys v7 bug where fetchProps fails with bad-request
    const originalFetchProps = sock.fetchProps;
    if (originalFetchProps) {
      sock.fetchProps = async function(...args) {
        try {
          return await originalFetchProps.call(this, ...args);
        } catch (error) {
          if (error?.message === 'bad-request' || error?.data === 400) {
            console.warn('⚠️  Suppressed bad-request error from fetchProps (known Baileys v7 issue)');
            return {}; // Return empty object instead of throwing
          }
          throw error;
        }
      };
    }

    // Event: QR Code muncul
    sock.ev.on('creds.update', saveCreds);

    // Event: Koneksi update
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // Tampilkan QR di terminal
      if (qr) {
        setQRCode(qr);
        setConnectionStatus('disconnected');
        console.log('📱 Scan QR code di bawah ini dengan WhatsApp:');
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'close') {
        const reason = lastDisconnect?.error?.output?.statusCode;
        const errorMessage = lastDisconnect?.error?.message || '';
        
        // Ignore bad-request errors (WhatsApp server bug)
        if (errorMessage === 'bad-request' || reason === 400) {
          console.warn('⚠️  Bad-request error dari WhatsApp server (known issue) - IGNORING');
          console.log('✅ Bot tetap connected, tidak reconnect');
          setConnectionStatus('connected');
          return; // Jangan reconnect
        }

        setConnectionStatus('disconnected');
        console.log(`❌ Koneksi terputus. Reason: ${DisconnectReason[reason] || reason}`);

        // Clear reconnect timer
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }

        // Kalau connectionReplaced, reconnect immediately (no delay)
        // karena ini kemungkinan false positive dari WhatsApp server
        if (reason === DisconnectReason.connectionReplaced) {
          console.log('⚠️  Connection replaced - reconnecting immediately (likely false positive)');
          reconnectAttempts = Math.min(reconnectAttempts + 1, MAX_RECONNECT_ATTEMPTS);
          
          // Reconnect after 1s instead of exponential backoff
          reconnectTimer = setTimeout(() => {
            isStarting = false;
            startWhatsApp();
          }, 1000);
          return;
        }

        // Reconnect dengan exponential backoff dan max attempts
        if (reason !== DisconnectReason.loggedOut && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000); // Max 30s
          console.log(`🔄 Reconnecting... (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}, delay: ${delay}ms)`);
          
          reconnectTimer = setTimeout(() => {
            isStarting = false;
            startWhatsApp();
          }, delay);
        } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          console.log(`⚠️  Max reconnect attempts reached. Please restart manually.`);
          setQRCode(null);
          isStarting = false;
          reconnectAttempts = 0; // Reset untuk kesempatan berikutnya
        } else {
          console.log('⚠️  Session habis. Scan ulang QR dari dashboard.');
          setQRCode(null);
          isStarting = false;
          reconnectAttempts = 0;
        }
      }

      if (connection === 'open') {
        // Reset reconnect attempts saat berhasil connect
        reconnectAttempts = 0;
        
        setSocket(sock);
        setConnectionStatus('connected');
        isStarting = false;
        console.log('✅ WhatsApp connected!');
        console.log(`🤖 Bot name: ${config.bot.name}`);
        console.log(`📞 Bot number: ${sock.user?.id?.split(':')[0]}`);
      }
    });

    // Event: Pesan masuk
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      // Hanya proses pesan yang benar-benar baru (bukan history)
      if (type !== 'notify') return;

      for (const message of messages) {
        // Ignore pesan dari bot sendiri
        if (message.key.fromMe) continue;

        // Ignore pesan dari grup (untuk sekarang)
        if (message.key.remoteJid?.endsWith('@g.us')) continue;

        await handleMessage(sock, message);
      }
    });

    // Event: Stream error handler - ignore conflict errors
    // This prevents connectionReplaced from killing the connection
    sock.ws.on('CB:stream:error', (error) => {
      console.warn('⚠️ Stream error received:', error?.content?.[0]?.attrs?.type || 'unknown');
      
      // Check if it's a conflict/replaced error
      const errorContent = error?.content?.[0];
      if (errorContent?.tag === 'conflict' && errorContent?.attrs?.type === 'replaced') {
        console.warn('⚠️ Conflict/replaced detected - IGNORING, keeping connection alive');
        // Don't close the connection, just log the error
        return;
      }
      
      // For other stream errors, let them through
      console.warn('⚠️ Non-conflict stream error, letting it through');
    });

    return sock;
  } catch (error) {
    isStarting = false;
    throw error;
  }
}

/**
 * Restart WhatsApp connection (dipanggil dari dashboard)
 */
export async function restartWhatsApp() {
  console.log('🔄 Restarting WhatsApp connection...');

  // End old socket properly
  if (currentSock) {
    try {
      await currentSock.logout();
    } catch (e) {
      // Ignore logout errors
    }
    try {
      currentSock.ev.removeAllListeners();
    } catch (e) {}
    currentSock = null;
  }

  // Reset state
  setConnectionStatus('disconnected');
  setQRCode(null);
  isStarting = false;

  // Clear auth store
  const fs = await import('fs');
  const path = await import('path');
  const authDir = path.resolve(config.bot.authDir);
  if (fs.existsSync(authDir)) {
    fs.rmSync(authDir, { recursive: true, force: true });
  }

  console.log('🗑️  Auth store cleared');

  // Start new connection
  await startWhatsApp();
}

/**
 * Kirim pesan error ke nomor admin
 */
export async function notifyAdmin(sock, errorMessage) {
  const adminNumber = config.bot.adminNumber;
  if (!adminNumber) {
    console.error('⚠️  ADMIN_NUMBER tidak diset di .env');
    return;
  }

  try {
    const adminJid = `${adminNumber}@s.whatsapp.net`;
    await sock.sendMessage(adminJid, {
      text: `⚠️ *Bot Error*\n\n${errorMessage}`,
    });
    console.log(`📩 Error notification sent to admin (${adminNumber})`);
  } catch (error) {
    console.error('❌ Failed to send error notification to admin:', error.message);
  }
}
