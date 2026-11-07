import { Router } from 'express';
import { getAllDoctors, createDoctor, updateDoctor, deleteDoctor } from '../controllers/doctor.controller';
import { verifyToken, requireRole } from '../middlewares/auth.middleware';
const router = Router();
router.use(verifyToken);
// Tanto ADMIN como PERSONAL pueden consultar el directorio de doctores al registrar órdenes
router.get('/', requireRole(['ADMIN', 'PERSONAL']), getAllDoctors);
// Solo el ADMIN puede crear, modificar comisiones o dar de baja a doctores asociados
router.post('/', requireRole(['ADMIN']), createDoctor);
router.put('/:id', requireRole(['ADMIN']), updateDoctor);
router.delete('/:id', requireRole(['ADMIN']), deleteDoctor);
export default router;
//# sourceMappingURL=doctor.routes.js.map