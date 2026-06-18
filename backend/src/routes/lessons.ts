import { Router }       from 'express';
import { prisma }       from '../lib/prisma';
import { Level }        from '@prisma/client';
import { requireAuth, requireAdmin } from '../middleware/auth';

export const lessonsRouter = Router();

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

lessonsRouter.get('/:id', requireAuth, async (req, res) => {
  const lesson = await prisma.lesson.findUnique({ where: { id: Number(req.params.id) } });
  if (!lesson) return res.status(404).json({ error: 'Lección no encontrada' });
  res.json(lesson);
});

lessonsRouter.post('/', requireAdmin, async (req, res) => {
  const { title, description, level, duration, modules, order, locked, content } = req.body;
  const lesson = await prisma.lesson.create({
    data: {
      title, description,
      level: level as Level,
      duration: Number(duration),
      modules:  Number(modules),
      order:    Number(order),
      locked:   Boolean(locked),
      content,
    },
  });
  res.status(201).json(lesson);
});

lessonsRouter.put('/:id', requireAdmin, async (req, res) => {
  const data = { ...req.body };
  if (data.level) data.level = data.level as Level;
  const lesson = await prisma.lesson.update({
    where: { id: Number(req.params.id) },
    data,
  });
  res.json(lesson);
});

lessonsRouter.delete('/:id', requireAdmin, async (req, res) => {
  await prisma.lesson.update({ where: { id: Number(req.params.id) }, data: { active: false } });
  res.json({ ok: true });
});