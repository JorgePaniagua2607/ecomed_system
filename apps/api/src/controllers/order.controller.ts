import type { Response } from 'express';
import { prisma } from '@ecomed/database';
import { createOrderSchema } from '@ecomed/shared-types';
import type { AuthRequest } from '../middlewares/auth.middleware';

function generateOrderNumber(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${datePart}-${randomPart}`;
}

export const getAllOrders = async (_req: AuthRequest, res: Response) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: [{ queuePriority: 'desc' }, { createdAt: 'desc' }],
      include: {
        patient: true,
        associatedDoctor: true,
        commission: true,
        items: {
          include: { studyService: true },
        },
        createdBy: {
          select: { id: true, username: true, fullName: true, role: true },
        },
      },
    });

    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener las órdenes.' });
  }
};

export const getOrderById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        patient: true,
        associatedDoctor: true,
        commission: true,
        items: {
          include: { studyService: true },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Orden no encontrada.' });
    }

    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al consultar la orden.' });
  }
};

export const createOrder = async (req: AuthRequest, res: Response) => {
  try {
    const result = createOrderSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ success: false, errors: result.error.errors });
    }

    const {
      patientId,
      studyIds,
      origin,
      associatedDoctorId,
      isEmergency,
      emergencySurcharge,
      paymentMethod,
      amountCash,
      amountQr,
    } = result.data;

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado.' });
    }

    // 1. Verificar usuario operador y su privilegio para aplicar promociones
    const operator = await prisma.user.findUnique({ where: { id: userId } });
    if (!operator || !operator.isActive) {
      return res.status(403).json({ success: false, message: 'Operador inactivo o inválido.' });
    }

    if (origin === 'PROMOCION' && operator.role !== 'ADMIN' && !operator.canApplyPromotions) {
      return res.status(403).json({
        success: false,
        message: 'No tienes el privilegio habilitado (canApplyPromotions) para registrar órdenes por Promoción.',
      });
    }

    // 2. Verificar existencia del paciente
    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) {
      return res.status(404).json({ success: false, message: 'El paciente especificado no existe.' });
    }

    // 3. Obtener y validar todos los estudios solicitados
    const studies = await prisma.studyService.findMany({
      where: { id: { in: studyIds }, isActive: true },
    });

    if (studies.length !== studyIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Uno o más estudios seleccionados no existen o se encuentran inactivos.',
      });
    }

    // 4. Si es RECOMENDACION, validar el Doctor Asociado y obtener su comisión fija
    let doctorToCommission = null;
    if (origin === 'RECOMENDACION') {
      doctorToCommission = await prisma.associatedDoctor.findUnique({
        where: { id: associatedDoctorId! },
      });

      if (!doctorToCommission || !doctorToCommission.isActive) {
        return res.status(404).json({
          success: false,
          message: 'El Doctor Asociado seleccionado no existe o está inactivo.',
        });
      }
    }

    // 5. Calcular subtotales, precios aplicados por ítem, recargo por emergencia y prioridad
    const orderItemsData = studies.map((study) => {
      const priceApplied = origin === 'PROMOCION' ? Number(study.promoPrice) : Number(study.normalPrice);
      return {
        studyServiceId: study.id,
        priceApplied,
      };
    });

    const subtotalStudies = orderItemsData.reduce((acc, item) => acc + item.priceApplied, 0);
    const appliedSurcharge = isEmergency ? Number(emergencySurcharge) : 0;
    const totalAmount = subtotalStudies + appliedSurcharge;
    const queuePriority = isEmergency ? 999 : 0;

    // 6. Validación y desglose exacto del Libro Mayor de Caja según método de pago
    let finalCash = 0;
    let finalQr = 0;
    let isCommitmentPaid = true;

    if (paymentMethod === 'EFECTIVO') {
      finalCash = totalAmount;
      finalQr = 0;
    } else if (paymentMethod === 'QR') {
      finalCash = 0;
      finalQr = totalAmount;
    } else if (paymentMethod === 'MIXTO') {
      const cash = Number(amountCash ?? 0);
      const qr = Number(amountQr ?? 0);

      if (cash <= 0 || qr <= 0) {
        return res.status(400).json({
          success: false,
          message: 'En pagos MIXTOS tanto el monto en Efectivo como el monto en QR deben ser mayores a 0.',
        });
      }

      if (Math.abs(cash + qr - totalAmount) > 0.01) {
        return res.status(400).json({
          success: false,
          message: `Descuadre en pago MIXTO: Efectivo (Bs. ${cash}) + QR (Bs. ${qr}) no coincide con el total de la orden (Bs. ${totalAmount}).`,
        });
      }

      finalCash = cash;
      finalQr = qr;
    } else if (paymentMethod === 'POR_COMPROMISO') {
      finalCash = 0;
      finalQr = 0;
      isCommitmentPaid = false;
    }

    // 7. Transacción atómica: Crear Orden + Ítems + Comisión de Doctor (si aplica)
    const createdOrder = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          patientId,
          createdById: userId,
          origin,
          associatedDoctorId: origin === 'RECOMENDACION' ? associatedDoctorId : null,
          isEmergency,
          emergencySurcharge: appliedSurcharge,
          queuePriority,
          status: 'EN_ESPERA',
          subtotalStudies,
          totalAmount,
          paymentMethod,
          amountCash: finalCash,
          amountQr: finalQr,
          isCommitmentPaid,
          items: {
            create: orderItemsData,
          },
        },
      });

      if (origin === 'RECOMENDACION' && doctorToCommission) {
        await tx.doctorCommission.create({
          data: {
            associatedDoctorId: doctorToCommission.id,
            orderId: newOrder.id,
            amount: doctorToCommission.agreedCommission,
            status: 'PENDIENTE',
          },
        });
      }

      return tx.order.findUnique({
        where: { id: newOrder.id },
        include: {
          patient: true,
          associatedDoctor: true,
          commission: true,
          items: { include: { studyService: true } },
        },
      });
    });

    res.status(201).json({
      success: true,
      message: 'Orden creada exitosamente.',
      data: createdOrder,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error interno al procesar la creación de la orden.' });
  }
};
