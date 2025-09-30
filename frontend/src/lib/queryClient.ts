// Qui puoi specificare le opzioni che si applicano a tutte le query e mutazioni
// a meno che non vengano sovrascritte a livello di query/mutazione specifica.

import { QueryClient } from '@tanstack/react-query';
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1, // Numero di tentativi di retry per le query
            refetchOnWindowFocus: false, // Non rifare il fetch quando la finestra è a fuoco
            staleTime: 1000 * 60 * 5, // Tempo di stale per le query (5 minuti)
        },
        mutations: {
            retry: 1, // Numero di tentativi di retry per le mutazioni
        },
    },
});
