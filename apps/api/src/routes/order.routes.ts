import { Router } from 'express';
import { getAllOrders, getOrderById, createOrder } from '../controllers/order.controller';
import { verifyToken, requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.use(verifyToken);

router.get('/', requireRole(['ADMIN', 'PERSONAL']), getAllOrders);
router.get('/:id', requireRole(['ADMIN', 'PERSONAL']), getOrderById);
router.post('/', requireRole(['ADMIN', 'PERSONAL']), createOrder);

export default router;
