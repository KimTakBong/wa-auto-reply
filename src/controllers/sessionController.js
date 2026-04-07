import fs from 'fs';
import path from 'path';
import config from '../core/config.js';
import { restartWhatsApp } from '../core/connection.js';

// Store socket reference
let waSocket = null;
let qrCode = null;
let connectionStatus = 'disconnected'; // disconnected, connecting, connected

/**
 * Set socket reference from WhatsApp connection
 */
export function setSocket(sock) {
  waSocket = sock;
  connectionStatus = 'connected';
  qrCode = null;
}

/**
 * Update connection status
 */
export function setConnectionStatus(status) {
  connectionStatus = status;
}

/**
 * Update QR code
 */
export function setQRCode(qr) {
  qrCode = qr;
}

/**
 * GET /api/session
 */
export function getSession(req, res) {
  res.json({
    success: true,
    data: {
      status: connectionStatus,
      qrCode: qrCode,
      botNumber: waSocket?.user?.id?.split(':')[0] || null,
      botName: config.bot.name,
    },
  });
}

/**
 * POST /api/session/reconnect
 */
export async function reconnectSession(req, res) {
  try {
    res.json({ success: true, message: 'Restarting WhatsApp connection...' });

    // Restart di background supaya response langsung balik
    setTimeout(() => {
      restartWhatsApp().catch(err => {
        console.error('Restart error:', err.message);
      });
    }, 500);
  } catch (error) {
    console.error('Reconnect error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * GET /api/session/stats
 */
export async function getStats(req, res) {
  try {
    const db = (await import('../core/database.js')).getPool();

    const [totalRules] = await db.query('SELECT COUNT(*) as count FROM reply_rules');
    const [activeRules] = await db.query('SELECT COUNT(*) as count FROM reply_rules WHERE is_active = 1');
    const [totalMessages] = await db.query('SELECT COUNT(*) as count FROM message_logs');
    const [todayMessages] = await db.query(
      "SELECT COUNT(*) as count FROM message_logs WHERE DATE(created_at) = CURDATE()",
    );
    const [inCount] = await db.query("SELECT COUNT(*) as count FROM message_logs WHERE direction = 'in'");
    const [outCount] = await db.query("SELECT COUNT(*) as count FROM message_logs WHERE direction = 'out'");

    res.json({
      success: true,
      data: {
        totalRules: totalRules[0].count,
        activeRules: activeRules[0].count,
        totalMessages: totalMessages[0].count,
        todayMessages: todayMessages[0].count,
        incomingMessages: inCount[0].count,
        outgoingMessages: outCount[0].count,
        connectionStatus,
        botNumber: waSocket?.user?.id?.split(':')[0] || null,
      },
    });
  } catch (error) {
    console.error('Get stats error:', error.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
