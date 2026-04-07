import { Router } from 'express';
import { getRules, createRule, updateRule, deleteRule, toggleRule } from '../controllers/ruleController.js';
import { isAuthenticated } from '../middleware/auth.js';

const router = Router();

router.get('/', isAuthenticated, getRules);
router.post('/', isAuthenticated, createRule);
router.put('/:id', isAuthenticated, updateRule);
router.delete('/:id', isAuthenticated, deleteRule);
router.patch('/:id/toggle', isAuthenticated, toggleRule);

export default router;
