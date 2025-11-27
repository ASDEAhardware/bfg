import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import Cookies from 'js-cookie';
import { defaultLocale, Locale } from '../i18n.config';

// Definiamo lo stato e le azioni del nostro store
interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

// Definiamo un custom storage engine per Zustand
// Questo ci permette di sincronizzare lo stato con i Cookie invece che solo con localStorage
const cookieStorage = {
  getItem: (name: string): string | null => {
    const cookieValue = Cookies.get(name);
    // Se il cookie esiste, lo usiamo.
    if (cookieValue) {
      return JSON.stringify({ state: { locale: cookieValue }, version: 0 });
    }
    // Altrimenti, proviamo a leggere da localStorage come fallback.
    if (typeof window !== 'undefined') {
      return localStorage.getItem(name);
    }
    return null;
  },
  setItem: (name: string, value: string): void => {
    // Quando lo stato viene salvato, lo scriviamo sia in localStorage sia nel cookie.
    const { state } = JSON.parse(value);
    if (state.locale) {
      Cookies.set('NEXT_LOCALE', state.locale, { expires: 365 });
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem(name, value);
    }
  },
  removeItem: (name: string): void => {
    // Rimuoviamo da entrambi
    Cookies.remove('NEXT_LOCALE');
    if (typeof window !== 'undefined') {
      localStorage.removeItem(name);
    }
  },
};

// Creiamo lo store
export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      // Stato iniziale: proviamo a leggere il cookie, altrimenti usiamo il default
      locale: (Cookies.get('NEXT_LOCALE') as Locale) || defaultLocale,
      // Azione per aggiornare lo stato
      setLocale: (locale: Locale) => set({ locale }),
    }),
    {
      name: 'locale-storage', // Nome per la persistenza in localStorage
      storage: createJSONStorage(() => cookieStorage),
    }
  )
);
