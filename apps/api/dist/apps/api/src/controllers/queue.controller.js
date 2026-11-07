import { prisma } from '@ecomed/database';
import { updateQueueStatusSchema } from '@ecomed/shared-types';
// Obtener el estado completo del Monitor de Sala de Espera
export const getWaitingRoomMonitor = async (_req, res) => {
    try {
        // 1. Pacientes en espera: Primero emergencias (queuePriority: 999), luego por orden de llegada (FIFO: createdAt asc)
        const waitingOrders = await prisma.order.findMany({
            where: { status: 'EN_ESPERA' },
            orderBy: [{ queuePriority: 'desc' }, { createdAt: 'asc' }],
            include: {
                patient: true,
                items: { include: { studyService: true } },
            },
        });
        // 2. Pacientes actualmente en consultorio (EN_ATENCION)
        const inAttentionOrders = await prisma.order.findMany({
            where: { status: 'EN_ATENCION' },
            orderBy: { updatedAt: 'desc' },
            include: {
                patient: true,
                items: { include: { studyService: true } },
            },
        });
        const formattedWaitingQueue = waitingOrders.map((order, index) => ({
            position: index + 1,
            orderId: order.id,
            orderNumber: order.orderNumber,
            patientId: order.patient.id,
            patientName: order.patient.fullName,
            patientPhone: order.patient.phone,
            isEmergency: order.isEmergency,
            queuePriority: order.queuePriority,
            status: order.status,
            studies: order.items.map((i) => i.studyService.name),
            arrivedAt: order.createdAt,
        }));
        const emergenciesWaiting = waitingOrders.filter((o) => o.isEmergency).length;
        res.json({
            success: true,
            data: {
                stats: {
                    totalWaiting: waitingOrders.length,
                    emergenciesWaiting,
                    normalWaiting: waitingOrders.length - emergenciesWaiting,
                    inAttentionCount: inAttentionOrders.length,
                },
                inAttention: inAttentionOrders,
                waitingQueue: formattedWaitingQueue,
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Error al obtener el monitor de sala de espera.' });
    }
};
// Llamar automáticamente al siguiente paciente según prioridad y orden de llegada
export const callNextPatient = async (_req, res) => {
    try {
        const nextOrder = await prisma.order.findFirst({
            where: { status: 'EN_ESPERA' },
            orderBy: [{ queuePriority: 'desc' }, { createdAt: 'asc' }],
        });
        if (!nextOrder) {
            return res.status(404).json({
                success: false,
                message: 'No hay pacientes en la cola de espera en este momento.',
            });
        }
        const updatedOrder = await prisma.order.update({
            where: { id: nextOrder.id },
            data: { status: 'EN_ATENCION' },
            include: {
                patient: true,
                items: { include: { studyService: true } },
            },
        });
        res.json({
            success: true,
            message: `Llamando a consulta: ${updatedOrder.patient.fullName} (${updatedOrder.isEmergency ? 'EMERGENCIA' : 'Turno Regular'})`,
            data: updatedOrder,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Error al llamar al siguiente paciente.' });
    }
};
// Cambiar estado de una orden específica (EN_ESPERA, EN_ATENCION, ATENDIDO, CANCELADO)
export const updateOrderQueueStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const result = updateQueueStatusSchema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({ success: false, errors: result.error.errors });
        }
        const { status } = result.data;
        const existingOrder = await prisma.order.findUnique({
            where: { id: orderId },
            include: { commission: true },
        });
        if (!existingOrder) {
            return res.status(404).json({ success: false, message: 'Orden no encontrada.' });
        }
        const updatedOrder = await prisma.$transaction(async (tx) => {
            // Si la orden se cancela y tenía una comisión pendiente, se elimina el asiento pendiente
            if (status === 'CANCELADO' && existingOrder.commission && existingOrder.commission.status === 'PENDIENTE') {
                await tx.doctorCommission.delete({
                    where: { id: existingOrder.commission.id },
                });
            }
            return tx.order.update({
                where: { id: orderId },
                data: { status },
                include: {
                    patient: true,
                    items: { include: { studyService: true } },
                },
            });
        });
        res.json({
            success: true,
            message: `Estado de la orden actualizado a ${status}.`,
            data: updatedOrder,
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Error al actualizar el estado de la orden en sala.' });
    }
};
//# sourceMappingURL=queue.controller.js.map