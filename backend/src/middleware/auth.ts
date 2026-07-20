import { Request, Response, NextFunction } from 'express';
import { admin, isAdminReady } from '../lib/firebaseAdmin';

export interface AuthRequest extends Request {
  uid?:  string;
  role?: 'student' | 'admin';
}

// Extrae y verifica el ID token del header Authorization: Bearer <token>.
// Devuelve el uid o null si el token falta / es inválido / está expirado.
async function verifyToken(req: AuthRequest): Promise<string | null> {
  const header = req.headers.authorization ?? '';
  const match  = header.match(/^Bearer (.+)$/);
  if (!match) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(match[1]);
    return decoded.uid;
  } catch {
    return null;
  }
}

// Lee el rol desde Realtime Database (fuente de verdad). Rol ausente = student.
// Nunca se confía en un rol enviado por el cliente.
async function roleOf(uid: string): Promise<'student' | 'admin'> {
  const snap = await admin.database().ref(`users/${uid}/role`).get();
  return snap.val() === 'admin' ? 'admin' : 'student';
}

// Exige un ID token válido (cualquier usuario autenticado).
// Guarda contenido NO sensible (p.ej. detalle de lección). Si el Admin SDK aún
// no está configurado, degrada de forma segura y deja pasar (mismo alcance que
// la lista de lecciones, que es pública) en vez de tumbar el flujo de app. Una
// vez configuradas las credenciales, verifica el token de verdad.
export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (!isAdminReady()) return next();
  const uid = await verifyToken(req);
  if (!uid) return res.status(401).json({ error: 'No autenticado.' });
  req.uid  = uid;
  req.role = await roleOf(uid);
  next();
}

// Exige un ID token válido Y que ese usuario tenga rol admin en RTDB.
export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!isAdminReady()) {
    return res.status(503).json({ error: 'Servicio de autenticación no configurado en el servidor.' });
  }
  const uid = await verifyToken(req);
  if (!uid) return res.status(401).json({ error: 'No autenticado.' });
  const role = await roleOf(uid);
  if (role !== 'admin') return res.status(403).json({ error: 'Requiere permisos de administrador.' });
  req.uid  = uid;
  req.role = role;
  next();
}
