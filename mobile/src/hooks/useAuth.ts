import type { UserProfile } from '../types';

/**
 * Portado de frontend/src/hooks/useAuth.ts — usuario mock hardcodeado.
 * No hay pantalla de login en mobile todavía: la app arranca "logueada"
 * con este usuario. Firebase Auth se integra en un bloque posterior.
 */
export const MOCK_USER: UserProfile = {
  uid: 'dev-1', name: 'Adrián Gottfried', email: 'a.gottfried@utsc.edu.mx',
  initials: 'AG', role: 'admin', streak: 7, progress: 35,
  totalCompleted: 2, totalSigns: 26, badges: 4,
  joined: 'Junio 2026', level: 'Básico — Nivel 2',
};

export function useAuth() {
  return { user: MOCK_USER };
}
