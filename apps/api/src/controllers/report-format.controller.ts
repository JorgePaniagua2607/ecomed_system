import type { Response } from 'express';
import { prisma } from '@ecomed/database';
import { upsertReportFormatSchema } from '@ecomed/shared-types';
import type { AuthRequest } from '../middlewares/auth.middleware';

/**
 * Resuelve dinámicamente los nombres de columnas del modelo ReportFormat en Prisma
 * para garantizar compatibilidad con el schema.prisma (ej. baseText/staticText y fields/rectangles)
 */
function getReportFormatFieldMap() {
  const runtimeModels = (prisma as any)._runtimeDataModel?.models;
  const modelFields: Array<{ name: string; type: string; kind: string }> =
    runtimeModels?.ReportFormat?.fields || [];

  const scalarStringFields = modelFields
    .filter((f) => f.kind === 'scalar' && f.type === 'String' && !['id', 'studyServiceId'].includes(f.name))
    .map((f) => f.name);

  const jsonFields = modelFields
    .filter((f) => f.kind === 'scalar' && f.type === 'Json')
    .map((f) => f.name);

  const textColumn =
    scalarStringFields.find((n) => ['baseText', 'staticText', 'templateHtml', 'content', 'baseHtml'].includes(n)) ||
    scalarStringFields[0] ||
    'baseText';

  const jsonColumn =
    jsonFields.find((n) => ['fields', 'rectangles', 'coordinates', 'fieldCoordinates'].includes(n)) ||
    jsonFields[0] ||
    'fields';

  return { textColumn, jsonColumn };
}

function normalizeFormatRecord(record: any) {
  if (!record) return null;
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
export const getAllReportFormats = async (_req: AuthRequest, res: Response) => {
  try {
    const formats = await (prisma as any).reportFormat.findMany({
      include: { studyService: true },
      orderBy: { updatedAt: 'desc' },
    });

    const normalized = formats.map(normalizeFormatRecord);

    res.json({
      success: true,
      data: normalized,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener el listado de plantillas A4.',
    });
  }
};

// Obtener la plantilla A4 vinculada a un studyServiceId específico
export const getReportFormatByStudy = async (req: AuthRequest, res: Response) => {
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

    const format = await (prisma as any).reportFormat.findUnique({
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
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al consultar la plantilla A4 del estudio.',
    });
  }
};

// Crear o actualizar (Upsert) la plantilla A4 vinculada a un studyServiceId
export const upsertReportFormat = async (req: AuthRequest, res: Response) => {
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

    const savedFormat = await (prisma as any).reportFormat.upsert({
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
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno al guardar la plantilla A4.',
    });
  }
};

// Eliminar la plantilla A4 vinculada a un studyServiceId
export const deleteReportFormat = async (req: AuthRequest, res: Response) => {
  try {
    const { studyServiceId } = req.params;

    const existing = await (prisma as any).reportFormat.findUnique({
      where: { studyServiceId },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'No existe una plantilla A4 configurada para este estudio.',
      });
    }

    await (prisma as any).reportFormat.delete({
      where: { studyServiceId },
    });

    res.json({
      success: true,
      message: 'Plantilla A4 eliminada correctamente.',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al eliminar la plantilla A4.',
    });
  }
};
