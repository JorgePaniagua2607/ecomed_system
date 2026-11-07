import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { prisma } from '@ecomed/database';

dotenv.config();

const API_URL = `http://localhost:${process.env.PORT || 3001}/api/v1`;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_ecomed_key';

async function runWorkflowTest() {
  console.log('==============================================================');
  console.log('🧪 TEST E2E: SALA DE ESPERA ➔ INFORME PDF A4 ➔ ORDEN ATENDIDA');
  console.log('==============================================================\n');

  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!adminUser) throw new Error('No existe usuario ADMIN en la base de datos.');

  const token = jwt.sign(
    { id: adminUser.id, userId: adminUser.id, username: adminUser.username, role: adminUser.role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 1. Obtener el estudio con plantilla A4
  const study = await prisma.studyService.findFirst();
  if (!study) throw new Error('No hay estudios registrados.');

  // 2. Crear un paciente de prueba
  console.log('1️⃣ Registrando paciente para atención...');
  const patientRes = await fetch(`${API_URL}/patients`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      fullName: 'María Fernanda Gutiérrez',
      phone: '70712345',
    }),
  });
  const patientJson = await patientRes.json();
  const patientId = patientJson.data?.id || patientJson.id;
  if (!patientId) throw new Error(`No se pudo crear el paciente: ${JSON.stringify(patientJson)}`);
  console.log(`   ✅ Paciente creada (ID: ${patientId})`);

  // 3. Crear orden de servicio (entra en EN_ESPERA)
  console.log('\n2️⃣ Creando orden de servicio en Sala de Espera...');
  const orderRes = await fetch(`${API_URL}/orders`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      patientId,
      studyIds: [study.id],
      origin: 'POR_SU_CUENTA',
      isEmergency: true,
      emergencySurcharge: 50,
      paymentMethod: 'EFECTIVO',
    }),
  });
  const orderJson = await orderRes.json();
  const orderId = orderJson.data?.id || orderJson.id;
  if (!orderId) throw new Error(`Error creando orden: ${JSON.stringify(orderJson)}`);
  console.log(`   ✅ Orden creada en estado EN_ESPERA (ID: ${orderId})`);

  // 4. Generar el informe PDF enviando orderId y completeOrder: true
  console.log('\n3️⃣ Generando PDF A4 con completeOrder = true...');
  const pdfRes = await fetch(`${API_URL}/reports/generate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      studyServiceId: study.id,
      orderId,
      completeOrder: true,
      fieldValues: {
        paciente_nombre: 'PACIENTE: María Fernanda Gutiérrez',
        fecha_estudio: new Date().toLocaleDateString('es-BO'),
        hallazgos_clinicos: 'Estudio de emergencia sin líquido libre en cavidad abdominal.',
        conclusion_diagnostica: 'Ecografía abdominal de urgencia sin hallazgos patológicos agudos.',
      },
    }),
  });

  if (!pdfRes.ok) {
    throw new Error(`Error generando PDF: ${await pdfRes.text()}`);
  }

  const pdfBytes = Buffer.from(await pdfRes.arrayBuffer());
  console.log(`   ✅ PDF compilado correctamente (${pdfBytes.length} bytes).`);

  // 5. Verificar en la BD que la orden pasó a ATENDIDO
  const orderDelegate = (prisma as any).serviceOrder || (prisma as any).order;
  const updatedOrder = await orderDelegate.findUnique({ where: { id: orderId } });

  if (!updatedOrder || updatedOrder.status !== 'ATENDIDO') {
    throw new Error(`Se esperaba estado ATENDIDO, pero se obtuvo: ${updatedOrder?.status}`);
  }

  console.log(`   ✅ Estado final de la orden verificado en BD: ${updatedOrder.status}`);
  console.log('\n🎉 FLUJO COMPLETO DE ECOMED (FASE 1 A FASE 4) VERIFICADO CON ÉXITO.');
}

runWorkflowTest()
  .catch((err) => {
    console.error('\n❌ ERROR EN TEST DE FLUJO:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
