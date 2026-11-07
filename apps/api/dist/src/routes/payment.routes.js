import { Router } from 'express';
import { getCommitmentsCounter, settleCommitmentOrder, getCashLedgerSummary, settleDoctorCommission, } from '../controllers/payment.controller';
import { verifyToken, requireRole } from '../middlewares/auth.middleware';
const router = Router();
router.use(verifyToken);
// Tanto ADMIN como PERSONAL ven el contador en tiempo real y pueden registrar pagos/liquidaciones en caja
router.get('/commitments-counter', requireRole(['ADMIN', 'PERSONAL']), getCommitmentsCounter);
router.post('/commitments/:orderId/settle', requireRole(['ADMIN', 'PERSONAL']), settleCommitmentOrder);
router.get('/ledger', requireRole(['ADMIN', 'PERSONAL']), getCashLedgerSummary);
// Liquidación de comisiones de Doctores Asociados
router.post('/commissions/:commissionId/settle', requireRole(['ADMIN', 'PERSONAL']), settleDoctorCommission);
router.patch('/commissions/:commissionId/pay', requireRole(['ADMIN', 'PERSONAL']), settleDoctorCommission);
export default router;
//# sourceMappingURL=payment.routes.js.map