import { Router }          from 'express';
import { Prisma, Level }   from '@prisma/client';
import { prisma }          from '../lib/prisma';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { validateContent } from '../lib/validateContent';

export const lessonsRouter = Router();

const VALID_LEVELS = Object.values(Level) as string[];

// Traduce el error de constraint único de `order` (P2002) a un 409 legible.
// Devuelve true si ya respondió.
function handlePrismaError(e: unknown, res: import('express').Response): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') {
      res.status(409).json({ error: 'Ya existe una lección con ese orden. Usa otro número de orden.' });
      return true;
    }
    if (e.code === 'P2025') {
      res.status(404).json({ error: 'Lección no encontrada.' });
      return true;
    }
  }
  return false;
}

lessonsRouter.get('/', async (req, res) => {
  const { level } = req.query;
  const validLevels = Object.values(Level);
  const where = (level && validLevels.includes(level as Level))
    ? { level: level as Level, active: true }
    : { active: true };
  const lessons = await prisma.lesson.findMany({
    where, orderBy: { order: 'asc' },
    select: { id:true, title:true, description:true, level:true, duration:true, modules:true, order:true, locked:true },
  });
  res.json(lessons);
});

// Lista para el panel admin: TODAS las lecciones (activas e inactivas/soft-
// deleted), con el flag `active`. Va antes de '/:id' para no ser capturada por
// la ruta param. Protegida: no expone lecciones inactivas a los alumnos.
lessonsRouter.get('/all', requireAdmin, async (_req, res) => {
  const lessons = await prisma.lesson.findMany({
    orderBy: { order: 'asc' },
    select: { id:true, title:true, description:true, level:true, duration:true, modules:true, order:true, locked:true, active:true },
  });
  res.json(lessons);
});

lessonsRouter.get('/:id', requireAuth, async (req, res) => {
  const lesson = await prisma.lesson.findUnique({ where: { id: Number(req.params.id) } });
  if (!lesson) return res.status(404).json({ error: 'Lección no encontrada' });
  res.json(lesson);
});

lessonsRouter.post('/', requireAdmin, async (req, res) => {
  const { title, description, level, duration, modules, order, locked, content } = req.body;

  // Validación de metadatos requeridos
  const missing: string[] = [];
  if (!title?.trim())       missing.push('título');
  if (!description?.trim())  missing.push('descripción');
  if (!VALID_LEVELS.includes(level)) missing.push('nivel (BASICO/INTERMEDIO/AVANZADO)');
  if (!Number.isFinite(Number(duration))) missing.push('duración');
  if (!Number.isFinite(Number(modules)))  missing.push('módulos');
  if (!Number.isFinite(Number(order)))    missing.push('orden');
  if (missing.length) return res.status(400).json({ error: `Faltan o son inválidos: ${missing.join(', ')}.` });

  // Validación de forma del contenido (protege web y móvil)
  const contentErrors = validateContent(content);
  if (contentErrors.length) return res.status(400).json({ error: contentErrors.join(' ') });

  try {
    const lesson = await prisma.lesson.create({
      data: {
        title, description,
        level:    level as Level,
        duration: Number(duration),
        modules:  Number(modules),
        order:    Number(order),
        locked:   Boolean(locked),
        content,
      },
    });
    res.status(201).json(lesson);
  } catch (e) {
    if (handlePrismaError(e, res)) return;
    console.error(e);
    res.status(500).json({ error: 'No se pudo crear la lección.' });
  }
});

lessonsRouter.put('/:id', requireAdmin, async (req, res) => {
  // Whitelist de campos editables (evita que el cliente escriba id/createdAt/etc.)
  const b = req.body ?? {};
  const data: Prisma.LessonUpdateInput = {};
  if (b.title !== undefined)       data.title = b.title;
  if (b.description !== undefined) data.description = b.description;
  if (b.duration !== undefined)    data.duration = Number(b.duration);
  if (b.modules !== undefined)     data.modules = Number(b.modules);
  if (b.order !== undefined)       data.order = Number(b.order);
  if (b.locked !== undefined)      data.locked = Boolean(b.locked);
  if (b.active !== undefined)      data.active = Boolean(b.active); // reactivar / desactivar

  if (b.level !== undefined) {
    if (!VALID_LEVELS.includes(b.level)) return res.status(400).json({ error: 'Nivel inválido.' });
    data.level = b.level as Level;
  }

  // Solo se valida el contenido si viene en la petición
  if (b.content !== undefined) {
    const contentErrors = validateContent(b.content);
    if (contentErrors.length) return res.status(400).json({ error: contentErrors.join(' ') });
    data.content = b.content;
  }

  try {
    const lesson = await prisma.lesson.update({ where: { id: Number(req.params.id) }, data });
    res.json(lesson);
  } catch (e) {
    if (handlePrismaError(e, res)) return;
    console.error(e);
    res.status(500).json({ error: 'No se pudo actualizar la lección.' });
  }
});

lessonsRouter.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await prisma.lesson.update({ where: { id: Number(req.params.id) }, data: { active: false } });
    res.json({ ok: true });
  } catch (e) {
    if (handlePrismaError(e, res)) return;
    console.error(e);
    res.status(500).json({ error: 'No se pudo eliminar la lección.' });
  }
});