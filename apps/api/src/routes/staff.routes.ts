import { Router } from 'express';
import {
  getAllStaff,
  createStaff,
  updateStaff,
  deleteStaff,
} from '../controllers/staff.controller';
import { verifyToken, requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.use(verifyToken);

// Lectura habilitada para ADMIN y PERSONAL (evita 401/403 en el polling del dashboard)
router.get('/', requireRole(['ADMIN', 'PERSONAL']), getAllStaff);

// Creación, edición, reseteo de clave a CI y baja exclusivos para ADMIN
router.post('/', requireRole(['ADMIN']), createStaff);
router.put('/:id', requireRole(['ADMIN']), updateStaff);
router.patch('/:id', requireRole(['ADMIN']), updateStaff);
router.delete('/:id', requireRole(['ADMIN']), deleteStaff);

export default router;
