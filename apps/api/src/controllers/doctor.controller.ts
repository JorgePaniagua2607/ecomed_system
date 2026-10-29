import type { Response } from 'express';
import { prisma } from '@ecomed/database';
import { createDoctorSchema, updateDoctorSchema } from '@ecomed/shared-types';
import type { AuthRequest } from '../middlewares/auth.middleware';

export const getAllDoctors = async (req: AuthRequest, res: Response) => {
  try {
    const onlyActive = req.query.active === 'true' || req.user?.role === 'PERSONAL';

    const doctors = await prisma.associatedDoctor.findMany({
      where: onlyActive ? { isActive: true } : undefined,
      orderBy: { fullName: 'asc' },
    });

    res.json({ success: true, data: doctors });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener la lista de doctores asociados.' });
  }
};

export const createDoctor = async (req: AuthRequest, res: Response) => {
  try {
    const result = createDoctorSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ success: false, errors: result.error.errors });
    }

    const { fullName, hospitalOrClinic, agreedCommission, phone, email } = result.data;

    const newDoctor = await prisma.associatedDoctor.create({
      data: {
        fullName,
        hospitalOrClinic: hospitalOrClinic || null,
        agreedCommission,
        phone,
        email: email || null,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Doctor asociado registrado correctamente.',
      data: newDoctor,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error interno al registrar el doctor asociado.' });
  }
};

export const updateDoctor = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = updateDoctorSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ success: false, errors: result.error.errors });
    }

    const existingDoctor = await prisma.associatedDoctor.findUnique({ where: { id } });
    if (!existingDoctor) {
      return res.status(404).json({ success: false, message: 'Doctor asociado no encontrado.' });
    }

    const { hospitalOrClinic, email, ...rest } = result.data;
    const dataToUpdate: any = { ...rest };

    if (hospitalOrClinic !== undefined) dataToUpdate.hospitalOrClinic = hospitalOrClinic || null;
    if (email !== undefined) dataToUpdate.email = email || null;

    const updatedDoctor = await prisma.associatedDoctor.update({
      where: { id },
      data: dataToUpdate,
    });

    res.json({
      success: true,
      message: 'Datos del doctor asociado actualizados correctamente.',
      data: updatedDoctor,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al actualizar el doctor asociado.' });
  }
};

export const deleteDoctor = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingDoctor = await prisma.associatedDoctor.findUnique({
      where: { id },
      include: { _count: { select: { orders: true, commissions: true } } },
    });

    if (!existingDoctor) {
      return res.status(404).json({ success: false, message: 'Doctor asociado no encontrado.' });
    }

    // Protección contable: si ya derivó órdenes o tiene comisiones, se desactiva en lugar de borrarse
    if (existingDoctor._count.orders > 0 || existingDoctor._count.commissions > 0) {
      await prisma.associatedDoctor.update({
        where: { id },
        data: { isActive: false },
      });
      return res.json({
        success: true,
        message: 'El doctor posee historial de derivaciones/comisiones, por lo que fue desactivado.',
      });
    }

    await prisma.associatedDoctor.delete({ where: { id } });
    res.json({ success: true, message: 'Doctor asociado eliminado correctamente.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al eliminar el doctor asociado.' });
  }
};
