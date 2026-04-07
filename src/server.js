import express from 'express';
import session from 'express-session';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './core/config.js';

// Routes
import authRoutes from './routes/authRoutes.js';
import ruleRoutes from './routes/ruleRoutes.js';
import logRoutes from './routes/logRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import aiSettingsRoutes from './routes/aiSettingsRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.DASHBOARD_PORT) || 1111;

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'wa-auto-reply-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.bot.nodeEnv === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

// Static files (frontend)
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/rules', ruleRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/ai-settings', aiSettingsRoutes);

// Serve index.html for all non-API routes (SPA support)
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

export { app, PORT };
