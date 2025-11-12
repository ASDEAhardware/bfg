/**
 * @file Hook per determinare se la dimensione dello schermo è superiore o uguale al breakpoint 'md' di Tailwind CSS.
 * @description Questo hook fornisce un valore booleano reattivo che indica se la larghezza del viewport corrente
 *              è maggiore o uguale a 768px (il breakpoint 'md' predefinito di Tailwind).
 *              È utile per implementare logiche o rendering condizionali basati sulla dimensione dello schermo.
 */
// File: src/hooks/useIsMdUp.ts (o .tsx)
import { useState, useEffect } from 'react';

// Corrisponde al breakpoint 'md' predefinito di Tailwind CSS (768px)
const QUERY_MD = '(min-width: 768px)';

export function useIsMdUp(): boolean {
  const [isMdUp, setIsMdUp] = useState(false);

  useEffect(() => {
    // 1. Evita l'esecuzione lato server (SSR) dove 'window' non esiste
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia(QUERY_MD);

    // 2. Funzione handler che aggiorna lo stato
    const handler = (event: MediaQueryListEvent) => {
      setIsMdUp(event.matches);
    };

    // 3. Imposta il valore iniziale all'avvio del componente
    // Nota: Questo è cruciale per il primo rendering lato client
    setIsMdUp(mediaQuery.matches);

    // 4. Utilizza l'API moderna: addEventListener
    // 'change' è l'evento corretto per gli aggiornamenti della media query
    mediaQuery.addEventListener('change', handler);

    // 5. Cleanup: Utilizza l'API moderna: removeEventListener
    return () => {
      mediaQuery.removeEventListener('change', handler);
    };
  }, []); // L'array di dipendenze vuoto assicura che l'effetto venga eseguito solo al mount/unmount

  return isMdUp;
}