import { useState, useEffect, useCallback } from 'react';
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, updateProfile,
} from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { getUserProfile, createUserProfile } from '../lib/database';
import type { StoredProfile } from '../lib/database';
import type { UserProfile } from '../types';

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-email':          'El correo electrónico no es válido.',
  'auth/user-disabled':          'Esta cuenta ha sido deshabilitada.',
  'auth/user-not-found':         'No existe una cuenta con ese correo.',
  'auth/wrong-password':         'Contraseña incorrecta.',
  'auth/invalid-credential':     'Correo o contraseña incorrectos.',
  'auth/email-already-in-use':   'Ya existe una cuenta con ese correo.',
  'auth/weak-password':          'La contraseña debe tener al menos 6 caracteres.',
  'auth/too-many-requests':      'Demasiados intentos. Intenta de nuevo más tarde.',
  'auth/network-request-failed': 'Error de red. Revisa tu conexión.',
};

function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  return AUTH_ERROR_MESSAGES[code] ?? 'Error de autenticación. Intenta de nuevo.';
}

function initialsOf(name: string): string {
  return name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';
}

const MONTHS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

function joinedLabel(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// Construye el UserProfile de la app a partir del usuario de Firebase Auth
// más su perfil en Realtime Database (se crea uno por defecto si no existe
// todavía, p.ej. la primera vez que inicia sesión tras esta integración).
// Los campos derivados del progreso real (streak, progress, totalCompleted,
// level) se sobrescriben después en AppShell con datos de useProgress — aquí
// solo van placeholders neutros.
async function buildUserProfile(fbUser: FirebaseUser): Promise<UserProfile> {
  let stored: StoredProfile | null = null;
  try {
    stored = await getUserProfile(fbUser.uid);
  } catch {
    // Realtime Database no disponible: seguimos con datos de Firebase Auth
  }

  const name = stored?.name ?? fbUser.displayName ?? fbUser.email?.split('@')[0] ?? 'Usuario';

  if (!stored) {
    const fallback: StoredProfile = { name, email: fbUser.email ?? '', role: 'student' };
    try { await createUserProfile(fbUser.uid, fallback); } catch { /* RTDB no disponible */ }
  }

  return {
    uid:            fbUser.uid,
    name,
    email:          fbUser.email ?? '',
    initials:       initialsOf(name),
    role:           stored?.role ?? 'student',
    streak:         0,
    progress:       0,
    totalCompleted: 0,
    totalSigns:     0,
    badges:         0,
    joined:         joinedLabel(fbUser.metadata.creationTime),
    level:          'Sin nivel aún',
  };
}

export function useAuth() {
  const [fbUser,  setFbUser]  = useState<FirebaseUser | null>(null);
  const [user,    setUser]    = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fu) => {
      setFbUser(fu);
      setUser(fu ? await buildUserProfile(fu) : null);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = useCallback(async (email: string, pw: string) => {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, pw);
    } catch (e) {
      const msg = authErrorMessage(e);
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const register = useCallback(async (name: string, email: string, pw: string) => {
    setError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pw);
      await updateProfile(cred.user, { displayName: name });
    } catch (e) {
      const msg = authErrorMessage(e);
      setError(msg);
      throw new Error(msg);
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { user, fbUser, loading, error, login, register, logout, clearError };
}
