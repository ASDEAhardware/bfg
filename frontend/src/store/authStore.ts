import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
    pk: number;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    // Aggiungi altri campi utente se presenti
}

interface AuthState {
    isAuthenticated: boolean;
    user: User | null;
    clearUser: () => void;
    // setUser ora accetta solo i dati dell'utente, non più l'access token
    setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            // Stato iniziale
            isAuthenticated: false,
            user: null,

            // Azioni dello store
            clearUser: () => set({ isAuthenticated: false, user: null }),
            setUser: (user) => set({ isAuthenticated: true, user }),
        }),
        {
            name: 'auth-storage', // Nome per la chiave nel Local Storage

            // persistiamo solo isAuthenticated e user
            partialize: (state) => ({
                isAuthenticated: state.isAuthenticated,
                user: state.user,
            }),
        }
    )
);

  