import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types/user';

interface AuthState {
    isAuthenticated: boolean;
    isRefreshing: boolean; // Stato per tracciare il refresh del token
    user: User | null;
    clearUser: () => void;
    setUser: (user: User) => void;
    setRefreshing: (isRefreshing: boolean) => void; // Azione per aggiornare lo stato di refresh
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            // Stato iniziale
            isAuthenticated: false,
            isRefreshing: false, // Inizializzato a false
            user: null,

            // Azioni dello store
            clearUser: () => set({ isAuthenticated: false, user: null, isRefreshing: false }),
            setUser: (user) => set({ isAuthenticated: true, user }),
            setRefreshing: (isRefreshing) => set({ isRefreshing }),
        }),
        {
            name: 'auth-storage',

            // Non persistiamo lo stato 'isRefreshing', che deve essere volatile
            partialize: (state) => ({
                isAuthenticated: state.isAuthenticated,
                user: state.user,
            }),
        }
    )
);