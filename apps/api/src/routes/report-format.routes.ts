import { Router } from 'express';
import {
  getAllReportFormats,
  getReportFormatByStudy,
  upsertReportFormat,
  deleteReportFormat,
} from '../controllers/report-format.controller';
import { verifyToken, requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.use(verifyToken);

// Consulta operativa para ADMIN y PERSONAL (para cargar formatos en atención o edición)
router.get('/', requireRole(['ADMIN', 'PERSONAL']), getAllReportFormats);
router.get('/study/:studyServiceId', requireRole(['ADMIN', 'PERSONAL']), getReportFormatByStudy);
router.get('/:studyServiceId', requireRole(['ADMIN', 'PERSONAL']), getReportFormatByStudy);

// Vinculación, actualización idempotente y eliminación de plantillas A4
router.post('/', requireRole(['ADMIN', 'PERSONAL']), upsertReportFormat);
router.put('/:studyServiceId', requireRole(['ADMIN', 'PERSONAL']), upsertReportFormat);
router.delete('/:studyServiceId', requireRole(['ADMIN']), deleteReportFormat);

export default router;
