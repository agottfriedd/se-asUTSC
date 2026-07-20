// Validador de forma del `content` de una lección. La MISMA forma la consumen
// la web (LessonDetailView) y la app móvil, así que un bloque malformado rompe
// ambas. Esto corre en POST/PUT antes de guardar. NO cambia la forma del
// content — solo verifica que cada bloque tenga los campos que su tipo exige.
//
// Tipos y campos requeridos (deben coincidir EXACTAMENTE con ContentBlock del
// frontend en frontend/src/types/index.ts):
//   intro     → title, body
//   body      → title, body
//   highlight → emoji, body
//   tip       → emoji, title, body
//   stats     → items: { n, l }[]  (>=1)
//   quiz      → q, opts (>=2), correct (índice válido), feedback
//   sign      → letter, name, description  (tip es OPCIONAL; si viene, string)

export const BLOCK_TYPES = ['intro', 'body', 'highlight', 'tip', 'stats', 'quiz', 'sign'] as const;

const isStr    = (v: unknown): v is string => typeof v === 'string';
const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

// Devuelve un arreglo de errores en español (vacío = válido).
export function validateContent(content: unknown): string[] {
  const errors: string[] = [];
  if (!Array.isArray(content)) {
    return ['El contenido debe ser un arreglo de bloques.'];
  }

  content.forEach((raw, i) => {
    const n = `Bloque ${i + 1}`;
    if (typeof raw !== 'object' || raw === null) {
      errors.push(`${n}: no es un objeto válido.`);
      return;
    }
    const b = raw as Record<string, unknown>;
    const type = b.type;

    if (!isStr(type) || !(BLOCK_TYPES as readonly string[]).includes(type)) {
      errors.push(`${n}: tipo inválido o ausente ("${String(type)}").`);
      return;
    }

    switch (type) {
      case 'intro':
      case 'body':
        if (!nonEmpty(b.title)) errors.push(`${n} (${type}): falta el título.`);
        if (!nonEmpty(b.body))  errors.push(`${n} (${type}): falta el cuerpo.`);
        break;

      case 'highlight':
        if (!nonEmpty(b.emoji)) errors.push(`${n} (highlight): falta el emoji.`);
        if (!nonEmpty(b.body))  errors.push(`${n} (highlight): falta el cuerpo.`);
        break;

      case 'tip':
        if (!nonEmpty(b.emoji)) errors.push(`${n} (tip): falta el emoji.`);
        if (!nonEmpty(b.title)) errors.push(`${n} (tip): falta el título.`);
        if (!nonEmpty(b.body))  errors.push(`${n} (tip): falta el cuerpo.`);
        break;

      case 'stats': {
        const items = b.items;
        if (!Array.isArray(items) || items.length === 0) {
          errors.push(`${n} (stats): necesita al menos un dato.`);
        } else {
          items.forEach((it, j) => {
            const item = it as Record<string, unknown>;
            if (!it || typeof it !== 'object' || !nonEmpty(item.n) || !nonEmpty(item.l))
              errors.push(`${n} (stats): el dato ${j + 1} necesita número (n) y etiqueta (l).`);
          });
        }
        break;
      }

      case 'quiz': {
        if (!nonEmpty(b.q))        errors.push(`${n} (quiz): falta la pregunta.`);
        if (!nonEmpty(b.feedback)) errors.push(`${n} (quiz): falta la retroalimentación.`);
        const opts = b.opts;
        if (!Array.isArray(opts) || opts.length < 2) {
          errors.push(`${n} (quiz): necesita al menos 2 opciones.`);
        } else if (!opts.every(nonEmpty)) {
          errors.push(`${n} (quiz): hay opciones vacías.`);
        }
        const correct = b.correct;
        const optCount = Array.isArray(opts) ? opts.length : 0;
        if (typeof correct !== 'number' || !Number.isInteger(correct) || correct < 0 || correct >= optCount) {
          errors.push(`${n} (quiz): la respuesta correcta debe ser el índice de una opción válida.`);
        }
        break;
      }

      case 'sign':
        if (!nonEmpty(b.letter))      errors.push(`${n} (sign): falta la letra/seña.`);
        if (!nonEmpty(b.name))        errors.push(`${n} (sign): falta el nombre.`);
        if (!nonEmpty(b.description)) errors.push(`${n} (sign): falta la descripción.`);
        // tip es opcional; solo se valida su tipo si viene presente.
        if (b.tip !== undefined && !isStr(b.tip)) errors.push(`${n} (sign): el tip debe ser texto.`);
        break;
    }
  });

  return errors;
}
