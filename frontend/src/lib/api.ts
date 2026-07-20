import { auth } from './firebase';

const BASE    = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const ML_BASE = import.meta.env.VITE_ML_URL  ?? 'http://localhost:8000';

// Adjunta el ID token de Firebase (best-effort): si hay sesión, el backend
// puede verificar al usuario y su rol. Si no hay sesión o falla, se envía sin
// header y los endpoints públicos siguen funcionando.
async function authHeader(): Promise<Record<string, string>> {
  try {
    const token = await auth.currentUser?.getIdToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

// Request unificado: adjunta token, y si el servidor responde error intenta
// leer el mensaje en español del cuerpo ({ error }) antes de lanzar.
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { ...(await authHeader()) };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let message = `API error ${res.status}: ${path}`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch { /* respuesta sin cuerpo JSON */ }
    throw new Error(message);
  }
  return res.json();
}

const get   = <T>(path: string)                 => request<T>('GET',    path);
const post  = <T>(path: string, body: unknown)  => request<T>('POST',   path, body);
const put   = <T>(path: string, body: unknown)  => request<T>('PUT',    path, body);
const patch = <T>(path: string, body: unknown)  => request<T>('PATCH',  path, body);
const del   = <T>(path: string)                 => request<T>('DELETE', path);

// ─── Lessons ─────────────────────────────────────────────────
export const api = {
  lessons: {
    getAll:      (level?: string) => get<LessonFromAPI[]>(`/api/lessons${level ? `?level=${level}` : ''}`),
    getAllAdmin: ()               => get<LessonFromAPI[]>('/api/lessons/all'), // incluye inactivas (requiere admin)
    getById:     (id: number)     => get<LessonFromAPI>(`/api/lessons/${id}`),
    create:      (data: unknown)  => post<LessonFromAPI>('/api/lessons', data),
    update:      (id: number, data: unknown) => put<LessonFromAPI>(`/api/lessons/${id}`, data),
    delete:      (id: number)     => del(`/api/lessons/${id}`),
  },
  dictionary: {
    getAll:  (params?: { category?: string; q?: string }) => {
      const qs = new URLSearchParams(params as Record<string, string>).toString();
      return get<SignFromAPI[]>(`/api/dictionary${qs ? `?${qs}` : ''}`);
    },
    create:  (data: unknown)  => post<SignFromAPI>('/api/dictionary', data),
    update:  (id: string, data: unknown) => put<SignFromAPI>(`/api/dictionary/${id}`, data),
    delete:  (id: string)     => del(`/api/dictionary/${id}`),
  },
  progress: {
    getAll:  (userId: string) => get<ProgressFromAPI[]>(`/api/progress/${userId}`),
    save:    (data: { userId: string; lessonId: number; progress: number; completed: boolean }) =>
      post<ProgressFromAPI>('/api/progress', data),
  },

  // ─── Administración de usuarios (backend + Firebase Admin SDK) ─────
  // Todos requieren rol admin real (verificado en el servidor con el ID token).
  users: {
    list:    ()                              => get<AdminUser[]>('/api/users'),
    create:  (data: { email: string; password: string; name: string; role: UserRoleAPI }) =>
      post<AdminUser>('/api/users', data),
    remove:  (uid: string)                   => del<{ ok: true }>(`/api/users/${uid}`),
    setRole: (uid: string, role: UserRoleAPI) =>
      patch<{ ok: true; uid: string; role: UserRoleAPI }>(`/api/users/${uid}/role`, { role }),
    setDisabled: (uid: string, disabled: boolean) =>
      patch<{ ok: true; uid: string; disabled: boolean }>(`/api/users/${uid}/disabled`, { disabled }),
    setPassword: (uid: string, password: string) =>
      patch<{ ok: true; uid: string }>(`/api/users/${uid}/password`, { password }),
  },

  health: () => get<{ status: string }>('/health'),

  // ─── Servicio ML (FastAPI, puerto distinto al backend) ─────
  ml: {
    /** Clasifica 21 landmarks de MediaPipe. Fuente de verdad: ml-service/app/classifier.py */
    classify: async (landmarks: LandmarkPoint[]): Promise<MLClassifyResponse> => {
      const res = await fetch(`${ML_BASE}/classify`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ landmarks }),
      });
      if (!res.ok) throw new Error(`ML error ${res.status}: /classify`);
      return res.json();
    },
    health: async (): Promise<{ status: string }> => {
      const res = await fetch(`${ML_BASE}/health`);
      if (!res.ok) throw new Error(`ML error ${res.status}: /health`);
      return res.json();
    },
  },
};

// ─── ML service types ─────────────────────────────────────────
export interface LandmarkPoint { x: number; y: number; z: number }

export interface MLClassifyResponse {
  letter:     string;  // 'A'..'Y' o '?' si no supera el umbral
  confidence: number;  // [0,1]
}

// ─── API response types ───────────────────────────────────────
export interface LessonFromAPI {
  id:          number;
  title:       string;
  description: string;
  level:       'BASICO' | 'INTERMEDIO' | 'AVANZADO';
  duration:    number;
  modules:     number;
  order:       number;
  locked:      boolean;
  active?:     boolean;   // solo lo devuelve GET /all (panel admin)
  content?:    unknown[];
}

export interface SignFromAPI {
  id:          string;
  letter:      string;
  name:        string;
  description: string;
  category:    string;
  level:       string;
  color:       string;
  handConfig:  unknown | null;
  tip?:        string;
}

export type UserRoleAPI = 'student' | 'admin';

// Usuario tal como lo devuelve el backend (merge de Firebase Auth + RTDB).
export interface AdminUser {
  uid:        string;
  email:      string;
  name:       string;
  role:       UserRoleAPI;
  disabled:   boolean;
  created?:   string;
  lastLogin?: string;
}

export interface ProgressFromAPI {
  userId:    string;
  lessonId:  number;
  progress:  number;
  completed: boolean;
  updatedAt?: string;
}

// ─── Helpers ─────────────────────────────────────────────────
export function apiLevelToLabel(level: string): 'Básico' | 'Intermedio' | 'Avanzado' {
  const map: Record<string, 'Básico' | 'Intermedio' | 'Avanzado'> = {
    BASICO:      'Básico',
    INTERMEDIO:  'Intermedio',
    AVANZADO:    'Avanzado',
  };
  return map[level] ?? 'Básico';
}
