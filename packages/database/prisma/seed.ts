import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const CLINIC_HEADER_HTML = `<div style="border-bottom: 2px solid #0284c7; padding-bottom: 10px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
  <div>
    <h1 style="margin: 0; font-size: 18pt; color: #0369a1; letter-spacing: 0.5px;">CLÍNICA ECOMED</h1>
    <p style="margin: 2px 0 0 0; font-size: 9.5pt; color: #475569;">Centro Especializado en Ecografía, Doppler y Tomografía Multicorte</p>
  </div>
  <div style="text-align: right; font-size: 8.5pt; color: #64748b;">
    <div>Av. América esq. Libertador · Cochabamba, Bolivia</div>
    <div>Telfs: 4-4455667 · Cel: 70712345</div>
  </div>
</div>`;

async function main() {
  console.log('🌱 Iniciando semilla de demostración completa ECOMED...');

  // Limpiar estados EN_ESPERA / EN_ATENCION residuales para no interferir con test-phase3-queue
  await prisma.order.updateMany({
    where: { status: { in: ['EN_ESPERA', 'EN_ATENCION'] } },
    data: { status: 'ATENDIDO' },
  });

  // 1. USUARIOS DEL SISTEMA (ADMIN y PERSONAL)
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const staff1PasswordHash = await bcrypt.hash('7894561', 10);
  const staff2PasswordHash = await bcrypt.hash('8521479', 10);

  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      fullName: 'Dr. Jorge Luis Administrador',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      shift: 'MANANA',
      canApplyPromotions: true,
      isActive: true,
    },
    create: {
      username: 'admin',
      fullName: 'Dr. Jorge Luis Administrador',
      ci: '1002003',
      phone: '70700001',
      email: 'admin@ecomed.bo',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      shift: 'MANANA',
      canApplyPromotions: true,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { username: 'recepcion_ma' },
    update: {
      fullName: 'Lic. Valeria Méndez (Recepción Mañana)',
      passwordHash: staff1PasswordHash,
      role: 'PERSONAL',
      shift: 'MANANA',
      canApplyPromotions: true,
      isActive: true,
    },
    create: {
      username: 'recepcion_ma',
      fullName: 'Lic. Valeria Méndez (Recepción Mañana)',
      ci: '7894561',
      phone: '71722334',
      email: 'valeria@ecomed.bo',
      passwordHash: staff1PasswordHash,
      role: 'PERSONAL',
      shift: 'MANANA',
      canApplyPromotions: true,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: { username: 'recepcion_ta' },
    update: {
      fullName: 'Sr. Marco Antonio Rojas (Recepción Tarde)',
      passwordHash: staff2PasswordHash,
      role: 'PERSONAL',
      shift: 'TARDE',
      canApplyPromotions: false,
      isActive: true,
    },
    create: {
      username: 'recepcion_ta',
      fullName: 'Sr. Marco Antonio Rojas (Recepción Tarde)',
      ci: '8521479',
      phone: '72288990',
      email: 'marco@ecomed.bo',
      passwordHash: staff2PasswordHash,
      role: 'PERSONAL',
      shift: 'TARDE',
      canApplyPromotions: false,
      isActive: true,
    },
  });

  // 2. DOCTORES ASOCIADOS
  const doctor1 = await prisma.associatedDoctor.upsert({
    where: { id: 'seed-doc-1' },
    update: {
      fullName: 'Dr. Carlos Alberto Villarroel',
      hospitalOrClinic: 'Hospital Viedma',
      agreedCommission: 40.0,
      phone: '70744556',
      email: 'cvillarroel@med.bo',
      isActive: true,
    },
    create: {
      id: 'seed-doc-1',
      fullName: 'Dr. Carlos Alberto Villarroel',
      hospitalOrClinic: 'Hospital Viedma',
      agreedCommission: 40.0,
      phone: '70744556',
      email: 'cvillarroel@med.bo',
      isActive: true,
    },
  });

  const doctor2 = await prisma.associatedDoctor.upsert({
    where: { id: 'seed-doc-2' },
    update: {
      fullName: 'Dra. Patricia Camacho Guzmán',
      hospitalOrClinic: 'Clínica Los Olivos',
      agreedCommission: 50.0,
      phone: '76411223',
      email: 'pcamacho@olivos.bo',
      isActive: true,
    },
    create: {
      id: 'seed-doc-2',
      fullName: 'Dra. Patricia Camacho Guzmán',
      hospitalOrClinic: 'Clínica Los Olivos',
      agreedCommission: 50.0,
      phone: '76411223',
      email: 'pcamacho@olivos.bo',
      isActive: true,
    },
  });

  await prisma.associatedDoctor.upsert({
    where: { id: 'seed-doc-3' },
    update: {
      fullName: 'Dr. Fernando Laredo Solíz',
      hospitalOrClinic: 'Seguro Universitario UMSS',
      agreedCommission: 35.0,
      phone: '79788112',
      email: 'flaredo@ssu.bo',
      isActive: true,
    },
    create: {
      id: 'seed-doc-3',
      fullName: 'Dr. Fernando Laredo Solíz',
      hospitalOrClinic: 'Seguro Universitario UMSS',
      agreedCommission: 35.0,
      phone: '79788112',
      email: 'flaredo@ssu.bo',
      isActive: true,
    },
  });

  // 3. CATÁLOGO DE ESTUDIOS + PLANTILLAS A4
  const studiesCatalog = [
    {
      id: 'seed-study-eco-abd',
      name: 'Ecografía Abdominal Completa',
      serviceType: 'HACER_ECOGRAFIA' as const,
      reportCategory: 'ECOGRAFIA' as const,
      normalPrice: 180.0,
      promoPrice: 150.0,
      fields: [
        {
          id: 'rect_paciente',
          name: 'paciente_nombre',
          label: 'Nombre del Paciente',
          type: 'text',
          xPercent: 8,
          yPercent: 14,
          widthPercent: 55,
          heightPercent: 4.5,
          fontSize: 11,
        },
        {
          id: 'rect_fecha',
          name: 'fecha_estudio',
          label: 'Fecha de Estudio',
          type: 'date',
          xPercent: 66,
          yPercent: 14,
          widthPercent: 26,
          heightPercent: 4.5,
          fontSize: 11,
        },
        {
          id: 'rect_higado',
          name: 'hallazgos_higado_vesicula',
          label: 'Hígado, Vesícula y Vías Biliares',
          type: 'textarea',
          xPercent: 8,
          yPercent: 22,
          widthPercent: 84,
          heightPercent: 22,
          fontSize: 11,
        },
        {
          id: 'rect_pancreas_bazo',
          name: 'hallazgos_pancreas_bazo_rinones',
          label: 'Páncreas, Bazo y Riñones Bilaterales',
          type: 'textarea',
          xPercent: 8,
          yPercent: 47,
          widthPercent: 84,
          heightPercent: 22,
          fontSize: 11,
        },
        {
          id: 'rect_conclusion',
          name: 'conclusion_diagnostica',
          label: 'Conclusión Ecográfica',
          type: 'textarea',
          xPercent: 8,
          yPercent: 72,
          widthPercent: 84,
          heightPercent: 14,
          fontSize: 12,
        },
      ],
    },
    {
      id: 'seed-study-eco-obs',
      name: 'Ecografía Obstétrica Doppler Fetal',
      serviceType: 'HACER_ECOGRAFIA' as const,
      reportCategory: 'ECOGRAFIA' as const,
      normalPrice: 240.0,
      promoPrice: 200.0,
      fields: [
        {
          id: 'rect_obs_pac',
          name: 'paciente_nombre',
          label: 'Paciente Gestante',
          type: 'text',
          xPercent: 8,
          yPercent: 14,
          widthPercent: 55,
          heightPercent: 4.5,
          fontSize: 11,
        },
        {
          id: 'rect_obs_fecha',
          name: 'fecha_estudio',
          label: 'Fecha',
          type: 'date',
          xPercent: 66,
          yPercent: 14,
          widthPercent: 26,
          heightPercent: 4.5,
          fontSize: 11,
        },
        {
          id: 'rect_obs_fcf',
          name: 'frecuencia_cardiaca_fetal',
          label: 'FCF (latidos/min)',
          type: 'number',
          xPercent: 8,
          yPercent: 21,
          widthPercent: 35,
          heightPercent: 4.5,
          fontSize: 11,
        },
        {
          id: 'rect_obs_biometria',
          name: 'biometria_fetal',
          label: 'Biometría Fetal (DBP, CC, CA, LF) y Placenta',
          type: 'textarea',
          xPercent: 8,
          yPercent: 28,
          widthPercent: 84,
          heightPercent: 30,
          fontSize: 11,
        },
        {
          id: 'rect_obs_conclusion',
          name: 'conclusion_obstetrica',
          label: 'Diagnóstico Gestacional',
          type: 'textarea',
          xPercent: 8,
          yPercent: 62,
          widthPercent: 84,
          heightPercent: 16,
          fontSize: 12,
        },
      ],
    },
    {
      id: 'seed-study-eco-ren',
      name: 'Ecografía Renal, Vesical y Prostática',
      serviceType: 'HACER_ECOGRAFIA' as const,
      reportCategory: 'ECOGRAFIA' as const,
      normalPrice: 170.0,
      promoPrice: 140.0,
      fields: [
        {
          id: 'rect_ren_pac',
          name: 'paciente_nombre',
          label: 'Paciente',
          type: 'text',
          xPercent: 8,
          yPercent: 14,
          widthPercent: 55,
          heightPercent: 4.5,
          fontSize: 11,
        },
        {
          id: 'rect_ren_fecha',
          name: 'fecha_estudio',
          label: 'Fecha',
          type: 'date',
          xPercent: 66,
          yPercent: 14,
          widthPercent: 26,
          heightPercent: 4.5,
          fontSize: 11,
        },
        {
          id: 'rect_ren_hallazgos',
          name: 'descripcion_renal_vesical',
          label: 'Parénquima Renal Bilateral, Vejiga y Volumen Prostático',
          type: 'textarea',
          xPercent: 8,
          yPercent: 22,
          widthPercent: 84,
          heightPercent: 38,
          fontSize: 11,
        },
        {
          id: 'rect_ren_conc',
          name: 'conclusion_renal',
          label: 'Impresión Diagnóstica',
          type: 'textarea',
          xPercent: 8,
          yPercent: 64,
          widthPercent: 84,
          heightPercent: 16,
          fontSize: 12,
        },
      ],
    },
    {
      id: 'seed-study-tac-cra',
      name: 'Tomografía Axial Computarizada (TAC) de Cráneo Simple',
      serviceType: 'SOLO_INFORME' as const,
      reportCategory: 'TOMOGRAFIA' as const,
      normalPrice: 350.0,
      promoPrice: 300.0,
      fields: [
        {
          id: 'rect_tac_pac',
          name: 'paciente_nombre',
          label: 'Paciente',
          type: 'text',
          xPercent: 8,
          yPercent: 14,
          widthPercent: 55,
          heightPercent: 4.5,
          fontSize: 11,
        },
        {
          id: 'rect_tac_fecha',
          name: 'fecha_estudio',
          label: 'Fecha de Lectura',
          type: 'date',
          xPercent: 66,
          yPercent: 14,
          widthPercent: 26,
          heightPercent: 4.5,
          fontSize: 11,
        },
        {
          id: 'rect_tac_parenquima',
          name: 'hallazgos_tomograficos',
          label: 'Descripción Tomográfica Encefálica y Sistema Ventricular',
          type: 'textarea',
          xPercent: 8,
          yPercent: 22,
          widthPercent: 84,
          heightPercent: 40,
          fontSize: 11,
        },
        {
          id: 'rect_tac_conclusion',
          name: 'conclusion_tomografica',
          label: 'Conclusión Tomográfica',
          type: 'textarea',
          xPercent: 8,
          yPercent: 65,
          widthPercent: 84,
          heightPercent: 16,
          fontSize: 12,
        },
      ],
    },
    {
      id: 'seed-study-tac-tor',
      name: 'Tomografía de Tórax de Alta Resolución (TACAR)',
      serviceType: 'SOLO_INFORME' as const,
      reportCategory: 'TOMOGRAFIA' as const,
      normalPrice: 420.0,
      promoPrice: 360.0,
      fields: [
        {
          id: 'rect_tor_pac',
          name: 'paciente_nombre',
          label: 'Paciente',
          type: 'text',
          xPercent: 8,
          yPercent: 14,
          widthPercent: 55,
          heightPercent: 4.5,
          fontSize: 11,
        },
        {
          id: 'rect_tor_fecha',
          name: 'fecha_estudio',
          label: 'Fecha',
          type: 'date',
          xPercent: 66,
          yPercent: 14,
          widthPercent: 26,
          heightPercent: 4.5,
          fontSize: 11,
        },
        {
          id: 'rect_tor_campos',
          name: 'ventana_pulmonar_mediastino',
          label: 'Ventana Pulmonar, Mediastino y Cavidad Pleural',
          type: 'textarea',
          xPercent: 8,
          yPercent: 22,
          widthPercent: 84,
          heightPercent: 40,
          fontSize: 11,
        },
        {
          id: 'rect_tor_conc',
          name: 'conclusion_tacar',
          label: 'Conclusión TACAR',
          type: 'textarea',
          xPercent: 8,
          yPercent: 65,
          widthPercent: 84,
          heightPercent: 16,
          fontSize: 12,
        },
      ],
    },
  ];

  const createdFormatsMap = new Map<string, string>();

  for (const st of studiesCatalog) {
    const savedStudy = await prisma.studyService.upsert({
      where: { id: st.id },
      update: {
        name: st.name,
        serviceType: st.serviceType,
        reportCategory: st.reportCategory,
        normalPrice: st.normalPrice,
        promoPrice: st.promoPrice,
        isActive: true,
      },
      create: {
        id: st.id,
        name: st.name,
        serviceType: st.serviceType,
        reportCategory: st.reportCategory,
        normalPrice: st.normalPrice,
        promoPrice: st.promoPrice,
        isActive: true,
      },
    });

    const savedFormat = await prisma.reportFormat.upsert({
      where: { studyServiceId: savedStudy.id },
      update: {
        baseText: CLINIC_HEADER_HTML,
        fields: st.fields as any,
        isActive: true,
      },
      create: {
        studyServiceId: savedStudy.id,
        baseText: CLINIC_HEADER_HTML,
        fields: st.fields as any,
        isActive: true,
      },
    });

    createdFormatsMap.set(savedStudy.id, savedFormat.id);
  }

  // 4. PACIENTES DE PRUEBA
  const patient1 = await prisma.patient.upsert({
    where: { id: 'seed-pat-1' },
    update: { fullName: 'Roberto Carlos Vega Mamani', phone: '70711223' },
    create: {
      id: 'seed-pat-1',
      fullName: 'Roberto Carlos Vega Mamani',
      phone: '70711223',
    },
  });

  const patient2 = await prisma.patient.upsert({
    where: { id: 'seed-pat-2' },
    update: { fullName: 'María Fernanda Quiroga Siles', phone: '71455667' },
    create: {
      id: 'seed-pat-2',
      fullName: 'María Fernanda Quiroga Siles',
      phone: '71455667',
    },
  });

  const patient3 = await prisma.patient.upsert({
    where: { id: 'seed-pat-3' },
    update: { fullName: 'Alejandro Torrico Céspedes', phone: '76933445' },
    create: {
      id: 'seed-pat-3',
      fullName: 'Alejandro Torrico Céspedes',
      phone: '76933445',
    },
  });

  // 5. ÓRDENES DEMO (en estado ATENDIDO para no bloquear el FIFO de test-phase3-queue)
  const orderAtendida = await prisma.order.upsert({
    where: { orderNumber: 'ORD-DEMO-001' },
    update: { status: 'ATENDIDO' },
    create: {
      id: 'seed-ord-1',
      orderNumber: 'ORD-DEMO-001',
      patientId: patient1.id,
      createdById: adminUser.id,
      origin: 'RECOMENDACION',
      associatedDoctorId: doctor1.id,
      isEmergency: false,
      emergencySurcharge: 0,
      queuePriority: 0,
      status: 'ATENDIDO',
      subtotalStudies: 180.0,
      totalAmount: 180.0,
      paymentMethod: 'EFECTIVO',
      amountCash: 180.0,
      amountQr: 0.0,
      isCommitmentPaid: true,
    },
  });

  const itemAtendido = await prisma.orderItem.upsert({
    where: { id: 'seed-item-1' },
    update: {},
    create: {
      id: 'seed-item-1',
      orderId: orderAtendida.id,
      studyServiceId: 'seed-study-eco-abd',
      priceApplied: 180.0,
    },
  });

  await prisma.doctorCommission.upsert({
    where: { orderId: orderAtendida.id },
    update: { status: 'PENDIENTE' },
    create: {
      orderId: orderAtendida.id,
      associatedDoctorId: doctor1.id,
      amount: 40.0,
      status: 'PENDIENTE',
    },
  });

  const formatAbdId = createdFormatsMap.get('seed-study-eco-abd');
  if (formatAbdId) {
    await prisma.patientReport.upsert({
      where: { orderItemId: itemAtendido.id },
      update: {},
      create: {
        orderItemId: itemAtendido.id,
        formatId: formatAbdId,
        generatedById: adminUser.id,
        fieldValues: {
          paciente_nombre: 'PACIENTE: Roberto Carlos Vega Mamani',
          fecha_estudio: new Date().toISOString().split('T')[0],
          hallazgos_higado_vesicula:
            'Hígado de forma, tamaño y ecogenicidad conservada. Bordes regulares, sin lesiones focales. Vesícula biliar distendida de paredes finas (2 mm), alitiásica.',
          hallazgos_pancreas_bazo_rinones:
            'Páncreas y bazo homogéneos sin alteraciones. Ambos riñones de topografía y dimensiones normales.',
          conclusion_diagnostica:
            'ESTUDIO ECOGRÁFICO ABDOMINAL DENTRO DE PARÁMETROS NORMALES.',
        },
      },
    });
  }

  // Orden 2: Emergencia Atendida + Pago QR + Comisión Médica Pendiente
  const orderEmergencia = await prisma.order.upsert({
    where: { orderNumber: 'ORD-DEMO-002' },
    update: { status: 'ATENDIDO' },
    create: {
      id: 'seed-ord-2',
      orderNumber: 'ORD-DEMO-002',
      patientId: patient2.id,
      createdById: adminUser.id,
      origin: 'RECOMENDACION',
      associatedDoctorId: doctor2.id,
      isEmergency: true,
      emergencySurcharge: 60.0,
      queuePriority: 999,
      status: 'ATENDIDO',
      subtotalStudies: 350.0,
      totalAmount: 410.0,
      paymentMethod: 'QR',
      amountCash: 0.0,
      amountQr: 410.0,
      isCommitmentPaid: true,
    },
  });

  await prisma.orderItem.upsert({
    where: { id: 'seed-item-2' },
    update: {},
    create: {
      id: 'seed-item-2',
      orderId: orderEmergencia.id,
      studyServiceId: 'seed-study-tac-cra',
      priceApplied: 350.0,
    },
  });

  await prisma.doctorCommission.upsert({
    where: { orderId: orderEmergencia.id },
    update: { status: 'PENDIENTE' },
    create: {
      orderId: orderEmergencia.id,
      associatedDoctorId: doctor2.id,
      amount: 50.0,
      status: 'PENDIENTE',
    },
  });

  // Orden 3: Orden con Pago Diferido (POR_COMPROMISO) pendiente de cobro en Caja
  const orderCompromiso = await prisma.order.upsert({
    where: { orderNumber: 'ORD-DEMO-003' },
    update: { status: 'ATENDIDO', isCommitmentPaid: false },
    create: {
      id: 'seed-ord-3',
      orderNumber: 'ORD-DEMO-003',
      patientId: patient3.id,
      createdById: adminUser.id,
      origin: 'POR_SU_CUENTA',
      associatedDoctorId: null,
      isEmergency: false,
      emergencySurcharge: 0.0,
      queuePriority: 0,
      status: 'ATENDIDO',
      subtotalStudies: 170.0,
      totalAmount: 170.0,
      paymentMethod: 'POR_COMPROMISO',
      amountCash: 0.0,
      amountQr: 0.0,
      isCommitmentPaid: false,
    },
  });

  await prisma.orderItem.upsert({
    where: { id: 'seed-item-3' },
    update: {},
    create: {
      id: 'seed-item-3',
      orderId: orderCompromiso.id,
      studyServiceId: 'seed-study-eco-ren',
      priceApplied: 170.0,
    },
  });

  console.log('✅ Semilla ECOMED completada exitosamente.');
}

main()
  .catch((e) => {
    console.error('❌ Error ejecutando seed.ts:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
