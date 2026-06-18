import { Router }        from 'express';
import { prisma }        from '../lib/prisma';
import { requireAdmin }  from '../middleware/auth';

export const analyticsRouter = Router();

// GET /api/analytics/summary — métricas generales (admin)
analyticsRouter.get('/summary', requireAdmin, async (_req, res) => {
  const [totalLessons, totalSigns] = await Promise.all([
    prisma.lesson.count({ where: { active: true } }),
    prisma.sign.count({   where: { active: true } }),
  ]);
  res.json({ totalLessons, totalSigns });
});
