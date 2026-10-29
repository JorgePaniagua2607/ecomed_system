import type { Response } from 'express';
import { prisma } from '@ecomed/database';
import { createStaffSchema, updateStaffSchema } from '@ecomed/shared-types';
import bcrypt from 'bcryptjs';
import type { AuthRequest } from '../middlewares/auth.middleware';

export const getAllStaff = async (_req: AuthRequest, res: Response) => {
  try {
    const staffList = await prisma.user.findMany({
      where: { role: 'PERSONAL' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        fullName: true,
        ci: true,
        phone: true,
        email: true,
        role: true,
        shift: true,
        canApplyPromotions: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.json({ success: true, data: staffList });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener la lista de personal.' });
  }
};

export const createStaff = async (req: AuthRequest, res: Response) => {
  try {
    const result = createStaffSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ success: false, errors: result.error.errors });
    }

    const { username, fullName, ci, phone, email, shift, canApplyPromotions } = result.data;

    // Verificar duplicados de username o CI
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { ci }],
      },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'El nombre de usuario o el Carnet de Identidad (CI) ya están registrados.',
      });
    }

    // Regla de negocio: La contraseña por defecto es el Carnet de Identidad (CI)
    const passwordHash = await bcrypt.hash(ci, 10);

    const newStaff = await prisma.user.create({
      data: {
        username,
        fullName,
        ci,
        phone,
        email: email || null,
        passwordHash,
        role: 'PERSONAL',
        shift,
        canApplyPromotions,
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        ci: true,
        phone: true,
        email: true,
        role: true,
        shift: true,
        canApplyPromotions: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Personal registrado correctamente. Su contraseña inicial es su CI.',
      data: newStaff,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error interno al registrar personal.' });
  }
};

export const updateStaff = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = updateStaffSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ success: false, errors: result.error.errors });
    }

    const existingStaff = await prisma.user.findUnique({ where: { id } });
    if (!existingStaff || existingStaff.role !== 'PERSONAL') {
      return res.status(404).json({ success: false, message: 'Miembro del personal no encontrado.' });
    }

    const { resetPasswordToCi, email, ...updateFields } = result.data;
    const dataToUpdate: any = { ...updateFields };

    if (email !== undefined) {
      dataToUpdate.email = email || null;
    }

    // Si el Admin solicita restaurar su contraseña a su CI
    if (resetPasswordToCi) {
      const targetCi = updateFields.ci || existingStaff.ci;
      dataToUpdate.passwordHash = await bcrypt.hash(targetCi, 10);
    }

    const updatedStaff = await prisma.user.update({
      where: { id },
      data: dataToUpdate,
      select: {
        id: true,
        username: true,
        fullName: true,
        ci: true,
        phone: true,
        email: true,
        role: true,
        shift: true,
        canApplyPromotions: true,
        isActive: true,
        updatedAt: true,
      },
    });

    res.json({
      success: true,
      message: 'Datos del personal actualizados correctamente.',
      data: updatedStaff,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al actualizar el personal.' });
  }
};

export const deleteStaff = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingStaff = await prisma.user.findUnique({
      where: { id },
      include: { _count: { select: { ordersCreated: true, reportsGenerated: true } } },
    });

    if (!existingStaff || existingStaff.role !== 'PERSONAL') {
      return res.status(404).json({ success: false, message: 'Miembro del personal no encontrado.' });
    }

    // Si tiene historial clínico/operativo, se desactiva para no romper trazabilidad; si no, se elimina físicamente
    if (existingStaff._count.ordersCreated > 0 || existingStaff._count.reportsGenerated > 0) {
      await prisma.user.update({
        where: { id },
        data: { isActive: false },
      });
      return res.json({
        success: true,
        message: 'El personal posee historial operativo, por lo que fue desactivado del sistema.',
      });
    }

    await prisma.user.delete({ where: { id } });
    res.json({ success: true, message: 'Personal eliminado correctamente.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al eliminar el personal.' });
  }
};
