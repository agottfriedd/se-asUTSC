import { Router } from 'express';
import { prisma }  from '../lib/prisma';
import { requireAdmin } from '../middleware/auth';

export const dictionaryRouter = Router();

// GET /api/dictionary — todas las señas activas
dictionaryRouter.get('/', async (req, res) => {
  const { category, level, q } = req.query as Record<string, string>;
  const where: Record<string, unknown> = { active: true };
  if (category && category !== 'Todos') where.category = category;
  if (level)    where.level    = level;
  if (q)        where.name     = { contains: q, mode: 'insensitive' };
  const signs = await prisma.sign.findMany({ where, orderBy: { name: 'asc' } });
  res.json(signs);
});

// GET /api/dictionary/:id
dictionaryRouter.get('/:id', async (req, res) => {
  const sign = await prisma.sign.findUnique({ where: { id: req.params.id } });
  if (!sign) return res.status(404).json({ error: 'Seña no encontrada' });
  res.json(sign);
});

// POST /api/dictionary — crear seña (admin)
dictionaryRouter.post('/', requireAdmin, async (req, res) => {
  const sign = await prisma.sign.create({ data: req.body });
  res.status(201).json(sign);
});

// PUT /api/dictionary/:id — actualizar (admin)
dictionaryRouter.put('/:id', requireAdmin, async (req, res) => {
  const sign = await prisma.sign.update({ where: { id: req.params.id }, data: req.body });
  res.json(sign);
});

// DELETE /api/dictionary/:id — archivar (admin)
dictionaryRouter.delete('/:id', requireAdmin, async (req, res) => {
  await prisma.sign.update({ where: { id: req.params.id }, data: { active: false } });
  res.json({ ok: true });
});
