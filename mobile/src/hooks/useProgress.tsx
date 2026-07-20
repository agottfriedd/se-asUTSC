/**
 * Portado de frontend/src/hooks/useProgress.ts, pero como CONTEXTO compartido.
 *
 * En web, useProgress se instancia UNA vez en <AppShell> y baja por props, así
 * que todas las vistas ven el mismo progreso y completar una lección se refleja
 * al instante. En móvil, cada pantalla (Inicio, Lecciones, detalle) es un
 * componente de expo-router independiente; si cada una llamara su propio
 * useProgress, tendrían estados separados y —como los tabs quedan montados— los
 * tabs nunca verían una lección completada en el detalle (bug de progreso).
 *
 * Solución: un <ProgressProvider> montado una sola vez (en app/_layout.tsx,
 * dentro de <AuthProvider> porque necesita el uid), que consumen Inicio,
 * Lecciones y el detalle vía useProgress(). Estado único y compartido, igual
 * que la web.
 */
import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../lib/api';
import { useAuth } from './useAuth';
import type { LessonProgress } from '../types';

interface ProgressContextValue {
  progress:       Record<number, LessonProgress>;
  loaded:         boolean;
  totalLessons:   number;
  saveProgress:   (lessonId: number, pct: number, completed: boolean) => Promise<void>;
  getForLesson:   (lessonId: number) => LessonProgress;
  globalProgress: number;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user.uid;

  const [progress, setProgress]         = useState<Record<number, LessonProgress>>({});
  const [loaded,   setLoaded]           = useState(false);
  const [totalLessons, setTotalLessons] = useState(0);
  // Espejo del mapa para el fallback offline sin meter `progress` en las deps
  // de saveProgress (así el callback queda estable).
  const progressRef = useRef(progress);
  progressRef.current = progress;

  // Total real de lecciones para el % general (no hardcodear 12).
  useEffect(() => {
    api.lessons.getAll().then(list => setTotalLessons(list.length)).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.progress.getAll(uid)
      .then(list => {
        if (cancelled) return;
        const map: Record<number, LessonProgress> = {};
        list.forEach(p => {
          map[p.lessonId] = { userId: p.userId, lessonId: p.lessonId, progress: p.progress, completed: p.completed };
        });
        setProgress(map);
        setLoaded(true);
      })
      .catch(async () => {
        // fallback AsyncStorage si el backend no está disponible
        try {
          const saved = await AsyncStorage.getItem(`progress_${uid}`);
          if (saved && !cancelled) setProgress(JSON.parse(saved));
        } catch {}
        if (!cancelled) setLoaded(true);
      });
    return () => { cancelled = true; };
  }, [uid]);

  const saveProgress = useCallback(async (lessonId: number, pct: number, completed: boolean) => {
    if (!uid) return;
    // Nunca degradar localmente: el progreso solo avanza y `completed` solo pasa
    // a true (mismo criterio que el blindaje del backend). Evita que reabrir una
    // lección completada la muestre como 0%/incompleta por el guardado por-bloque.
    setProgress(prev => {
      const cur = prev[lessonId];
      const merged: LessonProgress = {
        userId:    uid,
        lessonId,
        progress:  Math.max(cur?.progress ?? 0, pct),
        completed: (cur?.completed ?? false) || completed,
      };
      return { ...prev, [lessonId]: merged };
    });
    try {
      // El backend es la autoridad (aplica el no-downgrade); reflejamos su valor.
      const saved = await api.progress.save({ userId: uid, lessonId, progress: pct, completed });
      setProgress(prev => ({
        ...prev,
        [lessonId]: { userId: uid, lessonId, progress: saved.progress, completed: saved.completed },
      }));
    } catch {
      // Sin backend: persistir el mapa actual como cache offline.
      try { await AsyncStorage.setItem(`progress_${uid}`, JSON.stringify(progressRef.current)); } catch {}
    }
  }, [uid]);

  const getForLesson = useCallback((lessonId: number): LessonProgress =>
    progress[lessonId] ?? { userId: uid ?? '', lessonId, progress: 0, completed: false },
  [progress, uid]);

  const completed = Object.values(progress).filter(p => p.completed).length;
  const globalProgress = totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0;

  const value: ProgressContextValue = {
    progress, loaded, totalLessons, saveProgress, getForLesson, globalProgress,
  };

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressContextValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) {
    throw new Error('useProgress debe usarse dentro de <ProgressProvider>.');
  }
  return ctx;
}
