'use client';
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateUserTheme } from '@/services/theme.service'



/**
 * Hook per salvare la preferenza del tema dell'utente nel backend.
 * Utilizza useMutation per gestire la chiamata API in modo asincrono.
 */
export const useSaveTheme = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateUserTheme,
    onSuccess: () => {
      // Invalida la query delle preferenze utente per mantenere la coerenza
      queryClient.invalidateQueries({ queryKey: ["userPreferences"] });
    },
  });
};