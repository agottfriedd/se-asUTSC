import type { Badge } from '../types';

// Portado de frontend/src/data/lessons.ts (BADGES_LIST) — contenido
// estático, no viene del backend.
export const BADGES_LIST: Badge[] = [
  { emoji: '🌟', name: 'Primera lección', desc: 'Completaste tu primera lección de LSM' },
  { emoji: '🔥', name: 'Racha de 7 días', desc: '7 días consecutivos de práctica' },
  { emoji: '🤟', name: 'Alfabeto A–M',    desc: 'Dominaste las primeras 14 letras' },
  { emoji: '🏆', name: 'Explorador',       desc: 'Visitaste todos los módulos de la app' },
];
