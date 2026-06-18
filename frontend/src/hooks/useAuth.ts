import { useState } from 'react';
import type { UserProfile } from '../types';

const MOCK: UserProfile = {
  uid:'dev-1', name:'Adrián Gottfried', email:'a.gottfried@utsc.edu.mx',
  initials:'AG', role:'admin', streak:7, progress:35,
  totalCompleted:2, totalSigns:26, badges:4,
  joined:'Junio 2026', level:'Básico — Nivel 2',
};

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const loading = false;
  const error = null;

  const login = async (_email: string, _pw: string) => {
    setUser(MOCK);
  };
  const register = async (name: string, email: string, _pw: string) => {
    const initials = name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);
    setUser({ ...MOCK, name, email, initials });
  };
  const logout    = async () => setUser(null);
  const clearError = () => {};

  return { user, fbUser: user, loading, error, login, register, logout, clearError };
}