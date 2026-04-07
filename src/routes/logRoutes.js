import { Router } from 'express';
import { getLogs, flushLogs } from '../controllers/logController.js';
import { isAuthenticated } from '../middleware/auth.js';

const router = Router();

router.get('/', isAuthenticated, getLogs);
router.delete('/', isAuthenticated, flushLogs);

export default router;
