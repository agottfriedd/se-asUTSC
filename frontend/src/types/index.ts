// ─── Auth / User ─────────────────────────────────────────────
export type UserRole = 'student' | 'admin';

export interface UserProfile {
  uid:            string;
  name:           string;
  email:          string;
  initials:       string;
  role:           UserRole;
  streak:         number;
  progress:       number;
  totalCompleted: number;
  totalSigns:     number;
  badges:         number;
  joined:         string;
  level:          string;
}

// ─── Progress ─────────────────────────────────────────────────
export interface LessonProgress {
  userId:    string;
  lessonId:  number;
  progress:  number;   // 0–100
  completed: boolean;
}

// ─── Signs ────────────────────────────────────────────────────
export interface HandConfig {
  f: [number, number, number, number]; // [pinky, ring, middle, index]
  t: 'ext' | 'side' | 'near' | 'over' | 'none';
}

export type SignCategory =
  | 'Abecedario' | 'Saludos' | 'Respuestas'
  | 'Frases útiles' | 'Números' | 'Especiales';

export interface Sign {
  id:          string;
  letter:      string;
  name:        string;
  description: string;
  category:    SignCategory;
  level:       LessonLevel;
  color:       string;
  hand:        HandConfig | null;
  tip?:        string;
}

// ─── Lessons ──────────────────────────────────────────────────
export type LessonLevel = 'Básico' | 'Intermedio' | 'Avanzado';

export interface Lesson {
  id:     number;
  title:  string;
  desc:   string;
  level:  LessonLevel;
  dur:    number;
  mods:   number;
  locked: boolean;
}

// ─── Lesson content blocks ───────────────────────────────────
export type ContentBlock =
  | { type: 'intro';     title: string;  body: string }
  | { type: 'highlight'; emoji: string;  body: string }
  | { type: 'body';      title: string;  body: string }
  | { type: 'tip';       emoji: string;  title: string; body: string }
  | { type: 'sign';      letter: string; name: string; description: string; tip: string }
  | { type: 'stats';     items: { n: string; l: string }[] }
  | { type: 'quiz';      q: string; opts: string[]; correct: number; feedback: string };

// ─── ML Recognition ──────────────────────────────────────────
export interface RecognitionResult {
  letter:     string;
  confidence: number;
  landmarks?: number[][];
}

// ─── Navigation ──────────────────────────────────────────────
export type AppView =
  | 'dashboard' | 'dictionary' | 'lessons'
  | 'lesson' | 'practice' | 'profile' | 'admin';

export type AppPhase = 'landing' | 'auth' | 'app';

// ─── Admin ───────────────────────────────────────────────────
export interface AdminStats {
  totalUsers:        number;
  activeToday:       number;
  lessonsCompleted:  number;
  avgProgress:       number;
}
