import { Router } from 'express';
import { login, changePassword, getMe } from '../controllers/auth.controller';
import { verifyToken } from '../middlewares/auth.middleware';

const router = Router();

router.post('/login', login);
router.get('/me', verifyToken, getMe);

// Soporta POST, PUT y PATCH para cambio de contraseña propia
router.post('/change-password', verifyToken, changePassword);
router.put('/change-password', verifyToken, changePassword);
router.patch('/change-password', verifyToken, changePassword);

export default router;
