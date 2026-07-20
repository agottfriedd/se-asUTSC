import { ref, get, set, update } from 'firebase/database';
import { rtdb } from './firebase';
import type { UserRole } from '../types';

// Perfil mínimo persistido en Realtime Database. Los campos derivados del
// progreso real (streak, badges, etc.) NO se guardan aquí — ver useProgress.
// El cliente solo puede escribir el rol INICIAL 'student' al registrarse; las
// reglas de RTDB (.validate en /users/{uid}/role) impiden que después lo
// cambie a admin o a cualquier otro valor. Promover/degradar solo lo hace el
// backend con el Admin SDK (que ignora las reglas). Así nadie puede
// auto-asignarse admin desde el navegador.
export interface StoredProfile {
  name:  string;
  email: string;
  role?: UserRole;
}

// ─── USER PROFILE ──────────────────────────────────────────────
export async function getUserProfile(uid: string): Promise<StoredProfile | null> {
  const snap = await get(ref(rtdb, `users/${uid}`));
  return snap.exists() ? (snap.val() as StoredProfile) : null;
}

// Crea el perfil con rol inicial 'student'. Las reglas solo permiten 'student'
// como valor inicial; cualquier intento de crear con otro rol es rechazado.
export async function createUserProfile(uid: string, profile: { name: string; email: string }): Promise<void> {
  await set(ref(rtdb, `users/${uid}`), { ...profile, role: 'student', createdAt: Date.now() });
}

// Solo actualiza name/email — nunca role (lo administra el backend).
export async function updateUserProfile(uid: string, fields: { name?: string; email?: string }): Promise<void> {
  await update(ref(rtdb, `users/${uid}`), fields);
}

// ─── FAVORITES ─────────────────────────────────────────────────
export async function getFavorites(uid: string): Promise<string[]> {
  const snap = await get(ref(rtdb, `favorites/${uid}`));
  return snap.exists() ? (snap.val() as string[]) : [];
}

export async function toggleFavorite(uid: string, signId: string): Promise<string[]> {
  const favRef = ref(rtdb, `favorites/${uid}`);
  const snap   = await get(favRef);
  let   ids: string[] = snap.exists() ? (snap.val() as string[]) : [];

  ids = ids.includes(signId) ? ids.filter(id => id !== signId) : [...ids, signId];
  await set(favRef, ids);
  return ids;
}
