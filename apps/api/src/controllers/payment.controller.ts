import type { Response } from 'express';
import { prisma } from '@ecomed/database';
import { settleCommitmentSchema } from '@ecomed/shared-types';
import type { AuthRequest } from '../middlewares/auth.middleware';

// Contador en tiempo real de pacientes "Por Compromiso" con deuda pendiente
export const getCommitmentsCounter = async (_req: AuthRequest, res: Response) => {
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

    const totalUnpaidAmount = unpaidOrders.reduce((acc, ord) => acc + Number(ord.totalAmount), 0);

    res.json({
      success: true,
      data: {
        unpaidCount: unpaidOrders.length,
        totalUnpaidAmount,
        orders: unpaidOrders,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener el contador de compromisos pendientes.' });
  }
};

// Liquidar (saldar) una orden que estaba "Por Compromiso"
export const settleCommitmentOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { orderId } = req.params;
    const result = settleCommitmentSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ success: false, errors: result.error.errors });
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Orden no encontrada.' });
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
    res.status(500).json({ success: false, message: 'Error interno al saldar el compromiso.' });
  }
};

// Resumen en vivo del Libro Mayor de Caja
export const getCashLedgerSummary = async (_req: AuthRequest, res: Response) => {
  try {
    const activeOrders = await prisma.order.findMany({
      where: { status: { not: 'CANCELADO' } },
    });

    let totalCashCollected = 0;
    let totalQrCollected = 0;
    let totalAccountsReceivable = 0;
    let unpaidCommitmentsCount = 0;

    for (const ord of activeOrders) {
      totalCashCollected += Number(ord.amountCash);
      totalQrCollected += Number(ord.amountQr);

      if (ord.paymentMethod === 'POR_COMPROMISO' && !ord.isCommitmentPaid) {
        totalAccountsReceivable += Number(ord.totalAmount);
        unpaidCommitmentsCount += 1;
      }
    }

    res.json({
      success: true,
      data: {
        totalCashCollected,
        totalQrCollected,
        totalCollected: totalCashCollected + totalQrCollected,
        totalAccountsReceivable,
        unpaidCommitmentsCount,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al consultar el Libro Mayor de Caja.' });
  }
};
