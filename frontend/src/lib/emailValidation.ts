// Validación de formato de correo — cliente. Se usa en el registro y al crear
// usuarios desde el admin, ANTES de llamar a la API (mejor UX que esperar el
// rechazo del servidor). Valida FORMATO (usuario@dominio.tld con TLD de 2+
// letras), no que el dominio/TLD exista de verdad — eso solo lo sabe el envío.

// usuario@dominio.tld — sin espacios, con un TLD alfabético de 2+ caracteres.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

// Mensaje de error en español, o null si el correo es válido.
export function emailError(email: string): string | null {
  if (!email.trim()) return 'Ingresa un correo electrónico.';
  if (!isValidEmail(email)) return 'Ingresa un correo válido (ej. usuario@dominio.com).';
  return null;
}
