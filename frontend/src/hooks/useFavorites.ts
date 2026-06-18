import { useState, useEffect, useCallback } from 'react';
import { getFavorites, toggleFavorite } from '../lib/firestore';

export function useFavorites(uid: string | undefined) {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!uid) return;
    getFavorites(uid).then(ids => setFavorites(new Set(ids)));
  }, [uid]);

  const toggle = useCallback(async (signId: string) => {
    if (!uid) return;
    const newIds = await toggleFavorite(uid, signId);
    setFavorites(new Set(newIds));
  }, [uid]);

  const isFavorite = useCallback((signId: string) => favorites.has(signId), [favorites]);

  return { favorites, toggle, isFavorite };
}
