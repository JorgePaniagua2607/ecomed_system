import { prisma } from '@ecomed/database';
import { createStudySchema, updateStudySchema } from '@ecomed/shared-types';
// Listar estudios del catálogo
export const getAllStudies = async (req, res) => {
    try {
        const onlyActive = req.query.onlyActive === 'true';
        const studies = await prisma.studyService.findMany({
            where: onlyActive ? { isActive: true } : undefined,
            include: { reportFormat: true },
            orderBy: { name: 'asc' },
        });
        res.json({
            success: true,
            data: studies,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al obtener el catálogo de estudios.',
        });
    }
};
// Crear nuevo estudio en el catálogo
export const createStudy = async (req, res) => {
    try {
        const result = createStudySchema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({
                success: false,
                errors: result.error.errors,
            });
        }
        const { name, serviceType, reportCategory, normalPrice, promoPrice } = result.data;
        const newStudy = await prisma.studyService.create({
            data: {
                name,
                serviceType,
                reportCategory: serviceType === 'SOLO_INFORME'
                    ? reportCategory ?? 'ECOGRAFIA'
                    : reportCategory ?? null,
                normalPrice,
                promoPrice,
            },
        });
        res.status(201).json({
            success: true,
            message: 'Estudio clínico registrado exitosamente.',
            data: newStudy,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error interno al crear el estudio.',
        });
    }
};
// Actualizar un estudio existente
export const updateStudy = async (req, res) => {
    try {
        const { id } = req.params;
        const existingStudy = await prisma.studyService.findUnique({
            where: { id },
        });
        if (!existingStudy) {
            return res.status(404).json({
                success: false,
                message: 'Estudio no encontrado.',
            });
        }
        const result = updateStudySchema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({
                success: false,
                errors: result.error.errors,
            });
        }
        const nextNormal = result.data.normalPrice !== undefined
            ? Number(result.data.normalPrice)
            : Number(existingStudy.normalPrice);
        const nextPromo = result.data.promoPrice !== undefined
            ? Number(result.data.promoPrice)
            : Number(existingStudy.promoPrice);
        if (nextPromo > nextNormal) {
            return res.status(400).json({
                success: false,
                message: 'El precio promocional no puede ser mayor al precio normal.',
            });
        }
        const updatedStudy = await prisma.studyService.update({
            where: { id },
            data: result.data,
        });
        res.json({
            success: true,
            message: 'Estudio actualizado correctamente.',
            data: updatedStudy,
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error interno al actualizar el estudio.',
        });
    }
};
// Eliminar o desactivar un estudio (Soft-delete si tiene órdenes o plantilla A4 asociada)
export const deleteStudy = async (req, res) => {
    try {
        const { id } = req.params;
        const existingStudy = await prisma.studyService.findUnique({
            where: { id },
            include: {
                reportFormat: true,
                _count: { select: { orderItems: true } },
            },
        });
        if (!existingStudy) {
            return res.status(404).json({
                success: false,
                message: 'Estudio no encontrado.',
            });
        }
        if (existingStudy._count.orderItems > 0 ||
            Boolean(existingStudy.reportFormat)) {
            const deactivated = await prisma.studyService.update({
                where: { id },
                data: { isActive: false },
            });
            return res.json({
                success: true,
                message: 'El estudio posee historial clínico o plantilla asociada; fue desactivado (soft-delete).',
                data: deactivated,
            });
        }
        await prisma.studyService.delete({ where: { id } });
        res.json({
            success: true,
            message: 'Estudio eliminado definitivamente del catálogo.',
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error interno al eliminar el estudio.',
        });
    }
};
//# sourceMappingURL=study.controller.js.map