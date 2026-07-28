/**
 * Portado de frontend/src/index.css (:root design tokens).
 * React Native no tiene CSS vars ni Tailwind — estas son las mismas
 * constantes como objeto TS para usar en StyleSheet.create().
 *
 * Identidad UTSC. Naranja y turquesa muestreados del logo oficial
 * (UTES-01.png): #FF8300 = 93.75% de los píxeles opacos, #49C2B3 = 6.25%.
 * Navy y superficie oscura tomados de utsc.edu.mx.
 *
 * REGLA DE ROL: el naranja de marca (#FF8300) da 2.47:1 sobre blanco, así
 * que se usa SOLO como relleno, con `onPri` encima. Para texto naranja
 * existe `priInk`. Lo mismo con el turquesa: marca `secBrand`, texto `sec`.
 *
 * Todos los pares texto/fondo verificados contra WCAG 2.1 AA.
 */
export const colors = {
  // ─── Marca — relleno y gráficos, nunca texto sobre fondo claro ───
  utscOrange: '#FF8300',
  utscTeal:   '#49C2B3',
  utscNavy:   '#192F59',

  // ─── Primario (naranja) ───
  pri:        '#FF8300',
  priHover:   '#EE7A00',
  priActive:  '#D66D00',
  onPri:      '#3D1700',   // 6.43:1 sobre pri
  onFill:     '#FFFFFF',   // texto sobre rellenos oscuros (niveles, navy)
  priInk:     '#AD4E00',   // naranja como texto — 5.43:1 sobre card
  priSoft:    '#FFF3E6',
  priBorder:  '#FFCFA0',
  priRing:    'rgba(255, 131, 0, 0.34)',
  priGlow:    'rgba(255, 131, 0, 0.30)',
  priDisBg:   '#E9EDF4',
  priDisText: '#5A6880',   // 4.75:1 sobre priDisBg — ver nota en index.css

  // ─── Secundario (turquesa) ───
  sec:        '#0C7669',   // 5.51:1 sobre card
  secBrand:   '#49C2B3',
  secSoft:    '#E4F6F3',
  secBorder:  '#9DDDD3',

  // ─── Terciario (navy institucional) ───
  navInk:     '#30466F',   // 9.41:1 sobre card
  navSoft:    '#EBEEF4',
  navBorder:  '#C3CDE0',

  // ─── Superficies ───
  bg:    '#F4F6FA',   // lienzo — más frío que la tarjeta, para que levante
  bg2:   '#FFFFFF',   // cromo: tab bar, headers
  bg3:   '#ECF0F7',   // hundido
  card:      '#FFFFFF',
  cardHover: '#EEF2F9',

  // Superficie oscura — cámara y bloques de énfasis
  ink:    '#141826',
  ink2:   '#1E2437',
  inkT1:  '#EAF0FA',
  inkT2:  '#A9B8D2',
  inkT3:  '#8494B0',
  inkPri: '#FF9A2E',
  // Estados sobre superficie oscura — los de fondo claro son demasiado
  // oscuros para leerse encima del vídeo de la cámara.
  inkGrn: '#45D98A',
  inkRed: '#FF7B6E',
  inkAmb: '#F5B54A',
  // Velos sobre el vídeo de la cámara y detrás de los modales
  camVeil:  'rgba(20, 24, 38, 0.86)',
  camChip:  'rgba(20, 24, 38, 0.70)',
  camTrack: 'rgba(20, 24, 38, 0.55)',
  scrim:    'rgba(14, 23, 41, 0.55)',

  // ─── Bordes ───
  border:      '#E2E8F2',   // divisor decorativo
  border2:     '#C9D4E5',   // hover
  borderStrong:'#7B8BA6',   // contorno de control — 3.45:1, WCAG 1.4.11

  // ─── Texto — neutros con sesgo navy (H≈262°), no gris puro ───
  text1: '#0E1729',   // 17.90:1
  text2: '#43526B',   //  7.90:1
  text3: '#5D6C86',   //  5.31:1

  // ─── Estados ───
  green:   '#0E7A4E',
  greenBg: '#E6F6EE',
  red:     '#C42B21',
  redBg:   '#FDECEA',
  redBorder: '#F3C3BF',
  redBg2:  '#FADAD7',
  amber:   '#8F5B00',
  amberBg: '#FFF4E0',
  blue:    '#1F4FA8',
  blueBg:  '#E9F0FD',

  // ─── Barra de progreso ───
  // El naranja vivo está a luminancia media (0.375): ningún track claro
  // alcanza 3:1 contra él. Con track oscuro da 4.73:1.
  pbarTrack: '#2E3850',
  pbarFill:  '#FF8300',

  // ink con alpha — para overlays sobre la cámara
  overlay: 'rgba(20, 24, 38, 0.9)',

  // ─── Alias heredados ─────────────────────────────────────────
  // Las llaves viejas apuntan a los valores nuevos para que ninguna
  // pantalla tenga que cambiar en esta fase.
  // `teal` era el color primario y se usa 39 veces, casi siempre como texto
  // o tinte de ícono, así que apunta a priInk (seguro para texto).
  // `violet` no tiene origen en la identidad UTSC: pasa al navy institucional.
  teal:       '#AD4E00',
  tealDark:   '#D66D00',
  tealBg:     '#FFF3E6',
  tealBorder: '#FFCFA0',

  violet:       '#30466F',
  violetBg:     '#EBEEF4',
  violetBorder: '#C3CDE0',
} as const;

// Niveles de lección (LCOLORS en AppShell.tsx)
// Teal / naranja / navy: los tres salen de la identidad medida, y se
// distinguen por matiz Y luminosidad (5.51 / 5.43 / 9.41 sobre tarjeta),
// así que siguen siendo separables en deuteranopia y protanopia.
export const levelColors: Record<string, string> = {
  Básico:     colors.sec,
  Intermedio: colors.priInk,
  Avanzado:   colors.navInk,
};

/**
 * El color de acento de cada seña viene de Postgres (backend/prisma/seed.ts),
 * no del código. Sobre fondo claro los ocho reprueban AA — el mejor llega a
 * 3.68:1. Este mapa los lleva a su equivalente accesible conservando el matiz.
 * Los 16 pares (color sólido y sobre tinte 9%) están verificados.
 * No toca la base de datos: traduce en el momento de pintar.
 */
const SIGN_ACCENT: Record<string, string> = {
  '#0ED2B8': '#0C7669',  // turquesa → turquesa UTSC   1.92 → 5.51
  '#9D7BF8': '#5B4BC4',  // violeta  → índigo          3.17 → 6.46
  '#F5A623': '#8F5B00',  // ámbar    → bronce          2.03 → 5.73
  '#3B82F6': '#1F4FA8',  // azul     → navy UTSC       3.68 → 7.66
  '#EC4899': '#B32D6B',  // rosa     → rosa profundo   3.53 → 5.99
  '#22C97E': '#0E7A4E',  // verde    → bosque          2.16 → 5.37
  '#EF4444': '#C42B21',  // rojo     → ladrillo        3.76 → 5.65
  '#F97316': '#AD4E00',  // naranja  → naranja UTSC    2.80 → 5.43
};

export function signAccent(dbColor: string): string {
  return SIGN_ACCENT[dbColor?.toUpperCase()] ?? colors.priInk;
}

export const radius = {
  sm: 8,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

/**
 * Elevación — sombra teñida de navy, nunca negro puro: el negro sobre fondo
 * frío se ve sucio. iOS usa shadow*, Android usa elevation; se pasan juntos.
 */
export const elevation = {
  e1: {
    shadowColor: '#0E1729', shadowOpacity: 0.06, shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  e2: {
    shadowColor: '#0E1729', shadowOpacity: 0.08, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  e3: {
    shadowColor: '#0E1729', shadowOpacity: 0.10, shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  e4: {
    shadowColor: '#0E1729', shadowOpacity: 0.14, shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 }, elevation: 12,
  },
} as const;

/**
 * Feedback al tocar, compartido por todos los Pressable.
 *
 * Solo opacidad, deliberadamente:
 *  - Un `transform: scale` sería movimiento vestibular y habría que apagarlo
 *    con AccessibilityInfo.isReduceMotionEnabled, que es lógica en tiempo de
 *    ejecución. Un cambio de opacidad no lo es, así que respeta "movimiento
 *    reducido" sin necesitar código que lo consulte.
 *  - No hay transición ni bucle de animación: React Native ya re-renderiza el
 *    Pressable al cambiar `pressed`. Coste por frame: cero. Por eso es seguro
 *    también en las pantallas de cámara (M2/M3), donde no se puede perder FPS.
 *
 * Es un objeto constante y compartido: no se asigna memoria nueva en cada
 * pulsación, al contrario que un literal en línea.
 */
export const pressedStyle = { opacity: 0.62 } as const;

/** Duraciones en ms. Nada por encima de 240 en interacción directa. */
export const duration = {
  instant:   120,
  fast:      180,
  base:      240,
  slow:      420,
  celebrate: 600,
} as const;

/**
 * Tipografía. Poppins es la fuente institucional (utsc.edu.mx la usa en 380
 * de 382 nodos de texto). La registra useFonts() en app/_layout.tsx SIN
 * bloquear el render: mientras no termine de cargar —o si falla— React Native
 * no encuentra estas familias y cae a la del sistema, así que la app abre
 * igual. Por eso los estilos conservan también su fontWeight: es lo que
 * mantiene la jerarquía visible cuando el respaldo está en uso.
 */
export const fonts = {
  regular:  'Poppins_400Regular',
  medium:   'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold:     'Poppins_700Bold',
  extrabold:'Poppins_800ExtraBold',
} as const;

/** Escala tipográfica — tamaño / interlineado / peso. */
export const type = {
  display:  { fontSize: 28, lineHeight: 32, fontWeight: '800' as const },
  h1:       { fontSize: 22, lineHeight: 28, fontWeight: '700' as const },
  h2:       { fontSize: 17, lineHeight: 24, fontWeight: '700' as const },
  h3:       { fontSize: 15, lineHeight: 20, fontWeight: '700' as const },
  body:     { fontSize: 14, lineHeight: 21, fontWeight: '400' as const },
  bodySm:   { fontSize: 13, lineHeight: 19, fontWeight: '400' as const },
  label:    { fontSize: 12, lineHeight: 16, fontWeight: '600' as const },
  caption:  { fontSize: 11, lineHeight: 15, fontWeight: '500' as const },
  micro:    { fontSize: 10, lineHeight: 14, fontWeight: '700' as const, letterSpacing: 0.6 },
} as const;
