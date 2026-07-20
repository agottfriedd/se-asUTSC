import type { ContentBlock } from '../types';

// ESPEJO EXACTO de backend/src/lib/validateContent.ts. Debe mantenerse en sync:
// si el backend cambia una regla, este archivo también. Sirve para bloquear el
// guardado en el cliente ANTES de llamar a la API, y así nunca chocar con un 400.
// La MISMA forma la consume la app móvil, así que las reglas son las mismas.

const nonEmpty = (v: unknown): boolean => typeof v === 'string' && v.trim().length > 0;

// Errores de un solo bloque, SIN prefijo (para mostrar inline bajo su tarjeta).
export function blockErrors(b: ContentBlock): string[] {
  const e: string[] = [];
  switch (b.type) {
    case 'intro':
    case 'body':
      if (!nonEmpty(b.title)) e.push('Falta el título.');
      if (!nonEmpty(b.body))  e.push('Falta el cuerpo.');
      break;

    case 'highlight':
      if (!nonEmpty(b.emoji)) e.push('Falta el emoji.');
      if (!nonEmpty(b.body))  e.push('Falta el cuerpo.');
      break;

    case 'tip':
      if (!nonEmpty(b.emoji)) e.push('Falta el emoji.');
      if (!nonEmpty(b.title)) e.push('Falta el título.');
      if (!nonEmpty(b.body))  e.push('Falta el cuerpo.');
      break;

    case 'stats':
      if (!Array.isArray(b.items) || b.items.length === 0) {
        e.push('Necesita al menos un dato.');
      } else {
        b.items.forEach((it, j) => {
          if (!it || !nonEmpty(it.n) || !nonEmpty(it.l))
            e.push(`El dato ${j + 1} necesita número (n) y etiqueta (l).`);
        });
      }
      break;

    case 'quiz':
      if (!nonEmpty(b.q))        e.push('Falta la pregunta.');
      if (!nonEmpty(b.feedback)) e.push('Falta la retroalimentación.');
      if (!Array.isArray(b.opts) || b.opts.length < 2) {
        e.push('Necesita al menos 2 opciones.');
      } else if (!b.opts.every(nonEmpty)) {
        e.push('Hay opciones vacías.');
      }
      {
        const optCount = Array.isArray(b.opts) ? b.opts.length : 0;
        if (typeof b.correct !== 'number' || !Number.isInteger(b.correct) || b.correct < 0 || b.correct >= optCount)
          e.push('La respuesta correcta debe ser el índice de una opción válida.');
      }
      break;

    case 'sign':
      if (!nonEmpty(b.letter))      e.push('Falta la letra/seña.');
      if (!nonEmpty(b.name))        e.push('Falta el nombre.');
      if (!nonEmpty(b.description)) e.push('Falta la descripción.');
      // tip es opcional; solo se valida su tipo si viene presente.
      if (b.tip !== undefined && typeof b.tip !== 'string') e.push('El tip debe ser texto.');
      break;
  }
  return e;
}

// Lista plana de todos los errores, con "Bloque N (tipo): …" — para el banner y
// como puerta de guardado. Vacío = válido.
export function validateContent(content: ContentBlock[]): string[] {
  const all: string[] = [];
  content.forEach((b, i) => {
    blockErrors(b).forEach(msg => {
      all.push(`Bloque ${i + 1} (${b.type}): ${msg.charAt(0).toLowerCase()}${msg.slice(1)}`);
    });
  });
  return all;
}
