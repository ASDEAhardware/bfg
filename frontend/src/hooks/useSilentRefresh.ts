import { useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/axios';
import { useAuthStore } from '@/store/authStore';

/**
 * Hook per il silent refresh automatico del token
 * Refresh preventivo 2 minuti prima della scadenza (TTL 15min - 2min = 13min)
 */
export const useSilentRefresh = () => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshing = useAuthStore((state) => state.isRefreshing);

  const REFRESH_INTERVAL = 13 * 60 * 1000; // 13 minuti in millisecondi
  const RETRY_INTERVAL = 30 * 1000; // 30 secondi per retry in caso di errore

  const performSilentRefresh = useCallback(async () => {
    if (isRefreshing) return;

    try {
      await api.post('/auth/token/refresh');
      console.log('Silent refresh completato con successo');
    } catch (error) {
      console.warn('Silent refresh fallito:', error);
      // In caso di errore, riprova tra 30 secondi
      setTimeout(performSilentRefresh, RETRY_INTERVAL);
    }
  }, [isRefreshing, RETRY_INTERVAL]);

  const startSilentRefresh = useCallback(() => {
    // Cancella eventuale timer precedente
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Avvia il timer per il refresh periodico
    intervalRef.current = setInterval(performSilentRefresh, REFRESH_INTERVAL);
  }, [performSilentRefresh, REFRESH_INTERVAL]);

  const stopSilentRefresh = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopSilentRefresh();
    };
  }, [stopSilentRefresh]);

  return {
    startSilentRefresh,
    stopSilentRefresh,
    performSilentRefresh,
  };
};