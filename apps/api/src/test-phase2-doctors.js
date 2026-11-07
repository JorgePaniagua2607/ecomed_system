const BASE_URL = 'http://127.0.0.1:3001/api/v1';
async function fetchJSON(url, options) {
    const res = await fetch(url, options);
    const data = await res.json();
    return { status: res.status, ...data };
}
async function runDoctorTests() {
    console.log('🧪 Iniciando pruebas del Módulo de Doctores Asociados (Fase 2.2)...\n');
    try {
        // 1. Login como Administrador
        const adminLogin = await fetchJSON(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'admin123' }),
        });
        if (!adminLogin.success)
            throw new Error('Falló el login del Administrador.');
        const adminToken = adminLogin.data.token;
        console.log('✅ [1/4] Login de Administrador exitoso.');
        // 2. Registrar un Doctor Asociado con comisión fija
        const createRes = await fetchJSON(`${BASE_URL}/doctors`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
                fullName: 'Dra. Valeria Rojas',
                hospitalOrClinic: 'Clínica Los Olivos',
                agreedCommission: 45.50,
                phone: '76543210',
                email: 'valeria.rojas@clinica.bo',
            }),
        });
        if (!createRes.success) {
            console.error('🔍 DETALLE DEL ERROR:', createRes);
            throw new Error('Falló el registro del doctor asociado.');
        }
        const doctorId = createRes.data.id;
        console.log(`✅ [2/4] Doctor Asociado creado: ${createRes.data.fullName} | Clínica: ${createRes.data.hospitalOrClinic} | Comisión Fija: Bs. ${createRes.data.agreedCommission}`);
        // 3. Actualizar la comisión fija acordada
        const updateRes = await fetchJSON(`${BASE_URL}/doctors/${doctorId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({
                agreedCommission: 60.00,
            }),
        });
        if (!updateRes.success || Number(updateRes.data.agreedCommission) !== 60) {
            throw new Error('Falló la actualización de la comisión fija.');
        }
        console.log(`✅ [3/4] Comisión fija actualizada correctamente a: Bs. ${updateRes.data.agreedCommission}`);
        // 4. Listar doctores asociados activos
        const listRes = await fetchJSON(`${BASE_URL}/doctors?active=true`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        if (!listRes.success || !Array.isArray(listRes.data) || listRes.data.length === 0) {
            throw new Error('Falló la consulta del directorio de doctores.');
        }
        console.log(`✅ [4/4] Directorio consultado con éxito (${listRes.data.length} doctor(es) registrado(s)).`);
        // Limpieza
        await fetchJSON(`${BASE_URL}/doctors/${doctorId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${adminToken}` },
        });
        console.log('\n🧹 Limpieza completada: Doctor de prueba eliminado.');
        console.log('\n🎉 ¡MÓDULO DE DOCTORES ASOCIADOS (FASE 2.2) COMPLETADO CON ÉXITO! 🎉');
    }
    catch (error) {
        console.error('\n❌ ERROR EN LAS PRUEBAS DE DOCTORES:', error);
    }
}
runDoctorTests();
export {};
//# sourceMappingURL=test-phase2-doctors.js.map