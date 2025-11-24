import { api } from '@/lib/axios'
import { ThemeOption } from '@/types';


export const updateUserTheme = async (newTheme: ThemeOption) => {
    try {
        await api.patch("theme/", { theme: newTheme });
    } catch (err) {
        console.error("Errore nel salvataggio del tema nel backend:", err);
        throw err;
    }
}