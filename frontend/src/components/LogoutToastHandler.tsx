// src/components/LogoutToastHandler.tsx
'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

export const LogoutToastHandler = () => {
    const searchParams = useSearchParams();

    useEffect(() => {
        // 1. Controlla il parametro 'logoutSuccess'
        if (searchParams.get('logoutSuccess') === 'true') {

            // 2. Rimuovi il parametro dall'URL subito, 
            // in modo che non riappaia con un refresh.
            // Eseguiamo questa operazione prima di mostrare il toast.
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);

            // 3. Ritarda la chiamata al toast (Micro-Delay)
            // Questo consente al browser di stabilizzarsi e mostra l'animazione d'ingresso.
            const timer = setTimeout(() => {
                toast.success("Logout effettuato con successo!");
            }, 50); // 50ms di ritardo è di solito sufficiente

            // 4. Funzione di Cleanup (Buona Pratica)
            // Questa funzione viene eseguita se il componente viene smontato.
            return () => clearTimeout(timer);
        }

        // Non è necessario un array di dipendenze con searchParams.get() 
        // qui perché l'hard refresh ne garantisce l'esecuzione una sola volta.
        // Tuttavia, manteniamo [searchParams] per coerenza con l'hook.
    }, [searchParams]);

    // Questo componente non renderizza nulla, gestisce solo l'effetto
    return null;
};