// Política de contraseñas para registro. Todos los requisitos de abajo son
// OBLIGATORIOS y bloqueantes — no se puede crear una cuenta sin cumplirlos
// todos. Firebase Auth solo exige 6 caracteres; esta validación es más
// estricta y debe correr en el cliente ANTES de llamar a Firebase.

export const MIN_PASSWORD_LENGTH = 8;

// Lista corta de las contraseñas más comunes en filtraciones conocidas
// (listas públicas tipo "rockyou" / Have I Been Pwned). No pretende ser
// exhaustiva — solo bloquea los casos más obvios.
const COMMON_PASSWORDS = new Set([
  '12345678', '123456789', '1234567890', '123456', '1234567', '12345',
  'password', 'password1', 'password123', 'qwerty', 'qwerty123',
  '11111111', '00000000', 'abc12345', 'letmein', 'letmein1', 'admin123',
  'welcome1', 'iloveyou', '12312312', 'monkey123', 'football1', 'dragon12',
  'master12', 'sunshine1', 'princess1', 'abcd1234', 'trustno1',
]);

export type PasswordStrength = 'weak' | 'medium' | 'strong';

export interface PasswordChecks {
  minLength: boolean;
  hasUpper:  boolean;
  hasLower:  boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  notCommon: boolean;
}

// Etiquetas en español de cada requisito, en el orden en que se muestran.
export const REQUIREMENT_ITEMS: { key: keyof PasswordChecks; label: string }[] = [
  { key: 'minLength', label: `Al menos ${MIN_PASSWORD_LENGTH} caracteres` },
  { key: 'hasUpper',  label: 'Una letra mayúscula' },
  { key: 'hasLower',  label: 'Una letra minúscula' },
  { key: 'hasNumber', label: 'Un número' },
  { key: 'hasSpecial', label: 'Un carácter especial (!@#$%^&*, etc.)' },
  { key: 'notCommon', label: 'No es una contraseña común' },
];

export function checkPassword(pw: string): PasswordChecks {
  return {
    minLength:  pw.length >= MIN_PASSWORD_LENGTH,
    hasUpper:   /[A-Z]/.test(pw),
    hasLower:   /[a-z]/.test(pw),
    hasNumber:  /[0-9]/.test(pw),
    hasSpecial: /[^A-Za-z0-9]/.test(pw),
    notCommon:  pw.length === 0 || !COMMON_PASSWORDS.has(pw.toLowerCase()),
  };
}

export function allChecksPassed(checks: PasswordChecks): boolean {
  return checks.minLength && checks.hasUpper && checks.hasLower
      && checks.hasNumber && checks.hasSpecial && checks.notCommon;
}

// La fortaleza solo puede ser "media" o "fuerte" si TODOS los requisitos
// obligatorios se cumplen — así el medidor nunca contradice al botón de
// registro (si falta algo, siempre se lee "Débil" y el registro sigue
// bloqueado). Entre las contraseñas que ya cumplen todo, la longitud extra
// sube de media a fuerte.
export function passwordStrength(pw: string): PasswordStrength {
  const checks = checkPassword(pw);
  if (!allChecksPassed(checks)) return 'weak';
  return pw.length >= 12 ? 'strong' : 'medium';
}

// Devuelve el mensaje de error a mostrar, o null si la contraseña cumple
// TODOS los requisitos obligatorios.
export function passwordError(pw: string): string | null {
  const checks = checkPassword(pw);
  if (!checks.notCommon) {
    return 'Esa contraseña es demasiado común y fácil de adivinar — elige otra.';
  }
  const missing = REQUIREMENT_ITEMS
    .filter(item => item.key !== 'notCommon' && !checks[item.key])
    .map(item => item.label.charAt(0).toLowerCase() + item.label.slice(1));
  if (missing.length > 0) {
    return `Tu contraseña necesita: ${missing.join(', ')}.`;
  }
  return null;
}
