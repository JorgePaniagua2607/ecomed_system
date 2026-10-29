import { prisma } from '@ecomed/database';

const BASE_URL = 'http://127.0.0.1:3001/api/v1';

async function fetchJSON(url: string, options?: any) {
  const res = await fetch(url, options);
  const data = await res.json();
  return { status: res.status, ...data };
}

async function runOrderTests() {
  console.log('🧪 Iniciando pruebas del Creador de Órdenes (Fase 3.2)...\n');

  let patientId = '';
  let doctorId = '';
  let study1Id = '';
  let study2Id = '';
  let staffNoPromoId = '';
  let staffWithPromoId = '';
  const createdOrderIds: string[] = [];

  try {
    // 1. Login Admin
    const adminLogin = await fetchJSON(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    if (!adminLogin.success) throw new Error('Falló login Admin');
    const adminToken = adminLogin.data.token;

    // 2. Preparar datos de prueba (Paciente, Doctor, 2 Estudios y 2 Operadores)
    const patientRes = await fetchJSON(`${BASE_URL}/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ fullName: 'Paciente Orden Prueba', phone: '70099887' }),
    });
    patientId = patientRes.data.id;

    const doctorRes = await fetchJSON(`${BASE_URL}/doctors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        fullName: 'Dr. Derivador Prueba',
        hospitalOrClinic: 'Hospital Viedma',
        agreedCommission: 50.00,
        phone: '71122334',
      }),
    });
    doctorId = doctorRes.data.id;

    const s1 = await fetchJSON(`${BASE_URL}/studies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: 'Ecografía Renal Test',
        serviceType: 'HACER_ECOGRAFIA',
        normalPrice: 150.00,
        promoPrice: 120.00,
      }),
    });
    study1Id = s1.data.id;

    const s2 = await fetchJSON(`${BASE_URL}/studies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: 'Ecografía Hepatobiliar Test',
        serviceType: 'HACER_ECOGRAFIA',
        normalPrice: 200.00,
        promoPrice: 160.00,
      }),
    });
    study2Id = s2.data.id;

    const op1 = await fetchJSON(`${BASE_URL}/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        username: 'op_sin_promo',
        fullName: 'Operador Sin Promo',
        ci: '5551111',
        phone: '70001111',
        canApplyPromotions: false,
      }),
    });
    staffNoPromoId = op1.data.id;

    const op2 = await fetchJSON(`${BASE_URL}/staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        username: 'op_con_promo',
        fullName: 'Operador Con Promo',
        ci: '5552222',
        phone: '70002222',
        canApplyPromotions: true,
      }),
    });
    staffWithPromoId = op2.data.id;

    console.log('✅ [1/5] Entorno preparado: Paciente, Doctor (Comisión Bs. 50), 2 Estudios y 2 Operadores.');

    // 3. Probar candado de Promoción: Operador SIN permiso intenta crear orden PROMOCION (Debe dar 403)
    const loginNoPromo = await fetchJSON(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'op_sin_promo', password: '5551111' }),
    });

    const forbiddenPromoRes = await fetchJSON(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginNoPromo.data.token}` },
      body: JSON.stringify({
        patientId,
        studyIds: [study1Id, study2Id],
        origin: 'PROMOCION',
        paymentMethod: 'EFECTIVO',
      }),
    });

    if (forbiddenPromoRes.status !== 403) {
      throw new Error(`Fallo de privilegios: Se esperaba 403 y se recibió ${forbiddenPromoRes.status}`);
    }
    console.log('✅ [2/5] Candado canApplyPromotions verificado: Operador sin privilegio bloqueado (HTTP 403).');

    // 4. Operador CON permiso crea orden PROMOCION con 2 estudios (120 + 160 = Bs. 280)
    const loginWithPromo = await fetchJSON(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'op_con_promo', password: '5552222' }),
    });

    const promoOrderRes = await fetchJSON(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginWithPromo.data.token}` },
      body: JSON.stringify({
        patientId,
        studyIds: [study1Id, study2Id],
        origin: 'PROMOCION',
        paymentMethod: 'EFECTIVO',
      }),
    });

    if (!promoOrderRes.success || Number(promoOrderRes.data.totalAmount) !== 280) {
      throw new Error(`Cálculo promocional incorrecto: ${JSON.stringify(promoOrderRes)}`);
    }
    createdOrderIds.push(promoOrderRes.data.id);
    console.log(`✅ [3/5] Orden Promocional creada con múltiples estudios -> Total Promo: Bs. ${promoOrderRes.data.totalAmount} (120 + 160).`);

    // 5. Crear orden por RECOMENDACION + EMERGENCIA (Precios normales: 150 + 200 = 350 + Recargo 70 = Bs. 420)
    const emergencyOrderRes = await fetchJSON(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginNoPromo.data.token}` },
      body: JSON.stringify({
        patientId,
        studyIds: [study1Id, study2Id],
        origin: 'RECOMENDACION',
        associatedDoctorId: doctorId,
        isEmergency: true,
        emergencySurcharge: 70.00,
        paymentMethod: 'QR',
      }),
    });

    if (!emergencyOrderRes.success) {
      throw new Error(`Falló creación de orden de emergencia: ${JSON.stringify(emergencyOrderRes)}`);
    }

    const ord = emergencyOrderRes.data;
    createdOrderIds.push(ord.id);

    if (Number(ord.subtotalStudies) !== 350 || Number(ord.totalAmount) !== 420 || ord.queuePriority !== 999) {
      throw new Error('Los cálculos de emergencia o la prioridad 999 fallaron.');
    }
    console.log(`✅ [4/5] Orden de Emergencia verificada -> Subtotal: Bs. ${ord.subtotalStudies} | Recargo: Bs. ${ord.emergencySurcharge} | Total: Bs. ${ord.totalAmount} | Prioridad: ${ord.queuePriority}`);

    if (!ord.commission || Number(ord.commission.amount) !== 50 || ord.commission.status !== 'PENDIENTE') {
      throw new Error('No se generó correctamente la comisión automática del Doctor Asociado.');
    }
    console.log(`✅ [5/5] Comisión automática vinculada -> Doctor: ${ord.associatedDoctor.fullName} | Monto: Bs. ${ord.commission.amount} | Estado: ${ord.commission.status}`);

    console.log('\n🎉 ¡CREADOR DE ÓRDENES (FASE 3.2) COMPLETADO CON ÉXITO! 🎉');
  } catch (error) {
    console.error('\n❌ ERROR EN LAS PRUEBAS DE ÓRDENES:', error);
  } finally {
    // Limpieza en orden relacional
    await prisma.doctorCommission.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    if (patientId) await prisma.patient.delete({ where: { id: patientId } }).catch(() => {});
    if (doctorId) await prisma.associatedDoctor.delete({ where: { id: doctorId } }).catch(() => {});
    if (study1Id) await prisma.studyService.delete({ where: { id: study1Id } }).catch(() => {});
    if (study2Id) await prisma.studyService.delete({ where: { id: study2Id } }).catch(() => {});
    if (staffNoPromoId) await prisma.user.delete({ where: { id: staffNoPromoId } }).catch(() => {});
    if (staffWithPromoId) await prisma.user.delete({ where: { id: staffWithPromoId } }).catch(() => {});
    await prisma.$disconnect();
    console.log('🧹 Limpieza completada.');
  }
}

runOrderTests();
