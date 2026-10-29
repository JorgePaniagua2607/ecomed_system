const BASE_URL = 'http://127.0.0.1:3001/api/v1';

async function fetchJSON(url: string, options?: any) {
  const res = await fetch(url, options);
  const data = await res.json();
  return { status: res.status, ...data };
}

async function runStudyTests() {
  console.log('🧪 Iniciando pruebas del Gestor del Catálogo de Estudios (Fase 2.3)...\n');

  try {
    // 1. Login como Administrador
    const adminLogin = await fetchJSON(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });

    if (!adminLogin.success) throw new Error('Falló el login del Administrador.');
    const adminToken = adminLogin.data.token;
    console.log('✅ [1/6] Login de Administrador exitoso.');

    // 2. Crear un estudio físico ("Hacer Ecografía")
    const ecoRes = await fetchJSON(`${BASE_URL}/studies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Ecografía Abdominal Completa',
        serviceType: 'HACER_ECOGRAFIA',
        normalPrice: 150.00,
        promoPrice: 120.00,
      }),
    });

    if (!ecoRes.success) throw new Error(`Falló creación de Ecografía: ${JSON.stringify(ecoRes)}`);
    const ecoId = ecoRes.data.id;
    console.log(`✅ [2/6] Estudio físico creado: ${ecoRes.data.name} | Normal: Bs. ${ecoRes.data.normalPrice} | Promo: Bs. ${ecoRes.data.promoPrice}`);

    // 3. Crear un servicio de interpretación ("Solo Informe" - Tomografía)
    const reportRes = await fetchJSON(`${BASE_URL}/studies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Informe de Tomografía Cerebral Simple',
        serviceType: 'SOLO_INFORME',
        reportCategory: 'TOMOGRAFIA',
        normalPrice: 100.00,
        promoPrice: 80.00,
      }),
    });

    if (!reportRes.success) throw new Error(`Falló creación de Solo Informe: ${JSON.stringify(reportRes)}`);
    const reportId = reportRes.data.id;
    console.log(`✅ [3/6] Servicio "Solo Informe" creado: ${reportRes.data.name} (${reportRes.data.reportCategory})`);

    // 4. Probar regla de negocio: Rechazar si precio promocional > precio normal
    const invalidPriceRes = await fetchJSON(`${BASE_URL}/studies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Estudio Mal Configurado',
        serviceType: 'HACER_ECOGRAFIA',
        normalPrice: 100.00,
        promoPrice: 180.00,
      }),
    });

    if (invalidPriceRes.status !== 400) {
      throw new Error('El sistema permitió un precio promocional mayor al precio normal.');
    }
    console.log('✅ [4/6] Regla financiera verificada: Se bloquean precios promocionales mayores al normal.');

    // 5. Actualizar precios de un estudio existente
    const updateRes = await fetchJSON(`${BASE_URL}/studies/${ecoId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        normalPrice: 160.00,
        promoPrice: 130.00,
      }),
    });

    if (!updateRes.success || Number(updateRes.data.normalPrice) !== 160) {
      throw new Error('Falló la actualización de precios del estudio.');
    }
    console.log(`✅ [5/6] Tarifas actualizadas -> Normal: Bs. ${updateRes.data.normalPrice} | Promo: Bs. ${updateRes.data.promoPrice}`);

    // 6. Filtrar catálogo por tipo de servicio (SOLO_INFORME)
    const filterRes = await fetchJSON(`${BASE_URL}/studies?serviceType=SOLO_INFORME`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    if (!filterRes.success || !filterRes.data.some((s: any) => s.id === reportId)) {
      throw new Error('Falló el filtrado por tipo de servicio.');
    }
    console.log(`✅ [6/6] Filtrado dual verificado (${filterRes.data.length} estudio(s) bajo SOLO_INFORME).`);

    // Limpieza
    await fetchJSON(`${BASE_URL}/studies/${ecoId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    await fetchJSON(`${BASE_URL}/studies/${reportId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.log('\n🧹 Limpieza completada: Estudios de prueba eliminados.');
    console.log('\n🎉 ¡CATÁLOGO DE ESTUDIOS (FASE 2.3) Y TODA LA FASE 2 COMPLETADOS CON ÉXITO! 🎉');
  } catch (error) {
    console.error('\n❌ ERROR EN LAS PRUEBAS DE ESTUDIOS:', error);
  }
}

runStudyTests();
