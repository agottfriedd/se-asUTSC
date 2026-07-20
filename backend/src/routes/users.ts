import { Router }             from 'express';
import { admin }              from '../lib/firebaseAdmin';
import { requireAdmin }       from '../middleware/auth';
import type { AuthRequest }   from '../middleware/auth';
import { passwordError, emailError } from '../lib/validation';

export const usersRouter = Router();

type Role = 'student' | 'admin';

interface StoredProfile { name?: string; email?: string; role?: Role }

// Mapea errores del Admin SDK a mensajes en español + status HTTP.
function mapError(e: unknown): { status: number; message: string } {
  const code = (e as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/email-already-exists': return { status: 409, message: 'Ya existe un usuario con ese correo.' };
    case 'auth/invalid-email':        return { status: 400, message: 'El correo electrónico no es válido.' };
    case 'auth/invalid-password':     return { status: 400, message: 'La contraseña no cumple los requisitos.' };
    case 'auth/user-not-found':       return { status: 404, message: 'Usuario no encontrado.' };
    default:                          return { status: 500, message: 'Error del servidor. Intenta de nuevo.' };
  }
}

// ─── GET /api/users ────────────────────────────────────────────────
// Lista mergeada: Firebase Auth (estado real) + RTDB (nombre y rol).
usersRouter.get('/', requireAdmin, async (_req, res) => {
  try {
    const [list, rtdbSnap] = await Promise.all([
      admin.auth().listUsers(1000),
      admin.database().ref('users').get(),
    ]);
    const profiles: Record<string, StoredProfile> = rtdbSnap.val() ?? {};

    const users = list.users.map(u => {
      const p = profiles[u.uid] ?? {};
      return {
        uid:       u.uid,
        email:     u.email ?? p.email ?? '',
        name:      p.name ?? u.displayName ?? '',
        role:      (p.role === 'admin' ? 'admin' : 'student') as Role,
        disabled:  u.disabled,
        created:   u.metadata.creationTime,
        lastLogin: u.metadata.lastSignInTime,
      };
    });
    res.json(users);
  } catch (e) {
    const { status, message } = mapError(e);
    res.status(status).json({ error: message });
  }
});

// ─── POST /api/users ───────────────────────────────────────────────
// Crea un usuario en Auth y escribe su perfil (incl. rol) en RTDB.
usersRouter.post('/', requireAdmin, async (req, res) => {
  const { email, password, name, role } = req.body as {
    email?: string; password?: string; name?: string; role?: Role;
  };
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Correo, contraseña y nombre son obligatorios.' });
  }
  // Barrera real: mismo formato de email y política de contraseña que la UI.
  const eErr = emailError(email);
  if (eErr) return res.status(400).json({ error: eErr });
  const pErr = passwordError(password);
  if (pErr) return res.status(400).json({ error: pErr });

  const finalRole: Role = role === 'admin' ? 'admin' : 'student';
  try {
    const user = await admin.auth().createUser({ email, password, displayName: name });
    await admin.database().ref(`users/${user.uid}`).set({ name, email, role: finalRole });
    res.status(201).json({
      uid: user.uid, email, name, role: finalRole,
      disabled: false, created: user.metadata.creationTime, lastLogin: user.metadata.lastSignInTime,
    });
  } catch (e) {
    const { status, message } = mapError(e);
    res.status(status).json({ error: message });
  }
});

// ─── DELETE /api/users/:uid ────────────────────────────────────────
// Borrado real de Auth + RTDB. Guardrail: un admin no puede borrarse.
usersRouter.delete('/:uid', requireAdmin, async (req: AuthRequest, res) => {
  const { uid } = req.params;
  if (uid === req.uid) {
    return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta.' });
  }
  try {
    await admin.auth().deleteUser(uid);
    await Promise.all([
      admin.database().ref(`users/${uid}`).remove(),
      admin.database().ref(`favorites/${uid}`).remove(),
    ]);
    res.json({ ok: true });
  } catch (e) {
    const { status, message } = mapError(e);
    res.status(status).json({ error: message });
  }
});

// ─── PATCH /api/users/:uid/role ────────────────────────────────────
// Escribe el rol en RTDB (única fuente de verdad). Guardrail: un admin no
// puede auto-degradarse a student (evita quedarse sin admins por accidente).
usersRouter.patch('/:uid/role', requireAdmin, async (req: AuthRequest, res) => {
  const { uid } = req.params;
  const { role } = req.body as { role?: Role };
  if (role !== 'student' && role !== 'admin') {
    return res.status(400).json({ error: 'Rol inválido.' });
  }
  if (uid === req.uid && role === 'student') {
    return res.status(400).json({ error: 'No puedes quitarte a ti mismo el rol de administrador.' });
  }
  try {
    await admin.auth().getUser(uid); // 404 si no existe
    await admin.database().ref(`users/${uid}/role`).set(role);
    res.json({ ok: true, uid, role });
  } catch (e) {
    const { status, message } = mapError(e);
    res.status(status).json({ error: message });
  }
});

// ─── PATCH /api/users/:uid/disabled ────────────────────────────────
// Desactiva / reactiva la cuenta. Guardrail: un admin no puede desactivarse.
usersRouter.patch('/:uid/disabled', requireAdmin, async (req: AuthRequest, res) => {
  const { uid } = req.params;
  const { disabled } = req.body as { disabled?: boolean };
  if (typeof disabled !== 'boolean') {
    return res.status(400).json({ error: 'El campo "disabled" debe ser booleano.' });
  }
  if (uid === req.uid && disabled) {
    return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta.' });
  }
  try {
    await admin.auth().updateUser(uid, { disabled });
    res.json({ ok: true, uid, disabled });
  } catch (e) {
    const { status, message } = mapError(e);
    res.status(status).json({ error: message });
  }
});

// ─── PATCH /api/users/:uid/password ────────────────────────────────
// Cambia la contraseña de un usuario. Validación mínima en servidor (8+).
usersRouter.patch('/:uid/password', requireAdmin, async (req, res) => {
  const { uid } = req.params;
  const { password } = req.body as { password?: string };
  if (!password) {
    return res.status(400).json({ error: 'La contraseña es obligatoria.' });
  }
  // Barrera real: misma política de contraseña que la UI (no solo 8 caracteres).
  const pErr = passwordError(password);
  if (pErr) return res.status(400).json({ error: pErr });
  try {
    await admin.auth().updateUser(uid, { password });
    res.json({ ok: true, uid });
  } catch (e) {
    const { status, message } = mapError(e);
    res.status(status).json({ error: message });
  }
});
