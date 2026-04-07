import { Router } from 'express';
import { getSession, reconnectSession, getStats } from '../controllers/sessionController.js';
import { isAuthenticated } from '../middleware/auth.js';

const router = Router();

router.get('/', isAuthenticated, getSession);
router.post('/reconnect', isAuthenticated, reconnectSession);
router.get('/stats', isAuthenticated, getStats);

export default router;
