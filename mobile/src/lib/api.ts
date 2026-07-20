/**
 * Portado de frontend/src/lib/api.ts — mismo contrato con el backend
 * Node (lecciones, diccionario, progreso). La IP viene de config.ts en
 * vez de import.meta.env (no existe en React Native).
 *
 * El servicio ML (reconocimiento) NO pasa por aquí: la pantalla de
 * Práctica habla directo con ML_URL (ver src/lib/config.ts), igual que
 * hacía el prototipo original.
 */
import { API_URL } from './config';
import { auth } from './firebase';

// Adjunta el ID token de Firebase (best-effort): si hay sesión, el backend
// puede verificar al usuario y su rol. Sin esto, las rutas protegidas con
// requireAuth (p.ej. GET /api/lessons/:id) responden 401 "No autenticado".
// Si no hay sesión o falla getIdToken, se envía sin header y los endpoints
// públicos siguen funcionando. Mismo patrón que frontend/src/lib/api.ts.
async function authHeader(): Promise<Record<string, string>> {
  try {
    const token = await auth.currentUser?.getIdToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

// Request unificado: adjunta el token y, si el servidor responde error, intenta
// leer el mensaje en español del cuerpo ({ error }) antes de lanzar.
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { ...(await authHeader()) };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_URL}${path}`, {
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

const get  = <T>(path: string)                => request<T>('GET',    path);
const post = <T>(path: string, body: unknown) => request<T>('POST',   path, body);
const put  = <T>(path: string, body: unknown) => request<T>('PUT',    path, body);
const del  = <T>(path: string)                => request<T>('DELETE', path);

// ─── Lessons ─────────────────────────────────────────────────
export const api = {
  lessons: {
    getAll:  (level?: string) => get<LessonFromAPI[]>(`/api/lessons${level ? `?level=${level}` : ''}`),
    getById: (id: number)     => get<LessonFromAPI>(`/api/lessons/${id}`),
    create:  (data: unknown)  => post<LessonFromAPI>('/api/lessons', data),
    update:  (id: number, data: unknown) => put<LessonFromAPI>(`/api/lessons/${id}`, data),
    delete:  (id: number)     => del(`/api/lessons/${id}`),
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
  health: () => get<{ status: string }>('/health'),
};

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

export interface ProgressFromAPI {
  userId:    string;
  lessonId:  number;
  progress:  number;
  completed: boolean;
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
