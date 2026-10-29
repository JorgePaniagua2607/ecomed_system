const BASE_URL = 'http://127.0.0.1:3001/api/v1';

async function fetchJSON(url: string, options?: any) {
  const res = await fetch(url, options);
  const data = await res.json();
  return { status: res.status, ...data };
}

async function runStaffTests() {
  console.log('🧪 Iniciando pruebas del Módulo de Gestión de Personal (Fase 2.1)...\n');

  try {
    // 1. Iniciar sesión como ADMIN
    const adminLogin = await fetchJSON(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });

    if (!adminLogin.success) {
      console.error('\n🔍 DETALLE DEL RECHAZO (LOGIN ADMIN):', adminLogin);
      throw new Error('El backend rechazó las credenciales del Administrador.');
    }
    
    const adminToken = adminLogin.data.token;
    console.log('✅ [1/5] Login de Administrador exitoso.');

    // 2. Crear un nuevo miembro del Personal
    const createRes = await fetchJSON(`${BASE_URL}/staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        username: 'ecografista_juan',
        fullName: 'Dr. Juan Pérez',
        ci: '8899001',
        phone: '70011223',
        email: 'juan.perez@ecomed.bo',
        shift: 'TARDE',
        canApplyPromotions: false,
      }),
    });

    if (!createRes.success) {
      console.error('\n🔍 DETALLE DEL RECHAZO (CREAR PERSONAL):', createRes);
      throw new Error('Falló la creación de personal.');
    }
    
    const staffId = createRes.data.id;
    console.log(`✅ [2/5] Personal creado: ${createRes.data.fullName} | Turno: ${createRes.data.shift}`);

    // 3. Verificar login automático con CI
    const staffLogin = await fetchJSON(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'ecografista_juan', password: '8899001' }),
    });

    if (!staffLogin.success || !staffLogin.data.user.requiresPasswordChange) {
      console.error('\n🔍 DETALLE DEL RECHAZO (LOGIN PERSONAL):', staffLogin);
      throw new Error('Falló la validación de contraseña inicial por CI.');
    }
    const staffToken = staffLogin.data.token;
    console.log('✅ [3/5] El nuevo personal pudo iniciar sesión con su CI.');

    // 4. Verificar bloqueo de seguridad (403 Forbidden)
    const forbiddenCheck = await fetchJSON(`${BASE_URL}/staff`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });

    if (forbiddenCheck.status !== 403) {
      throw new Error(`Fallo de seguridad: Se esperaba estado 403, pero dio ${forbiddenCheck.status}`);
    }
    console.log('✅ [4/5] Seguridad RBAC verificada: El rol PERSONAL recibe HTTP 403 al intentar administrar.');

    // 5. Admin actualiza turno del personal
    const updateRes = await fetchJSON(`${BASE_URL}/staff/${staffId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        shift: 'ROTATIVO',
        canApplyPromotions: true,
      }),
    });

    if (!updateRes.success) {
      console.error('\n🔍 DETALLE DEL RECHAZO (ACTUALIZAR PERSONAL):', updateRes);
      throw new Error('Falló actualización de privilegios.');
    }
    
    console.log(`✅ [5/5] Privilegios actualizados por Admin (Turno: ${updateRes.data.shift}).`);

    // Limpieza
    await fetchJSON(`${BASE_URL}/staff/${staffId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.log('\n🧹 Limpieza completada: Personal de prueba eliminado.');
    console.log('\n🎉 ¡MÓDULO DE GESTIÓN DE PERSONAL (FASE 2.1) COMPLETADO CON ÉXITO! 🎉');
  } catch (error) {
    console.error('\n❌ ERROR EN LAS PRUEBAS DE PERSONAL:', error);
  }
}

runStaffTests();
