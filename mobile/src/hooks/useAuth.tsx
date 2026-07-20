/**
 * Portado de frontend/src/hooks/useAuth.ts — Firebase Auth real.
 *
 * Diferencia de arquitectura con la web: en la web useAuth se llama UNA vez en
 * <App/> y el user baja por props. En mobile las pantallas llaman useAuth() por
 * su cuenta (const { user } = useAuth()). Para que todas vean el MISMO usuario
 * (un solo listener onAuthStateChanged) y para poder cerrar el paso a las
 * pantallas mientras no hay sesión, envolvemos todo en <AuthProvider> (montado
 * en app/_layout.tsx). El provider NO renderiza los tabs hasta que hay sesión,
 * así que dentro del árbol autenticado `user` es siempre no-null y las pantallas
 * no se rompen con user.uid.
 */
import {
  createContext, useCallback, useContext, useEffect, useState,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, updateProfile,
} from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { getUserProfile, createUserProfile } from '../lib/database';
import type { StoredProfile } from '../lib/database';
import type { UserProfile } from '../types';
import { AuthScreen } from '../screens/AuthScreen';
import { LoadingView } from '../components/UI';

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

// Construye el UserProfile de la app SOLO leyendo: perfil de Realtime Database
// (si existe) + datos de Firebase Auth como respaldo. NO crea el perfil aquí:
// eso lo hace register() con el nombre real que tecleó el usuario. (Ver la nota
// del bug "nombre autogenerado" en la web.) Los campos derivados del progreso
// real (streak, badges, level) son placeholders — se derivan del progreso en
// otro bloque; aquí quedan en 0 como en la web.
async function buildUserProfile(fbUser: FirebaseUser): Promise<UserProfile> {
  let stored: StoredProfile | null = null;
  try {
    stored = await getUserProfile(fbUser.uid);
  } catch {
    // Realtime Database no disponible: seguimos con datos de Firebase Auth
  }

  const name = stored?.name ?? fbUser.displayName ?? fbUser.email?.split('@')[0] ?? 'Usuario';

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

// ─── Contexto ──────────────────────────────────────────────────
// Dentro del árbol autenticado user es siempre no-null (el provider no monta a
// los hijos sin sesión), por eso lo tipamos no-nullable: las pantallas hacen
// user.uid sin comprobaciones, igual que con el mock.
interface AuthContextValue {
  user:   UserProfile;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fu) => {
      setUser(fu ? await buildUserProfile(fu) : null);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // login/register lanzan el mensaje en español ya traducido; AuthScreen lo
  // captura y lo muestra (mismo patrón que el AuthView web).
  const login = useCallback(async (email: string, pw: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pw);
    } catch (e) {
      throw new Error(authErrorMessage(e));
    }
  }, []);

  const register = useCallback(async (name: string, email: string, pw: string) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pw);
      await updateProfile(cred.user, { displayName: name });
      // register es la ÚNICA fuente del nombre tecleado: crea el perfil con él
      // (rol inicial 'student'). Así no depende del timing del listener.
      try { await createUserProfile(cred.user.uid, { name, email }); } catch { /* RTDB no disp. */ }
      setUser(await buildUserProfile(cred.user));
    } catch (e) {
      throw new Error(authErrorMessage(e));
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  // Sin sesión resuelta todavía → splash. Sin usuario → pantalla de auth. Con
  // usuario → la app (tabs). Réplica del flujo de fases landing/auth/app de la
  // web, sin landing (mobile arranca directo en auth).
  if (loading) {
    return <LoadingView label="Cargando…" />;
  }
  if (!user) {
    return <AuthScreen onLogin={login} onRegister={register} />;
  }

  return (
    <AuthContext.Provider value={{ user, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// Consumido por las pantallas dentro del árbol autenticado. Mismo contrato que
// el mock ({ user }), más logout para el botón de Perfil.
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  }
  return ctx;
}
