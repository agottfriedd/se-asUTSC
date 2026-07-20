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
//
// Blindaje anti-degradación: el progreso solo AVANZA y `completed` solo pasa a
// true. Nunca reducimos el progreso máximo alcanzado ni des-completamos una
// lección. Esto protege a web y móvil del bug de "des-completar al repasar":
// reabrir una lección ya terminada dispara un guardado con progress=0/
// completed=false (el efecto por-bloque arranca en step 0); sin este blindaje
// eso borraba el 100%/completada en la BD.
progressRouter.post('/', async (req, res) => {
  const { userId, lessonId, progress, completed } = req.body;
  if (!userId || !lessonId) {
    return res.status(400).json({ error: 'userId y lessonId son requeridos' });
  }
  const lid = Number(lessonId);
  const pct = Number(progress);
  const done = Boolean(completed);

  const existing = await prisma.progress.findUnique({
    where: { userId_lessonId: { userId, lessonId: lid } },
  });

  const nextProgress  = Math.max(existing?.progress ?? 0, Number.isFinite(pct) ? pct : 0);
  const nextCompleted = (existing?.completed ?? false) || done;

  const record = await prisma.progress.upsert({
    where:  { userId_lessonId: { userId, lessonId: lid } },
    update: { progress: nextProgress, completed: nextCompleted },
    create: { userId, lessonId: lid, progress: nextProgress, completed: nextCompleted },
  });
  res.json(record);
});

// DELETE /api/progress/:userId — resetear progreso
progressRouter.delete('/:userId', async (req, res) => {
  await prisma.progress.deleteMany({ where: { userId: req.params.userId } });
  res.json({ ok: true });
});
