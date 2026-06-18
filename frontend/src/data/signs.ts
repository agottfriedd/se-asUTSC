import type { Sign, HandConfig } from '../types';

// ─── Hand configurations ─────────────────────────────────────
// fingers: [pinky, ring, middle, index] — 1=extended 0=folded 0.5=bent
const HAND_CFG: Record<string, HandConfig> = {
  A:  { f: [0,   0,   0,   0  ], t: 'side' },
  B:  { f: [1,   1,   1,   1  ], t: 'none' },
  C:  { f: [0.5, 0.5, 0.5, 0.5], t: 'side' },
  D:  { f: [0,   0,   0,   1  ], t: 'side' },
  E:  { f: [0.3, 0.3, 0.3, 0.3], t: 'none' },
  F:  { f: [1,   1,   1,   0  ], t: 'side' },
  G:  { f: [0,   0,   0,   1  ], t: 'ext'  },
  H:  { f: [0,   0,   1,   1  ], t: 'none' },
  I:  { f: [1,   0,   0,   0  ], t: 'none' },
  J:  { f: [1,   0,   0,   0  ], t: 'none' },
  K:  { f: [0,   0,   1,   1  ], t: 'ext'  },
  L:  { f: [0,   0,   0,   1  ], t: 'ext'  },
  M:  { f: [0,   0,   0,   0  ], t: 'none' },
  N:  { f: [0,   0,   0,   0  ], t: 'none' },
  O:  { f: [0.45,0.45,0.45,0.45], t: 'near' },
  P:  { f: [1,   0,   0,   1  ], t: 'none' },
  Q:  { f: [0,   0,   0,   1  ], t: 'ext'  },
  R:  { f: [0,   0,   1,   1  ], t: 'none' },
  S:  { f: [0,   0,   0,   0  ], t: 'over' },
  T:  { f: [0,   0,   0,   0  ], t: 'side' },
  U:  { f: [0,   0,   1,   1  ], t: 'none' },
  V:  { f: [0,   0,   1,   1  ], t: 'none' },
  W:  { f: [0,   1,   1,   1  ], t: 'none' },
  X:  { f: [0,   0,   0,  0.45], t: 'none' },
  Y:  { f: [1,   0,   0,   0  ], t: 'ext'  },
  Z:  { f: [0,   0,   0,   1  ], t: 'none' },
  CH: { f: [0,   0,   1,   0  ], t: 'ext'  },
  RR: { f: [0,   0,   1,   1  ], t: 'none' },
};

const DESCRIPTIONS: Record<string, string> = {
  A:  'Puño cerrado, pulgar al costado del índice',
  B:  'Mano plana, dedos juntos, pulgar doblado hacia la palma',
  C:  'Dedos curvados formando una C con el pulgar',
  D:  'Índice extendido, demás curvados tocando el pulgar',
  E:  'Dedos doblados en primer nudillo, pulgar dentro',
  F:  'Anular, medio y meñique arriba; índice toca el pulgar',
  G:  'Índice apuntando a un lado, pulgar extendido hacia arriba',
  H:  'Índice y medio extendidos horizontalmente juntos',
  I:  'Solo el meñique extendido hacia arriba',
  J:  'Meñique extendido, traza la letra J en el aire',
  K:  'Índice y medio en V, pulgar extendido hacia fuera',
  L:  'Índice apuntando arriba y pulgar extendido: forma de L',
  M:  'Tres dedos doblados sobre el pulgar cerrado',
  N:  'Dos dedos doblados sobre el pulgar cerrado',
  O:  'Todos los dedos forman una O cerrada con el pulgar',
  P:  'Meñique e índice extendidos, demás cerrados',
  Q:  'Índice y pulgar apuntando hacia abajo',
  R:  'Índice y medio cruzados y extendidos',
  S:  'Puño cerrado, pulgar sobre los dedos',
  T:  'Puño cerrado, pulgar entre índice y medio',
  U:  'Índice y medio juntos extendidos hacia arriba',
  V:  'Índice y medio separados en V (signo de paz)',
  W:  'Índice, medio y anular extendidos',
  X:  'Índice ligeramente curvado/enganchado',
  Y:  'Meñique y pulgar extendidos (shaka)',
  Z:  'Índice extendido traza la letra Z en el aire',
  CH: 'Seña combinada C con movimiento lateral del dedo medio',
  RR: 'Índice y medio extendidos con vibración repetida',
};

const PALETTE = [
  '#0ED2B8','#9D7BF8','#F5A623','#3B82F6',
  '#EC4899','#22C97E','#EF4444','#F97316',
];

// Alphabet signs (A–Z + CH + RR)
export const SIGNS_ALPHA: Sign[] = Object.keys(HAND_CFG).map((letter, i) => ({
  id: letter.toLowerCase(),
  letter,
  name: letter,
  description: DESCRIPTIONS[letter] ?? 'Seña del alfabeto LSM',
  category: ['CH', 'RR'].includes(letter) ? 'Especiales' : 'Abecedario',
  level: 'Básico',
  color: PALETTE[i % PALETTE.length],
  hand: HAND_CFG[letter],
}));

// Common phrases / words
export const SIGNS_PHRASES: Sign[] = [
  {
    id: 'hola', letter: 'H', name: 'Hola',
    description: 'Mano abierta agitando de lado a lado frente al cuerpo',
    category: 'Saludos', level: 'Básico', color: '#0ED2B8', hand: null,
  },
  {
    id: 'gracias', letter: 'G', name: 'Gracias',
    description: 'Mano plana desde la barbilla moviéndose hacia adelante',
    category: 'Saludos', level: 'Básico', color: '#9D7BF8', hand: null,
  },
  {
    id: 'porfavor', letter: 'P', name: 'Por favor',
    description: 'Mano plana haciendo movimiento circular en el pecho',
    category: 'Saludos', level: 'Básico', color: '#F5A623', hand: null,
  },
  {
    id: 'si', letter: 'S', name: 'Sí',
    description: 'Puño cerrado moviéndose hacia arriba y abajo',
    category: 'Respuestas', level: 'Básico', color: '#22C97E', hand: null,
  },
  {
    id: 'no', letter: 'N', name: 'No',
    description: 'Índice y medio hacen movimiento lateral de negación',
    category: 'Respuestas', level: 'Básico', color: '#F05050', hand: null,
  },
  {
    id: 'bien', letter: 'B', name: 'Bien / OK',
    description: 'Pulgar extendido hacia arriba con movimiento afirmativo',
    category: 'Respuestas', level: 'Básico', color: '#3B82F6', hand: null,
  },
  {
    id: 'ayuda', letter: 'A', name: 'Ayuda',
    description: 'Puño cerrado sobre la palma abierta, movimiento hacia arriba',
    category: 'Frases útiles', level: 'Intermedio', color: '#EC4899', hand: null,
  },
  {
    id: 'nombre', letter: 'N', name: '¿Nombre?',
    description: 'Índice y medio de cada mano se tocan alternadamente',
    category: 'Frases útiles', level: 'Intermedio', color: '#F97316', hand: null,
  },
];

export const ALL_SIGNS: Sign[] = [...SIGNS_ALPHA, ...SIGNS_PHRASES];

export const SIGN_CATEGORIES = [
  'Todos', 'Abecedario', 'Saludos', 'Respuestas', 'Frases útiles', 'Especiales',
] as const;
