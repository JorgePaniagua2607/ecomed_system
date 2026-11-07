import { Router } from 'express';
import { login, changePassword } from '../controllers/auth.controller';
import { verifyToken } from '../middlewares/auth.middleware';

const router = Router();

router.post('/login', login);

// Soporta POST, PUT y PATCH para cambio de contraseña propia
router.post('/change-password', verifyToken, changePassword);
router.put('/change-password', verifyToken, changePassword);
router.patch('/change-password', verifyToken, changePassword);

export default router;
