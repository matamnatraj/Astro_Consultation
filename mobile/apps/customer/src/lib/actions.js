import { router } from 'expo-router';
import { useCallback } from 'react';
import { useAuth } from '@astro/mobile-core';

/** Optimistic favourite toggle for lists of astrologers. */
export function useFavoriteToggle(setList, show) {
  const { api } = useAuth();
  return useCallback(async (a) => {
    const next = !a.isFavorite;
    const patchTo = (value) => (list) => (Array.isArray(list)
      ? list.map((x) => (x.astrologerId === a.astrologerId ? { ...x, isFavorite: value } : x))
      : list && list.astrologerId === a.astrologerId ? { ...list, isFavorite: value } : list);
    setList?.(patchTo(next));
    try {
      if (next) await api.put(`/astrologers/${a.astrologerId}/favorite`); else await api.del(`/astrologers/${a.astrologerId}/favorite`);
      show?.(next ? 'Added to favourites' : 'Removed from favourites');
    } catch (e) { setList?.(patchTo(!next)); show?.(e.message, 'bad'); }
  }, [api, setList, show]);
}

export function startChat(a) {
  router.push(`/consult/${a.astrologerId}?mode=chat`);
}

export function startCall(a, show, callEnabled) {
  if (!callEnabled) { show?.('Audio calls are coming soon. Chat is available now.', 'info'); return; }
  router.push(`/consult/${a.astrologerId}?mode=voice`);
}
