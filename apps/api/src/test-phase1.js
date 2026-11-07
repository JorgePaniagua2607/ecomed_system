import { prisma } from '@ecomed/database';
import bcrypt from 'bcryptjs';
const API_URL = 'http://localhost:3001/api/v1/auth';
async function runTests() {
    console.log('🧪 Iniciando pruebas automáticas de la Fase 1...\n');
    try {
        // 1. Probar que el servidor responda
        const healthRes = await fetch('http://localhost:3001/api/health');
        const health = await healthRes.json();
        console.log(`✅ [1/5] Servidor API responde: "${health.message}"`);
        // 2. Crear usuario PERSONAL simulando que su contraseña es su CI
        const ci = '9876543';
        const passwordHash = await bcrypt.hash(ci, 10);
        await prisma.user.upsert({
            where: { username: 'operador_prueba' },
            update: { passwordHash, ci },
            create: {
                username: 'operador_prueba',
                fullName: 'Operador de Prueba',
                ci: ci,
                phone: '77777777',
                passwordHash,
                role: 'PERSONAL',
            }
        });
        console.log(`✅ [2/5] Usuario PERSONAL creado. (Login: operador_prueba | Clave: ${ci})`);
        // 3. Login inicial con la contraseña por defecto (CI)
        console.log('\n🔄 Realizando Login con Carnet de Identidad (CI)...');
        const loginRes1 = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'operador_prueba', password: ci })
        });
        const loginData1 = await loginRes1.json();
        if (!loginData1.success)
            throw new Error('Fallo el login inicial.');
        console.log(`✅ [3/5] Login exitoso. JWT generado.`);
        console.log(`⚠️  Alerta de cambio de contraseña activada: ${loginData1.data.user.requiresPasswordChange}`);
        if (!loginData1.data.user.requiresPasswordChange) {
            throw new Error('El sistema falló al detectar que se usó el CI como contraseña.');
        }
        const token = loginData1.data.token;
        // 4. Cambiar la contraseña usando el token JWT
        console.log('\n🔄 Consumiendo endpoint protegido por JWT para cambiar contraseña...');
        const newPassword = 'NuevaPasswordSegura123';
        const changeRes = await fetch(`${API_URL}/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ newPassword })
        });
        const changeData = await changeRes.json();
        if (!changeData.success)
            throw new Error('Fallo al cambiar contraseña.');
        console.log(`✅ [4/5] ${changeData.message}`);
        // 5. Login con la NUEVA contraseña
        console.log('\n🔄 Realizando Login con la NUEVA contraseña...');
        const loginRes2 = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'operador_prueba', password: newPassword })
        });
        const loginData2 = await loginRes2.json();
        if (!loginData2.success)
            throw new Error('Fallo el login con la nueva contraseña.');
        console.log(`✅ [5/5] Login exitoso con nueva contraseña.`);
        console.log(`✅ Alerta de cambio de contraseña desactivada: ${!loginData2.data.user.requiresPasswordChange}`);
        if (loginData2.data.user.requiresPasswordChange) {
            throw new Error('El sistema sigue pidiendo cambio de contraseña erróneamente.');
        }
        // 6. Limpieza
        await prisma.user.delete({ where: { username: 'operador_prueba' } });
        console.log('\n🧹 Limpieza de BD: Usuario de prueba eliminado.');
        console.log('\n🎉 ¡TODAS LAS PRUEBAS DE LA FASE 1 PASARON CON ÉXITO! 🎉');
        console.log('El entorno, la BD, Prisma, Turborepo y la Autenticación JWT funcionan perfectamente.');
    }
    catch (error) {
        console.error('\n❌ ERROR EN LAS PRUEBAS:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
runTests();
//# sourceMappingURL=test-phase1.js.map