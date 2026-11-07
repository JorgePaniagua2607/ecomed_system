import { Router } from 'express';
import { login, changePassword } from '../controllers/auth.controller';
import { verifyToken } from '../middlewares/auth.middleware';
const router = Router();
router.post('/login', login);
router.post('/change-password', verifyToken, changePassword);
export default router;
//# sourceMappingURL=auth.routes.js.map