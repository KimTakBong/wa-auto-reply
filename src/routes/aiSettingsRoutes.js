import { Router } from 'express';
import { getSettings, updateSettings, resetSettings } from '../controllers/aiSettingsController.js';
import { isAuthenticated } from '../middleware/auth.js';

const router = Router();

router.get('/', isAuthenticated, getSettings);
router.put('/', isAuthenticated, updateSettings);
router.post('/reset', isAuthenticated, resetSettings);

export default router;
