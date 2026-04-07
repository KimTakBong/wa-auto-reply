import { startWhatsApp } from './core/connection.js';
import { testConnection, closePool } from './core/database.js';
import { app, PORT } from './server.js';
import { setSocket, setConnectionStatus, setQRCode } from './controllers/sessionController.js';

console.log('🚀 Starting WhatsApp Auto-Reply Bot...');

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  await closePool();
  process.exit(0);
});

process.on('uncaughtException', async (error) => {
  console.error('💥 Uncaught Exception:', error.message);
  process.exit(1);
});

async function main() {
  // Test database connection
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('❌ Failed to connect to database. Exiting...');
    process.exit(1);
  }

  // Start Dashboard
  app.listen(PORT, () => {
    console.log(`🌐 Dashboard available at http://localhost:${PORT}`);
  });

  // Start WhatsApp
  try {
    const sock = await startWhatsApp();
    setSocket(sock);
  } catch (error) {
    console.error('❌ Failed to start WhatsApp:', error.message);
    process.exit(1);
  }
}

main();
