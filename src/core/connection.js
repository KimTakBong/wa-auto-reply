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
    });

    currentSock = sock;

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
        setConnectionStatus('disconnected');
        const reason = lastDisconnect?.error?.output?.statusCode;
        console.log(`❌ Koneksi terputus. Reason: ${DisconnectReason[reason] || reason}`);

        // Reconnect kecuali logged out
        if (reason !== DisconnectReason.loggedOut) {
          console.log('🔄 Reconnecting...');
          setTimeout(() => {
            isStarting = false;
            startWhatsApp();
          }, 3000);
        } else {
          console.log('⚠️  Session habis. Scan ulang QR dari dashboard.');
          setQRCode(null);
          isStarting = false;
        }
      }

      if (connection === 'open') {
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
