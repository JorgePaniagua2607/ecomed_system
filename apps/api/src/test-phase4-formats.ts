import { prisma } from '@ecomed/database';

const BASE_URL = 'http://127.0.0.1:3001/api/v1';

async function fetchJSON(url: string, options?: any) {
  const res = await fetch(url, options);
  const data = await res.json();
  return { status: res.status, ...data };
}

async function runReportFormatTests() {
  console.log('🧪 Iniciando pruebas de Esquemas Posicionales y Plantillas A4 (Fase 4.1 y 4.2)...\n');

  let studyId = '';

  try {
    // 1. Login Admin y crear estudio para vincularle plantilla A4
    const adminLogin = await fetchJSON(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    const token = adminLogin.data.token;

    const studyRes = await fetchJSON(`${BASE_URL}/studies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: 'Ecografía Hepatobiliar Plantilla A4 Test',
        serviceType: 'HACER_ECOGRAFIA',
        reportCategory: 'ECOGRAFIA',
        normalPrice: 180.0,
        promoPrice: 150.0,
      }),
    });

    if (!studyRes.success) throw new Error('No se pudo crear el estudio base para la prueba.');
    studyId = studyRes.data.id;
    console.log(`✅ [1/5] Estudio creado para la prueba: "${studyRes.data.name}" (ID: ${studyId})`);

    // 2. Vincular plantilla A4 inicial (texto estático base + 3 rectángulos posicionales)
    const initialFormatRes = await fetchJSON(`${BASE_URL}/report-formats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        studyServiceId: studyId,
        baseText: 'INFORME ECOGRÁFICO HEPATOBILIAR\nPaciente evaluado en decúbito supino con transductor convexo de 3.5 MHz.',
        fields: [
          {
            id: 'rect-1',
            name: 'fecha_estudio',
            label: 'Fecha del Estudio',
            type: 'date',
            xPercent: 72.5,
            yPercent: 8.0,
            widthPercent: 20.0,
            heightPercent: 4.5,
            fontSize: 10,
          },
          {
            id: 'rect-2',
            name: 'coledoco_mm',
            label: 'Calibre Colédoco (mm)',
            type: 'number',
            xPercent: 10.0,
            yPercent: 25.0,
            widthPercent: 25.0,
            heightPercent: 5.0,
            fontSize: 11,
          },
          {
            id: 'rect-3',
            name: 'hallazgos_higado',
            label: 'Parénquima Hepático y Vías Biliares',
            type: 'textarea',
            xPercent: 10.0,
            yPercent: 33.0,
            widthPercent: 80.0,
            heightPercent: 28.0,
            fontSize: 11,
          },
        ],
      }),
    });

    if (!initialFormatRes.success || initialFormatRes.data.fields.length !== 3) {
      throw new Error(`Falló la vinculación inicial de la plantilla A4: ${JSON.stringify(initialFormatRes)}`);
    }
    console.log(`✅ [2/5] Plantilla A4 vinculada -> ${initialFormatRes.data.fields.length} rectángulos registrados correctamente.`);

    // 3. Probar validación Zod: Rechazar rectángulo que desborda el límite del 100% de la hoja A4
    const overflowRes = await fetchJSON(`${BASE_URL}/report-formats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        studyServiceId: studyId,
        baseText: 'Texto base',
        fields: [
          {
            id: 'rect-overflow',
            name: 'campo_desbordado',
            label: 'Campo Fuera de Hoja A4',
            type: 'text',
            xPercent: 85.0,
            yPercent: 10.0,
            widthPercent: 25.0, // 85 + 25 = 110% (Desborda el 100% de ancho A4)
            heightPercent: 6.0,
            fontSize: 12,
          },
        ],
      }),
    });

    if (overflowRes.status !== 400) {
      throw new Error('El validador Zod permitió guardar un rectángulo que desborda la hoja A4.');
    }
    console.log('✅ [3/5] Protección geométrica Zod verificada -> Rechazado desborde A4 (85% + 25% = 110%) con HTTP 400.');

    // 4. Actualizar plantilla existente (Upsert) simulando edición en react-rnd (añadiendo un 4to bloque de conclusión)
    const updatedFormatRes = await fetchJSON(`${BASE_URL}/report-formats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        studyServiceId: studyId,
        baseText: 'INFORME ECOGRÁFICO HEPATOBILIAR ACTUALIZADO\nProtocolo abdominal superior completo.',
        fields: [
          ...initialFormatRes.data.fields,
          {
            id: 'rect-4',
            name: 'conclusion_diagnostica',
            label: 'Conclusión Diagnóstica',
            type: 'textarea',
            xPercent: 10.0,
            yPercent: 65.0,
            widthPercent: 80.0,
            heightPercent: 18.0,
            fontSize: 12,
          },
        ],
      }),
    });

    if (!updatedFormatRes.success || updatedFormatRes.data.fields.length !== 4) {
      throw new Error('Falló la actualización idempotente (Upsert) de la plantilla A4.');
    }
    console.log(`✅ [4/5] Upsert exitoso sobre el mismo studyServiceId -> Ahora cuenta con ${updatedFormatRes.data.fields.length} rectángulos.`);

    // 5. Consultar la plantilla por studyServiceId (GET /api/v1/report-formats/:studyServiceId)
    const getFormatRes = await fetchJSON(`${BASE_URL}/report-formats/${studyId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (
      !getFormatRes.success ||
      getFormatRes.data.studyServiceId !== studyId ||
      getFormatRes.data.fields[3].name !== 'conclusion_diagnostica'
    ) {
      throw new Error('La consulta GET por studyServiceId no devolvió los datos actualizados.');
    }
    console.log(`✅ [5/5] Consulta GET verificada -> Plantilla recuperada con campo "${getFormatRes.data.fields[3].label}".`);

    console.log('\n🎉 ¡GESTOR DE PLANTILLAS POSICIONALES A4 (FASE 4.1 Y 4.2) COMPLETADO CON ÉXITO! 🎉');
  } catch (error) {
    console.error('\n❌ ERROR EN LAS PRUEBAS DE FORMATOS A4:', error);
  } finally {
    if (studyId) {
      await (prisma as any).reportFormat.deleteMany({ where: { studyServiceId: studyId } }).catch(() => {});
      await prisma.studyService.delete({ where: { id: studyId } }).catch(() => {});
    }
    await prisma.$disconnect();
    console.log('🧹 Limpieza completada.');
  }
}

runReportFormatTests();
