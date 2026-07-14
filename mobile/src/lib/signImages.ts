// Metro necesita require() estáticos (rutas literales) para poder
// empaquetar los assets — no admite claves dinámicas. Cubre las 27
// imágenes en assets/signs/ (A–Z + Ñ), copiadas de frontend/public/signs/.
export const SIGN_IMAGES: Record<string, number> = {
  A: require('../../assets/signs/A.png'),
  B: require('../../assets/signs/B.png'),
  C: require('../../assets/signs/C.png'),
  D: require('../../assets/signs/D.png'),
  E: require('../../assets/signs/E.png'),
  F: require('../../assets/signs/F.png'),
  G: require('../../assets/signs/G.png'),
  H: require('../../assets/signs/H.png'),
  I: require('../../assets/signs/I.png'),
  J: require('../../assets/signs/J.png'),
  K: require('../../assets/signs/K.png'),
  L: require('../../assets/signs/L.png'),
  M: require('../../assets/signs/M.png'),
  N: require('../../assets/signs/N.png'),
  Ñ: require('../../assets/signs/Ñ.png'),
  O: require('../../assets/signs/O.png'),
  P: require('../../assets/signs/P.png'),
  Q: require('../../assets/signs/Q.png'),
  R: require('../../assets/signs/R.png'),
  S: require('../../assets/signs/S.png'),
  T: require('../../assets/signs/T.png'),
  U: require('../../assets/signs/U.png'),
  V: require('../../assets/signs/V.png'),
  W: require('../../assets/signs/W.png'),
  X: require('../../assets/signs/X.png'),
  Y: require('../../assets/signs/Y.png'),
  Z: require('../../assets/signs/Z.png'),
};

/**
 * Solo las señas de tipo Abecedario tienen imagen 1:1 con su letra.
 * Las frases/especiales (Hola, Gracias, CH, RR…) reusan el campo `letter`
 * de forma laxa (p.ej. "Hola" -> letter:'H') y mostrarían la imagen
 * equivocada, así que caen al fallback de insignia con color.
 */
export function getSignImage(letter: string, category: string): number | null {
  if (category !== 'Abecedario') return null;
  return SIGN_IMAGES[letter] ?? null;
}
