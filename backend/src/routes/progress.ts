import { Router } from 'express';
import { prisma }  from '../lib/prisma';

export const progressRouter = Router();

// GET /api/progress/:userId
progressRouter.get('/:userId', async (req, res) => {
  const records = await prisma.progress.findMany({
    where: { userId: req.params.userId },
  });
  res.json(records);
});

// POST /api/progress — crear o actualizar
progressRouter.post('/', async (req, res) => {
  const { userId, lessonId, progress, completed } = req.body;
  if (!userId || !lessonId) {
    return res.status(400).json({ error: 'userId y lessonId son requeridos' });
  }
  const record = await prisma.progress.upsert({
    where:  { userId_lessonId: { userId, lessonId: Number(lessonId) } },
    update: { progress: Number(progress), completed: Boolean(completed) },
    create: { userId, lessonId: Number(lessonId), progress: Number(progress), completed: Boolean(completed) },
  });
  res.json(record);
});

// DELETE /api/progress/:userId — resetear progreso
progressRouter.delete('/:userId', async (req, res) => {
  await prisma.progress.deleteMany({ where: { userId: req.params.userId } });
  res.json({ ok: true });
});
