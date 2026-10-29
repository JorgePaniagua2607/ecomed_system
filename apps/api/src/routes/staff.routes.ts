import { Router } from 'express';
import { getAllStaff, createStaff, updateStaff, deleteStaff } from '../controllers/staff.controller';
import { verifyToken, requireRole } from '../middlewares/auth.middleware';

const router = Router();

// Todas las rutas de gestión de personal exigen token válido y rol ADMIN
router.use(verifyToken, requireRole(['ADMIN']));

router.get('/', getAllStaff);
router.post('/', createStaff);
router.put('/:id', updateStaff);
router.delete('/:id', deleteStaff);

export default router;
