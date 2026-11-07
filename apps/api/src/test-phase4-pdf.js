import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { prisma } from '@ecomed/database';
dotenv.config();
const API_URL = `http://localhost:${process.env.PORT || 3001}/api/v1`;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_ecomed_key';
async function runPhase4PdfTest() {
    console.log('====================================================');
    console.log('🧪 INICIANDO TEST FASE 4.3: MOTOR DE RENDERIZADO PDF');
    console.log('====================================================\n');
    // 1. Obtener un usuario ADMIN para firmar un token JWT válido
    const adminUser = await prisma.user.findFirst({
        where: { role: 'ADMIN' },
    });
    if (!adminUser) {
        throw new Error('No se encontró un usuario ADMIN en la BD. Ejecuta el seed primero.');
    }
    const token = jwt.sign({ id: adminUser.id, userId: adminUser.id, username: adminUser.username, role: adminUser.role }, JWT_SECRET, { expiresIn: '1h' });
    // 2. Obtener o crear un estudio de prueba
    let study = await prisma.studyService.findFirst();
    if (!study) {
        study = await prisma.studyService.create({
            data: {
                name: 'Ecografía Abdominal Completa',
                serviceType: 'HACER_ECOGRAFIA',
                reportCategory: 'ECOGRAFIA',
                normalPrice: 150,
                promoPrice: 120,
            },
        });
    }
    // 3. Guardar/actualizar plantilla A4 usando el endpoint PUT /api/v1/report-formats/:studyServiceId
    const templatePayload = {
        studyServiceId: study.id,
        baseText: `<div style="border-bottom: 2px solid #0284c7; padding-bottom: 8px;">
  <h2 style="margin: 0; color: #0369a1;">CENTRO DE DIAGNÓSTICO ECOMED</h2>
  <small style="color: #4b5563;">Informe Ecográfico de Alta Resolución - Formato A4</small>
</div>`,
        fields: [
            {
                id: 'rect_paciente',
                name: 'paciente_nombre',
                label: 'Nombre del Paciente',
                type: 'text',
                xPercent: 8,
                yPercent: 14,
                widthPercent: 55,
                heightPercent: 4,
                fontSize: 11,
            },
            {
                id: 'rect_fecha',
                name: 'fecha_estudio',
                label: 'Fecha del Estudio',
                type: 'date',
                xPercent: 68,
                yPercent: 14,
                widthPercent: 24,
                heightPercent: 4,
                fontSize: 11,
            },
            {
                id: 'rect_hallazgos',
                name: 'hallazgos_clinicos',
                label: 'Hallazgos Ecográficos',
                type: 'textarea',
                xPercent: 8,
                yPercent: 22,
                widthPercent: 84,
                heightPercent: 45,
                fontSize: 11,
            },
            {
                id: 'rect_conclusion',
                name: 'conclusion_diagnostica',
                label: 'Conclusión Diagnóstica',
                type: 'textarea',
                xPercent: 8,
                yPercent: 72,
                widthPercent: 84,
                heightPercent: 15,
                fontSize: 12,
            },
        ],
    };
    console.log(`1️⃣ Configurando plantilla A4 para el estudio: "${study.name}"...`);
    const upsertRes = await fetch(`${API_URL}/report-formats/${study.id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(templatePayload),
    });
    const upsertJson = await upsertRes.json();
    if (!upsertRes.ok || !upsertJson.success) {
        throw new Error(`Error guardando plantilla A4: ${JSON.stringify(upsertJson)}`);
    }
    console.log('   ✅ Plantilla guardada correctamente.');
    // 4. Solicitar la generación del PDF enviando los valores llenados por el médico
    console.log('\n2️⃣ Solicitando generación de PDF en POST /api/v1/reports/generate...');
    const pdfRes = await fetch(`${API_URL}/reports/generate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            studyServiceId: study.id,
            fieldValues: {
                paciente_nombre: 'PACIENTE: Carlos Eduardo Rojas Vargas (Edad: 38 años)',
                fecha_estudio: `FECHA: ${new Date().toLocaleDateString('es-BO')}`,
                hallazgos_clinicos: 'HÍGADO: Tamaño y morfología conservada. Parénquima homogéneo sin lesiones focales.\n\n' +
                    'VESÍCULA BILIAR: Distendida, pared fina (< 3 mm), alitiásica.\n\n' +
                    'VÍA BILIAR: Intra y extrahepática no dilatada. Colédoco < 4 mm.\n\n' +
                    'PÁNCREAS Y BAZO: Ecoestructura conservada, dimensiones normales.',
                conclusion_diagnostica: 'CONCLUSIÓN: Estudio ecográfico abdominal dentro de parámetros normales.',
            },
        }),
    });
    if (!pdfRes.ok) {
        const errText = await pdfRes.text();
        throw new Error(`Fallo generando PDF (HTTP ${pdfRes.status}): ${errText}`);
    }
    const contentType = pdfRes.headers.get('content-type') || '';
    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
    const pdfHeader = pdfBuffer.subarray(0, 5).toString('ascii');
    if (!contentType.includes('application/pdf') || pdfHeader !== '%PDF-') {
        throw new Error(`Respuesta inválida. Content-Type: ${contentType}, Header: ${pdfHeader}`);
    }
    const outFile = path.resolve(process.cwd(), 'test-informe-a4.pdf');
    fs.writeFileSync(outFile, pdfBuffer);
    console.log(`   ✅ PDF A4 generado exitosamente (${pdfBuffer.length} bytes).`);
    console.log(`   📄 Archivo guardado en: ${outFile}`);
    console.log('\n🎉 TEST FASE 4.3 COMPLETADO CON ÉXITO.');
}
runPhase4PdfTest()
    .catch((error) => {
    console.error('\n❌ ERROR EN LA PRUEBA DE FASE 4.3:', error);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=test-phase4-pdf.js.map