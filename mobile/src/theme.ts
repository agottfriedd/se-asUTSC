/**
 * Portado de frontend/src/index.css (:root design tokens).
 * React Native no tiene CSS vars ni Tailwind — estas son las mismas
 * constantes como objeto TS para usar en StyleSheet.create().
 */
export const colors = {
  bg:    '#080D1A',
  bg2:   '#0D1526',
  bg3:   '#111E30',
  card:      'rgba(255, 255, 255, 0.045)',
  cardHover: 'rgba(255, 255, 255, 0.082)',
  border:    'rgba(255, 255, 255, 0.082)',
  border2:   'rgba(255, 255, 255, 0.15)',

  teal:     '#0ED2B8',
  tealDark: '#07A898',
  tealBg:     'rgba(14, 210, 184, 0.14)',
  tealBorder: 'rgba(14, 210, 184, 0.28)',

  violet:   '#9D7BF8',
  violetBg:     'rgba(157, 123, 248, 0.14)',
  violetBorder: 'rgba(157, 123, 248, 0.28)',

  amber:   '#F5A623',
  amberBg: 'rgba(245, 166, 35, 0.14)',

  green:   '#22C97E',
  greenBg: 'rgba(34, 201, 126, 0.14)',

  red:   '#F05050',
  redBg: 'rgba(240, 80, 80, 0.14)',

  text1: '#EFF4FD',
  text2: '#9AABCA',
  text3: '#4E637E',

  // bg (#080D1A) con alpha — para overlays sobre la cámara
  overlay: 'rgba(8, 13, 26, 0.9)',
} as const;

// Niveles de lección (LCOLORS en AppShell.tsx)
export const levelColors: Record<string, string> = {
  Básico:     colors.teal,
  Intermedio: colors.violet,
  Avanzado:   colors.amber,
};

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
