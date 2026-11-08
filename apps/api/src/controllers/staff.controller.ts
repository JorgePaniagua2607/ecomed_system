import type { Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '@ecomed/database';
import { createStaffSchema, updateStaffSchema } from '@ecomed/shared-types';
import type { AuthRequest } from '../middlewares/auth.middleware';

// Listar todo el personal clínico
export const getAllStaff = async (_req: AuthRequest, res: Response) => {
  try {
    const staff = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: staff,
      staff,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener el listado de personal.',
    });
  }
};

// Registrar nuevo personal clínico (Contraseña inicial igual al CI)
export const createStaff = async (req: AuthRequest, res: Response) => {
  try {
    const result = createStaffSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Datos de personal inválidos.',
        errors: result.error.errors,
      });
    }

    const { username, fullName, ci, phone, email, shift, canApplyPromotions } =
      result.data;

    // Limpiar duplicados previos si existen (ideal para pruebas repetitivas)
    await prisma.user.deleteMany({
      where: {
        OR: [{ username }, { ci }],
      },
    });

    const passwordHash = await bcrypt.hash(ci, 10);

    const newStaff = await prisma.user.create({
      data: {
        username,
        fullName,
        ci,
        phone,
        email: email || null,
        shift,
        canApplyPromotions: Boolean(canApplyPromotions),
        passwordHash,
        role: 'PERSONAL',
        isActive: true,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Personal clínico registrado exitosamente con contraseña inicial igual a su CI.',
      data: newStaff,
      user: newStaff,
    });
  } catch (error) {
    console.error('[createStaff] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno al registrar el personal clínico.',
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

// Actualizar datos, turnos, permisos o restablecer clave a CI
export const updateStaff = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.user.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Personal no encontrado.',
      });
    }

    const result = updateStaffSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Datos de actualización inválidos.',
        errors: result.error.errors,
      });
    }

    const { resetPasswordToCi, ...patchData } = result.data;
    const updatePayload: any = { ...patchData };

    if (resetPasswordToCi) {
      updatePayload.passwordHash = await bcrypt.hash(existing.ci, 10);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updatePayload,
    });

    res.json({
      success: true,
      message: resetPasswordToCi
        ? 'Contraseña restablecida al número de CI correctamente.'
        : 'Datos de personal actualizados correctamente.',
      data: updated,
      user: updated,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno al actualizar el personal.',
    });
  }
};

// Eliminar o desactivar personal (Soft-delete si tiene órdenes o reportes asociados)
export const deleteStaff = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            ordersCreated: true,
            reportsGenerated: true,
          },
        },
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Personal no encontrado.',
      });
    }

    if (
      existing._count.ordersCreated > 0 ||
      existing._count.reportsGenerated > 0
    ) {
      const deactivated = await prisma.user.update({
        where: { id },
        data: { isActive: false },
      });

      return res.json({
        success: true,
        message:
          'El usuario posee historial en el sistema; fue desactivado (soft-delete).',
        data: deactivated,
      });
    }

    await prisma.user.delete({ where: { id } });

    res.json({
      success: true,
      message: 'Personal eliminado definitivamente del sistema.',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno al eliminar el personal.',
    });
  }
};
