import { Router } from 'express';
import { getAllReportFormats, getReportFormatByStudy, upsertReportFormat, deleteReportFormat, generateReportPdf, getEmittedReportsHistory, regenerateHistoricalReportPdf, } from '../controllers/report-format.controller';
import { verifyToken, requireRole } from '../middlewares/auth.middleware';
const router = Router();
router.use(verifyToken);
// Paso 3: Historial de Informes Emitidos y Reimpresión PDF (antes de rutas dinámicas /:studyServiceId)
router.get('/history', requireRole(['ADMIN', 'PERSONAL']), getEmittedReportsHistory);
router.post('/history/:reportId/pdf', requireRole(['ADMIN', 'PERSONAL']), regenerateHistoricalReportPdf);
// Fase 4.3: Motor de renderizado PDF (POST /generate y POST /:studyServiceId/generate)
router.post('/generate', requireRole(['ADMIN', 'PERSONAL']), generateReportPdf);
router.post('/:studyServiceId/generate', requireRole(['ADMIN', 'PERSONAL']), generateReportPdf);
// Consulta operativa para ADMIN y PERSONAL (para cargar formatos en atención o edición)
router.get('/', requireRole(['ADMIN', 'PERSONAL']), getAllReportFormats);
router.get('/study/:studyServiceId', requireRole(['ADMIN', 'PERSONAL']), getReportFormatByStudy);
router.get('/:studyServiceId', requireRole(['ADMIN', 'PERSONAL']), getReportFormatByStudy);
// Vinculación, actualización idempotente y eliminación de plantillas A4
router.post('/', requireRole(['ADMIN', 'PERSONAL']), upsertReportFormat);
router.put('/:studyServiceId', requireRole(['ADMIN', 'PERSONAL']), upsertReportFormat);
router.delete('/:studyServiceId', requireRole(['ADMIN']), deleteReportFormat);
export default router;
//# sourceMappingURL=report-format.routes.js.map