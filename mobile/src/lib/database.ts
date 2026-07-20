// Portado de frontend/src/lib/database.ts — perfil de usuario en Realtime
// Database. El cliente solo puede escribir el rol INICIAL 'student' al
// registrarse; las reglas de RTDB impiden cambiarlo después. Promover/degradar
// solo lo hace el backend con el Admin SDK.
import { ref, get, set, update } from 'firebase/database';
import { rtdb } from './firebase';
import type { UserRole } from '../types';

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
