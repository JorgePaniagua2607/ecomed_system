const BASE_URL = 'http://127.0.0.1:3001/api/v1';
async function fetchJSON(url, options) {
    const res = await fetch(url, options);
    const data = await res.json();
    return { status: res.status, ...data };
}
async function runPatientTests() {
    console.log('🧪 Iniciando pruebas del Registro Ágil de Pacientes (Fase 3.1)...\n');
    try {
        // 1. Login como Administrador
        const adminLogin = await fetchJSON(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'admin123' }),
        });
        if (!adminLogin.success)
            throw new Error('Falló el login del Administrador.');
        const token = adminLogin.data.token;
        console.log('✅ [1/5] Autenticación exitosa.');
        // 2. Registro ágil de paciente (solo Nombre y Teléfono)
        const createRes = await fetchJSON(`${BASE_URL}/patients`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                fullName: 'Carlos Alberto Mamani',
                phone: '71234567',
            }),
        });
        if (!createRes.success)
            throw new Error(`Falló creación de paciente: ${JSON.stringify(createRes)}`);
        const patientId = createRes.data.id;
        console.log(`✅ [2/5] Paciente registrado ágilmente: ${createRes.data.fullName} (Tel: ${createRes.data.phone})`);
        // 3. Búsqueda instantánea por fragmento de apellido (insensible a mayúsculas)
        const searchByName = await fetchJSON(`${BASE_URL}/patients?search=mamani`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!searchByName.success || !searchByName.data.some((p) => p.id === patientId)) {
            throw new Error('Falló la búsqueda ágil por nombre.');
        }
        console.log(`✅ [3/5] Búsqueda por nombre ("mamani") encontró ${searchByName.data.length} coincidencia(s).`);
        // 4. Búsqueda instantánea por número de teléfono
        const searchByPhone = await fetchJSON(`${BASE_URL}/patients?search=712345`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!searchByPhone.success || !searchByPhone.data.some((p) => p.id === patientId)) {
            throw new Error('Falló la búsqueda ágil por teléfono.');
        }
        console.log(`✅ [4/5] Búsqueda por teléfono ("712345") verificada con éxito.`);
        // 5. Actualizar teléfono del paciente
        const updateRes = await fetchJSON(`${BASE_URL}/patients/${patientId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                phone: '69876543',
            }),
        });
        if (!updateRes.success || updateRes.data.phone !== '69876543') {
            throw new Error('Falló la actualización del teléfono del paciente.');
        }
        console.log(`✅ [5/5] Teléfono actualizado correctamente a: ${updateRes.data.phone}`);
        // Limpieza
        await fetchJSON(`${BASE_URL}/patients/${patientId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        });
        console.log('\n🧹 Limpieza completada: Paciente de prueba eliminado.');
        console.log('\n🎉 ¡REGISTRO ÁGIL DE PACIENTES (FASE 3.1) COMPLETADO CON ÉXITO! 🎉');
    }
    catch (error) {
        console.error('\n❌ ERROR EN LAS PRUEBAS DE PACIENTES:', error);
    }
}
runPatientTests();
export {};
//# sourceMappingURL=test-phase3-patients.js.map