import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../lib/api';
import type { LessonProgress } from '../types';

// Racha = días consecutivos hasta hoy con al menos un registro de progreso
// actualizado ese día (basado en updatedAt real de Postgres).
function computeStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const days = new Set(dates.map(d => new Date(d).toDateString()));
  let streak = 0;
  const cursor = new Date();
  while (days.has(cursor.toDateString())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function useProgress(uid: string | undefined) {
  const [progress,     setProgress]     = useState<Record<number, LessonProgress>>({});
  const [updatedDates, setUpdatedDates] = useState<string[]>([]);
  const [totalLessons, setTotalLessons] = useState(0);
  const [loaded,        setLoaded]      = useState(false);

  useEffect(() => {
    api.lessons.getAll().then(list => setTotalLessons(list.length)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!uid) return;
    api.progress.getAll(uid)
      .then(list => {
        const map: Record<number, LessonProgress> = {};
        list.forEach(p => { map[p.lessonId] = p; });
        setProgress(map);
        setUpdatedDates(list.map(p => p.updatedAt).filter((d): d is string => Boolean(d)));
        setLoaded(true);
      })
      .catch(() => {
        // fallback localStorage si el backend no está disponible
        try {
          const saved = JSON.parse(localStorage.getItem(`progress_${uid}`) ?? '{}');
          setProgress(saved);
        } catch {}
        setLoaded(true);
      });
  }, [uid]);

  const saveProgress = useCallback(async (lessonId: number, pct: number, completed: boolean) => {
    if (!uid) return;
    // Nunca degradar localmente: el progreso solo avanza y `completed` solo pasa
    // a true (mismo criterio que el blindaje del backend). Evita que reabrir una
    // lección completada la muestre como 0%/incompleta por el guardado por-bloque
    // (el efecto por-bloque arranca en step 0 y reenvía progress=0).
    const merge = (cur: LessonProgress | undefined): LessonProgress => ({
      userId:    uid,
      lessonId,
      progress:  Math.max(cur?.progress ?? 0, pct),
      completed: (cur?.completed ?? false) || completed,
    });
    setProgress(prev => ({ ...prev, [lessonId]: merge(prev[lessonId]) }));
    // Guardar en backend Y localStorage como fallback
    try {
      // El backend es la autoridad (aplica el no-downgrade); reflejamos su valor.
      const saved = await api.progress.save({ userId: uid, lessonId, progress: pct, completed });
      setProgress(prev => ({
        ...prev,
        [lessonId]: { userId: uid, lessonId, progress: saved.progress, completed: saved.completed },
      }));
      if (saved.updatedAt) setUpdatedDates(prev => [...prev, saved.updatedAt as string]);
    } catch {
      localStorage.setItem(`progress_${uid}`, JSON.stringify({ ...progress, [lessonId]: merge(progress[lessonId]) }));
    }
  }, [uid, progress]);

  const getForLesson = useCallback((lessonId: number): LessonProgress =>
    progress[lessonId] ?? { userId: uid ?? '', lessonId, progress: 0, completed: false },
  [progress, uid]);

  const completedCount = Object.values(progress).filter(p => p.completed).length;
  const globalProgress = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
  const streak = useMemo(() => computeStreak(updatedDates), [updatedDates]);

  return { progress, loaded, saveProgress, getForLesson, globalProgress, completedCount, totalLessons, streak };
}
