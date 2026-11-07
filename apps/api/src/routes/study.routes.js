import { Router } from 'express';
import { getAllStudies, createStudy, updateStudy, deleteStudy } from '../controllers/study.controller';
import { verifyToken, requireRole } from '../middlewares/auth.middleware';
const router = Router();
router.use(verifyToken);
// Tanto ADMIN como PERSONAL pueden consultar el catálogo y filtrar por tipo
router.get('/', requireRole(['ADMIN', 'PERSONAL']), getAllStudies);
// Solo el ADMIN puede crear, modificar precios o dar de baja estudios
router.post('/', requireRole(['ADMIN']), createStudy);
router.put('/:id', requireRole(['ADMIN']), updateStudy);
router.delete('/:id', requireRole(['ADMIN']), deleteStudy);
export default router;
//# sourceMappingURL=study.routes.js.map