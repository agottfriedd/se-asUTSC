import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Adaptado de frontend/src/hooks/useFavorites.ts. El web persiste en
 * Firestore; aquí Firebase Auth todavía no está integrado (bloque
 * posterior), así que se guarda localmente con AsyncStorage. Mismo
 * contrato público (favorites/toggle/isFavorite) para no romper nada
 * cuando se conecte Firestore.
 */
export function useFavorites(uid: string | undefined) {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!uid) return;
    AsyncStorage.getItem(`favorites_${uid}`)
      .then(saved => setFavorites(new Set(saved ? JSON.parse(saved) : [])))
      .catch(() => {});
  }, [uid]);

  const toggle = useCallback(async (signId: string) => {
    if (!uid) return;
    setFavorites(prev => {
      const next = new Set(prev);
      next.has(signId) ? next.delete(signId) : next.add(signId);
      AsyncStorage.setItem(`favorites_${uid}`, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, [uid]);

  const isFavorite = useCallback((signId: string) => favorites.has(signId), [favorites]);

  return { favorites, toggle, isFavorite };
}
