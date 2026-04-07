import dotenv from 'dotenv';

dotenv.config();

const config = {
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'wa-auto-reply',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  },
  bot: {
    name: process.env.BOT_NAME || 'WA-AutoReply-Bot',
    adminNumber: process.env.ADMIN_NUMBER || '',
    authDir: process.env.AUTH_DIR || './auth_store',
    logLevel: process.env.LOG_LEVEL || 'info',
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  ai: {
    groqApiKey: process.env.GROQ_API_KEY || '',
    groqModel: process.env.GROQ_MODEL || 'llama-3.1-70b-versatile',
    maxHistory: parseInt(process.env.AI_MAX_HISTORY || '20'),
    rateLimitSeconds: parseInt(process.env.AI_RATE_LIMIT_SECONDS || '5'),
    fallbackReply: process.env.AI_FALLBACK_REPLY || 'Maaf, saya sedang sibuk. Coba lagi dalam beberapa menit ya.',
  },
};

export default config;
