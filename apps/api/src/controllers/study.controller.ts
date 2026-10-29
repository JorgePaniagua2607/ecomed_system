import type { Response } from 'express';
import { prisma } from '@ecomed/database';
import { createStudySchema, updateStudySchema } from '@ecomed/shared-types';
import type { AuthRequest } from '../middlewares/auth.middleware';

export const getAllStudies = async (req: AuthRequest, res: Response) => {
  try {
    const onlyActive = req.query.active === 'true' || req.user?.role === 'PERSONAL';
    const serviceType = req.query.serviceType as 'HACER_ECOGRAFIA' | 'SOLO_INFORME' | undefined;
    const reportCategory = req.query.reportCategory as 'ECOGRAFIA' | 'TOMOGRAFIA' | undefined;

    const whereClause: any = {};
    if (onlyActive) whereClause.isActive = true;
    if (serviceType) whereClause.serviceType = serviceType;
    if (reportCategory) whereClause.reportCategory = reportCategory;

    const studies = await prisma.studyService.findMany({
      where: whereClause,
      orderBy: [{ serviceType: 'asc' }, { name: 'asc' }],
    });

    res.json({ success: true, data: studies });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener el catálogo de estudios.' });
  }
};

export const createStudy = async (req: AuthRequest, res: Response) => {
  try {
    const result = createStudySchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ success: false, errors: result.error.errors });
    }

    const { name, serviceType, reportCategory, normalPrice, promoPrice } = result.data;

    // Si es HACER_ECOGRAFIA, su categoría implícita siempre es ECOGRAFIA
    const resolvedCategory = serviceType === 'HACER_ECOGRAFIA' ? 'ECOGRAFIA' : reportCategory;

    const newStudy = await prisma.studyService.create({
      data: {
        name,
        serviceType,
        reportCategory: resolvedCategory,
        normalPrice,
        promoPrice,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Estudio registrado correctamente en el catálogo.',
      data: newStudy,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error interno al registrar el estudio.' });
  }
};

export const updateStudy = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = updateStudySchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ success: false, errors: result.error.errors });
    }

    const existingStudy = await prisma.studyService.findUnique({ where: { id } });
    if (!existingStudy) {
      return res.status(404).json({ success: false, message: 'Estudio no encontrado en el catálogo.' });
    }

    const finalNormalPrice = result.data.normalPrice ?? Number(existingStudy.normalPrice);
    const finalPromoPrice = result.data.promoPrice ?? Number(existingStudy.promoPrice);

    if (finalPromoPrice > finalNormalPrice) {
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
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al actualizar el estudio.' });
  }
};

export const deleteStudy = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingStudy = await prisma.studyService.findUnique({
      where: { id },
      include: { _count: { select: { orderItems: true, reportFormats: true } } },
    });

    if (!existingStudy) {
      return res.status(404).json({ success: false, message: 'Estudio no encontrado.' });
    }

    // Si ya tiene órdenes o plantillas de informes asociadas, se desactiva lógicamente
    if (existingStudy._count.orderItems > 0 || existingStudy._count.reportFormats > 0) {
      await prisma.studyService.update({
        where: { id },
        data: { isActive: false },
      });
      return res.json({
        success: true,
        message: 'El estudio posee historial clínico o formatos asociados, por lo que fue desactivado.',
      });
    }

    await prisma.studyService.delete({ where: { id } });
    res.json({ success: true, message: 'Estudio eliminado correctamente del catálogo.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al eliminar el estudio.' });
  }
};
