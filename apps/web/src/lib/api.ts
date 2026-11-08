export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export function getStoredToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('ecomed_token') || '';
}

export function setStoredToken(token: string) {
  if (typeof window === 'undefined') return;
  if (!token) {
    localStorage.removeItem('ecomed_token');
    localStorage.removeItem('ecomed_user_meta');
  } else {
    localStorage.setItem('ecomed_token', token);
  }
}

export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  // Si el token guardado expiró o es inválido (401), limpiar sesión y avisar a la UI
  if (res.status === 401 && !endpoint.includes('/auth/login')) {
    setStoredToken('');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('ecomed:unauthorized'));
    }
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const firstError =
      data?.errors?.[0]?.message ||
      data?.message ||
      `Error HTTP ${res.status} en ${endpoint}`;
    throw new Error(firstError);
  }

  return data as T;
}

export function extractArray<T = any>(
  payload: any,
  possibleKeys: string[] = []
): T[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  for (const key of possibleKeys) {
    if (Array.isArray(payload?.[key])) return payload[key];
    if (Array.isArray(payload?.data?.[key])) return payload.data[key];
  }
  return [];
}
