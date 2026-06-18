import { Router }       from 'express';
import admin            from 'firebase-admin';
import { requireAdmin } from '../middleware/auth';

export const usersRouter = Router();

// GET /api/users — lista de usuarios (admin)
usersRouter.get('/', requireAdmin, async (_req, res) => {
  const list = await admin.auth().listUsers(1000);
  res.json(list.users.map(u => ({
    uid:      u.uid,
    email:    u.email,
    name:     u.displayName,
    disabled: u.disabled,
    created:  u.metadata.creationTime,
  })));
});

// PATCH /api/users/:uid/role — cambiar rol (admin)
usersRouter.patch('/:uid/role', requireAdmin, async (req, res) => {
  const { role } = req.body as { role: 'student' | 'admin' };
  if (!['student', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Rol inválido' });
  }
  await admin.auth().setCustomUserClaims(req.params.uid, { role });
  res.json({ ok: true, uid: req.params.uid, role });
});

// DELETE /api/users/:uid — deshabilitar usuario (admin)
usersRouter.delete('/:uid', requireAdmin, async (req, res) => {
  await admin.auth().updateUser(req.params.uid, { disabled: true });
  res.json({ ok: true });
});
