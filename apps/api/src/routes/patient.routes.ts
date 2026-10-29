import { Router } from 'express';
import {
  getAllPatients,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient,
} from '../controllers/patient.controller';
import { verifyToken, requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.use(verifyToken);

// Flujo operativo: Tanto ADMIN como PERSONAL pueden buscar, registrar y editar pacientes
router.get('/', requireRole(['ADMIN', 'PERSONAL']), getAllPatients);
router.get('/:id', requireRole(['ADMIN', 'PERSONAL']), getPatientById);
router.post('/', requireRole(['ADMIN', 'PERSONAL']), createPatient);
router.put('/:id', requireRole(['ADMIN', 'PERSONAL']), updatePatient);

// Solo el ADMIN puede eliminar registros de pacientes sin historial clínico
router.delete('/:id', requireRole(['ADMIN']), deletePatient);

export default router;
