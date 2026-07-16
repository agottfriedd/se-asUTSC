import { ref, get, set, update } from 'firebase/database';
import { rtdb } from './firebase';
import type { UserRole } from '../types';

// Perfil mínimo persistido en Realtime Database. Los campos derivados del
// progreso real (streak, badges, etc.) NO se guardan aquí — ver useProgress.
export interface StoredProfile {
  name:  string;
  email: string;
  role:  UserRole;
}

// ─── USER PROFILE ──────────────────────────────────────────────
export async function getUserProfile(uid: string): Promise<StoredProfile | null> {
  const snap = await get(ref(rtdb, `users/${uid}`));
  return snap.exists() ? (snap.val() as StoredProfile) : null;
}

export async function createUserProfile(uid: string, profile: StoredProfile): Promise<void> {
  await set(ref(rtdb, `users/${uid}`), { ...profile, createdAt: Date.now() });
}

export async function updateUserProfile(uid: string, fields: Partial<StoredProfile>): Promise<void> {
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
