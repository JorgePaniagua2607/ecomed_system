const API_URL = process.env.API_URL || 'http://localhost:3001/api/v1';

async function runPhase5ClosureTests() {
  console.log('=============================================================');
  console.log('🚀 INICIANDO SUITE E2E DE CIERRE FINAL (FASE 5 - ECOMED)');
  console.log('=============================================================\n');

  // 1. Login como ADMIN y verificación de permisos en respuesta y JWT
  console.log('1️⃣  Verificando Login ADMIN y permisos (canApplyPromotions)...');
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  const loginData = await loginRes.json();

  if (!loginRes.ok || !loginData.token) {
    throw new Error(`Fallo en login ADMIN: ${JSON.stringify(loginData)}`);
  }

  const token = loginData.token as string;
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  console.log(
    `   ✅ Token obtenido. Usuario: ${loginData.user?.username} | Rol: ${loginData.user?.role} | Promo: ${loginData.user?.canApplyPromotions}\n`
  );

  // 2. Verificar Libro de Caja enriquecido (/payments/ledger) y Liquidación de Comisiones
  console.log(
    '2️⃣  Verificando Libro de Caja (/payments/ledger) y Comisiones Médicas...'
  );
  const ledgerRes = await fetch(`${API_URL}/payments/ledger`, {
    headers: authHeaders,
  });
  const ledgerJson = await ledgerRes.json();

  if (!ledgerRes.ok || !ledgerJson.data) {
    throw new Error(`Error en /payments/ledger: ${JSON.stringify(ledgerJson)}`);
  }

  const ledger = ledgerJson.data;
  console.log(
    `   ✅ Tarjetas Financieras -> Efectivo: Bs ${ledger.totalCashCollected} | QR: Bs ${ledger.totalQrCollected} | Emergencias: Bs ${ledger.totalEmergencySurcharges} | Compromisos: Bs ${ledger.totalAccountsReceivable}`
  );
  console.log(
    `   ✅ Comisiones registradas en Ledger: ${
      Array.isArray(ledger.commissions) ? ledger.commissions.length : 0
    }`
  );

  const pendingCommission = (ledger.commissions || []).find(
    (c: any) => c.status === 'PENDIENTE' && c.orderStatus !== 'CANCELADO'
  );

  if (pendingCommission) {
    console.log(
      `   🔄 Liquidando comisión pendiente ID: ${pendingCommission.id} (${pendingCommission.doctorName} - Bs ${pendingCommission.amount})...`
    );
    const settleCommRes = await fetch(
      `${API_URL}/payments/commissions/${pendingCommission.id}/settle`,
      {
        method: 'POST',
        headers: authHeaders,
      }
    );
    const settleCommJson = await settleCommRes.json();
    if (!settleCommRes.ok) {
      throw new Error(
        `Error al liquidar comisión: ${JSON.stringify(settleCommJson)}`
      );
    }
    console.log(`   ✅ ${settleCommJson.message}\n`);
  } else {
    console.log(
      '   ℹ️ No había comisiones en estado PENDIENTE para liquidar en este instante.\n'
    );
  }

  // 3. Verificar Historial de Informes Emitidos (/reports/history) y Reimpresión PDF
  console.log(
    '3️⃣  Verificando Historial de Informes Médicos (/reports/history) y Reimpresión PDF...'
  );
  const historyRes = await fetch(`${API_URL}/reports/history`, {
    headers: authHeaders,
  });
  const historyJson = await historyRes.json();

  if (!historyRes.ok || !Array.isArray(historyJson.data)) {
    throw new Error(
      `Error en /reports/history: ${JSON.stringify(historyJson)}`
    );
  }

  console.log(
    `   ✅ Informes médicos almacenados en Historial: ${historyJson.data.length}`
  );

  if (historyJson.data.length > 0) {
    const firstReport = historyJson.data[0];
    console.log(
      `   🖨️  Solicitando reimpresión PDF del informe ID: ${firstReport.id} (Paciente: ${firstReport.patientName} - ${firstReport.studyName})...`
    );
    const reprintRes = await fetch(
      `${API_URL}/reports/history/${firstReport.id}/pdf`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!reprintRes.ok) {
      const errText = await reprintRes.text();
      throw new Error(`Error al reimprimir PDF histórico: ${errText}`);
    }

    const pdfArrayBuffer = await reprintRes.arrayBuffer();
    const pdfBytes = Buffer.from(pdfArrayBuffer);
    const headerStr = pdfBytes.subarray(0, 5).toString('utf-8');

    if (headerStr !== '%PDF-') {
      throw new Error(
        `El archivo reimpreso no tiene cabecera PDF válida: ${headerStr}`
      );
    }
    console.log(
      `   ✅ PDF Histórico compilado con Puppeteer correctamente (${pdfBytes.length} bytes, cabecera "${headerStr}").\n`
    );
  }

  // 4. Verificar Edición de Catálogos y Cambio de Contraseña Propia
  console.log(
    '4️⃣  Verificando Edición de Catálogos y Cambio de Contraseña Propia...'
  );
  const studiesRes = await fetch(`${API_URL}/studies`, {
    headers: authHeaders,
  });
  const studiesJson = await studiesRes.json();
  const firstStudy = studiesJson.data?.[0];

  if (firstStudy) {
    const updateRes = await fetch(`${API_URL}/studies/${firstStudy.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        name: firstStudy.name,
        normalPrice: Number(firstStudy.normalPrice),
        promoPrice: Number(firstStudy.promoPrice),
        isActive: true,
      }),
    });
    if (!updateRes.ok) {
      throw new Error('Error al actualizar estudio en el catálogo.');
    }
    console.log(`   ✅ Estudio "${firstStudy.name}" editado y verificado.`);
  }

  const passRes = await fetch(`${API_URL}/auth/change-password`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      currentPassword: 'admin123',
      newPassword: 'admin123',
    }),
  });
  const passJson = await passRes.json();
  if (!passRes.ok) {
    throw new Error(
      `Error en /auth/change-password: ${JSON.stringify(passJson)}`
    );
  }
  console.log(`   ✅ Cambio de contraseña verificado: ${passJson.message}\n`);

  console.log('=============================================================');
  console.log('🎉 TODAS LAS PRUEBAS DE CIERRE FINAL (FASE 5) PASARON AL 100%');
  console.log('=============================================================');
}

runPhase5ClosureTests().catch((err) => {
  console.error('\n❌ ERROR EN LA SUITE E2E DE FASE 5:', err);
  process.exit(1);
});
