import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { LessonProgress } from '../types';

export function useProgress(uid: string | undefined) {
  const [progress, setProgress] = useState<Record<number, LessonProgress>>({});
  const [loaded,   setLoaded]   = useState(false);

  useEffect(() => {
    if (!uid) return;
    api.progress.getAll(uid)
      .then(list => {
        const map: Record<number, LessonProgress> = {};
        list.forEach(p => { map[p.lessonId] = p; });
        setProgress(map);
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
    const updated = { userId: uid, lessonId, progress: pct, completed };
    setProgress(prev => ({ ...prev, [lessonId]: updated }));
    // Guardar en backend Y localStorage como fallback
    try {
      await api.progress.save(updated);
    } catch {
      localStorage.setItem(`progress_${uid}`, JSON.stringify({ ...progress, [lessonId]: updated }));
    }
  }, [uid, progress]);

  const getForLesson = useCallback((lessonId: number): LessonProgress =>
    progress[lessonId] ?? { userId: uid ?? '', lessonId, progress: 0, completed: false },
  [progress, uid]);

  const completed = Object.values(progress).filter(p => p.completed).length;
  const globalProgress = Math.round((completed / 12) * 100);

  return { progress, loaded, saveProgress, getForLesson, globalProgress };
}
