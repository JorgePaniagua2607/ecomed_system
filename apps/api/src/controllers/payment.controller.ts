import type { Response } from 'express';
import { prisma, CommissionStatus } from '@ecomed/database';
import { settleCommitmentSchema } from '@ecomed/shared-types';
import type { AuthRequest } from '../middlewares/auth.middleware';

// Contador en tiempo real de pacientes "Por Compromiso" con deuda pendiente
export const getCommitmentsCounter = async (req: AuthRequest, res: Response) => {
  try {
    const unpaidOrders = await prisma.order.findMany({
      where: {
        paymentMethod: 'POR_COMPROMISO',
        isCommitmentPaid: false,
        status: { not: 'CANCELADO' },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        patient: true,
        items: { include: { studyService: true } },
      },
    });

    const totalUnpaidAmount = unpaidOrders.reduce(
      (acc, ord) => acc + Number(ord.totalAmount),
      0
    );

    res.json({
      success: true,
      data: {
        unpaidCount: unpaidOrders.length,
        totalUnpaidAmount,
        orders: unpaidOrders,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al obtener el contador de compromisos pendientes.',
    });
  }
};

// Liquidar (saldar) una orden que estaba "Por Compromiso"
export const settleCommitmentOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { orderId } = req.params;
    const result = settleCommitmentSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        errors: result.error.errors,
      });
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Orden no encontrada.',
      });
    }

    if (order.paymentMethod !== 'POR_COMPROMISO' || order.isCommitmentPaid) {
      return res.status(400).json({
        success: false,
        message: 'Esta orden no corresponde a un compromiso pendiente de pago.',
      });
    }

    const totalAmount = Number(order.totalAmount);
    const { paymentMethod, amountCash, amountQr } = result.data;

    let finalCash = 0;
    let finalQr = 0;

    if (paymentMethod === 'EFECTIVO') {
      finalCash = totalAmount;
    } else if (paymentMethod === 'QR') {
      finalQr = totalAmount;
    } else if (paymentMethod === 'MIXTO') {
      const cash = Number(amountCash ?? 0);
      const qr = Number(amountQr ?? 0);

      if (cash <= 0 || qr <= 0 || Math.abs(cash + qr - totalAmount) > 0.01) {
        return res.status(400).json({
          success: false,
          message: `El desglose MIXTO (Efectivo: Bs. ${cash} + QR: Bs. ${qr}) debe sumar exactamente Bs. ${totalAmount}.`,
        });
      }
      finalCash = cash;
      finalQr = qr;
    }

    const settledOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        amountCash: finalCash,
        amountQr: finalQr,
        isCommitmentPaid: true,
        commitmentPaidAt: new Date(),
      },
      include: {
        patient: true,
      },
    });

    res.json({
      success: true,
      message: 'Deuda por compromiso saldada correctamente.',
      data: settledOrder,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno al saldar el compromiso.',
    });
  }
};

// Resumen en vivo del Libro Mayor de Caja y Comisiones Médicas
export const getCashLedgerSummary = async (req: AuthRequest, res: Response) => {
  try {
    const [activeOrders, allCommissions] = await Promise.all([
      prisma.order.findMany({
        where: { status: { not: 'CANCELADO' } },
      }),
      prisma.doctorCommission.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          associatedDoctor: true,
          order: {
            include: {
              patient: true,
              items: {
                include: { studyService: true },
              },
            },
          },
        },
      }),
    ]);

    let totalCashCollected = 0;
    let totalQrCollected = 0;
    let totalAccountsReceivable = 0;
    let unpaidCommitmentsCount = 0;
    let totalEmergencySurcharges = 0;
    let emergencyOrdersCount = 0;

    for (const ord of activeOrders) {
      totalCashCollected += Number(ord.amountCash);
      totalQrCollected += Number(ord.amountQr);

      if (ord.paymentMethod === 'POR_COMPROMISO' && !ord.isCommitmentPaid) {
        totalAccountsReceivable += Number(ord.totalAmount);
        unpaidCommitmentsCount += 1;
      }

      if (ord.isEmergency) {
        totalEmergencySurcharges += Number(ord.emergencySurcharge);
        emergencyOrdersCount += 1;
      }
    }

    let totalPendingCommissions = 0;
    let totalPaidCommissions = 0;

    const formattedCommissions = allCommissions.map((comm) => {
      const amount = Number(comm.amount);
      const isOrderCancelled = comm.order?.status === 'CANCELADO';
      const rawStatus = String(comm.status);

      const effectiveStatus = isOrderCancelled
        ? 'ANULADO'
        : rawStatus === 'PAGADA' || rawStatus === 'PAGADO'
        ? 'PAGADO'
        : rawStatus;

      if (effectiveStatus === 'PENDIENTE') {
        totalPendingCommissions += amount;
      } else if (effectiveStatus === 'PAGADO') {
        totalPaidCommissions += amount;
      }

      return {
        id: comm.id,
        orderId: comm.orderId,
        orderNumber: comm.order?.orderNumber || comm.orderId.slice(0, 8),
        orderStatus: comm.order?.status || 'EN_ESPERA',
        associatedDoctorId: comm.associatedDoctorId,
        doctorName: comm.associatedDoctor?.fullName || 'Doctor Asociado',
        hospitalOrClinic: comm.associatedDoctor?.hospitalOrClinic || 'Particular',
        doctorPhone: comm.associatedDoctor?.phone || '',
        patientName: comm.order?.patient?.fullName || 'Paciente',
        patientPhone: comm.order?.patient?.phone || '',
        studyNames:
          comm.order?.items
            ?.map((it) => it.studyService?.name)
            .filter(Boolean)
            .join(', ') || 'Estudio Clínico',
        amount,
        status: effectiveStatus,
        rawStatus,
        paidAt: comm.paidAt,
        createdAt: comm.createdAt,
      };
    });

    res.json({
      success: true,
      data: {
        totalCashCollected,
        totalQrCollected,
        totalCollected: totalCashCollected + totalQrCollected,
        totalAccountsReceivable,
        unpaidCommitmentsCount,
        totalEmergencySurcharges,
        emergencyOrdersCount,
        totalPendingCommissions,
        totalPaidCommissions,
        commissions: formattedCommissions,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al consultar el Libro Mayor de Caja.',
    });
  }
};

// Liquidar (pagar) la comisión de un Doctor Asociado (PENDIENTE -> PAGADA)
export const settleDoctorCommission = async (req: AuthRequest, res: Response) => {
  try {
    const { commissionId } = req.params;

    const commission = await prisma.doctorCommission.findUnique({
      where: { id: commissionId },
      include: {
        associatedDoctor: true,
        order: { include: { patient: true } },
      },
    });

    if (!commission) {
      return res.status(404).json({
        success: false,
        message: 'Comisión médica no encontrada.',
      });
    }

    if (
      commission.order?.status === 'CANCELADO' ||
      String(commission.status).startsWith('ANULAD')
    ) {
      return res.status(400).json({
        success: false,
        message:
          'No se puede pagar una comisión cuya orden fue dada de baja (CANCELADO).',
      });
    }

    if (String(commission.status) !== 'PENDIENTE') {
      return res.status(400).json({
        success: false,
        message: 'Esta comisión ya fue liquidada anteriormente.',
      });
    }

    const paidEnumVal =
      (CommissionStatus as Record<string, string>)?.PAGADA ||
      (CommissionStatus as Record<string, string>)?.PAGADO ||
      'PAGADA';

    const updated = await prisma.doctorCommission.update({
      where: { id: commissionId },
      data: {
        status: paidEnumVal as CommissionStatus,
        paidAt: new Date(),
      },
      include: {
        associatedDoctor: true,
        order: { include: { patient: true } },
      },
    });

    res.json({
      success: true,
      message: `Comisión de Bs. ${Number(updated.amount).toFixed(2)} pagada a ${updated.associatedDoctor.fullName}.`,
      data: updated,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error interno al liquidar la comisión médica.',
    });
  }
};
