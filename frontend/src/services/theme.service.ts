import { api } from '@/lib/axios'

type ThemeOption = "light" | "dark" | "system";

export const updateUserTheme = async (newTheme: ThemeOption) => {
    try {
        await api.patch("theme/", { theme: newTheme });
    } catch (err) {
        console.error("Errore nel salvataggio del tema nel backend:", err);
        throw err;
    }
}