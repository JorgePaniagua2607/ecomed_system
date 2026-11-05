import { z } from 'zod';

// --- FASE 1: AUTENTICACIÓN ---
export const loginSchema = z.object({
  username: z.string().min(1, 'El usuario es requerido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

export const changePasswordSchema = z.object({
  newPassword: z.string().min(6, 'La nueva contraseña debe tener al menos 6 caracteres'),
});

// --- FASE 2.1: GESTIÓN DE PERSONAL ---
export const ShiftEnum = z.enum(['MANANA', 'TARDE', 'NOCHE', 'ROTATIVO']);

export const createStaffSchema = z.object({
  username: z.string().min(3, 'El nombre de usuario debe tener al menos 3 caracteres'),
  fullName: z.string().min(3, 'El nombre completo es requerido'),
  ci: z.string().min(4, 'El Carnet de Identidad es requerido'),
  phone: z.string().min(6, 'El teléfono es requerido'),
  email: z.string().email('Correo electrónico inválido').optional().or(z.literal('')),
  shift: ShiftEnum.default('MANANA'),
  canApplyPromotions: z.boolean().default(false),
});

export const updateStaffSchema = createStaffSchema.partial().extend({
  isActive: z.boolean().optional(),
  resetPasswordToCi: z.boolean().optional(),
});

// --- FASE 2.2: DOCTORES ASOCIADOS ---
export const createDoctorSchema = z.object({
  fullName: z.string().min(3, 'El nombre completo del doctor es requerido'),
  hospitalOrClinic: z.string().optional().or(z.literal('')),
  agreedCommission: z.coerce.number().min(0, 'La comisión acordada no puede ser negativa'),
  phone: z.string().min(6, 'El teléfono es requerido'),
  email: z.string().email('Correo electrónico inválido').optional().or(z.literal('')),
});

export const updateDoctorSchema = createDoctorSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// --- FASE 2.3: CATÁLOGO DE ESTUDIOS ---
export const ServiceTypeEnum = z.enum(['HACER_ECOGRAFIA', 'SOLO_INFORME']);
export const ReportCategoryEnum = z.enum(['ECOGRAFIA', 'TOMOGRAFIA']);

const baseStudySchema = z.object({
  name: z.string().min(3, 'El nombre del estudio debe tener al menos 3 caracteres'),
  serviceType: ServiceTypeEnum,
  reportCategory: ReportCategoryEnum.optional().nullable(),
  normalPrice: z.coerce.number().positive('El precio normal debe ser mayor a 0'),
  promoPrice: z.coerce.number().min(0, 'El precio promocional no puede ser negativo'),
});

export const createStudySchema = baseStudySchema
  .refine(
    (data) => {
      if (data.serviceType === 'SOLO_INFORME' && !data.reportCategory) {
        return false;
      }
      return true;
    },
    {
      message: 'Para servicios de "Solo Informe" debe especificar si es ECOGRAFIA o TOMOGRAFIA',
      path: ['reportCategory'],
    }
  )
  .refine((data) => data.promoPrice <= data.normalPrice, {
    message: 'El precio promocional no puede ser mayor al precio normal',
    path: ['promoPrice'],
  });

export const updateStudySchema = baseStudySchema.partial().extend({
  isActive: z.boolean().optional(),
});

// --- FASE 3.1: REGISTRO ÁGIL DE PACIENTES ---
export const createPatientSchema = z.object({
  fullName: z.string().trim().min(3, 'El nombre completo del paciente debe tener al menos 3 caracteres'),
  phone: z.string().trim().min(6, 'El teléfono del paciente debe tener al menos 6 dígitos'),
});

export const updatePatientSchema = createPatientSchema.partial();

// --- FASE 3.2, 3.3 y 3.4: ÓRDENES, PAGOS Y SALA DE ESPERA ---
export const OrderOriginEnum = z.enum(['POR_SU_CUENTA', 'RECOMENDACION', 'PROMOCION']);
export const OrderStatusEnum = z.enum(['EN_ESPERA', 'EN_ATENCION', 'ATENDIDO', 'CANCELADO']);
export const PaymentMethodEnum = z.enum(['EFECTIVO', 'QR', 'MIXTO', 'POR_COMPROMISO']);

export const createOrderSchema = z
  .object({
    patientId: z.string().min(1, 'El paciente es requerido'),
    studyIds: z.array(z.string().min(1)).min(1, 'Debe incluir al menos un estudio en la orden'),
    origin: OrderOriginEnum.default('POR_SU_CUENTA'),
    associatedDoctorId: z.string().optional().nullable(),
    isEmergency: z.boolean().default(false),
    emergencySurcharge: z.coerce.number().min(0, 'El recargo de emergencia no puede ser negativo').default(0),
    paymentMethod: PaymentMethodEnum.default('EFECTIVO'),
    amountCash: z.coerce.number().min(0).optional(),
    amountQr: z.coerce.number().min(0).optional(),
  })
  .refine(
    (data) => {
      if (data.origin === 'RECOMENDACION' && !data.associatedDoctorId) {
        return false;
      }
      return true;
    },
    {
      message: 'Debe seleccionar un Doctor Asociado cuando el origen de la orden es por RECOMENDACION',
      path: ['associatedDoctorId'],
    }
  )
  .refine(
    (data) => {
      if (data.isEmergency && data.emergencySurcharge <= 0) {
        return false;
      }
      return true;
    },
    {
      message: 'Las órdenes marcadas como Emergencia deben especificar un recargo mayor a 0',
      path: ['emergencySurcharge'],
    }
  );

export const settleCommitmentSchema = z.object({
  paymentMethod: z.enum(['EFECTIVO', 'QR', 'MIXTO']),
  amountCash: z.coerce.number().min(0).optional(),
  amountQr: z.coerce.number().min(0).optional(),
});

export const updateQueueStatusSchema = z.object({
  status: OrderStatusEnum,
});

// --- FASE 4.1 y 4.2: ESQUEMAS POSICIONALES Y PLANTILLAS A4 ---
const BOUNDARY_TOLERANCE = 100.05;

export const ReportFieldTypeEnum = z.enum(['text', 'textarea', 'number', 'date']);
export const TemplateFieldTypeSchema = ReportFieldTypeEnum;

export const positionalRectangleSchema = z
  .object({
    id: z.string().min(1, 'El ID del rectángulo es requerido'),
    name: z
      .string()
      .min(1, 'El nombre técnico (name) del campo es requerido')
      .regex(
        /^[a-zA-Z][a-zA-Z0-9_]*$/,
        'El nombre técnico debe iniciar con letra y contener solo letras, números o guiones bajos'
      ),
    label: z.string().min(1, 'La etiqueta visible (label) es requerida'),
    type: ReportFieldTypeEnum,
    xPercent: z.coerce.number().min(0, 'xPercent no puede ser menor a 0').max(100, 'xPercent no puede superar 100'),
    yPercent: z.coerce.number().min(0, 'yPercent no puede ser menor a 0').max(100, 'yPercent no puede superar 100'),
    widthPercent: z.coerce
      .number()
      .gt(0, 'widthPercent debe ser mayor a 0')
      .max(100, 'widthPercent no puede superar 100'),
    heightPercent: z.coerce
      .number()
      .gt(0, 'heightPercent debe ser mayor a 0')
      .max(100, 'heightPercent no puede superar 100'),
    fontSize: z.coerce
      .number()
      .min(6, 'El tamaño de fuente mínimo es 6pt')
      .max(72, 'El tamaño de fuente máximo es 72pt')
      .default(11),
  })
  .superRefine((rect, ctx) => {
    if (rect.xPercent + rect.widthPercent > BOUNDARY_TOLERANCE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['widthPercent'],
        message: `El campo "${rect.label}" desborda el ancho de la hoja A4 (xPercent + widthPercent supera el 100%)`,
      });
    }
    if (rect.yPercent + rect.heightPercent > BOUNDARY_TOLERANCE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['heightPercent'],
        message: `El campo "${rect.label}" desborda el alto de la hoja A4 (yPercent + heightPercent supera el 100%)`,
      });
    }
  });

export const PositionalRectSchema = positionalRectangleSchema;

export const positionalRectangleArraySchema = z
  .array(positionalRectangleSchema)
  .superRefine((rects, ctx) => {
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();

    rects.forEach((rect, idx) => {
      if (seenIds.has(rect.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [idx, 'id'],
          message: `ID de rectángulo duplicado: "${rect.id}"`,
        });
      }
      seenIds.add(rect.id);

      if (seenNames.has(rect.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [idx, 'name'],
          message: `Nombre de campo duplicado en la plantilla: "${rect.name}"`,
        });
      }
      seenNames.add(rect.name);
    });
  });

export const PositionalRectArraySchema = positionalRectangleArraySchema;

export const upsertReportFormatSchema = z.object({
  studyServiceId: z.string().min(1, 'El ID del servicio de estudio (studyServiceId) es requerido'),
  baseText: z.string().default(''),
  fields: positionalRectangleArraySchema.default([]),
});

export type LoginDTO = z.infer<typeof loginSchema>;
export type ChangePasswordDTO = z.infer<typeof changePasswordSchema>;
export type CreateStaffDTO = z.infer<typeof createStaffSchema>;
export type UpdateStaffDTO = z.infer<typeof updateStaffSchema>;
export type CreateDoctorDTO = z.infer<typeof createDoctorSchema>;
export type UpdateDoctorDTO = z.infer<typeof updateDoctorSchema>;
export type CreateStudyDTO = z.infer<typeof createStudySchema>;
export type UpdateStudyDTO = z.infer<typeof updateStudySchema>;
export type CreatePatientDTO = z.infer<typeof createPatientSchema>;
export type UpdatePatientDTO = z.infer<typeof updatePatientSchema>;
export type CreateOrderDTO = z.infer<typeof createOrderSchema>;
export type SettleCommitmentDTO = z.infer<typeof settleCommitmentSchema>;
export type UpdateQueueStatusDTO = z.infer<typeof updateQueueStatusSchema>;
export type PositionalRectangleDTO = z.infer<typeof positionalRectangleSchema>;
export type PositionalRect = PositionalRectangleDTO;
export type UpsertReportFormatDTO = z.infer<typeof upsertReportFormatSchema>;

// --- FASE 4.3: GENERACIÓN DE INFORME PDF A4 ---
export const generateReportSchema = z.object({
  studyServiceId: z.string().min(1, 'El ID del estudio (studyServiceId) es requerido'),
  orderId: z.string().optional(),
  fieldValues: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean(), z.null(), z.undefined()])
  ),
});

export type GenerateReportInput = z.infer<typeof generateReportSchema>;
