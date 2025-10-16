'use client';
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/axios";

type ThemeOption = "light" | "dark" | "system";

/**
 * Hook per salvare la preferenza del tema dell'utente nel backend.
 * Utilizza useMutation per gestire la chiamata API in modo asincrono.
 */
export const useSaveTheme = () => {
  return useMutation({
    mutationFn: async (newTheme: ThemeOption) => {
      try {
        // La chiamata punta all'endpoint del BFF di Next.js
        await api.patch("theme/", { theme: newTheme });
      } catch (err) {
        console.error("Errore nel salvataggio del tema nel backend:", err);
        // Lancia nuovamente l'errore per permettere al chiamante di gestirlo se necessario
        throw err;
      }
    },
  });
};