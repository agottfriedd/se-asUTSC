import type { Badge } from '../types';

// Nota: las lecciones y su contenido se cargan desde el backend (BD) vía
// api.lessons. Los antiguos exports hardcodeados (LESSONS, LESSON_1_CONTENT,
// LESSON_CONTENT) eran código muerto y se eliminaron. Un borrador alterno con
// señas adicionales aún vive en data/content.ts (también sin usar) pendiente de
// migrar a la BD con el editor de lecciones.

// ─── Badges ───────────────────────────────────────────────────
export const BADGES_LIST: Badge[] = [
  { emoji: '🌟', name: 'Primera lección',  desc: 'Completaste tu primera lección de LSM' },
  { emoji: '🔥', name: 'Racha de 7 días',  desc: '7 días consecutivos de práctica' },
  { emoji: '🤟', name: 'Alfabeto A–M',     desc: 'Dominaste las primeras 14 letras' },
  { emoji: '🏆', name: 'Explorador',        desc: 'Visitaste todos los módulos de la app' },
];
