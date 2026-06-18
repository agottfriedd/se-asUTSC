import type { Lesson, ContentBlock, Badge } from '../types';

export const LESSONS: Lesson[] = [
  // ── Básico ──────────────────────────────────────────────────
  {
    id: 1, title: 'Introducción a la LSM',
    desc: 'Historia, importancia y cultura de la comunidad sorda en México',
    level: 'Básico', dur: 15, mods: 5, done: true,  prog: 100, locked: false,
  },
  {
    id: 2, title: 'Dactilología A–M',
    desc: 'Aprende las primeras 14 letras del abecedario manual LSM',
    level: 'Básico', dur: 20, mods: 7, done: true,  prog: 100, locked: false,
  },
  {
    id: 3, title: 'Dactilología N–Z',
    desc: 'Completa el abecedario con letras finales y grafemas especiales (CH, RR)',
    level: 'Básico', dur: 20, mods: 8, done: false, prog: 60,  locked: false,
  },
  {
    id: 4, title: 'Números 1–20',
    desc: 'Señas para los números del 1 al 20 en LSM',
    level: 'Básico', dur: 15, mods: 5, done: false, prog: 0,   locked: false,
  },
  {
    id: 5, title: 'Saludos y despedidas',
    desc: 'Las expresiones básicas de cortesía en LSM',
    level: 'Básico', dur: 12, mods: 4, done: false, prog: 0,   locked: false,
  },
  // ── Intermedio ───────────────────────────────────────────────
  {
    id: 6, title: 'Presentación personal',
    desc: 'Cómo decir tu nombre, edad y lugar de origen en LSM',
    level: 'Intermedio', dur: 25, mods: 6, done: false, prog: 0, locked: true,
  },
  {
    id: 7, title: 'La familia',
    desc: 'Señas para los miembros de la familia y relaciones',
    level: 'Intermedio', dur: 20, mods: 6, done: false, prog: 0, locked: true,
  },
  {
    id: 8, title: 'Emociones y sentimientos',
    desc: 'Expresa emociones con expresión facial y señas LSM',
    level: 'Intermedio', dur: 25, mods: 7, done: false, prog: 0, locked: true,
  },
  {
    id: 9, title: 'Colores y formas',
    desc: 'Vocabulario visual: colores, formas y tamaños en LSM',
    level: 'Intermedio', dur: 20, mods: 5, done: false, prog: 0, locked: true,
  },
  // ── Avanzado ────────────────────────────────────────────────
  {
    id: 10, title: 'Frases del día a día',
    desc: 'Construye oraciones completas con gramática LSM correcta',
    level: 'Avanzado', dur: 30, mods: 8, done: false, prog: 0, locked: true,
  },
  {
    id: 11, title: 'Conversación básica',
    desc: 'Practica diálogos completos con retroalimentación',
    level: 'Avanzado', dur: 35, mods: 9, done: false, prog: 0, locked: true,
  },
  {
    id: 12, title: 'LSM en el campus',
    desc: 'Vocabulario académico para comunicarte en UTSC',
    level: 'Avanzado', dur: 30, mods: 7, done: false, prog: 0, locked: true,
  },
];

// ─── Lesson 1 interactive content ─────────────────────────────
export const LESSON_1_CONTENT: ContentBlock[] = [
  {
    type: 'intro',
    title: '¿Qué es la LSM?',
    body: 'La Lengua de Señas Mexicana (LSM) es el idioma visual-gestual propio de la Comunidad Sorda en México. Tiene gramática, sintaxis y estructura completamente independientes del español escrito.',
  },
  {
    type: 'highlight',
    emoji: '⚠️',
    body: 'La LSM NO es una mímica del español ni una "traducción gestual". Es un idioma completo reconocido legalmente en México desde 2003 (Ley General para la Inclusión de las Personas con Discapacidad).',
  },
  {
    type: 'stats',
    items: [
      { n: '150,000+', l: 'hablantes de LSM en México' },
      { n: '2003',     l: 'año del reconocimiento legal' },
      { n: '7',        l: 'dialectos regionales documentados' },
    ],
  },
  {
    type: 'body',
    title: '¿Por qué aprenderla en UTSC?',
    body: 'Una parte significativa de la comunidad de UTSC incluye personas sordas o con deficiencia auditiva. Aprender LSM básico te permite comunicarte directamente, sin intermediarios, respetando su identidad cultural y lingüística. Esto es exactamente el ODS 4 (educación inclusiva) y ODS 10 (reducción de desigualdades) en acción.',
  },
  {
    type: 'quiz',
    q: '¿La LSM y el Español Signado son el mismo idioma?',
    opts: [
      'Sí, son equivalentes',
      'No, son sistemas completamente distintos',
      'Son variantes del mismo sistema',
      'La LSM no tiene gramática propia',
    ],
    correct: 1,
    feedback: '¡Correcto! El Español Signado es un sistema artificial que sigue la gramática del español. La LSM es un idioma natural con su propia gramática espacial y visual, desarrollada orgánicamente por la comunidad sorda mexicana.',
  },
];

export const LESSON_CONTENT: Record<number, ContentBlock[]> = {
  1: LESSON_1_CONTENT,
};

// ─── Badges ───────────────────────────────────────────────────
export const BADGES_LIST: Badge[] = [
  { emoji: '🌟', name: 'Primera lección',  desc: 'Completaste tu primera lección de LSM' },
  { emoji: '🔥', name: 'Racha de 7 días',  desc: '7 días consecutivos de práctica' },
  { emoji: '🤟', name: 'Alfabeto A–M',     desc: 'Dominaste las primeras 14 letras' },
  { emoji: '🏆', name: 'Explorador',        desc: 'Visitaste todos los módulos de la app' },
];
