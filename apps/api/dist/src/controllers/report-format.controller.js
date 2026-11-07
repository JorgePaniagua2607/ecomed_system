import { prisma } from '@ecomed/database';
import { upsertReportFormatSchema, generateReportSchema, } from '@ecomed/shared-types';
import { PdfService } from '../services/pdf.service';
/**
 * Resuelve dinámicamente los nombres de columnas del modelo ReportFormat en Prisma
 * para garantizar compatibilidad con el schema.prisma (ej. baseText/staticText y fields/rectangles)
 */
function getReportFormatFieldMap() {
    const runtimeModels = prisma._runtimeDataModel?.models;
    const modelFields = runtimeModels?.ReportFormat?.fields || [];
    const scalarStringFields = modelFields
        .filter((f) => f.kind === 'scalar' &&
        f.type === 'String' &&
        !['id', 'studyServiceId'].includes(f.name))
        .map((f) => f.name);
    const jsonFields = modelFields
        .filter((f) => f.kind === 'scalar' && f.type === 'Json')
        .map((f) => f.name);
    const textColumn = scalarStringFields.find((n) => [
        'baseText',
        'staticText',
        'templateHtml',
        'content',
        'baseHtml',
    ].includes(n)) ||
        scalarStringFields[0] ||
        'baseText';
    const jsonColumn = jsonFields.find((n) => ['fields', 'rectangles', 'coordinates', 'fieldCoordinates'].includes(n)) ||
        jsonFields[0] ||
        'fields';
    return { textColumn, jsonColumn };
}
function normalizeFormatRecord(record) {
    if (!record)
        return null;
    const { textColumn, jsonColumn } = getReportFormatFieldMap();
    const baseText = record[textColumn] ?? record.baseText ?? record.staticText ?? '';
    const fields = record[jsonColumn] ?? record.fields ?? record.rectangles ?? [];
    return {
        ...record,
        baseText,
        fields: Array.isArray(fields) ? fields : [],
    };
}
// Listar todas las plantillas A4 registradas
export const getAllReportFormats = async (_req, res) => {
    try {
        const formats = await prisma.reportFormat.findMany({
            include: { studyService: true },
            orderBy: { updatedAt: 'desc' },
        });
        const normalized = formats.map(normalizeFormatRecord);
        res.json({
            success: true,
            data: normalized,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al obtener el listado de plantillas A4.',
        });
    }
};
// Obtener la plantilla A4 vinculada a un studyServiceId específico
export const getReportFormatByStudy = async (req, res) => {
    try {
        const { studyServiceId } = req.params;
        const study = await prisma.studyService.findUnique({
            where: { id: studyServiceId },
        });
        if (!study) {
            return res.status(404).json({
                success: false,
                message: 'El estudio solicitado no existe en el catálogo.',
            });
        }
        const format = await prisma.reportFormat.findUnique({
            where: { studyServiceId },
            include: { studyService: true },
        });
        if (!format) {
            return res.status(404).json({
                success: false,
                message: 'Este estudio aún no tiene una plantilla A4 configurada.',
                data: null,
            });
        }
        res.json({
            success: true,
            data: normalizeFormatRecord(format),
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al consultar la plantilla A4 del estudio.',
        });
    }
};
// Crear o actualizar (Upsert) la plantilla A4 vinculada a un studyServiceId
export const upsertReportFormat = async (req, res) => {
    try {
        const payload = {
            ...req.body,
            studyServiceId: req.params.studyServiceId || req.body.studyServiceId,
            baseText: req.body.baseText ?? req.body.staticText ?? '',
            fields: req.body.fields ?? req.body.rectangles ?? [],
        };
        const result = upsertReportFormatSchema.safeParse(payload);
        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: 'Error de validación en las coordenadas o estructura de la plantilla A4.',
                errors: result.error.errors,
            });
        }
        const { studyServiceId, baseText, fields } = result.data;
        const study = await prisma.studyService.findUnique({
            where: { id: studyServiceId },
        });
        if (!study) {
            return res.status(404).json({
                success: false,
                message: 'No se puede vincular la plantilla: el estudio especificado no existe.',
            });
        }
        const { textColumn, jsonColumn } = getReportFormatFieldMap();
        const dbPayload = {
            [textColumn]: baseText,
            [jsonColumn]: fields,
        };
        const savedFormat = await prisma.reportFormat.upsert({
            where: { studyServiceId },
            update: dbPayload,
            create: {
                studyServiceId,
                ...dbPayload,
            },
            include: { studyService: true },
        });
        res.json({
            success: true,
            message: `Plantilla A4 vinculada correctamente al estudio "${study.name}" (${fields.length} campos dinámicos).`,
            data: normalizeFormatRecord(savedFormat),
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error interno al guardar la plantilla A4.',
        });
    }
};
// Eliminar la plantilla A4 vinculada a un studyServiceId
export const deleteReportFormat = async (req, res) => {
    try {
        const { studyServiceId } = req.params;
        const existing = await prisma.reportFormat.findUnique({
            where: { studyServiceId },
        });
        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'No existe una plantilla A4 configurada para este estudio.',
            });
        }
        await prisma.reportFormat.delete({
            where: { studyServiceId },
        });
        res.json({
            success: true,
            message: 'Plantilla A4 eliminada correctamente.',
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error interno al eliminar la plantilla A4.',
        });
    }
};
// Fase 4.3 + Paso 3: Generar PDF A4, persistir PatientReport en BD y marcar orden ATENDIDO
export const generateReportPdf = async (req, res) => {
    try {
        const payload = {
            ...req.body,
            studyServiceId: req.params.studyServiceId || req.body.studyServiceId,
        };
        const parsed = generateReportSchema.safeParse(payload);
        if (!parsed.success) {
            return res.status(400).json({
                success: false,
                message: 'Datos de entrada inválidos para generar el informe PDF.',
                errors: parsed.error.errors,
            });
        }
        const { studyServiceId, orderId, completeOrder, fieldValues } = parsed.data;
        const rawFormat = await prisma.reportFormat.findUnique({
            where: { studyServiceId },
            include: { studyService: true },
        });
        if (!rawFormat) {
            return res.status(404).json({
                success: false,
                message: 'No existe una plantilla A4 configurada para este estudio.',
            });
        }
        const normalized = normalizeFormatRecord(rawFormat);
        const fields = normalized.fields;
        const pdfBuffer = await PdfService.renderA4Pdf({
            baseText: normalized.baseText,
            fields,
            fieldValues,
        });
        // Persistir los fieldValues redactados vinculados a la orden (PatientReport) y pasar a ATENDIDO
        if (orderId) {
            try {
                const orderRecord = await prisma.order.findUnique({
                    where: { id: orderId },
                    include: { items: true },
                });
                if (orderRecord) {
                    let targetItem = orderRecord.items.find((item) => item.studyServiceId === studyServiceId) || orderRecord.items[0];
                    if (!targetItem) {
                        targetItem = await prisma.orderItem.create({
                            data: {
                                orderId: orderRecord.id,
                                studyServiceId,
                                priceApplied: rawFormat.studyService?.normalPrice ?? 0,
                            },
                        });
                    }
                    const authUser = req.user;
                    let resolvedUserId = authUser?.id || authUser?.userId || orderRecord.createdById;
                    if (!resolvedUserId) {
                        const firstUser = await prisma.user.findFirst();
                        resolvedUserId = firstUser?.id;
                    }
                    if (targetItem && resolvedUserId) {
                        await prisma.patientReport.upsert({
                            where: { orderItemId: targetItem.id },
                            update: {
                                formatId: rawFormat.id,
                                generatedById: resolvedUserId,
                                fieldValues: fieldValues,
                            },
                            create: {
                                orderItemId: targetItem.id,
                                formatId: rawFormat.id,
                                generatedById: resolvedUserId,
                                fieldValues: fieldValues,
                            },
                        });
                    }
                    if (completeOrder) {
                        await prisma.order.update({
                            where: { id: orderId },
                            data: { status: 'ATENDIDO' },
                        });
                    }
                }
            }
            catch (persistErr) {
                console.error('[generateReportPdf] Aviso al persistir PatientReport:', persistErr);
            }
        }
        const studySlug = (rawFormat.studyService?.name || 'estudio')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="informe-${studySlug}-${Date.now()}.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        return res.status(200).end(pdfBuffer);
    }
    catch (error) {
        console.error('[generateReportPdf] Error compilando PDF:', error);
        return res.status(500).json({
            success: false,
            message: 'Error interno al generar el documento PDF con Puppeteer.',
            error: error instanceof Error ? error.message : String(error),
        });
    }
};
// Paso 3: Listar historial de informes médicos emitidos (PatientReport)
export const getEmittedReportsHistory = async (_req, res) => {
    try {
        const reports = await prisma.patientReport.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                orderItem: {
                    include: {
                        studyService: true,
                        order: {
                            include: {
                                patient: true,
                                associatedDoctor: true,
                            },
                        },
                    },
                },
                format: {
                    include: { studyService: true },
                },
                generatedBy: {
                    select: {
                        id: true,
                        username: true,
                        fullName: true,
                        role: true,
                    },
                },
            },
        });
        const formatted = reports.map((rep) => {
            const ord = rep.orderItem?.order;
            const study = rep.orderItem?.studyService || rep.format?.studyService || null;
            return {
                id: rep.id,
                orderItemId: rep.orderItemId,
                orderId: ord?.id || rep.orderItem?.orderId || '',
                orderNumber: ord?.orderNumber ||
                    (rep.orderItem?.orderId
                        ? rep.orderItem.orderId.slice(0, 8)
                        : 'S/N'),
                orderStatus: ord?.status || 'ATENDIDO',
                origin: ord?.origin || 'POR_SU_CUENTA',
                patientId: ord?.patientId || '',
                patientName: ord?.patient?.fullName || 'Paciente',
                patientPhone: ord?.patient?.phone || '',
                associatedDoctorName: ord?.associatedDoctor?.fullName || null,
                studyServiceId: study?.id || rep.format?.studyServiceId || '',
                studyName: study?.name || 'Estudio Clínico',
                serviceType: study?.serviceType || 'HACER_ECOGRAFIA',
                reportCategory: study?.reportCategory || null,
                generatedByName: rep.generatedBy?.fullName ||
                    rep.generatedBy?.username ||
                    'Especialista Ecomed',
                fieldValues: rep.fieldValues || {},
                createdAt: rep.createdAt,
            };
        });
        res.json({
            success: true,
            data: formatted,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al obtener el historial de informes médicos emitidos.',
        });
    }
};
// Paso 3: Reimprimir / Recompilar un PDF emitido anteriormente desde su registro en PatientReport
export const regenerateHistoricalReportPdf = async (req, res) => {
    try {
        const { reportId } = req.params;
        const report = await prisma.patientReport.findUnique({
            where: { id: reportId },
            include: {
                format: {
                    include: { studyService: true },
                },
                orderItem: {
                    include: {
                        studyService: true,
                        order: { include: { patient: true } },
                    },
                },
            },
        });
        if (!report || !report.format) {
            return res.status(404).json({
                success: false,
                message: 'El informe histórico solicitado no fue encontrado.',
            });
        }
        const normalized = normalizeFormatRecord(report.format);
        const fields = normalized.fields;
        const savedValues = report.fieldValues || {};
        const pdfBuffer = await PdfService.renderA4Pdf({
            baseText: normalized.baseText,
            fields,
            fieldValues: savedValues,
        });
        const studySlug = (report.orderItem?.studyService?.name ||
            report.format.studyService?.name ||
            'historial')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="reimpresion-${studySlug}-${Date.now()}.pdf"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        return res.status(200).end(pdfBuffer);
    }
    catch (error) {
        console.error('[regenerateHistoricalReportPdf] Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error interno al reimprimir el informe PDF histórico.',
        });
    }
};
//# sourceMappingURL=report-format.controller.js.map