/**
 * Espejo TS de los tokens de index.css.
 *
 * index.css sigue siendo la fuente de verdad del tema: aquí solo viven los
 * valores que el CSS no puede resolver porque se calculan en JavaScript —
 * el acento por seña que llega de Postgres, los colores de nivel y los
 * acentos decorativos que se interpolan como `${c}18`.
 *
 * Para cualquier otra cosa usa var(--token) directamente en el estilo.
 * Si cambias un valor aquí, cámbialo también en index.css.
 */

export const colors = {
  // Marca — solo relleno y gráficos (sobre el vídeo de la cámara, por ejemplo)
  utscOrange: '#FF8300',
  utscTeal:   '#49C2B3',
  utscNavy:   '#192F59',

  pri:       '#FF8300',
  priHover:  '#EE7A00',
  priActive: '#D66D00',
  onPri:     '#3D1700',
  priInk:    '#AD4E00',

  sec:       '#0C7669',
  secBrand:  '#49C2B3',
  navInk:    '#30466F',

  green:     '#0E7A4E',
  red:       '#C42B21',
  amber:     '#8F5B00',
  blue:      '#1F4FA8',

  t1: '#0E1729',
  t2: '#43526B',
  t3: '#5D6C86',
} as const;

/**
 * Niveles de lección. Teal / naranja / navy: los tres salen de la identidad
 * medida, y se distinguen por matiz Y luminosidad (5.51 / 5.43 / 9.41 sobre
 * tarjeta), así que siguen siendo separables en deuteranopia y protanopia.
 */
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
  '#F05050': '#C42B21',  // rojo alt (solo en el fallback local de signs.ts)
};

export function signAccent(dbColor: string): string {
  return SIGN_ACCENT[dbColor?.toUpperCase()] ?? colors.priInk;
}
