'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

let refreshToastId: string | number | undefined;

export const RefreshIndicator = () => {
  const isRefreshing = useAuthStore((state) => state.isRefreshing);

  useEffect(() => {
    if (isRefreshing) {
      // Mostra un toast discreto durante il refresh
      refreshToastId = toast.loading('Aggiornamento sessione...', {
        duration: Infinity, // Non scompare automaticamente
        position: 'bottom-right',
      });
    } else if (refreshToastId) {
      // Chiudi il toast quando il refresh è completato
      toast.dismiss(refreshToastId);
      refreshToastId = undefined;
    }

    // Cleanup in caso di unmount
    return () => {
      if (refreshToastId) {
        toast.dismiss(refreshToastId);
        refreshToastId = undefined;
      }
    };
  }, [isRefreshing]);

  // Questo componente non renderizza nulla visivamente
  return null;
};