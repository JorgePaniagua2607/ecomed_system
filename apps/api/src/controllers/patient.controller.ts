import type { Response } from 'express';
import { prisma } from '@ecomed/database';
import { createPatientSchema, updatePatientSchema } from '@ecomed/shared-types';
import type { AuthRequest } from '../middlewares/auth.middleware';

export const getAllPatients = async (req: AuthRequest, res: Response) => {
  try {
    const search = (req.query.search as string)?.trim();

    const whereClause = search
      ? {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search } },
          ],
        }
      : undefined;

    const patients = await prisma.patient.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        _count: { select: { orders: true } },
      },
    });

    res.json({ success: true, data: patients });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener la lista de pacientes.' });
  }
};

export const getPatientById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!patient) {
      return res.status(404).json({ success: false, message: 'Paciente no encontrado.' });
    }

    res.json({ success: true, data: patient });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al consultar el paciente.' });
  }
};

export const createPatient = async (req: AuthRequest, res: Response) => {
  try {
    const result = createPatientSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ success: false, errors: result.error.errors });
    }

    const { fullName, phone } = result.data;

    const newPatient = await prisma.patient.create({
      data: {
        fullName,
        phone,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Paciente registrado correctamente.',
      data: newPatient,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error interno al registrar el paciente.' });
  }
};

export const updatePatient = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = updatePatientSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ success: false, errors: result.error.errors });
    }

    const existingPatient = await prisma.patient.findUnique({ where: { id } });
    if (!existingPatient) {
      return res.status(404).json({ success: false, message: 'Paciente no encontrado.' });
    }

    const updatedPatient = await prisma.patient.update({
      where: { id },
      data: result.data,
    });

    res.json({
      success: true,
      message: 'Datos del paciente actualizados correctamente.',
      data: updatedPatient,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al actualizar el paciente.' });
  }
};

export const deletePatient = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existingPatient = await prisma.patient.findUnique({
      where: { id },
      include: { _count: { select: { orders: true } } },
    });

    if (!existingPatient) {
      return res.status(404).json({ success: false, message: 'Paciente no encontrado.' });
    }

    if (existingPatient._count.orders > 0) {
      return res.status(409).json({
        success: false,
        message: 'No se puede eliminar al paciente porque ya posee órdenes clínicas registradas.',
      });
    }

    await prisma.patient.delete({ where: { id } });
    res.json({ success: true, message: 'Paciente eliminado correctamente.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al eliminar el paciente.' });
  }
};
