'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Rnd } from 'react-rnd';
import {
  Stethoscope,
  ClipboardPlus,
  Users,
  FileText,
  LayoutTemplate,
  Database,
  LogOut,
  LogIn,
  RefreshCw,
  PhoneCall,
  Flame,
  Plus,
  Save,
  Trash2,
  Download,
  CheckCircle2,
  AlertCircle,
  UserPlus,
  DollarSign,
  XCircle,
  Play,
  CheckCheck,
  Wallet,
  ShieldCheck,
  KeyRound,
  BadgeDollarSign,
  Pencil,
  Power,
  Lock,
  X,
  History,
  Printer,
  Search,
  RotateCcw,
} from 'lucide-react';
import {
  API_BASE,
  apiFetch,
  extractArray,
  getStoredToken,
  setStoredToken,
} from '@/lib/api';

type ModuleTab =
  | 'reception'
  | 'queue'
  | 'consultation'
  | 'builder'
  | 'finance'
  | 'staff'
  | 'catalogs';

type FieldType = 'text' | 'textarea' | 'number' | 'date';

interface PositionalField {
  id: string;
  name: string;
  label: string;
  type: FieldType;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  fontSize: number;
}

interface StudyService {
  id: string;
  name: string;
  serviceType: 'HACER_ECOGRAFIA' | 'SOLO_INFORME';
  reportCategory?: 'ECOGRAFIA' | 'TOMOGRAFIA' | null;
  normalPrice: number;
  promoPrice: number;
  isActive?: boolean;
}

interface Doctor {
  id: string;
  fullName: string;
  hospitalOrClinic?: string;
  agreedCommission: number;
  phone: string;
  email?: string;
  isActive?: boolean;
}

interface StaffMember {
  id: string;
  username: string;
  fullName: string;
  ci: string;
  phone: string;
  email?: string;
  role: 'ADMIN' | 'PERSONAL';
  shift: 'MANANA' | 'TARDE' | 'NOCHE' | 'ROTATIVO';
  canApplyPromotions: boolean;
  isActive: boolean;
}

interface Patient {
  id: string;
  fullName: string;
  phone: string;
}

interface QueueOrder {
  id: string;
  orderNumber?: string;
  patientId?: string;
  associatedDoctorId?: string | null;
  status: 'EN_ESPERA' | 'EN_ATENCION' | 'ATENDIDO' | 'CANCELADO';
  origin: 'POR_SU_CUENTA' | 'RECOMENDACION' | 'PROMOCION';
  isEmergency: boolean;
  emergencySurcharge: number;
  totalAmount?: number;
  amountCash?: number;
  amountQr?: number;
  paymentMethod?: 'EFECTIVO' | 'QR' | 'MIXTO' | 'POR_COMPROMISO';
  isCommitmentPaid?: boolean;
  queuePriority: number;
  createdAt: string;
  patient?: Patient;
  associatedDoctor?: Doctor | null;
  payment?: {
    id?: string;
    method?: string;
    paymentMethod?: string;
    status?: string;
    isPaid?: boolean;
    totalAmount?: number;
    amountCash?: number;
    amountQr?: number;
  } | null;
  commission?: {
    id: string;
    amount: number;
    status: 'PENDIENTE' | 'PAGADO' | 'PAGADA' | 'ANULADO';
  } | null;
  studies?: StudyService[];
  items?: Array<{
    id: string;
    studyServiceId?: string;
    studyId?: string;
    studyService?: StudyService;
    study?: StudyService;
    studies?: StudyService[];
  }>;
}

interface LedgerCommission {
  id: string;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  associatedDoctorId: string;
  doctorName: string;
  hospitalOrClinic: string;
  doctorPhone: string;
  patientName: string;
  patientPhone: string;
  studyNames: string;
  amount: number;
  status: 'PENDIENTE' | 'PAGADO' | 'PAGADA' | 'ANULADO';
  paidAt?: string | null;
  createdAt: string;
}

interface EmittedReportRecord {
  id: string;
  orderItemId: string;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  origin: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  associatedDoctorName?: string | null;
  studyServiceId: string;
  studyName: string;
  serviceType: string;
  reportCategory?: string | null;
  generatedByName: string;
  fieldValues: Record<string, any>;
  createdAt: string;
}

const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;
const USER_META_STORAGE_KEY = 'ecomed_user_meta';

function parseJwtPayload(token: string): Record<string, any> | null {
  try {
    if (typeof window === 'undefined' || !token) return null;
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/**
 * Recorre recursivamente las respuestas de GET /queue (getWaitingRoomMonitor)
 * y GET /orders (getAllOrders) para extraer todas las órdenes sin importar
 * cómo estén agrupadas (waitingQueue, inAttention, orders, data, etc.).
 */
function deepExtractOrders(
  node: any,
  found = new Map<string, QueueOrder>()
): QueueOrder[] {
  if (!node || typeof node !== 'object') {
    return Array.from(found.values());
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      deepExtractOrders(item, found);
    }
    return Array.from(found.values());
  }

  const hasValidStatus =
    typeof node.status === 'string' &&
    ['EN_ESPERA', 'EN_ATENCION', 'ATENDIDO', 'CANCELADO'].includes(node.status);

  if (
    typeof node.id === 'string' &&
    (hasValidStatus || typeof node.patientId === 'string')
  ) {
    const prev = found.get(node.id);
    found.set(node.id, {
      ...prev,
      ...node,
      status: node.status || prev?.status || 'EN_ESPERA',
    });
  }

  const skipChildKeys = new Set([
    'patient',
    'associatedDoctor',
    'doctor',
    'items',
    'studies',
    'payment',
    'commission',
  ]);

  for (const key of Object.keys(node)) {
    if (
      !skipChildKeys.has(key) &&
      typeof node[key] === 'object' &&
      node[key] !== null
    ) {
      deepExtractOrders(node[key], found);
    }
  }

  return Array.from(found.values());
}

export default function EcomedSuite() {
  // Autenticación y Permisos (Paso 2)
  const [token, setToken] = useState<string>('');
  const [userRole, setUserRole] = useState<'ADMIN' | 'PERSONAL'>('ADMIN');
  const [currentUsername, setCurrentUsername] = useState<string>('admin');
  const [userCanPromo, setUserCanPromo] = useState<boolean>(true);
  const [loginUsername, setLoginUsername] = useState<string>('admin');
  const [loginPassword, setLoginPassword] = useState<string>('admin123');

  // Modal de Cambio de Contraseña Propia (Paso 4)
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState<string>('');
  const [newPasswordInput, setNewPasswordInput] = useState<string>('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState<string>('');

  // Navegación
  const [activeModule, setActiveModule] = useState<ModuleTab>('reception');
  const [consultationSubTab, setConsultationSubTab] = useState<
    'editor' | 'history'
  >('editor');
  const [historySearch, setHistorySearch] = useState<string>('');

  // Datos maestros
  const [studies, setStudies] = useState<StudyService[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [queueOrders, setQueueOrders] = useState<QueueOrder[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [emittedReports, setEmittedReports] = useState<EmittedReportRecord[]>(
    []
  );

  // Datos de Caja (/api/v1/payments/commitments-counter y /api/v1/payments/ledger)
  const [commitmentsCount, setCommitmentsCount] = useState<number>(0);
  const [ledgerData, setLedgerData] = useState<any>(null);
  const [settleMethodMap, setSettleMethodMap] = useState<
    Record<string, 'EFECTIVO' | 'QR' | 'MIXTO'>
  >({});
  const [commissionFilter, setCommissionFilter] = useState<
    'ALL' | 'PENDIENTE' | 'PAGADO'
  >('ALL');

  // --- ESTADO: RECEPCIÓN Y NUEVA ORDEN (FASE 3) ---
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [newPatientName, setNewPatientName] = useState<string>('');
  const [newPatientPhone, setNewPatientPhone] = useState<string>('');
  const [orderStudyIds, setOrderStudyIds] = useState<string[]>([]);
  const [orderOrigin, setOrderOrigin] = useState<
    'POR_SU_CUENTA' | 'PROMOCION' | 'RECOMENDACION'
  >('POR_SU_CUENTA');
  const [orderDoctorId, setOrderDoctorId] = useState<string>('');
  const [orderIsEmergency, setOrderIsEmergency] = useState<boolean>(false);
  const [orderEmergencySurcharge, setOrderEmergencySurcharge] =
    useState<number>(50);
  const [orderPaymentMethod, setOrderPaymentMethod] = useState<
    'EFECTIVO' | 'QR' | 'MIXTO' | 'POR_COMPROMISO'
  >('EFECTIVO');
  const [orderAmountCash, setOrderAmountCash] = useState<number>(0);
  const [orderAmountQr, setOrderAmountQr] = useState<number>(0);

  // --- ESTADO: CONSULTORIO Y CONSTRUCTOR A4 (FASE 4) ---
  const [activeOrder, setActiveOrder] = useState<QueueOrder | null>(null);
  const [selectedStudyId, setSelectedStudyId] = useState<string>('');
  const [baseText, setBaseText] = useState<string>(
    `<div style="border-bottom: 2px solid #0284c7; padding-bottom: 8px;">\n  <h2 style="margin: 0; color: #0369a1;">CLÍNICA ECOMED</h2>\n  <small style="color: #4b5563;">Diagnóstico por Imagen - Ecografía y Tomografía</small>\n</div>`
  );
  const [fields, setFields] = useState<PositionalField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [completeOrderOnGenerate, setCompleteOrderOnGenerate] =
    useState<boolean>(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // --- ESTADO: PERSONAL CLÍNICO (FASE 2.1) ---
  const [staffUsername, setStaffUsername] = useState<string>('');
  const [staffFullName, setStaffFullName] = useState<string>('');
  const [staffCi, setStaffCi] = useState<string>('');
  const [staffPhone, setStaffPhone] = useState<string>('');
  const [staffEmail, setStaffEmail] = useState<string>('');
  const [staffShift, setStaffShift] = useState<
    'MANANA' | 'TARDE' | 'NOCHE' | 'ROTATIVO'
  >('MANANA');
  const [staffCanPromo, setStaffCanPromo] = useState<boolean>(false);

  // --- ESTADO: CATÁLOGOS Y EDICIÓN (FASE 2.2, 2.3 y PASO 4) ---
  const [editingStudyId, setEditingStudyId] = useState<string | null>(null);
  const [newStudyName, setNewStudyName] = useState<string>('');
  const [newStudyType, setNewStudyType] = useState<
    'HACER_ECOGRAFIA' | 'SOLO_INFORME'
  >('HACER_ECOGRAFIA');
  const [newStudyCategory, setNewStudyCategory] = useState<
    'ECOGRAFIA' | 'TOMOGRAFIA'
  >('ECOGRAFIA');
  const [newStudyNormalPrice, setNewStudyNormalPrice] = useState<number>(150);
  const [newStudyPromoPrice, setNewStudyPromoPrice] = useState<number>(120);

  const [editingDoctorId, setEditingDoctorId] = useState<string | null>(null);
  const [newDoctorName, setNewDoctorName] = useState<string>('');
  const [newDoctorClinic, setNewDoctorClinic] = useState<string>('');
  const [newDoctorPhone, setNewDoctorPhone] = useState<string>('');
  const [newDoctorCommission, setNewDoctorCommission] = useState<number>(30);

  // Feedback
  const [loading, setLoading] = useState<boolean>(false);
  const [toast, setToast] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const notify = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  const isAdmin = userRole === 'ADMIN';
  const canUsePromotions = isAdmin || userCanPromo;

  useEffect(() => {
    if (!canUsePromotions && orderOrigin === 'PROMOCION') {
      setOrderOrigin('POR_SU_CUENTA');
    }
  }, [canUsePromotions, orderOrigin]);

  // --- PLANTILLAS A4 Y MOTOR PDF (FASE 4) ---
  const loadTemplateForStudy = useCallback(
    async (
      studyId: string,
      orderContext: QueueOrder | null = null,
      overrideFieldValues: Record<string, any> | null = null
    ) => {
      if (!studyId) return;
      setLoading(true);
      try {
        const json = await apiFetch(`/report-formats/${studyId}`);
        const formatData = json.data || json;
        setBaseText(formatData.baseText || '');
        const loadedFields: PositionalField[] = (formatData.fields || []).map(
          (f: any) => ({
            id: f.id,
            name: f.name || f.id,
            label: f.label || f.name || 'Campo',
            type: f.type || 'text',
            xPercent: Number(f.xPercent) || 10,
            yPercent: Number(f.yPercent) || 10,
            widthPercent: Number(f.widthPercent ?? f.width) || 35,
            heightPercent: Number(f.heightPercent ?? f.height) || 5,
            fontSize: Number(f.fontSize) || 11,
          })
        );
        setFields(loadedFields);
        setSelectedFieldId(loadedFields[0]?.id || null);

        if (overrideFieldValues) {
          const restored: Record<string, string> = {};
          loadedFields.forEach((f) => {
            restored[f.name] =
              overrideFieldValues[f.name] !== undefined &&
              overrideFieldValues[f.name] !== null
                ? String(overrideFieldValues[f.name])
                : '';
          });
          setFieldValues(restored);
        } else {
          const today = new Date().toISOString().split('T')[0];
          const prefilled: Record<string, string> = {};
          loadedFields.forEach((f) => {
            const lower = `${f.name} ${f.label}`.toLowerCase();
            if (orderContext?.patient?.fullName && lower.includes('paciente')) {
              prefilled[f.name] = `PACIENTE: ${orderContext.patient.fullName}`;
            } else if (f.type === 'date' || lower.includes('fecha')) {
              prefilled[f.name] = today;
            } else {
              prefilled[f.name] = '';
            }
          });
          setFieldValues(prefilled);
        }
      } catch {
        setFields([]);
        setSelectedFieldId(null);
        setFieldValues({});
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const loadAllData = useCallback(async () => {
    const activeJwt = getStoredToken();
    if (!activeJwt) return;
    try {
      const [
        studiesRes,
        doctorsRes,
        patientsRes,
        ordersRes,
        queueRes,
        commitCounterRes,
        ledgerRes,
        staffRes,
        historyRes,
      ] = await Promise.allSettled([
        apiFetch('/studies?includeInactive=true'),
        apiFetch('/doctors?includeInactive=true'),
        apiFetch('/patients'),
        apiFetch('/orders'),
        apiFetch('/queue'),
        apiFetch('/payments/commitments-counter'),
        apiFetch('/payments/ledger'),
        apiFetch('/staff'),
        apiFetch('/reports/history'),
      ]);

      let loadedPatients: Patient[] = [];
      if (patientsRes.status === 'fulfilled') {
        loadedPatients = extractArray<Patient>(patientsRes.value, ['patients']);
        setPatients(loadedPatients);
        setSelectedPatientId((prev) =>
          !prev && loadedPatients.length > 0 ? loadedPatients[0].id : prev
        );
      }

      let loadedDoctors: Doctor[] = [];
      if (doctorsRes.status === 'fulfilled') {
        loadedDoctors = extractArray<Doctor>(doctorsRes.value, ['doctors']);
        setDoctors(loadedDoctors);
      }

      if (studiesRes.status === 'fulfilled') {
        const list = extractArray<StudyService>(studiesRes.value, ['studies']);
        setStudies(list);
        setSelectedStudyId((prev) => {
          if (!prev && list.length > 0) {
            loadTemplateForStudy(list[0].id);
            return list[0].id;
          }
          return prev;
        });
      }

      const patientMap = new Map<string, Patient>();
      loadedPatients.forEach((p) => patientMap.set(p.id, p));
      const doctorMap = new Map<string, Doctor>();
      loadedDoctors.forEach((d) => doctorMap.set(d.id, d));

      const mergedOrders = new Map<string, QueueOrder>();
      if (ordersRes.status === 'fulfilled') {
        deepExtractOrders(ordersRes.value, mergedOrders);
      }
      if (queueRes.status === 'fulfilled') {
        deepExtractOrders(queueRes.value, mergedOrders);
      }

      const enrichedOrders = Array.from(mergedOrders.values()).map((ord) => ({
        ...ord,
        patient:
          ord.patient ||
          (ord.patientId ? patientMap.get(ord.patientId) : undefined),
        associatedDoctor:
          ord.associatedDoctor ||
          (ord.associatedDoctorId
            ? doctorMap.get(ord.associatedDoctorId)
            : null),
      }));

      setQueueOrders(enrichedOrders);

      if (commitCounterRes.status === 'fulfilled') {
        const raw = commitCounterRes.value;
        const countVal =
          typeof raw?.data?.unpaidCount === 'number'
            ? raw.data.unpaidCount
            : typeof raw?.unpaidCount === 'number'
            ? raw.unpaidCount
            : typeof raw?.count === 'number'
            ? raw.count
            : typeof raw?.data?.count === 'number'
            ? raw.data.count
            : 0;
        setCommitmentsCount(countVal);
      }

      if (ledgerRes.status === 'fulfilled') {
        setLedgerData(ledgerRes.value?.data || ledgerRes.value);
      }

      if (staffRes.status === 'fulfilled') {
        const loadedStaff = extractArray<StaffMember>(staffRes.value, [
          'staff',
          'users',
        ]);
        setStaffList(loadedStaff);

        const decoded = parseJwtPayload(activeJwt);
        const uname = decoded?.username;
        if (uname) {
          const foundMe = loadedStaff.find((u) => u.username === uname);
          if (foundMe) {
            setUserCanPromo(
              foundMe.role === 'ADMIN' || Boolean(foundMe.canApplyPromotions)
            );
          }
        }
      }

      if (historyRes.status === 'fulfilled') {
        setEmittedReports(
          extractArray<EmittedReportRecord>(historyRes.value, ['reports'])
        );
      }
    } catch {
      // Silencioso durante polling automático
    }
  }, [loadTemplateForStudy]);

  useEffect(() => {
    const saved = getStoredToken();
    if (saved) {
      setToken(saved);
      const decoded = parseJwtPayload(saved);
      let storedMeta: Record<string, any> | null = null;
      try {
        const rawMeta = localStorage.getItem(USER_META_STORAGE_KEY);
        if (rawMeta) storedMeta = JSON.parse(rawMeta);
      } catch {
        storedMeta = null;
      }

      const resolvedRole =
        (decoded?.role as 'ADMIN' | 'PERSONAL') ||
        (storedMeta?.role as 'ADMIN' | 'PERSONAL') ||
        'ADMIN';
      const resolvedUsername =
        decoded?.username || storedMeta?.username || 'admin';
      const resolvedCanPromo =
        resolvedRole === 'ADMIN'
          ? true
          : typeof decoded?.canApplyPromotions === 'boolean'
          ? decoded.canApplyPromotions
          : Boolean(storedMeta?.canApplyPromotions);

      setUserRole(resolvedRole);
      setCurrentUsername(resolvedUsername);
      setUserCanPromo(resolvedCanPromo);
      loadAllData();
    }
  }, [loadAllData]);

  useEffect(() => {
    if (!token) return;
    const timer = setInterval(() => {
      loadAllData();
    }, 4000);
    return () => clearInterval(timer);
  }, [token, loadAllData]);

  // --- COLA REACTIVA ORDENADA POR PRIORIDAD (EMERGENCIAS 999) Y LUEGO FIFO ---
  const waitingOnlyList = queueOrders
    .filter((o) => o.status === 'EN_ESPERA')
    .sort((a, b) => {
      const pA = a.queuePriority ?? (a.isEmergency ? 999 : 0);
      const pB = b.queuePriority ?? (b.isEmergency ? 999 : 0);
      if (pA !== pB) return pB - pA;
      return (
        new Date(a.createdAt || 0).getTime() -
        new Date(b.createdAt || 0).getTime()
      );
    });

  const activeQueue = queueOrders
    .filter((o) => o.status === 'EN_ESPERA' || o.status === 'EN_ATENCION')
    .sort((a, b) => {
      const pA = a.queuePriority ?? (a.isEmergency ? 999 : 0);
      const pB = b.queuePriority ?? (b.isEmergency ? 999 : 0);
      if (pA !== pB) return pB - pA;
      return (
        new Date(a.createdAt || 0).getTime() -
        new Date(b.createdAt || 0).getTime()
      );
    });

  const patientInAttention =
    activeQueue.find((o) => o.status === 'EN_ATENCION') || activeOrder || null;

  // --- AUTENTICACIÓN ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: loginUsername,
          password: loginPassword,
        }),
      });
      const jwt = data.token || data.data?.token || data.accessToken;
      if (!jwt) throw new Error('No se recibió token JWT.');

      const userObj = data.user || data.data?.user || {};
      const decoded = parseJwtPayload(jwt) || {};

      const resolvedRole: 'ADMIN' | 'PERSONAL' =
        userObj.role || decoded.role || 'ADMIN';
      const resolvedUsername: string =
        userObj.username || decoded.username || loginUsername;
      const resolvedCanPromo: boolean =
        resolvedRole === 'ADMIN'
          ? true
          : typeof userObj.canApplyPromotions === 'boolean'
          ? userObj.canApplyPromotions
          : Boolean(decoded.canApplyPromotions);

      setStoredToken(jwt);
      setToken(jwt);
      setCurrentUsername(resolvedUsername);
      setUserRole(resolvedRole);
      setUserCanPromo(resolvedCanPromo);

      if (typeof window !== 'undefined') {
        localStorage.setItem(
          USER_META_STORAGE_KEY,
          JSON.stringify({
            username: resolvedUsername,
            role: resolvedRole,
            canApplyPromotions: resolvedCanPromo,
          })
        );
      }

      if (resolvedRole !== 'ADMIN' && activeModule === 'staff') {
        setActiveModule('reception');
      }

      notify('success', `Bienvenido a Ecomed (${resolvedUsername})`);
      await loadAllData();
    } catch (err: any) {
      notify('error', err.message || 'Credenciales incorrectas.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setStoredToken('');
    setToken('');
    if (typeof window !== 'undefined') {
      localStorage.removeItem(USER_META_STORAGE_KEY);
    }
    notify('success', 'Sesión cerrada correctamente.');
  };

  // --- PASO 4: CAMBIO DE CONTRASEÑA PROPIA (changePasswordSchema) ---
  const handleChangeOwnPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPasswordInput.trim().length < 6) {
      notify(
        'error',
        'La nueva contraseña debe tener al menos 6 caracteres.'
      );
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      notify('error', 'La confirmación de contraseña no coincide.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        currentPassword: currentPasswordInput || undefined,
        newPassword: newPasswordInput,
      };

      await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(payload),
      }).catch(async () => {
        await apiFetch('/auth/change-password', {
          method: 'PATCH',
          body: JSON.stringify(payload),
        }).catch(async () => {
          await apiFetch('/auth/change-password', {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
        });
      });

      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      setShowPasswordModal(false);
      notify('success', 'Tu contraseña ha sido actualizada correctamente.');
    } catch (err: any) {
      notify('error', err.message || 'Error al cambiar la contraseña.');
    } finally {
      setLoading(false);
    }
  };

  // --- RECEPCIÓN: CREAR PACIENTE AL VUELO ---
  const handleQuickCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatientName.trim() || !newPatientPhone.trim()) return;
    setLoading(true);
    try {
      const res = await apiFetch('/patients', {
        method: 'POST',
        body: JSON.stringify({
          fullName: newPatientName,
          phone: newPatientPhone,
        }),
      });
      const created: Patient = res.data || res.patient || res;
      await loadAllData();
      if (created?.id) {
        setSelectedPatientId(created.id);
      }
      setNewPatientName('');
      setNewPatientPhone('');
      notify(
        'success',
        `Paciente "${created.fullName}" registrado y seleccionado.`
      );
    } catch (err: any) {
      notify('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateOrderTotal = () => {
    const studiesSum = orderStudyIds.reduce((acc, id) => {
      const st = studies.find((s) => s.id === id);
      if (!st) return acc;
      const price =
        orderOrigin === 'PROMOCION' && canUsePromotions
          ? Number(st.promoPrice)
          : Number(st.normalPrice);
      return acc + price;
    }, 0);
    const surcharge = orderIsEmergency
      ? Number(orderEmergencySurcharge) || 0
      : 0;
    return studiesSum + surcharge;
  };

  // --- RECEPCIÓN: CREAR ORDEN DE SERVICIO (POST /api/v1/orders) ---
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) {
      notify('error', 'Selecciona o registra un paciente.');
      return;
    }
    if (orderStudyIds.length === 0) {
      notify('error', 'Selecciona al menos un estudio clínico.');
      return;
    }
    if (orderOrigin === 'PROMOCION' && !canUsePromotions) {
      notify(
        'error',
        'Tu cuenta de PERSONAL no tiene autorización para aplicar descuentos promocionales.'
      );
      return;
    }

    setLoading(true);
    try {
      const total = calculateOrderTotal();
      const payload: Record<string, any> = {
        patientId: selectedPatientId,
        studyIds: orderStudyIds,
        origin: orderOrigin,
        associatedDoctorId:
          orderOrigin === 'RECOMENDACION' ? orderDoctorId : null,
        isEmergency: orderIsEmergency,
        emergencySurcharge: orderIsEmergency
          ? Number(orderEmergencySurcharge)
          : 0,
        paymentMethod: orderPaymentMethod,
      };

      if (orderPaymentMethod === 'EFECTIVO') {
        payload.amountCash = total;
        payload.amountQr = 0;
      } else if (orderPaymentMethod === 'QR') {
        payload.amountCash = 0;
        payload.amountQr = total;
      } else if (orderPaymentMethod === 'MIXTO') {
        payload.amountCash = Number(orderAmountCash);
        payload.amountQr = Number(orderAmountQr);
      }

      const res = await apiFetch('/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const createdOrder: QueueOrder | null = res.data || res.order || null;
      const patientObj = patients.find((p) => p.id === selectedPatientId);

      if (createdOrder?.id) {
        setQueueOrders((prev) => [
          ...prev,
          {
            ...createdOrder,
            status: createdOrder.status || 'EN_ESPERA',
            patient: createdOrder.patient || patientObj,
            queuePriority:
              createdOrder.queuePriority ?? (orderIsEmergency ? 999 : 0),
            createdAt: createdOrder.createdAt || new Date().toISOString(),
          },
        ]);
      }

      setOrderStudyIds([]);
      setOrderIsEmergency(false);
      await loadAllData();
      notify('success', 'Orden emitida y paciente agregado a la Sala de Espera.');
      setActiveModule('queue');
    } catch (err: any) {
      notify('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- SALA DE ESPERA: LLAMAR SIGUIENTE (POST /api/v1/queue/call-next) ---
  const handleCallNext = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/queue/call-next', { method: 'POST' });
      const extracted = deepExtractOrders(res);
      const calledOrder = extracted[0] || res.data || res.order || null;
      await loadAllData();
      if (calledOrder?.id) {
        const patientObj =
          calledOrder.patient ||
          patients.find((p) => p.id === calledOrder.patientId);
        setActiveOrder({ ...calledOrder, patient: patientObj });
        notify(
          'success',
          `Llamando a consultorio: ${patientObj?.fullName || calledOrder.id}`
        );
      } else {
        notify('success', res.message || 'Siguiente paciente llamado.');
      }
    } catch (err: any) {
      notify('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- SALA DE ESPERA: DAR DE BAJA / CAMBIAR ESTADO (PATCH /api/v1/queue/:orderId/status) ---
  const handleUpdateOrderStatus = async (
    orderId: string,
    status: 'EN_ESPERA' | 'EN_ATENCION' | 'ATENDIDO' | 'CANCELADO'
  ) => {
    setLoading(true);
    try {
      await apiFetch(`/queue/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      if (status === 'CANCELADO' && activeOrder?.id === orderId) {
        setActiveOrder(null);
      }
      await loadAllData();
      notify(
        'success',
        status === 'CANCELADO'
          ? 'Paciente dado de baja de la cola y comisión médica anulada.'
          : `Estado de la orden actualizado a ${status}.`
      );
    } catch (err: any) {
      notify('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const extractOrderStudyId = (order: QueueOrder): string | null => {
    if (order.items && order.items.length > 0) {
      const first = order.items[0];
      return (
        first.studyServiceId ||
        first.studyId ||
        first.studyService?.id ||
        first.study?.id ||
        null
      );
    }
    if (order.studies && order.studies.length > 0) {
      return order.studies[0].id;
    }
    return null;
  };

  const handleOpenOrderInConsultation = async (order: QueueOrder) => {
    if (order.status === 'EN_ESPERA') {
      await apiFetch(`/queue/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'EN_ATENCION' }),
      }).catch(() => null);
    }
    setActiveOrder({ ...order, status: 'EN_ATENCION' });
    setActiveModule('consultation');
    setConsultationSubTab('editor');
    const stId = extractOrderStudyId(order) || selectedStudyId;
    if (stId) {
      setSelectedStudyId(stId);
      await loadTemplateForStudy(stId, order);
    }
    await loadAllData();
  };

  const handleSaveTemplate = async () => {
    if (!selectedStudyId) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/report-formats/${selectedStudyId}`, {
        method: 'PUT',
        body: JSON.stringify({
          studyServiceId: selectedStudyId,
          baseText,
          fields,
        }),
      });
      notify('success', res.message || 'Plantilla A4 guardada exitosamente.');
    } catch (err: any) {
      notify('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- PASO 2: ELIMINAR PLANTILLA A4 (EXCLUSIVO ADMIN) ---
  const handleDeleteTemplate = async () => {
    if (!isAdmin) {
      notify('error', 'Solo el rol ADMIN puede eliminar plantillas A4.');
      return;
    }
    if (!selectedStudyId) return;
    setLoading(true);
    try {
      await apiFetch(`/report-formats/${selectedStudyId}`, {
        method: 'DELETE',
      }).catch(async () => {
        await apiFetch(`/report-formats/${selectedStudyId}`, {
          method: 'PUT',
          body: JSON.stringify({
            studyServiceId: selectedStudyId,
            baseText: '',
            fields: [],
          }),
        });
      });
      setFields([]);
      setSelectedFieldId(null);
      notify('success', 'Plantilla A4 eliminada/reiniciada por el Administrador.');
    } catch (err: any) {
      notify('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePdf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudyId) return;
    setLoading(true);
    try {
      const targetOrder = activeOrder || patientInAttention;
      const res = await fetch(`${API_BASE}/reports/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          studyServiceId: selectedStudyId,
          orderId: targetOrder?.id,
          completeOrder: Boolean(targetOrder && completeOrderOnGenerate),
          fieldValues,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Error HTTP ${res.status}`);
      }

      const blob = await res.blob();
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(URL.createObjectURL(blob));

      if (targetOrder && completeOrderOnGenerate) {
        await apiFetch(`/queue/${targetOrder.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'ATENDIDO' }),
        }).catch(() => null);
        notify(
          'success',
          `Informe PDF generado, guardado en Historial y orden de ${
            targetOrder.patient?.fullName || 'paciente'
          } marcada como ATENDIDO.`
        );
        setActiveOrder(null);
        await loadAllData();
      } else {
        await loadAllData();
        notify('success', 'Informe PDF A4 compilado correctamente.');
      }
    } catch (err: any) {
      notify('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- PASO 3: REIMPRIMIR PDF DESDE EL HISTORIAL (POST /api/v1/reports/history/:reportId/pdf) ---
  const handleReprintHistoricalPdf = async (
    report: EmittedReportRecord,
    autoDownload = false
  ) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/reports/history/${report.id}/pdf`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(
          errJson.message || `Error HTTP ${res.status} al reimprimir PDF`
        );
      }

      const blob = await res.blob();
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      const objectUrl = URL.createObjectURL(blob);
      setPdfUrl(objectUrl);

      if (autoDownload) {
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = `reimpresion-${report.orderNumber}-${Date.now()}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }

      notify(
        'success',
        `Informe de ${report.patientName} (${report.studyName}) listo en el visor PDF.`
      );
    } catch (err: any) {
      notify('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- PASO 3: CARGAR INFORME HISTÓRICO EN EL EDITOR DE CONSULTORIO ---
  const handleLoadHistoricalReportIntoEditor = async (
    report: EmittedReportRecord
  ) => {
    if (!report.studyServiceId) return;
    setSelectedStudyId(report.studyServiceId);
    setConsultationSubTab('editor');
    await loadTemplateForStudy(report.studyServiceId, null, report.fieldValues);
    await handleReprintHistoricalPdf(report, false);
  };

  // --- CAJA: LIQUIDAR DEUDA POR COMPROMISO (POST /api/v1/payments/commitments/:orderId/settle) ---
  const handleSettleCommitment = async (order: QueueOrder) => {
    const method = settleMethodMap[order.id] || 'EFECTIVO';
    const total = Number(order.totalAmount || order.payment?.totalAmount || 150);
    setLoading(true);
    try {
      await apiFetch(`/payments/commitments/${order.id}/settle`, {
        method: 'POST',
        body: JSON.stringify({
          paymentMethod: method,
          amountCash:
            method === 'EFECTIVO' ? total : method === 'MIXTO' ? total / 2 : 0,
          amountQr:
            method === 'QR' ? total : method === 'MIXTO' ? total / 2 : 0,
        }),
      });
      await loadAllData();
      notify('success', 'Compromiso de pago liquidado exitosamente en Caja.');
    } catch (err: any) {
      notify('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- CAJA: LIQUIDAR COMISIÓN DE DOCTOR ASOCIADO (POST /api/v1/payments/commissions/:id/settle) ---
  const handleSettleCommission = async (
    commissionId: string,
    doctorName: string
  ) => {
    setLoading(true);
    try {
      const res = await apiFetch(
        `/payments/commissions/${commissionId}/settle`,
        {
          method: 'POST',
        }
      );
      await loadAllData();
      notify(
        'success',
        res.message || `Comisión médica de ${doctorName} marcada como PAGADO.`
      );
    } catch (err: any) {
      notify('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- PERSONAL CLÍNICO (FASE 2.1 - EXCLUSIVO ADMIN) ---
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      notify('error', 'Solo el rol ADMIN puede gestionar el personal.');
      return;
    }
    setLoading(true);
    try {
      await apiFetch('/staff', {
        method: 'POST',
        body: JSON.stringify({
          username: staffUsername,
          fullName: staffFullName,
          ci: staffCi,
          phone: staffPhone,
          email: staffEmail,
          shift: staffShift,
          canApplyPromotions: staffCanPromo,
        }),
      });
      setStaffUsername('');
      setStaffFullName('');
      setStaffCi('');
      setStaffPhone('');
      setStaffEmail('');
      setStaffCanPromo(false);
      await loadAllData();
      notify(
        'success',
        'Personal registrado (contraseña inicial asignada a su CI).'
      );
    } catch (err: any) {
      notify('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetStaffPassword = async (staffId: string) => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      await apiFetch(`/staff/${staffId}`, {
        method: 'PUT',
        body: JSON.stringify({ resetPasswordToCi: true }),
      }).catch(async () => {
        await apiFetch(`/staff/${staffId}`, {
          method: 'PATCH',
          body: JSON.stringify({ resetPasswordToCi: true }),
        });
      });
      notify('success', 'Contraseña restablecida al CI del funcionario.');
    } catch (err: any) {
      notify('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStaffPermission = async (
    member: StaffMember,
    patch: Partial<Pick<StaffMember, 'canApplyPromotions' | 'isActive'>>
  ) => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      await apiFetch(`/staff/${member.id}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      }).catch(async () => {
        await apiFetch(`/staff/${member.id}`, {
          method: 'PATCH',
          body: JSON.stringify(patch),
        });
      });
      await loadAllData();
      notify(
        'success',
        `Permisos de ${member.fullName} actualizados correctamente.`
      );
    } catch (err: any) {
      notify('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- PASO 4: CATÁLOGOS — CREAR, EDITAR Y ACTIVAR/DESACTIVAR ESTUDIOS ---
  const handleSaveStudy = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        name: newStudyName,
        serviceType: newStudyType,
        reportCategory: newStudyCategory,
        normalPrice: Number(newStudyNormalPrice),
        promoPrice: Number(newStudyPromoPrice),
      };

      if (editingStudyId) {
        await apiFetch(`/studies/${editingStudyId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        }).catch(async () => {
          await apiFetch(`/studies/${editingStudyId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          });
        });
        notify('success', 'Estudio actualizado correctamente.');
      } else {
        await apiFetch('/studies', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        notify('success', 'Estudio agregado al catálogo.');
      }

      setEditingStudyId(null);
      setNewStudyName('');
      setNewStudyNormalPrice(150);
      setNewStudyPromoPrice(120);
      await loadAllData();
    } catch (err: any) {
      notify('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartEditStudy = (st: StudyService) => {
    setEditingStudyId(st.id);
    setNewStudyName(st.name);
    setNewStudyType(st.serviceType);
    setNewStudyCategory(st.reportCategory || 'ECOGRAFIA');
    setNewStudyNormalPrice(Number(st.normalPrice));
    setNewStudyPromoPrice(Number(st.promoPrice));
  };

  const handleCancelEditStudy = () => {
    setEditingStudyId(null);
    setNewStudyName('');
    setNewStudyNormalPrice(150);
    setNewStudyPromoPrice(120);
  };

  const handleToggleStudyActive = async (st: StudyService) => {
    const nextState = st.isActive === false ? true : false;
    setLoading(true);
    try {
      await apiFetch(`/studies/${st.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: nextState }),
      }).catch(async () => {
        await apiFetch(`/studies/${st.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ isActive: nextState }),
        });
      });
      setStudies((prev) =>
        prev.map((item) =>
          item.id === st.id ? { ...item, isActive: nextState } : item
        )
      );
      await loadAllData();
      notify(
        'success',
        `Estudio "${st.name}" ${nextState ? 'activado' : 'desactivado'}.`
      );
    } catch (err: any) {
      notify('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- PASO 4: CATÁLOGOS — CREAR, EDITAR Y ACTIVAR/DESACTIVAR DOCTORES ASOCIADOS ---
  const handleSaveDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        fullName: newDoctorName,
        hospitalOrClinic: newDoctorClinic,
        phone: newDoctorPhone,
        agreedCommission: Number(newDoctorCommission),
      };

      if (editingDoctorId) {
        await apiFetch(`/doctors/${editingDoctorId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        }).catch(async () => {
          await apiFetch(`/doctors/${editingDoctorId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          });
        });
        notify('success', 'Datos del Doctor Asociado actualizados.');
      } else {
        await apiFetch('/doctors', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        notify('success', 'Doctor Asociado registrado correctamente.');
      }

      setEditingDoctorId(null);
      setNewDoctorName('');
      setNewDoctorClinic('');
      setNewDoctorPhone('');
      setNewDoctorCommission(30);
      await loadAllData();
    } catch (err: any) {
      notify('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartEditDoctor = (doc: Doctor) => {
    setEditingDoctorId(doc.id);
    setNewDoctorName(doc.fullName);
    setNewDoctorClinic(doc.hospitalOrClinic || '');
    setNewDoctorPhone(doc.phone);
    setNewDoctorCommission(Number(doc.agreedCommission));
  };

  const handleCancelEditDoctor = () => {
    setEditingDoctorId(null);
    setNewDoctorName('');
    setNewDoctorClinic('');
    setNewDoctorPhone('');
    setNewDoctorCommission(30);
  };

  const handleToggleDoctorActive = async (doc: Doctor) => {
    const nextState = doc.isActive === false ? true : false;
    setLoading(true);
    try {
      await apiFetch(`/doctors/${doc.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: nextState }),
      }).catch(async () => {
        await apiFetch(`/doctors/${doc.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ isActive: nextState }),
        });
      });
      setDoctors((prev) =>
        prev.map((item) =>
          item.id === doc.id ? { ...item, isActive: nextState } : item
        )
      );
      await loadAllData();
      notify(
        'success',
        `Doctor "${doc.fullName}" ${nextState ? 'activado' : 'desactivado'}.`
      );
    } catch (err: any) {
      notify('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddField = (type: FieldType) => {
    const idx = fields.length + 1;
    const item: PositionalField = {
      id: `rect_${Date.now()}`,
      name: `campo_${idx}`,
      label: `Campo ${idx}`,
      type,
      xPercent: 10,
      yPercent: Math.min(80, 14 + idx * 7),
      widthPercent: type === 'textarea' ? 80 : 45,
      heightPercent: type === 'textarea' ? 18 : 5,
      fontSize: 11,
    };
    setFields((prev) => [...prev, item]);
    setSelectedFieldId(item.id);
  };

  const updateSelectedField = (patch: Partial<PositionalField>) => {
    if (!selectedFieldId) return;
    setFields((prev) =>
      prev.map((f) => {
        if (f.id !== selectedFieldId) return f;
        const next = { ...f, ...patch };
        if (next.xPercent + next.widthPercent > 100) {
          next.xPercent = Number(
            Math.max(0, 100 - next.widthPercent).toFixed(2)
          );
        }
        if (next.yPercent + next.heightPercent > 100) {
          next.yPercent = Number(
            Math.max(0, 100 - next.heightPercent).toFixed(2)
          );
        }
        return next;
      })
    );
  };

  const selectedField = fields.find((f) => f.id === selectedFieldId) || null;

  const activeStudiesForReception = studies.filter(
    (s) => s.isActive !== false
  );
  const activeDoctorsForReception = doctors.filter(
    (d) => d.isActive !== false
  );

  const filteredEmittedReports = emittedReports.filter((rep) => {
    if (!historySearch.trim()) return true;
    const q = historySearch.toLowerCase();
    return (
      rep.patientName.toLowerCase().includes(q) ||
      rep.studyName.toLowerCase().includes(q) ||
      rep.orderNumber.toLowerCase().includes(q) ||
      (rep.associatedDoctorName || '').toLowerCase().includes(q)
    );
  });

  const commitmentOrders = queueOrders.filter(
    (o) =>
      (o.paymentMethod === 'POR_COMPROMISO' ||
        o.payment?.method === 'POR_COMPROMISO' ||
        o.payment?.paymentMethod === 'POR_COMPROMISO') &&
      !o.isCommitmentPaid &&
      !o.payment?.isPaid &&
      o.status !== 'CANCELADO'
  );

  // Totales financieros para las tarjetas del Módulo 5
  const totalCashCollected = Number(ledgerData?.totalCashCollected ?? 0);
  const totalQrCollected = Number(ledgerData?.totalQrCollected ?? 0);
  const totalCollected = Number(
    ledgerData?.totalCollected ?? totalCashCollected + totalQrCollected
  );

  const totalEmergencySurcharges =
    typeof ledgerData?.totalEmergencySurcharges === 'number'
      ? ledgerData.totalEmergencySurcharges
      : queueOrders
          .filter((o) => o.status !== 'CANCELADO' && o.isEmergency)
          .reduce((acc, o) => acc + Number(o.emergencySurcharge || 0), 0);

  const emergencyOrdersCount =
    typeof ledgerData?.emergencyOrdersCount === 'number'
      ? ledgerData.emergencyOrdersCount
      : queueOrders.filter((o) => o.status !== 'CANCELADO' && o.isEmergency)
          .length;

  const totalAccountsReceivable =
    typeof ledgerData?.totalAccountsReceivable === 'number'
      ? ledgerData.totalAccountsReceivable
      : commitmentOrders.reduce(
          (acc, o) => acc + Number(o.totalAmount || 0),
          0
        );

  const ledgerCommissions: LedgerCommission[] = Array.isArray(
    ledgerData?.commissions
  )
    ? ledgerData.commissions
    : [];

  const filteredCommissions = ledgerCommissions.filter((c) => {
    if (commissionFilter === 'ALL') return true;
    if (commissionFilter === 'PENDIENTE') return c.status === 'PENDIENTE';
    return c.status === 'PAGADO' || c.status === 'PAGADA';
  });

  const totalPendingCommissions =
    typeof ledgerData?.totalPendingCommissions === 'number'
      ? ledgerData.totalPendingCommissions
      : ledgerCommissions
          .filter((c) => c.status === 'PENDIENTE')
          .reduce((acc, c) => acc + Number(c.amount || 0), 0);

  const totalPaidCommissions =
    typeof ledgerData?.totalPaidCommissions === 'number'
      ? ledgerData.totalPaidCommissions
      : ledgerCommissions
          .filter((c) => c.status === 'PAGADO' || c.status === 'PAGADA')
          .reduce((acc, c) => acc + Number(c.amount || 0), 0);

  // =========================================================
  // VISTA DE LOGIN
  // =========================================================
  if (!token) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-sky-600 text-white">
              <Stethoscope className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                CLÍNICA ECOMED
              </h1>
              <p className="text-xs text-slate-500">
                Sistema Integral de Ecografías, Tomografías e Informes A4
              </p>
            </div>
          </div>

          {toast && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
              {toast.message}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                Usuario
              </label>
              <input
                type="text"
                required
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                Contraseña
              </label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-2.5 rounded-lg shadow flex items-center justify-center gap-2 transition"
            >
              <LogIn className="w-4 h-4" />
              {loading ? 'Verificando...' : 'Ingresar al Sistema'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // =========================================================
  // SHELL PRINCIPAL CON SIDEBAR
  // =========================================================
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex">
      <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col justify-between shrink-0">
        <div>
          <div className="p-5 border-b border-slate-800 space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400">
                <Stethoscope className="w-6 h-6" />
              </div>
              <div>
                <h1 className="font-bold text-base tracking-tight text-white">
                  ECOMED
                </h1>
                <span className="text-[11px] text-emerald-400 font-mono block">
                  @{currentUsername} · {userRole}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 pt-1">
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                  canUsePromotions
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {canUsePromotions
                  ? 'Promociones: Habilitado'
                  : 'Promociones: Sin permiso'}
              </span>
            </div>
          </div>

          <nav className="p-3 space-y-1">
            <button
              type="button"
              onClick={() => setActiveModule('reception')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition ${
                activeModule === 'reception'
                  ? 'bg-sky-600 text-white shadow'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <ClipboardPlus className="w-4 h-4" />
              1. Recepción y Órdenes
            </button>

            <button
              type="button"
              onClick={() => setActiveModule('queue')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition ${
                activeModule === 'queue'
                  ? 'bg-sky-600 text-white shadow'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <span className="flex items-center gap-3">
                <Users className="w-4 h-4" />
                2. Sala de Espera
              </span>
              <span className="px-2 py-0.5 text-[10px] rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                {activeQueue.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModule('consultation')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition ${
                activeModule === 'consultation'
                  ? 'bg-sky-600 text-white shadow'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <span className="flex items-center gap-3">
                <FileText className="w-4 h-4" />
                3. Consultorio e Historial
              </span>
              {emittedReports.length > 0 && (
                <span className="px-2 py-0.5 text-[10px] rounded-full bg-sky-500/20 text-sky-300 font-mono">
                  {emittedReports.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveModule('builder')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition ${
                activeModule === 'builder'
                  ? 'bg-sky-600 text-white shadow'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <LayoutTemplate className="w-4 h-4" />
              4. Diseñador Plantillas A4
            </button>

            <button
              type="button"
              onClick={() => setActiveModule('finance')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition ${
                activeModule === 'finance'
                  ? 'bg-sky-600 text-white shadow'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <span className="flex items-center gap-3">
                <Wallet className="w-4 h-4" />
                5. Caja y Finanzas
              </span>
              {(commitmentsCount > 0 || commitmentOrders.length > 0) && (
                <span className="px-2 py-0.5 text-[10px] rounded-full bg-amber-500/20 text-amber-300 font-mono">
                  {commitmentsCount || commitmentOrders.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                if (!isAdmin) {
                  notify(
                    'error',
                    'Acceso restringido: Solo el rol ADMIN puede gestionar Personal y Turnos.'
                  );
                  return;
                }
                setActiveModule('staff');
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition ${
                activeModule === 'staff'
                  ? 'bg-sky-600 text-white shadow'
                  : isAdmin
                  ? 'text-slate-300 hover:bg-slate-800'
                  : 'text-slate-500 hover:bg-slate-800/50 cursor-not-allowed'
              }`}
            >
              <span className="flex items-center gap-3">
                <ShieldCheck className="w-4 h-4" />
                6. Personal y Turnos
              </span>
              {!isAdmin && <Lock className="w-3.5 h-3.5 text-amber-400" />}
            </button>

            <button
              type="button"
              onClick={() => setActiveModule('catalogs')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition ${
                activeModule === 'catalogs'
                  ? 'bg-sky-600 text-white shadow'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Database className="w-4 h-4" />
              7. Catálogos y Doctores
            </button>
          </nav>
        </div>

        <div className="p-4 border-t border-slate-800 space-y-2">
          <button
            type="button"
            onClick={() => setShowPasswordModal(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-sky-950/70 hover:bg-sky-900 border border-sky-800/60 text-xs font-medium text-sky-200 transition"
          >
            <KeyRound className="w-3.5 h-3.5" />
            Cambiar Mi Contraseña
          </button>
          <button
            type="button"
            onClick={loadAllData}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Sincronizar Datos
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-xs font-medium text-rose-200 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* MODAL DE CAMBIO DE CONTRASEÑA PROPIA (PASO 4) */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-sky-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Cambiar Contraseña Personal
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Cuenta activa: @{currentUsername} ({userRole})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleChangeOwnPassword} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 mb-1">
                  Contraseña Actual (opcional si aplica)
                </label>
                <input
                  type="password"
                  placeholder="Ingresa tu contraseña actual"
                  value={currentPasswordInput}
                  onChange={(e) => setCurrentPasswordInput(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">
                  Nueva Contraseña (mínimo 6 caracteres) *
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Nueva contraseña segura"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 mb-1">
                  Confirmar Nueva Contraseña *
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Repite la nueva contraseña"
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold shadow"
                >
                  {loading ? 'Guardando...' : 'Actualizar Contraseña'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col min-w-0">
        {/* Barra Superior con Contador Real de Sala de Espera */}
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full">
              Cola en Espera: {waitingOnlyList.length} en espera ·{' '}
              {activeQueue.length} total activo(s)
            </span>
            {patientInAttention && (
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                Paciente Activo: {patientInAttention.patient?.fullName}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleCallNext}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow flex items-center gap-2 transition"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            Llamar Siguiente Paciente (call-next)
          </button>
        </header>

        {toast && (
          <div
            className={`mx-6 mt-4 px-4 py-3 rounded-xl border flex items-center gap-2 text-sm font-medium shadow-sm ${
              toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        )}

        {/* ========================================================= */}
        {/* MÓDULO 1: RECEPCIÓN Y ADMISIÓN                            */}
        {/* ========================================================= */}
        {activeModule === 'reception' && (
          <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4 h-fit">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <UserPlus className="w-5 h-5 text-sky-600" />
                <div>
                  <h2 className="text-sm font-bold text-slate-800">
                    Registro Ágil de Paciente
                  </h2>
                  <p className="text-xs text-slate-500">
                    Fase 3.1: Alta inmediata en recepción
                  </p>
                </div>
              </div>
              <form onSubmit={handleQuickCreatePatient} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Nombre Completo del Paciente
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Roberto Carlos Vega"
                    value={newPatientName}
                    onChange={(e) => setNewPatientName(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Teléfono / Celular
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. 70711223"
                    value={newPatientPhone}
                    onChange={(e) => setNewPatientPhone(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition"
                >
                  + Registrar y Seleccionar Paciente
                </button>
              </form>
            </div>

            <form
              onSubmit={handleCreateOrder}
              className="lg:col-span-8 bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-800">
                    Nueva Orden de Servicio Clínico
                  </h2>
                  <p className="text-xs text-slate-500">
                    Calcula precios, comisiones de médicos derivadores y
                    prioridad de emergencia
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block">
                    Total a Cobrar
                  </span>
                  <span className="text-2xl font-extrabold text-emerald-600">
                    Bs {calculateOrderTotal().toFixed(2)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                  1. Paciente
                </label>
                <select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                >
                  <option value="">-- Seleccionar paciente --</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName} — Tel: {p.phone}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-600 mb-2">
                  2. Estudios a Realizar (Catálogo Activo)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                  {activeStudiesForReception.map((st) => {
                    const checked = orderStudyIds.includes(st.id);
                    const activePrice =
                      orderOrigin === 'PROMOCION' && canUsePromotions
                        ? st.promoPrice
                        : st.normalPrice;
                    return (
                      <label
                        key={st.id}
                        className={`p-3 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition ${
                          checked
                            ? 'bg-sky-50 border-sky-500 text-sky-900 font-semibold'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setOrderStudyIds((prev) => [...prev, st.id]);
                              } else {
                                setOrderStudyIds((prev) =>
                                  prev.filter((id) => id !== st.id)
                                );
                              }
                            }}
                          />
                          <span>{st.name}</span>
                        </div>
                        <span className="font-mono font-bold text-slate-700">
                          Bs {activePrice}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    3. Origen de la Orden
                  </label>
                  <select
                    value={orderOrigin}
                    onChange={(e) => {
                      const nextOrigin = e.target.value as
                        | 'POR_SU_CUENTA'
                        | 'PROMOCION'
                        | 'RECOMENDACION';
                      if (nextOrigin === 'PROMOCION' && !canUsePromotions) {
                        notify(
                          'error',
                          'Tu usuario no tiene el permiso canApplyPromotions para aplicar tarifas promocionales.'
                        );
                        return;
                      }
                      setOrderOrigin(nextOrigin);
                    }}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="POR_SU_CUENTA">
                      Por su cuenta (Precio Normal)
                    </option>
                    <option value="PROMOCION" disabled={!canUsePromotions}>
                      {canUsePromotions
                        ? 'Promoción (Precio Promocional)'
                        : 'Promoción (Bloqueado — Sin permiso canApplyPromotions)'}
                    </option>
                    <option value="RECOMENDACION">
                      Recomendación Médica (Genera Comisión)
                    </option>
                  </select>
                  {!canUsePromotions && (
                    <span className="text-[11px] text-amber-700 flex items-center gap-1 mt-1">
                      <Lock className="w-3 h-3" /> El rol PERSONAL requiere
                      autorización para aplicar promociones.
                    </span>
                  )}
                </div>

                {orderOrigin === 'RECOMENDACION' && (
                  <div>
                    <label className="block text-xs font-bold uppercase text-amber-700 mb-1">
                      Doctor Asociado Derivador *
                    </label>
                    <select
                      required
                      value={orderDoctorId}
                      onChange={(e) => setOrderDoctorId(e.target.value)}
                      className="w-full border border-amber-400 bg-amber-50 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">
                        -- Seleccionar Doctor Asociado --
                      </option>
                      {activeDoctorsForReception.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.fullName} (Comisión: Bs {d.agreedCommission})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div className="p-3 rounded-lg bg-rose-50/70 border border-rose-200 space-y-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-rose-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={orderIsEmergency}
                      onChange={(e) => setOrderIsEmergency(e.target.checked)}
                    />
                    <Flame className="w-4 h-4 text-rose-600" />
                    Marcar como EMERGENCIA (Prioridad 999 en Cola)
                  </label>
                  {orderIsEmergency && (
                    <div>
                      <label className="block text-[11px] font-semibold text-rose-700 mb-1">
                        Recargo de Emergencia Obligatorio (Bs):
                      </label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={orderEmergencySurcharge}
                        onChange={(e) =>
                          setOrderEmergencySurcharge(Number(e.target.value))
                        }
                        className="w-full border border-rose-300 rounded px-2.5 py-1 text-sm bg-white"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase text-slate-600">
                    4. Modalidad de Pago
                  </label>
                  <select
                    value={orderPaymentMethod}
                    onChange={(e) =>
                      setOrderPaymentMethod(e.target.value as any)
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="QR">Transferencia QR</option>
                    <option value="MIXTO">Pago Mixto (Efectivo + QR)</option>
                    <option value="POR_COMPROMISO">
                      Por Compromiso (Pago Diferido)
                    </option>
                  </select>

                  {orderPaymentMethod === 'MIXTO' && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <input
                        type="number"
                        min={0}
                        placeholder="Monto Efectivo"
                        value={orderAmountCash}
                        onChange={(e) =>
                          setOrderAmountCash(Number(e.target.value))
                        }
                        className="border border-slate-300 rounded px-2 py-1 text-xs"
                      />
                      <input
                        type="number"
                        min={0}
                        placeholder="Monto QR"
                        value={orderAmountQr}
                        onChange={(e) =>
                          setOrderAmountQr(Number(e.target.value))
                        }
                        className="border border-slate-300 rounded px-2 py-1 text-xs"
                      />
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl shadow flex items-center justify-center gap-2 transition"
              >
                <DollarSign className="w-4 h-4" />
                {loading
                  ? 'Registrando Orden...'
                  : 'Emitir Orden y Enviar a Sala de Espera'}
              </button>
            </form>
          </div>
        )}

        {/* ========================================================= */}
        {/* MÓDULO 2: MONITOR REACTIVO DE SALA DE ESPERA              */}
        {/* ========================================================= */}
        {activeModule === 'queue' && (
          <div className="p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <div>
                <h2 className="text-base font-bold text-slate-800">
                  Monitor Reactivo de Sala de Espera ({activeQueue.length}{' '}
                  paciente(s) en cola)
                </h2>
                <p className="text-xs text-slate-500">
                  Ordenado automáticamente por Prioridad (Emergencias 999) y
                  Orden de Llegada (FIFO)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCallNext}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow flex items-center gap-2"
                >
                  <PhoneCall className="w-4 h-4" />
                  Llamar Siguiente (call-next)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {activeQueue.length === 0 ? (
                <div className="col-span-full bg-white p-12 rounded-xl border border-dashed border-slate-300 text-center text-slate-400 text-sm">
                  No hay pacientes registrados en espera. Crea una orden desde
                  Recepción.
                </div>
              ) : (
                activeQueue.map((ord, idx) => (
                  <div
                    key={ord.id}
                    className={`rounded-xl border p-5 bg-white shadow-sm flex flex-col justify-between gap-4 ${
                      ord.isEmergency
                        ? 'border-l-4 border-l-rose-500 ring-1 ring-rose-200'
                        : ord.status === 'EN_ATENCION'
                        ? 'border-l-4 border-l-sky-500 ring-1 ring-sky-200'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                            Turno #{idx + 1}
                          </span>
                          <span
                            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                              ord.status === 'EN_ATENCION'
                                ? 'bg-sky-100 text-sky-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {ord.status}
                          </span>
                        </div>
                        {ord.isEmergency && (
                          <span className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                            <Flame className="w-3.5 h-3.5" /> EMERGENCIA (P:
                            {ord.queuePriority ?? 999})
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-base text-slate-900">
                        {ord.patient?.fullName ||
                          `Paciente #${ord.id.slice(0, 6)}`}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Origen: <strong>{ord.origin}</strong>
                        {ord.patient?.phone
                          ? ` · Tel: ${ord.patient.phone}`
                          : ''}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleOpenOrderInConsultation(ord)}
                        className="flex-1 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5" />
                        Atender / Emitir Informe
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateOrderStatus(ord.id, 'CANCELADO')
                        }
                        className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold py-2 px-2.5 rounded-lg flex items-center gap-1"
                        title="Dar de baja al paciente y anular comisión pendiente"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Dar de Baja
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MÓDULO 3: CONSULTORIO, INFORME PDF E HISTORIAL (PASO 3)   */}
        {/* ========================================================= */}
        {activeModule === 'consultation' && (
          <div className="p-6 space-y-6">
            {/* Conmutador Superior: Redacción en Consultorio vs Historial de Informes Emitidos */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConsultationSubTab('editor')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition ${
                    consultationSubTab === 'editor'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Redacción de Informe Clínico Activo
                </button>
                <button
                  type="button"
                  onClick={() => setConsultationSubTab('history')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition ${
                    consultationSubTab === 'history'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <History className="w-4 h-4" />
                  Pacientes Atendidos / Historial de Informes (
                  {emittedReports.length})
                </button>
              </div>

              {patientInAttention && (
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                  En Consultorio:{' '}
                  <strong>{patientInAttention.patient?.fullName}</strong>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Columna Izquierda (5 cols): Editor Activo o Listado de Historial */}
              {consultationSubTab === 'editor' ? (
                <form
                  onSubmit={handleGeneratePdf}
                  className="lg:col-span-5 bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4"
                >
                  <div className="border-b border-slate-100 pb-3">
                    <h2 className="text-base font-bold text-slate-800">
                      Redacción de Informe Clínico A4
                    </h2>
                    <p className="text-xs text-slate-500">
                      Al generar el PDF con orden activa, los datos se guardan
                      en el Historial Clínico
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                      Estudio / Plantilla A4:
                    </label>
                    <select
                      value={selectedStudyId}
                      onChange={(e) => {
                        setSelectedStudyId(e.target.value);
                        loadTemplateForStudy(
                          e.target.value,
                          patientInAttention
                        );
                      }}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white font-medium"
                    >
                      {studies.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {fields.length === 0 ? (
                    <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                      Este estudio aún no tiene campos dinámicos configurados.
                      Ve al módulo <strong>4. Diseñador Plantillas A4</strong>{' '}
                      para crearlos.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {fields.map((field) => (
                        <div key={field.id}>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            {field.label}{' '}
                            <span className="font-mono font-normal text-slate-400">
                              ({field.name})
                            </span>
                          </label>
                          {field.type === 'textarea' ? (
                            <textarea
                              rows={4}
                              value={fieldValues[field.name] ?? ''}
                              onChange={(e) =>
                                setFieldValues((prev) => ({
                                  ...prev,
                                  [field.name]: e.target.value,
                                }))
                              }
                              className="w-full border border-slate-300 rounded-lg p-2.5 text-sm"
                            />
                          ) : (
                            <input
                              type={field.type}
                              value={fieldValues[field.name] ?? ''}
                              onChange={(e) =>
                                setFieldValues((prev) => ({
                                  ...prev,
                                  [field.name]: e.target.value,
                                }))
                              }
                              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {patientInAttention && (
                    <label className="flex items-center gap-2 pt-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={completeOrderOnGenerate}
                        onChange={(e) =>
                          setCompleteOrderOnGenerate(e.target.checked)
                        }
                      />
                      <CheckCheck className="w-4 h-4 text-emerald-600" />
                      Finalizar orden de {
                        patientInAttention.patient?.fullName
                      }{' '}
                      (pasar a ATENDIDO y guardar en Historial)
                    </label>
                  )}

                  <button
                    type="submit"
                    disabled={loading || fields.length === 0}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 text-white font-bold rounded-xl shadow flex items-center justify-center gap-2 transition"
                  >
                    <FileText className="w-4 h-4" />
                    {loading
                      ? 'Compilando PDF con Puppeteer...'
                      : 'Generar Informe PDF A4'}
                  </button>
                </form>
              ) : (
                <div className="lg:col-span-5 bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
                  <div className="border-b border-slate-100 pb-3">
                    <h2 className="text-base font-bold text-slate-800">
                      Historial de Informes Emitidos
                    </h2>
                    <p className="text-xs text-slate-500">
                      Reimprime cualquier PDF emitido o vuelve a cargarlo en el
                      editor
                    </p>
                  </div>

                  {/* Buscador de Historial */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Buscar por paciente, orden o estudio..."
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs"
                    />
                  </div>

                  {filteredEmittedReports.length === 0 ? (
                    <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs space-y-2">
                      <History className="w-8 h-8 mx-auto stroke-1" />
                      <p>No se encontraron informes médicos emitidos.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto pr-1 text-xs">
                      {filteredEmittedReports.map((rep) => (
                        <div key={rep.id} className="py-3.5 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="font-mono text-[11px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                                {rep.orderNumber}
                              </span>
                              <p className="font-bold text-slate-900 text-sm mt-1">
                                {rep.patientName}
                              </p>
                              <span className="text-slate-500 block">
                                Estudio: <strong>{rep.studyName}</strong>
                              </span>
                              <span className="text-[11px] text-slate-400 block">
                                Emitido por: {rep.generatedByName} ·{' '}
                                {new Date(rep.createdAt).toLocaleString(
                                  'es-BO',
                                  {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  }
                                )}
                              </span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              {rep.orderStatus}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <button
                              type="button"
                              disabled={loading}
                              onClick={() =>
                                handleReprintHistoricalPdf(rep, false)
                              }
                              className="flex-1 py-1.5 px-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg flex items-center justify-center gap-1.5 transition"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              Ver / Reimprimir PDF
                            </button>
                            <button
                              type="button"
                              disabled={loading}
                              onClick={() =>
                                handleReprintHistoricalPdf(rep, true)
                              }
                              className="py-1.5 px-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg flex items-center gap-1 transition"
                              title="Descargar PDF directamente"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={loading}
                              onClick={() =>
                                handleLoadHistoricalReportIntoEditor(rep)
                              }
                              className="py-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg flex items-center gap-1 transition"
                              title="Cargar campos en el editor"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Editar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Columna Derecha (7 cols): Visor PDF A4 Compilado */}
              <div className="lg:col-span-7 bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col h-[800px]">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                  <span className="text-xs font-bold uppercase text-slate-500">
                    Documento A4 Compilado (Previsualización e Impresión)
                  </span>
                  {pdfUrl && (
                    <a
                      href={pdfUrl}
                      download={`informe-ecomed-${Date.now()}.pdf`}
                      className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" /> Descargar PDF
                    </a>
                  )}
                </div>
                {pdfUrl ? (
                  <iframe
                    src={pdfUrl}
                    title="PDF Preview"
                    className="w-full flex-1 rounded border border-slate-200"
                  />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-lg p-6 text-center">
                    <FileText className="w-10 h-10 mb-2 stroke-1" />
                    <p>
                      Completa los campos clínicos o selecciona un registro en{' '}
                      <strong>Historial de Informes</strong> para previsualizar
                      y reimprimir el PDF A4
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MÓDULO 4: DISEÑADOR DE PLANTILLAS A4 CON REACT-RND        */}
        {/* ========================================================= */}
        {activeModule === 'builder' && (
          <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-4 bg-white p-5 rounded-xl shadow-sm border border-slate-200 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Estudio a Configurar:
                </label>
                <select
                  value={selectedStudyId}
                  onChange={(e) => {
                    setSelectedStudyId(e.target.value);
                    loadTemplateForStudy(e.target.value);
                  }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white font-semibold"
                >
                  {studies.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleAddField('text')}
                  className="px-3 py-2 bg-slate-100 hover:bg-sky-50 border border-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Texto Corto
                </button>
                <button
                  type="button"
                  onClick={() => handleAddField('textarea')}
                  className="px-3 py-2 bg-slate-100 hover:bg-sky-50 border border-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Párrafo Clínico
                </button>
                <button
                  type="button"
                  onClick={() => handleAddField('number')}
                  className="px-3 py-2 bg-slate-100 hover:bg-sky-50 border border-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Número
                </button>
                <button
                  type="button"
                  onClick={() => handleAddField('date')}
                  className="px-3 py-2 bg-slate-100 hover:bg-sky-50 border border-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Fecha
                </button>
              </div>

              {selectedField && (
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">
                      Etiqueta:
                    </label>
                    <input
                      type="text"
                      value={selectedField.label}
                      onChange={(e) =>
                        updateSelectedField({ label: e.target.value })
                      }
                      className="w-full border border-slate-300 rounded px-2 py-1 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">
                      Nombre variable (name):
                    </label>
                    <input
                      type="text"
                      value={selectedField.name}
                      onChange={(e) =>
                        updateSelectedField({
                          name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '_'),
                        })
                      }
                      className="w-full border border-slate-300 rounded px-2 py-1 font-mono bg-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 font-mono text-[11px] pt-1">
                    <span>X: {selectedField.xPercent}%</span>
                    <span>Y: {selectedField.yPercent}%</span>
                    <span>W: {selectedField.widthPercent}%</span>
                    <span>H: {selectedField.heightPercent}%</span>
                  </div>
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() =>
                        setFields((prev) =>
                          prev.filter((item) => item.id !== selectedField.id)
                        )
                      }
                      className="w-full py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded font-semibold flex items-center justify-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Eliminar Campo
                    </button>
                  ) : (
                    <p className="text-[11px] text-amber-700 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> Solo ADMIN puede eliminar
                      campos o plantillas.
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Encabezado HTML Base:
                </label>
                <textarea
                  rows={4}
                  value={baseText}
                  onChange={(e) => setBaseText(e.target.value)}
                  className="w-full border border-slate-300 rounded p-2 font-mono text-xs"
                />
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  disabled={loading}
                  className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg shadow flex items-center justify-center gap-2 text-xs"
                >
                  <Save className="w-4 h-4" />
                  Guardar Plantilla A4
                </button>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleDeleteTemplate}
                    disabled={loading}
                    className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-lg flex items-center justify-center gap-1.5 text-xs transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Eliminar / Vaciar Plantilla A4 (Solo ADMIN)
                  </button>
                )}
              </div>
            </div>

            <div className="lg:col-span-8 flex flex-col items-center overflow-auto pb-10">
              <div
                style={{
                  width: `${A4_WIDTH_PX}px`,
                  height: `${A4_HEIGHT_PX}px`,
                }}
                className="relative bg-white shadow-2xl border border-slate-300 select-none overflow-hidden shrink-0"
                onClick={() => setSelectedFieldId(null)}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    padding: '15mm',
                    zIndex: 1,
                    fontSize: '11pt',
                    lineHeight: 1.45,
                    whiteSpace: 'pre-wrap',
                    pointerEvents: 'none',
                  }}
                  dangerouslySetInnerHTML={{ __html: baseText }}
                />

                {fields.map((field) => {
                  const pxX = (field.xPercent / 100) * A4_WIDTH_PX;
                  const pxY = (field.yPercent / 100) * A4_HEIGHT_PX;
                  const pxW = (field.widthPercent / 100) * A4_WIDTH_PX;
                  const pxH = (field.heightPercent / 100) * A4_HEIGHT_PX;
                  const isSelected = field.id === selectedFieldId;

                  return (
                    <Rnd
                      key={field.id}
                      bounds="parent"
                      size={{ width: pxW, height: pxH }}
                      position={{ x: pxX, y: pxY }}
                      onDragStart={(e) => {
                        e.stopPropagation();
                        setSelectedFieldId(field.id);
                      }}
                      onDragStop={(_e, d) => {
                        const newX = Math.max(
                          0,
                          Math.min(
                            100 - field.widthPercent,
                            Number(((d.x / A4_WIDTH_PX) * 100).toFixed(2))
                          )
                        );
                        const newY = Math.max(
                          0,
                          Math.min(
                            100 - field.heightPercent,
                            Number(((d.y / A4_HEIGHT_PX) * 100).toFixed(2))
                          )
                        );
                        setFields((prev) =>
                          prev.map((item) =>
                            item.id === field.id
                              ? { ...item, xPercent: newX, yPercent: newY }
                              : item
                          )
                        );
                      }}
                      onResizeStop={(_e, _dir, ref, _delta, pos) => {
                        const newW = Math.max(
                          2,
                          Math.min(
                            100,
                            Number(
                              ((ref.offsetWidth / A4_WIDTH_PX) * 100).toFixed(2)
                            )
                          )
                        );
                        const newH = Math.max(
                          2,
                          Math.min(
                            100,
                            Number(
                              ((ref.offsetHeight / A4_HEIGHT_PX) * 100).toFixed(
                                2
                              )
                            )
                          )
                        );
                        const newX = Math.max(
                          0,
                          Math.min(
                            100 - newW,
                            Number(((pos.x / A4_WIDTH_PX) * 100).toFixed(2))
                          )
                        );
                        const newY = Math.max(
                          0,
                          Math.min(
                            100 - newH,
                            Number(((pos.y / A4_HEIGHT_PX) * 100).toFixed(2))
                          )
                        );
                        setFields((prev) =>
                          prev.map((item) =>
                            item.id === field.id
                              ? {
                                  ...item,
                                  xPercent: newX,
                                  yPercent: newY,
                                  widthPercent: newW,
                                  heightPercent: newH,
                                }
                              : item
                          )
                        );
                      }}
                      style={{ zIndex: isSelected ? 20 : 10 }}
                      className={
                        isSelected
                          ? 'border-2 border-sky-600 bg-sky-500/15'
                          : 'border border-dashed border-slate-500 bg-amber-500/10'
                      }
                    >
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFieldId(field.id);
                        }}
                        className="w-full h-full p-1 flex flex-col justify-between overflow-hidden cursor-move"
                      >
                        <span className="bg-slate-900/80 text-white px-1.5 py-0.5 rounded text-[10px] font-mono w-fit">
                          {field.label} ({field.name})
                        </span>
                      </div>
                    </Rnd>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MÓDULO 5: CAJA, COMPROMISOS Y LIBRO DIARIO (/api/v1/payments) */}
        {/* ========================================================= */}
        {activeModule === 'finance' && (
          <div className="p-6 space-y-6">
            {/* 1. TARJETAS FINANCIERAS DEL LIBRO DE CAJA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-start justify-between">
                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Total Efectivo
                  </span>
                  <p className="text-2xl font-extrabold text-emerald-600 font-mono">
                    Bs {totalCashCollected.toFixed(2)}
                  </p>
                  <span className="text-[11px] text-slate-400 block">
                    Caja general (Efec + QR): Bs {totalCollected.toFixed(2)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
                  <DollarSign className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-start justify-between">
                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Total Cobros QR
                  </span>
                  <p className="text-2xl font-extrabold text-sky-600 font-mono">
                    Bs {totalQrCollected.toFixed(2)}
                  </p>
                  <span className="text-[11px] text-slate-400 block">
                    Pagos digitales verificados
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-sky-50 text-sky-600">
                  <BadgeDollarSign className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-start justify-between">
                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Recargos de Emergencia
                  </span>
                  <p className="text-2xl font-extrabold text-rose-600 font-mono">
                    Bs {totalEmergencySurcharges.toFixed(2)}
                  </p>
                  <span className="text-[11px] text-rose-600 font-medium block">
                    {emergencyOrdersCount} emergencia(s) prioridad 999
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-rose-50 text-rose-600">
                  <Flame className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-start justify-between">
                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Deudas por Compromiso
                  </span>
                  <p className="text-2xl font-extrabold text-amber-600 font-mono">
                    Bs {totalAccountsReceivable.toFixed(2)}
                  </p>
                  <span className="text-[11px] text-amber-700 font-medium block">
                    {commitmentsCount || commitmentOrders.length} orden(es) por
                    cobrar
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 text-amber-600">
                  <Wallet className="w-6 h-6" />
                </div>
              </div>
            </div>

            {/* 2. SECCIÓN CENTRAL: COMPROMISOS DE PAGO Y COMISIONES MÉDICAS */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Columna Izquierda (4 cols): Liquidación de Órdenes "Por Compromiso" */}
              <div className="lg:col-span-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-amber-600" />
                    <div>
                      <h2 className="text-sm font-bold text-slate-800">
                        Órdenes &ldquo;Por Compromiso&rdquo;
                      </h2>
                      <p className="text-[11px] text-slate-500">
                        Cobro diferido en Recepción / Caja
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                    {commitmentOrders.length} pendiente(s)
                  </span>
                </div>

                {commitmentOrders.length === 0 ? (
                  <div className="py-10 text-center space-y-2 border border-dashed border-slate-200 rounded-xl">
                    <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto" />
                    <p className="text-xs text-slate-500 font-medium">
                      No existen órdenes con deuda por compromiso pendiente.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 text-xs max-h-[420px] overflow-y-auto pr-1">
                    {commitmentOrders.map((ord) => (
                      <div key={ord.id} className="py-3.5 flex flex-col gap-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-bold text-slate-900 text-sm">
                              {ord.patient?.fullName ||
                                `Orden #${ord.id.slice(0, 6)}`}
                            </p>
                            <span className="text-slate-500 block">
                              Estado: <strong>{ord.status}</strong>
                              {ord.patient?.phone
                                ? ` · Tel: ${ord.patient.phone}`
                                : ''}
                            </span>
                          </div>
                          <span className="font-mono font-extrabold text-sm text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                            Bs{' '}
                            {Number(
                              ord.totalAmount || ord.payment?.totalAmount || 0
                            ).toFixed(2)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <select
                            value={settleMethodMap[ord.id] || 'EFECTIVO'}
                            onChange={(e) =>
                              setSettleMethodMap((prev) => ({
                                ...prev,
                                [ord.id]: e.target.value as
                                  | 'EFECTIVO'
                                  | 'QR'
                                  | 'MIXTO',
                              }))
                            }
                            className="flex-1 border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white font-medium"
                          >
                            <option value="EFECTIVO">Cobrar en EFECTIVO</option>
                            <option value="QR">Cobrar por QR</option>
                            <option value="MIXTO">
                              MIXTO (50% Efec / 50% QR)
                            </option>
                          </select>
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => handleSettleCommitment(ord)}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 text-white font-bold rounded-lg shadow-sm transition"
                          >
                            Liquidar Deuda
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Columna Derecha (8 cols): Tabla Interactiva de Comisiones de Doctores Asociados */}
              <div className="lg:col-span-8 bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2.5">
                    <BadgeDollarSign className="w-5 h-5 text-emerald-600" />
                    <div>
                      <h2 className="text-base font-bold text-slate-800">
                        Liquidación de Comisiones de Doctores Asociados
                      </h2>
                      <p className="text-xs text-slate-500">
                        Control de órdenes por RECOMENDACIÓN y pago a médicos
                        derivadores externos
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-3 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold font-mono">
                      Por Pagar: Bs {totalPendingCommissions.toFixed(2)}
                    </span>
                    <span className="px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold font-mono">
                      Pagadas: Bs {totalPaidCommissions.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Pestañas de Filtro */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="inline-flex rounded-lg bg-slate-100 p-1 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setCommissionFilter('ALL')}
                      className={`px-3 py-1.5 rounded-md transition ${
                        commissionFilter === 'ALL'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Todas ({ledgerCommissions.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCommissionFilter('PENDIENTE')}
                      className={`px-3 py-1.5 rounded-md transition ${
                        commissionFilter === 'PENDIENTE'
                          ? 'bg-white text-amber-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Pendientes (
                      {
                        ledgerCommissions.filter(
                          (c) => c.status === 'PENDIENTE'
                        ).length
                      }
                      )
                    </button>
                    <button
                      type="button"
                      onClick={() => setCommissionFilter('PAGADO')}
                      className={`px-3 py-1.5 rounded-md transition ${
                        commissionFilter === 'PAGADO'
                          ? 'bg-white text-emerald-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Pagadas (
                      {
                        ledgerCommissions.filter(
                          (c) =>
                            c.status === 'PAGADO' || c.status === 'PAGADA'
                        ).length
                      }
                      )
                    </button>
                  </div>
                </div>

                {/* Tabla de Comisiones */}
                {filteredCommissions.length === 0 ? (
                  <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                    No hay comisiones médicas registradas para el filtro
                    seleccionado.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px] font-bold">
                          <th className="py-3 px-3.5">Orden / Fecha</th>
                          <th className="py-3 px-3.5">Doctor Asociado</th>
                          <th className="py-3 px-3.5">Paciente / Estudio</th>
                          <th className="py-3 px-3.5 text-right">Comisión</th>
                          <th className="py-3 px-3.5 text-center">Estado</th>
                          <th className="py-3 px-3.5 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredCommissions.map((comm) => {
                          const isPaid =
                            comm.status === 'PAGADO' ||
                            comm.status === 'PAGADA';
                          const isCancelled =
                            comm.status === 'ANULADO' ||
                            comm.orderStatus === 'CANCELADO';

                          return (
                            <tr
                              key={comm.id}
                              className="hover:bg-slate-50/80 transition"
                            >
                              <td className="py-3 px-3.5 whitespace-nowrap">
                                <span className="font-mono font-bold text-slate-800 block">
                                  {comm.orderNumber}
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  {new Date(comm.createdAt).toLocaleDateString(
                                    'es-BO',
                                    {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric',
                                    }
                                  )}
                                </span>
                              </td>

                              <td className="py-3 px-3.5">
                                <p className="font-bold text-slate-900">
                                  {comm.doctorName}
                                </p>
                                <span className="text-[11px] text-slate-500">
                                  {comm.hospitalOrClinic}
                                  {comm.doctorPhone
                                    ? ` · Tel: ${comm.doctorPhone}`
                                    : ''}
                                </span>
                              </td>

                              <td className="py-3 px-3.5">
                                <p className="font-semibold text-slate-800">
                                  {comm.patientName}
                                </p>
                                <span className="text-[11px] text-slate-500 block truncate max-w-[200px]">
                                  {comm.studyNames} ({comm.orderStatus})
                                </span>
                              </td>

                              <td className="py-3 px-3.5 text-right font-mono font-extrabold text-slate-900 whitespace-nowrap">
                                Bs {Number(comm.amount).toFixed(2)}
                              </td>

                              <td className="py-3 px-3.5 text-center whitespace-nowrap">
                                {isCancelled ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700">
                                    ANULADO
                                  </span>
                                ) : isPaid ? (
                                  <div className="inline-flex flex-col items-center">
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                                      <CheckCircle2 className="w-3 h-3" /> PAGADO
                                    </span>
                                    {comm.paidAt && (
                                      <span className="text-[10px] text-slate-400 mt-0.5">
                                        {new Date(
                                          comm.paidAt
                                        ).toLocaleDateString('es-BO')}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                                    PENDIENTE
                                  </span>
                                )}
                              </td>

                              <td className="py-3 px-3.5 text-right whitespace-nowrap">
                                {comm.status === 'PENDIENTE' && !isCancelled ? (
                                  <button
                                    type="button"
                                    disabled={loading}
                                    onClick={() =>
                                      handleSettleCommission(
                                        comm.id,
                                        comm.doctorName
                                      )
                                    }
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 text-white font-bold rounded-lg shadow-sm inline-flex items-center gap-1.5 transition"
                                  >
                                    <CheckCheck className="w-3.5 h-3.5" />
                                    Marcar PAGADO
                                  </button>
                                ) : isPaid ? (
                                  <span className="text-[11px] font-semibold text-emerald-600">
                                    Liquidada ✓
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-slate-400 italic">
                                    Sin cobro (Baja)
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MÓDULO 6: PERSONAL CLÍNICO Y TURNOS (EXCLUSIVO ADMIN)     */}
        {/* ========================================================= */}
        {activeModule === 'staff' && (
          <div className="p-6">
            {!isAdmin ? (
              <div className="bg-white p-10 rounded-xl border border-amber-200 text-center max-w-lg mx-auto space-y-3">
                <Lock className="w-10 h-10 text-amber-500 mx-auto" />
                <h2 className="text-base font-bold text-slate-800">
                  Módulo Exclusivo para Administradores (ADMIN)
                </h2>
                <p className="text-xs text-slate-500">
                  Tu cuenta actual tiene rol <strong>{userRole}</strong>. La
                  gestión de personal, turnos y restablecimiento de claves a CI
                  está reservada al rol ADMIN.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <form
                  onSubmit={handleCreateStaff}
                  className="lg:col-span-5 bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4 h-fit"
                >
                  <div className="border-b border-slate-100 pb-3">
                    <h2 className="text-base font-bold text-slate-800">
                      Registrar Personal Clínico (Staff)
                    </h2>
                    <p className="text-xs text-slate-500">
                      La contraseña inicial se asigna automáticamente con el
                      número de CI
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="col-span-2">
                      <label className="block font-semibold text-slate-600 mb-1">
                        Nombre Completo
                      </label>
                      <input
                        type="text"
                        required
                        value={staffFullName}
                        onChange={(e) => setStaffFullName(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">
                        Usuario (username)
                      </label>
                      <input
                        type="text"
                        required
                        value={staffUsername}
                        onChange={(e) => setStaffUsername(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">
                        Carnet de Identidad (CI)
                      </label>
                      <input
                        type="text"
                        required
                        value={staffCi}
                        onChange={(e) => setStaffCi(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">
                        Teléfono
                      </label>
                      <input
                        type="text"
                        required
                        value={staffPhone}
                        onChange={(e) => setStaffPhone(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">
                        Turno
                      </label>
                      <select
                        value={staffShift}
                        onChange={(e) => setStaffShift(e.target.value as any)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white"
                      >
                        <option value="MANANA">MAÑANA</option>
                        <option value="TARDE">TARDE</option>
                        <option value="NOCHE">NOCHE</option>
                        <option value="ROTATIVO">ROTATIVO</option>
                      </select>
                    </div>
                    <label className="col-span-2 flex items-center gap-2 pt-1 font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={staffCanPromo}
                        onChange={(e) => setStaffCanPromo(e.target.checked)}
                      />
                      Autorizado para aplicar descuentos promocionales
                      (canApplyPromotions)
                    </label>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg text-xs"
                  >
                    + Registrar Personal Clínico
                  </button>
                </form>

                <div className="lg:col-span-7 bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
                  <h2 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-3">
                    Plantel de Usuarios, Permisos y Turnos Activos
                  </h2>
                  <div className="divide-y divide-slate-100 text-xs">
                    {staffList.map((st) => (
                      <div
                        key={st.id}
                        className="py-3 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-800">
                              {st.fullName}{' '}
                              <span className="font-mono text-slate-400">
                                (@{st.username})
                              </span>
                            </p>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                st.isActive === false
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {st.isActive === false ? 'INACTIVO' : 'ACTIVO'}
                            </span>
                          </div>
                          <span className="text-slate-500 block mt-0.5">
                            CI: {st.ci} · Rol: <strong>{st.role}</strong> ·
                            Turno: <strong>{st.shift}</strong> · Promociones:{' '}
                            <strong
                              className={
                                st.canApplyPromotions
                                  ? 'text-emerald-600'
                                  : 'text-slate-500'
                              }
                            >
                              {st.canApplyPromotions ? 'Sí' : 'No'}
                            </strong>
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleStaffPermission(st, {
                                canApplyPromotions: !st.canApplyPromotions,
                              })
                            }
                            className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded font-semibold"
                          >
                            {st.canApplyPromotions
                              ? 'Quitar Promo'
                              : 'Habilitar Promo'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResetStaffPassword(st.id)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold flex items-center gap-1"
                          >
                            <KeyRound className="w-3.5 h-3.5" /> Resetear Clave
                            a CI
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* MÓDULO 7: CATÁLOGOS Y DOCTORES ASOCIADOS (CON EDICIÓN)    */}
        {/* ========================================================= */}
        {activeModule === 'catalogs' && (
          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Submódulo 7.1: Catálogo de Estudios */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h2 className="text-base font-bold text-slate-800">
                  Catálogo de Estudios (Ecografías y Tomografías)
                </h2>
                {editingStudyId && (
                  <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                    Modo Edición
                  </span>
                )}
              </div>

              <form
                onSubmit={handleSaveStudy}
                className="grid grid-cols-2 gap-3 text-xs"
              >
                <input
                  type="text"
                  required
                  placeholder="Nombre del Estudio"
                  value={newStudyName}
                  onChange={(e) => setNewStudyName(e.target.value)}
                  className="col-span-2 border border-slate-300 rounded-lg px-3 py-2"
                />
                <select
                  value={newStudyType}
                  onChange={(e) => setNewStudyType(e.target.value as any)}
                  className="border border-slate-300 rounded-lg px-3 py-2 bg-white"
                >
                  <option value="HACER_ECOGRAFIA">HACER_ECOGRAFIA</option>
                  <option value="SOLO_INFORME">SOLO_INFORME</option>
                </select>
                <select
                  value={newStudyCategory}
                  onChange={(e) => setNewStudyCategory(e.target.value as any)}
                  className="border border-slate-300 rounded-lg px-3 py-2 bg-white"
                >
                  <option value="ECOGRAFIA">ECOGRAFIA</option>
                  <option value="TOMOGRAFIA">TOMOGRAFIA</option>
                </select>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Precio Normal (Bs):
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    placeholder="Precio Normal (Bs)"
                    value={newStudyNormalPrice}
                    onChange={(e) =>
                      setNewStudyNormalPrice(Number(e.target.value))
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Precio Promocional (Bs):
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    placeholder="Precio Promo (Bs)"
                    value={newStudyPromoPrice}
                    onChange={(e) =>
                      setNewStudyPromoPrice(Number(e.target.value))
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div className="col-span-2 flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg transition"
                  >
                    {editingStudyId
                      ? 'Guardar Cambios del Estudio'
                      : '+ Agregar Estudio al Catálogo'}
                  </button>
                  {editingStudyId && (
                    <button
                      type="button"
                      onClick={handleCancelEditStudy}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>

              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto text-xs">
                {studies.map((st) => {
                  const isActive = st.isActive !== false;
                  return (
                    <div
                      key={st.id}
                      className={`py-3 flex flex-wrap items-center justify-between gap-2 ${
                        !isActive ? 'opacity-60 bg-slate-50 px-2 rounded' : ''
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-800">{st.name}</p>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isActive
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            {isActive ? 'ACTIVO' : 'INACTIVO'}
                          </span>
                        </div>
                        <span className="text-slate-400">
                          {st.serviceType}
                          {st.reportCategory ? ` · ${st.reportCategory}` : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right font-mono">
                          <span className="font-bold text-slate-900">
                            Bs {st.normalPrice}
                          </span>
                          <span className="block text-[11px] text-emerald-600">
                            Promo: Bs {st.promoPrice}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEditStudy(st)}
                            title="Editar estudio"
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-sky-100 text-slate-700 hover:text-sky-700 transition"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStudyActive(st)}
                            title={
                              isActive
                                ? 'Desactivar estudio'
                                : 'Activar estudio'
                            }
                            className={`p-1.5 rounded-lg transition ${
                              isActive
                                ? 'bg-rose-50 hover:bg-rose-100 text-rose-600'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
                            }`}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Submódulo 7.2: Catálogo de Doctores Asociados */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h2 className="text-base font-bold text-slate-800">
                  Doctores Asociados (Médicos Derivadores)
                </h2>
                {editingDoctorId && (
                  <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                    Modo Edición
                  </span>
                )}
              </div>

              <form
                onSubmit={handleSaveDoctor}
                className="grid grid-cols-2 gap-3 text-xs"
              >
                <input
                  type="text"
                  required
                  placeholder="Nombre completo del Doctor"
                  value={newDoctorName}
                  onChange={(e) => setNewDoctorName(e.target.value)}
                  className="col-span-2 border border-slate-300 rounded-lg px-3 py-2"
                />
                <input
                  type="text"
                  placeholder="Hospital o Clínica"
                  value={newDoctorClinic}
                  onChange={(e) => setNewDoctorClinic(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2"
                />
                <input
                  type="text"
                  required
                  placeholder="Teléfono"
                  value={newDoctorPhone}
                  onChange={(e) => setNewDoctorPhone(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2"
                />
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Comisión Pactada por Paciente Derivado (Bs):
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={newDoctorCommission}
                    onChange={(e) =>
                      setNewDoctorCommission(Number(e.target.value))
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div className="col-span-2 flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition"
                  >
                    {editingDoctorId
                      ? 'Guardar Cambios del Doctor'
                      : '+ Registrar Doctor Asociado'}
                  </button>
                  {editingDoctorId && (
                    <button
                      type="button"
                      onClick={handleCancelEditDoctor}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>

              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto text-xs">
                {doctors.map((doc) => {
                  const isActive = doc.isActive !== false;
                  return (
                    <div
                      key={doc.id}
                      className={`py-3 flex flex-wrap items-center justify-between gap-2 ${
                        !isActive ? 'opacity-60 bg-slate-50 px-2 rounded' : ''
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-800">
                            {doc.fullName}
                          </p>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isActive
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            {isActive ? 'ACTIVO' : 'INACTIVO'}
                          </span>
                        </div>
                        <span className="text-slate-400">
                          {doc.hospitalOrClinic || 'Consultorio Particular'} ·
                          Tel: {doc.phone}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded">
                          Comisión: Bs {doc.agreedCommission}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleStartEditDoctor(doc)}
                          title="Editar doctor asociado"
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-sky-100 text-slate-700 hover:text-sky-700 transition"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleDoctorActive(doc)}
                          title={
                            isActive
                              ? 'Desactivar doctor asociado'
                              : 'Activar doctor asociado'
                          }
                          className={`p-1.5 rounded-lg transition ${
                            isActive
                              ? 'bg-rose-50 hover:bg-rose-100 text-rose-600'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
                          }`}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
