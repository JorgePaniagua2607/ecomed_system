import { prisma } from '@ecomed/database';
const BASE_URL = 'http://127.0.0.1:3001/api/v1';
async function fetchJSON(url, options) {
    const res = await fetch(url, options);
    const data = await res.json();
    return { status: res.status, ...data };
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function runQueueTests() {
    console.log('🧪 Iniciando pruebas del Monitor de Sala de Espera Reactivo (Fase 3.4)...\n');
    const createdPatientIds = [];
    const createdOrderIds = [];
    let studyId = '';
    try {
        // 1. Login Admin y crear estudio base
        const adminLogin = await fetchJSON(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'admin123' }),
        });
        const token = adminLogin.data.token;
        const sRes = await fetchJSON(`${BASE_URL}/studies`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                name: 'Ecografía Obstétrica Monitor Test',
                serviceType: 'HACER_ECOGRAFIA',
                normalPrice: 150.00,
                promoPrice: 120.00,
            }),
        });
        studyId = sRes.data.id;
        // 2. Registrar 3 pacientes (2 regulares y 1 de emergencia que llegará al final)
        const p1 = await fetchJSON(`${BASE_URL}/patients`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ fullName: '1. Paciente Regular Uno', phone: '70000001' }),
        });
        createdPatientIds.push(p1.data.id);
        const p2 = await fetchJSON(`${BASE_URL}/patients`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ fullName: '2. Paciente Regular Dos', phone: '70000002' }),
        });
        createdPatientIds.push(p2.data.id);
        const p3 = await fetchJSON(`${BASE_URL}/patients`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ fullName: '3. Paciente EMERGENCIA Crítica', phone: '70000003' }),
        });
        createdPatientIds.push(p3.data.id);
        // 3. Crear órdenes en secuencia temporal (Primero Regular 1, luego Regular 2 y por último Emergencia 3)
        const ord1 = await fetchJSON(`${BASE_URL}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                patientId: p1.data.id,
                studyIds: [studyId],
                origin: 'POR_SU_CUENTA',
                paymentMethod: 'EFECTIVO',
            }),
        });
        createdOrderIds.push(ord1.data.id);
        await sleep(50);
        const ord2 = await fetchJSON(`${BASE_URL}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                patientId: p2.data.id,
                studyIds: [studyId],
                origin: 'POR_SU_CUENTA',
                paymentMethod: 'EFECTIVO',
            }),
        });
        createdOrderIds.push(ord2.data.id);
        await sleep(50);
        const ordEmergency = await fetchJSON(`${BASE_URL}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                patientId: p3.data.id,
                studyIds: [studyId],
                origin: 'POR_SU_CUENTA',
                isEmergency: true,
                emergencySurcharge: 80.00,
                paymentMethod: 'EFECTIVO',
            }),
        });
        createdOrderIds.push(ordEmergency.data.id);
        console.log('✅ [1/5] 3 órdenes registradas secuencialmente (2 Regulares primero, 1 Emergencia al final).');
        // 4. Consultar el Monitor y verificar que la Emergencia saltó al Puesto #1
        const monitorRes = await fetchJSON(`${BASE_URL}/queue`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!monitorRes.success)
            throw new Error('Falló la consulta del monitor.');
        const queue = monitorRes.data.waitingQueue;
        const firstInQueue = queue[0];
        if (firstInQueue.orderId !== ordEmergency.data.id || firstInQueue.queuePriority !== 999) {
            throw new Error(`El paciente de emergencia no saltó al primer lugar. Puesto 1 actual: ${firstInQueue.patientName}`);
        }
        console.log(`✅ [2/5] Prioridad 999 verificada -> Puesto #1: "${queue[0].patientName}" | Puesto #2: "${queue[1].patientName}" | Puesto #3: "${queue[2].patientName}"`);
        // 5. Llamar al siguiente paciente (Debe tomar automáticamente la Emergencia y pasarla a EN_ATENCION)
        const callNextRes = await fetchJSON(`${BASE_URL}/queue/call-next`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!callNextRes.success || callNextRes.data.id !== ordEmergency.data.id || callNextRes.data.status !== 'EN_ATENCION') {
            throw new Error('El llamado automático no seleccionó al paciente de emergencia.');
        }
        console.log(`✅ [3/5] Llamado automático exitoso -> "${callNextRes.data.patient.fullName}" pasó a estado: ${callNextRes.data.status}`);
        // 6. Marcar al paciente de emergencia como ATENDIDO
        const completeRes = await fetchJSON(`${BASE_URL}/queue/${ordEmergency.data.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ status: 'ATENDIDO' }),
        });
        if (!completeRes.success || completeRes.data.status !== 'ATENDIDO') {
            throw new Error('Falló el paso a estado ATENDIDO.');
        }
        console.log(`✅ [4/5] Atención finalizada -> Orden marcada como: ${completeRes.data.status}`);
        // 7. Verificar que ahora el Puesto #1 en espera sea el Paciente Regular Uno (FIFO respetado)
        const monitorAfter = await fetchJSON(`${BASE_URL}/queue`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const nextRegular = monitorAfter.data.waitingQueue[0];
        if (nextRegular.orderId !== ord1.data.id) {
            throw new Error('No se respetó el orden de llegada (FIFO) para los pacientes regulares.');
        }
        console.log(`✅ [5/5] Cola actualizada en vivo -> Nuevo Puesto #1: "${nextRegular.patientName}" (${monitorAfter.data.stats.totalWaiting} en espera).`);
        console.log('\n🎉 ¡MONITOR DE SALA DE ESPERA (FASE 3.4) Y TODA LA FASE 3 COMPLETADOS CON ÉXITO! 🎉');
    }
    catch (error) {
        console.error('\n❌ ERROR EN LAS PRUEBAS DE SALA DE ESPERA:', error);
    }
    finally {
        await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
        await prisma.patient.deleteMany({ where: { id: { in: createdPatientIds } } });
        if (studyId)
            await prisma.studyService.delete({ where: { id: studyId } }).catch(() => { });
        await prisma.$disconnect();
        console.log('🧹 Limpieza completada.');
    }
}
runQueueTests();
//# sourceMappingURL=test-phase3-queue.js.map