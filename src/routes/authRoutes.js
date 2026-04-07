import { Router } from 'express';
import { login, logout, me, getUsers, createUser, updateUser, deleteUser } from '../controllers/authController.js';
import { isAuthenticated, isAdmin } from '../middleware/auth.js';

const router = Router();

// Public
router.post('/login', login);

// Authenticated
router.post('/logout', isAuthenticated, logout);
router.get('/me', isAuthenticated, me);

// Admin only
router.get('/users', isAuthenticated, isAdmin, getUsers);
router.post('/users', isAuthenticated, isAdmin, createUser);
router.put('/users/:id', isAuthenticated, isAdmin, updateUser);
router.delete('/users/:id', isAuthenticated, isAdmin, deleteUser);

export default router;
