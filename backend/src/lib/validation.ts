// Validación de servidor para email y contraseña. Es la barrera REAL (400):
// aplica la misma política que la UI para quien llame a los endpoints saltándose
// el cliente (POST /api/users, PATCH /api/users/:uid/password).
//
// ⚠️ TRADE-OFF: la lógica está REPLICADA del cliente (los tres paquetes no
// comparten módulo). MANTENER EN SYNC con:
//   - frontend/src/lib/passwordPolicy.ts   (+ su copia en mobile/src/lib/passwordPolicy.ts)
//   - frontend/src/lib/emailValidation.ts  (+ su copia en mobile/src/lib/emailValidation.ts)
// Mismo criterio que backend/src/lib/validateContent.ts.

const MIN_PASSWORD_LENGTH = 8;

// Lista corta de contraseñas más comunes (misma que el cliente). No exhaustiva:
// solo bloquea los casos más obvios.
const COMMON_PASSWORDS = new Set([
  '12345678', '123456789', '1234567890', '123456', '1234567', '12345',
  'password', 'password1', 'password123', 'qwerty', 'qwerty123',
  '11111111', '00000000', 'abc12345', 'letmein', 'letmein1', 'admin123',
  'welcome1', 'iloveyou', '12312312', 'monkey123', 'football1', 'dragon12',
  'master12', 'sunshine1', 'princess1', 'abcd1234', 'trustno1',
]);

// Requisitos obligatorios, con su etiqueta (ya en minúscula para el mensaje) —
// mismos que checkPassword() del cliente.
const REQUIREMENTS: { label: string; test: (pw: string) => boolean }[] = [
  { label: `al menos ${MIN_PASSWORD_LENGTH} caracteres`,   test: pw => pw.length >= MIN_PASSWORD_LENGTH },
  { label: 'una letra mayúscula',                          test: pw => /[A-Z]/.test(pw) },
  { label: 'una letra minúscula',                          test: pw => /[a-z]/.test(pw) },
  { label: 'un número',                                    test: pw => /[0-9]/.test(pw) },
  { label: 'un carácter especial (!@#$%^&*, etc.)',        test: pw => /[^A-Za-z0-9]/.test(pw) },
];

// Devuelve el mensaje de error en español, o null si cumple todos los
// requisitos. Mismo orden y mismos textos que passwordError() del cliente.
export function passwordError(pw: string): string | null {
  if (COMMON_PASSWORDS.has(pw.toLowerCase())) {
    return 'Esa contraseña es demasiado común y fácil de adivinar — elige otra.';
  }
  const missing = REQUIREMENTS.filter(r => !r.test(pw)).map(r => r.label);
  if (missing.length > 0) {
    return `Tu contraseña necesita: ${missing.join(', ')}.`;
  }
  return null;
}

// usuario@dominio.tld — sin espacios, TLD alfabético de 2+ (igual que el cliente).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

export function emailError(email: string): string | null {
  const e = (email ?? '').trim();
  if (!e) return 'Ingresa un correo electrónico.';
  if (!EMAIL_RE.test(e)) return 'Ingresa un correo válido (ej. usuario@dominio.com).';
  return null;
}
