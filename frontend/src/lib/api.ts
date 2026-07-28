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
    /**
     * Clasifica 21 landmarks de MediaPipe. Fuente de verdad: ml-service.
     *
     * `worldLandmarks` y `handedness` son OPCIONALES en el contrato, pero
     * mándalos siempre: sin ellos el servicio cae al clasificador de reglas
     * (classifier.py) en vez de usar el modelo entrenado. Son opcionales
     * justamente para que un cliente viejo cacheado por el service worker siga
     * funcionando en lugar de romperse con un 422.
     */
    classify: async (
      landmarks: LandmarkPoint[],
      worldLandmarks?: LandmarkPoint[],
      handedness?: string,
    ): Promise<MLClassifyResponse> => {
      const res = await fetch(`${ML_BASE}/classify`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          landmarks,
          world_landmarks: worldLandmarks,
          handedness,
        }),
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

/**
 * Umbral mínimo de confianza para dar una letra por buena.
 *
 * PENDIENTE DE RECALIBRAR. Este 0.72 se eligió para el clasificador de reglas,
 * donde la confianza era un margen heurístico. Ahora la confianza viene de
 * predict_proba del modelo SVM, que es una probabilidad real y mucho más alta:
 * medida sobre una sesión no vista da mediana 0.971 y deja pasar el 97.7% de
 * los frames, así que este umbral casi no filtra nada.
 *
 * Se mantiene en 0.72 A PROPÓSITO para no desalinear web y móvil (mobile/ usa
 * el mismo valor y su flujo no cambia). Subirlo a ~0.90 se hará en ambas
 * plataformas a la vez, con datos de uso real y con más de un sujeto: el modelo
 * se entrenó con uno solo, así que con otras manos la confianza bajará.
 */
export const ML_CONFIDENCE_GATE = 0.72;

/**
 * Traduce la handedness de MediaPipe **legacy** (el bundle del CDN que usa la
 * web) a la convención de MediaPipe **Tasks** (el que corre en el ml-service).
 *
 * Las dos librerías NO coinciden: verificado sobre la misma foto de una mano
 * derecha sin espejar, Tasks reporta "Right" y legacy reporta "Left"
 * (score 0.996). Legacy invierte la ETIQUETA porque asume que la imagen viene
 * espejada — pero NO invierte las coordenadas world, que llegan en la misma
 * orientación física que las de Tasks.
 *
 * El ml-service usa la handedness para decidir si espeja la mano antes de
 * clasificar, y espera la convención de Tasks. Mandar la etiqueta legacy sin
 * traducir clasificaba mal: para esa misma foto daba "P" (0.392) en vez de
 * "V" (0.642).
 */
export function handednessDesdeLegacy(label?: string): string | undefined {
  if (!label) return undefined;
  return label === 'Left' ? 'Right' : 'Left';
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
