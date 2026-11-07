import { Router } from 'express';
import { getWaitingRoomMonitor, callNextPatient, updateOrderQueueStatus, } from '../controllers/queue.controller';
import { verifyToken, requireRole } from '../middlewares/auth.middleware';
const router = Router();
router.use(verifyToken);
// Acceso operativo completo para ADMIN y PERSONAL
router.get('/', requireRole(['ADMIN', 'PERSONAL']), getWaitingRoomMonitor);
router.post('/call-next', requireRole(['ADMIN', 'PERSONAL']), callNextPatient);
router.patch('/:orderId/status', requireRole(['ADMIN', 'PERSONAL']), updateOrderQueueStatus);
export default router;
//# sourceMappingURL=queue.routes.js.map