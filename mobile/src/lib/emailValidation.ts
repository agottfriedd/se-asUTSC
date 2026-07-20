// Portado de frontend/src/lib/emailValidation.ts — misma lógica.
// Validación de formato de correo en cliente: se usa en el registro y al crear
// usuarios desde el admin, antes de llamar a la API. Valida FORMATO
// (usuario@dominio.tld con TLD de 2+ letras), no que el dominio exista.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export function emailError(email: string): string | null {
  if (!email.trim()) return 'Ingresa un correo electrónico.';
  if (!isValidEmail(email)) return 'Ingresa un correo válido (ej. usuario@dominio.com).';
  return null;
}
