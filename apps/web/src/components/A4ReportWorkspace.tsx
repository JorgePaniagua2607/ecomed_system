'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Rnd } from 'react-rnd';
import {
  Plus,
  Save,
  Trash2,
  FileText,
  LayoutTemplate,
  LogIn,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Download,
} from 'lucide-react';

export type FieldType = 'text' | 'textarea' | 'number' | 'date';

export interface PositionalField {
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
  serviceType: string;
  reportCategory?: string | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

// Dimensiones base en píxeles equivalentes a 210mm x 297mm (A4 a 96 DPI)
const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;

export default function A4ReportWorkspace() {
  // Autenticación y conexión con Backend
  const [token, setToken] = useState<string>('');
  const [username, setUsername] = useState<string>('admin');
  const [password, setPassword] = useState<string>('admin123');
  const [authStatus, setAuthStatus] = useState<string>('');

  // Catálogo de estudios y estudio activo
  const [studies, setStudies] = useState<StudyService[]>([]);
  const [selectedStudyId, setSelectedStudyId] = useState<string>('');

  // Estado de la Plantilla A4
  const [baseText, setBaseText] = useState<string>(
    `<div style="border-bottom: 2px solid #0284c7; padding-bottom: 8px;">\n  <h2 style="margin: 0; color: #0369a1;">CENTRO DE DIAGNÓSTICO ECOMED</h2>\n  <small style="color: #4b5563;">Informe Clínico Especializado - Formato A4</small>\n</div>`
  );
  const [fields, setFields] = useState<PositionalField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);

  // Modo de vista: 'builder' (Admin react-rnd) | 'filler' (Médico llenado + PDF)
  const [activeTab, setActiveTab] = useState<'builder' | 'filler'>('builder');

  // Estado del Llenado Clínico y PDF
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Feedback visual
  const [loading, setLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const canvasRef = useRef<HTMLDivElement | null>(null);

  // Cargar token guardado en localStorage al iniciar
  useEffect(() => {
    const savedToken = localStorage.getItem('ecomed_token');
    if (savedToken) {
      setToken(savedToken);
      setAuthStatus('Conectado con token guardado');
      fetchStudies(savedToken);
    }
  }, []);

  const showMessage = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  // Login rápido contra POST /api/v1/auth/login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      const jwt = data.token || data.data?.token || data.accessToken;

      if (!res.ok || !jwt) {
        throw new Error(data.message || 'Credenciales inválidas');
      }

      localStorage.setItem('ecomed_token', jwt);
      setToken(jwt);
      setAuthStatus(`Sesión activa (${username})`);
      showMessage('success', 'Autenticación exitosa con el backend.');
      await fetchStudies(jwt);
    } catch (err: any) {
      showMessage('error', err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  // Obtener catálogo de estudios (GET /api/v1/studies)
  const fetchStudies = async (jwtToken = token) => {
    if (!jwtToken) return;
    try {
      const res = await fetch(`${API_BASE}/studies`, {
        headers: { Authorization: `Bearer ${jwtToken}` },
      });
      const json = await res.json();
      const list: StudyService[] = Array.isArray(json)
        ? json
        : Array.isArray(json.data)
        ? json.data
        : Array.isArray(json.studies)
        ? json.studies
        : [];

      setStudies(list);
      if (list.length > 0 && !selectedStudyId) {
        setSelectedStudyId(list[0].id);
        await loadTemplateForStudy(list[0].id, jwtToken);
      }
    } catch (err) {
      showMessage('error', 'No se pudo cargar el catálogo de estudios.');
    }
  };

  // Cargar la plantilla A4 de un estudio (GET /api/v1/report-formats/:studyServiceId)
  const loadTemplateForStudy = async (studyId: string, jwtToken = token) => {
    if (!studyId || !jwtToken) return;
    setLoading(true);
    setPdfUrl(null);
    try {
      const res = await fetch(`${API_BASE}/report-formats/${studyId}`, {
        headers: { Authorization: `Bearer ${jwtToken}` },
      });

      if (res.status === 404) {
        // Estudio sin plantilla previa: inicializar lienzo limpio
        setFields([]);
        setSelectedFieldId(null);
        setFieldValues({});
        showMessage('success', 'Estudio sin plantilla previa. Lienzo A4 listo para diseñar.');
        return;
      }

      const json = await res.json();
      if (res.ok && json.data) {
        setBaseText(json.data.baseText || '');
        const loadedFields: PositionalField[] = (json.data.fields || []).map((f: any) => ({
          id: f.id,
          name: f.name || f.id,
          label: f.label || f.name || 'Campo',
          type: f.type || 'text',
          xPercent: Number(f.xPercent) || 10,
          yPercent: Number(f.yPercent) || 10,
          widthPercent: Number(f.widthPercent ?? f.width) || 35,
          heightPercent: Number(f.heightPercent ?? f.height) || 5,
          fontSize: Number(f.fontSize) || 11,
        }));
        setFields(loadedFields);
        setSelectedFieldId(loadedFields[0]?.id || null);

        const initialValues: Record<string, string> = {};
        loadedFields.forEach((f) => {
          initialValues[f.name] = '';
        });
        setFieldValues(initialValues);
      }
    } catch (err) {
      showMessage('error', 'Error al consultar la plantilla del estudio.');
    } finally {
      setLoading(false);
    }
  };

  // Agregar nuevo rectángulo dinámico al lienzo A4
  const handleAddField = (type: FieldType = 'text') => {
    const index = fields.length + 1;
    const newField: PositionalField = {
      id: `rect_${Date.now()}`,
      name: `campo_${index}`,
      label: `Campo Clínico ${index}`,
      type,
      xPercent: 10,
      yPercent: Math.min(80, 15 + index * 7),
      widthPercent: type === 'textarea' ? 80 : 45,
      heightPercent: type === 'textarea' ? 18 : 5,
      fontSize: 11,
    };

    setFields((prev) => [...prev, newField]);
    setSelectedFieldId(newField.id);
  };

  // Actualizar propiedades del campo seleccionado
  const updateSelectedField = (patch: Partial<PositionalField>) => {
    if (!selectedFieldId) return;
    setFields((prev) =>
      prev.map((f) => {
        if (f.id !== selectedFieldId) return f;
        const updated = { ...f, ...patch };
        // Garantizar que no desborde el 100% de la hoja A4
        if (updated.xPercent + updated.widthPercent > 100) {
          updated.xPercent = Number(Math.max(0, 100 - updated.widthPercent).toFixed(2));
        }
        if (updated.yPercent + updated.heightPercent > 100) {
          updated.yPercent = Number(Math.max(0, 100 - updated.heightPercent).toFixed(2));
        }
        return updated;
      })
    );
  };

  const handleDeleteField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
    if (selectedFieldId === id) {
      setSelectedFieldId(null);
    }
  };

  // Guardar Plantilla A4 en el Backend (PUT /api/v1/report-formats/:studyServiceId)
  const handleSaveTemplate = async () => {
    if (!selectedStudyId) {
      showMessage('error', 'Selecciona un estudio primero.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/report-formats/${selectedStudyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          studyServiceId: selectedStudyId,
          baseText,
          fields,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        const detail = json.errors?.[0]?.message || json.message || 'Error de validación';
        throw new Error(detail);
      }

      showMessage('success', json.message || 'Plantilla A4 guardada exitosamente.');
    } catch (err: any) {
      showMessage('error', err.message || 'Error al guardar la plantilla.');
    } finally {
      setLoading(false);
    }
  };

  // Generar PDF real enviando fieldValues a POST /api/v1/reports/generate
  const handleGeneratePdf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudyId) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/reports/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          studyServiceId: selectedStudyId,
          fieldValues,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Error HTTP ${res.status}`);
      }

      const blob = await res.blob();
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      showMessage('success', 'PDF A4 compilado por Puppeteer correctamente.');
    } catch (err: any) {
      showMessage('error', err.message || 'Error generando el informe PDF.');
    } finally {
      setLoading(false);
    }
  };

  const selectedField = fields.find((f) => f.id === selectedFieldId) || null;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col">
      {/* Barra Superior de Conexión y Selección de Estudio */}
      <header className="bg-slate-900 text-white px-6 py-3 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <LayoutTemplate className="w-6 h-6 text-sky-400" />
          <div>
            <h1 className="font-bold text-base tracking-tight">
              ECOMED · Motor de Plantillas e Informes A4
            </h1>
            <p className="text-xs text-slate-400">
              Fase 4: Constructor Drag & Drop (react-rnd) + Compilador PDF (Puppeteer)
            </p>
          </div>
        </div>

        {/* Login Rápido si no hay sesión o para cambiar usuario */}
        <form onSubmit={handleLogin} className="flex items-center gap-2 text-xs">
          <input
            type="text"
            placeholder="Usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-white w-28"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-white w-28"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-sky-600 hover:bg-sky-500 text-white px-3 py-1.5 rounded font-medium flex items-center gap-1.5 transition"
          >
            <LogIn className="w-3.5 h-3.5" />
            Conectar API
          </button>
          {authStatus && <span className="text-emerald-400 ml-2 font-medium">{authStatus}</span>}
        </form>
      </header>

      {/* Sub-barra de Estudio y Selector de Modo */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold uppercase text-slate-500">
            Estudio del Catálogo:
          </label>
          <select
            value={selectedStudyId}
            onChange={(e) => {
              setSelectedStudyId(e.target.value);
              loadTemplateForStudy(e.target.value);
            }}
            className="border border-slate-300 rounded-md px-3 py-1.5 text-sm font-medium bg-white min-w-[280px]"
          >
            {studies.length === 0 && (
              <option value="">-- Conecta la API para cargar estudios --</option>
            )}
            {studies.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name} ({st.serviceType})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => fetchStudies()}
            className="p-1.5 text-slate-600 hover:text-slate-900 border border-slate-200 rounded"
            title="Recargar catálogo"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Pestañas de Modo */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('builder')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'builder'
                ? 'bg-white text-sky-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutTemplate className="w-4 h-4" />
            1. Constructor de Plantilla A4 (Admin)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('filler')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'filler'
                ? 'bg-white text-emerald-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            2. Llenado Clínico y PDF (Médico)
          </button>
        </div>
      </div>

      {/* Notificaciones flotantes */}
      {feedback && (
        <div
          className={`mx-6 mt-4 px-4 py-2.5 rounded-lg border flex items-center gap-2 text-sm font-medium ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODO 1: CONSTRUCTOR DE PLANTILLAS A4 CON REACT-RND                    */}
      {/* ===================================================================== */}
      {activeTab === 'builder' && (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 items-start">
          {/* Panel Lateral de Controles (4 columnas) */}
          <div className="lg:col-span-4 space-y-5 bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <div>
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-2">
                1. Añadir Campos Dinámicos
              </h2>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleAddField('text')}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-sky-50 hover:text-sky-700 border border-slate-200 rounded-lg text-xs font-semibold transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Texto Corto
                </button>
                <button
                  type="button"
                  onClick={() => handleAddField('textarea')}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-sky-50 hover:text-sky-700 border border-slate-200 rounded-lg text-xs font-semibold transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Párrafo Clínico
                </button>
                <button
                  type="button"
                  onClick={() => handleAddField('number')}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-sky-50 hover:text-sky-700 border border-slate-200 rounded-lg text-xs font-semibold transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Numérico
                </button>
                <button
                  type="button"
                  onClick={() => handleAddField('date')}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-sky-50 hover:text-sky-700 border border-slate-200 rounded-lg text-xs font-semibold transition"
                >
                  <Plus className="w-3.5 h-3.5" /> Fecha
                </button>
              </div>
            </div>

            <hr className="border-slate-200" />

            {/* Propiedades del Rectángulo Seleccionado */}
            <div>
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-3">
                2. Propiedades del Campo Activo
              </h2>
              {!selectedField ? (
                <p className="text-xs text-slate-500 italic">
                  Haz clic sobre cualquier bloque en la hoja A4 para configurar su nombre, etiqueta
                  o tamaño de fuente.
                </p>
              ) : (
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">
                      Etiqueta visible (Label):
                    </label>
                    <input
                      type="text"
                      value={selectedField.label}
                      onChange={(e) => updateSelectedField({ label: e.target.value })}
                      className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">
                      Nombre técnico (ID variable, solo letras/números/_):
                    </label>
                    <input
                      type="text"
                      value={selectedField.name}
                      onChange={(e) =>
                        updateSelectedField({
                          name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '_'),
                        })
                      }
                      className="w-full border border-slate-300 rounded px-2.5 py-1.5 font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Tipo:</label>
                      <select
                        value={selectedField.type}
                        onChange={(e) =>
                          updateSelectedField({ type: e.target.value as FieldType })
                        }
                        className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white"
                      >
                        <option value="text">Texto (text)</option>
                        <option value="textarea">Párrafo (textarea)</option>
                        <option value="number">Número (number)</option>
                        <option value="date">Fecha (date)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">
                        Fuente (pt):
                      </label>
                      <input
                        type="number"
                        min={6}
                        max={72}
                        value={selectedField.fontSize}
                        onChange={(e) =>
                          updateSelectedField({ fontSize: Number(e.target.value) || 11 })
                        }
                        className="w-full border border-slate-300 rounded px-2.5 py-1.5"
                      />
                    </div>
                  </div>

                  {/* Coordenadas en Porcentaje (Solo lectura / ajuste fino) */}
                  <div className="bg-slate-50 p-2.5 rounded border border-slate-200 grid grid-cols-2 gap-2 font-mono text-[11px]">
                    <div>X: {selectedField.xPercent}%</div>
                    <div>Y: {selectedField.yPercent}%</div>
                    <div>Ancho: {selectedField.widthPercent}%</div>
                    <div>Alto: {selectedField.heightPercent}%</div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteField(selectedField.id)}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded font-semibold transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Eliminar este campo
                  </button>
                </div>
              )}
            </div>

            <hr className="border-slate-200" />

            {/* HTML / Texto Base de la Hoja A4 */}
            <div>
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-1">
                3. Encabezado / HTML Base Fijo
              </h2>
              <p className="text-[11px] text-slate-500 mb-2">
                Se renderiza al fondo de la hoja A4 con margen de 15mm.
              </p>
              <textarea
                rows={5}
                value={baseText}
                onChange={(e) => setBaseText(e.target.value)}
                className="w-full border border-slate-300 rounded p-2 font-mono text-xs"
              />
            </div>

            <button
              type="button"
              onClick={handleSaveTemplate}
              disabled={loading || !selectedStudyId}
              className="w-full py-2.5 px-4 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-300 text-white font-bold rounded-lg shadow flex items-center justify-center gap-2 transition"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Guardando...' : 'Guardar Plantilla A4 en Base de Datos'}
            </button>
          </div>

          {/* Lienzo Simulado A4 (8 columnas) */}
          <div className="lg:col-span-8 flex flex-col items-center overflow-auto pb-10">
            <div className="mb-2 text-xs text-slate-500 font-medium">
              Lienzo A4 Exacto (210mm × 297mm · {A4_WIDTH_PX}px × {A4_HEIGHT_PX}px) — Arrastra y
              redimensiona los campos dentro de la hoja
            </div>

            <div
              ref={canvasRef}
              style={{ width: `${A4_WIDTH_PX}px`, height: `${A4_HEIGHT_PX}px` }}
              className="relative bg-white shadow-2xl border border-slate-300 select-none overflow-hidden shrink-0"
              onClick={() => setSelectedFieldId(null)}
            >
              {/* Capa de Fondo (idéntica a .base-text-layer en pdf.service.ts) */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  padding: '15mm',
                  zIndex: 1,
                  fontSize: '11pt',
                  lineHeight: 1.45,
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word',
                  pointerEvents: 'none',
                }}
                dangerouslySetInnerHTML={{ __html: baseText }}
              />

              {/* Capa Interactiva de Campos Dinámicos (react-rnd) */}
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
                        Math.min(100 - field.widthPercent, Number(((d.x / A4_WIDTH_PX) * 100).toFixed(2)))
                      );
                      const newY = Math.max(
                        0,
                        Math.min(100 - field.heightPercent, Number(((d.y / A4_HEIGHT_PX) * 100).toFixed(2)))
                      );
                      setFields((prev) =>
                        prev.map((item) =>
                          item.id === field.id ? { ...item, xPercent: newX, yPercent: newY } : item
                        )
                      );
                    }}
                    onResizeStart={(e) => {
                      e.stopPropagation();
                      setSelectedFieldId(field.id);
                    }}
                    onResizeStop={(_e, _dir, ref, _delta, position) => {
                      const newW = Math.max(
                        2,
                        Math.min(100, Number(((ref.offsetWidth / A4_WIDTH_PX) * 100).toFixed(2)))
                      );
                      const newH = Math.max(
                        2,
                        Math.min(100, Number(((ref.offsetHeight / A4_HEIGHT_PX) * 100).toFixed(2)))
                      );
                      const newX = Math.max(
                        0,
                        Math.min(100 - newW, Number(((position.x / A4_WIDTH_PX) * 100).toFixed(2)))
                      );
                      const newY = Math.max(
                        0,
                        Math.min(100 - newH, Number(((position.y / A4_HEIGHT_PX) * 100).toFixed(2)))
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
                    className={`group transition-colors ${
                      isSelected
                        ? 'border-2 border-sky-600 bg-sky-500/15 ring-2 ring-sky-400/30'
                        : 'border border-dashed border-slate-500 bg-amber-500/10 hover:border-sky-500'
                    }`}
                  >
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFieldId(field.id);
                      }}
                      style={{ fontSize: `${field.fontSize}pt` }}
                      className="w-full h-full p-1 flex flex-col justify-between overflow-hidden cursor-move"
                    >
                      <div className="flex items-center justify-between gap-1 bg-slate-900/80 text-white px-1.5 py-0.5 rounded text-[10px] font-mono w-fit">
                        <span>{field.label}</span>
                        <span className="text-sky-300">({field.name})</span>
                      </div>
                      <span className="text-[10px] text-slate-600 font-mono self-end bg-white/80 px-1 rounded">
                        {field.xPercent}%, {field.yPercent}%
                      </span>
                    </div>
                  </Rnd>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODO 2: LLENADO CLÍNICO DEL MÉDICO Y PREVISUALIZACIÓN PDF             */}
      {/* ===================================================================== */}
      {activeTab === 'filler' && (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 items-start">
          {/* Formulario Clínico Dinámico (5 columnas) */}
          <form
            onSubmit={handleGeneratePdf}
            className="lg:col-span-5 bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4"
          >
            <div className="border-b border-slate-200 pb-3">
              <h2 className="text-base font-bold text-slate-800">
                Redacción de Informe Médico
              </h2>
              <p className="text-xs text-slate-500">
                Completa los campos configurados en la plantilla A4 para compilar el PDF final.
              </p>
            </div>

            {fields.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                Esta plantilla aún no tiene campos dinámicos. Ve a la pestaña{' '}
                <strong>Constructor de Plantilla A4</strong>, añade algunos campos y guárdala.
              </div>
            ) : (
              <div className="space-y-4">
                {fields.map((field) => (
                  <div key={field.id}>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {field.label}{' '}
                      <span className="font-mono font-normal text-slate-400">({field.name})</span>
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea
                        rows={5}
                        placeholder={`Redactar ${field.label.toLowerCase()}...`}
                        value={fieldValues[field.name] ?? ''}
                        onChange={(e) =>
                          setFieldValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                        }
                        className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    ) : (
                      <input
                        type={field.type}
                        placeholder={`Ingresar ${field.label.toLowerCase()}...`}
                        value={fieldValues[field.name] ?? ''}
                        onChange={(e) =>
                          setFieldValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                        }
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || fields.length === 0}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 text-white font-bold rounded-lg shadow flex items-center justify-center gap-2 transition"
            >
              <FileText className="w-4 h-4" />
              {loading ? 'Compilando PDF con Puppeteer...' : 'Generar Informe PDF A4'}
            </button>
          </form>

          {/* Visor PDF en Tiempo Real (7 columnas) */}
          <div className="lg:col-span-7 bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col h-[820px]">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
              <span className="text-xs font-bold uppercase text-slate-600">
                Previsualización del Documento A4 Compilado
              </span>
              {pdfUrl && (
                <a
                  href={pdfUrl}
                  download={`informe-ecomed-${Date.now()}.pdf`}
                  className="text-xs bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar PDF
                </a>
              )}
            </div>

            {pdfUrl ? (
              <iframe
                src={pdfUrl}
                title="Visor PDF Ecomed"
                className="w-full flex-1 rounded border border-slate-200"
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-lg">
                <FileText className="w-10 h-10 mb-2 stroke-1" />
                <p>Llena los datos clínicos a la izquierda y pulsa &ldquo;Generar Informe PDF A4&rdquo;</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
