const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

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
