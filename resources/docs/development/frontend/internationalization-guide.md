# Guida all'Internazionalizzazione (i18n) Client-Side

Questo documento descrive l'architettura e l'implementazione del sistema di internazionalizzazione (i18n) del frontend. Il sistema è basato su `next-intl` e configurato per una gestione interamente **client-side** e **senza flicker**, dove la lingua selezionata viene aggiornata dinamicamente tramite uno store globale, senza ricaricare la pagina.

---

## 1. Scopo e Architettura (Approccio "Soft Navigation")

L'obiettivo è permettere all'utente di cambiare la lingua dell'interfaccia in modo istantaneo e fluido, come in una Single-Page Application (SPA), facendo persistere la scelta tra le sessioni.

L'architettura si basa su un flusso di dati reattivo:

1.  **Selezione Utente**: L'utente sceglie una nuova lingua nella pagina delle Impostazioni.
2.  **Aggiornamento Store Globale**: Viene chiamata un'azione dello store globale **`useLocaleStore`** (basato su Zustand).
3.  **Sincronizzazione Cookie**: Lo store aggiorna il suo stato interno e, grazie al middleware `persist`, salva automaticamente la nuova lingua nel cookie `NEXT_LOCALE`.
4.  **Reazione del Provider**: Il provider globale **`IntlClientProvider`**, che è in ascolto dello store, rileva il cambio di stato.
5.  **Gestione Caricamento**: `IntlClientProvider` attiva uno spinner di caricamento a schermo intero.
6.  **Caricamento Messaggi**: Il provider carica in modo asincrono il nuovo file delle traduzioni (es. `messages/it.json`).
7.  **Aggiornamento Contesto**: Una volta caricati i messaggi, il provider aggiorna il contesto di `next-intl` con le nuove traduzioni e nasconde lo spinner. L'interfaccia si aggiorna istantaneamente con i nuovi testi.
8.  **Refresh dei Server Components**: Contemporaneamente, la funzione di cambio lingua invoca `router.refresh()`, che istruisce Next.js a rieseguire i Server Components con il nuovo cookie, aggiornando così anche le parti dell'UI renderizzate sul server.

---

## Workflow Dettagliato (Come funziona la "Magia")

La "magia" che si osserva non è una singola funzione, ma una perfetta collaborazione tra Zustand, React e la libreria `next-intl`.

Ecco il workflow passo dopo passo.

### Il Ruolo Distinto del Cookie e dello Store Zustand

Prima di tutto, è fondamentale capire perché esistono entrambi e che ruoli diversi hanno:

1.  **Cookie (`NEXT_LOCALE`):** Il suo scopo principale è comunicare la lingua scelta al **server**. Quando richiedi una pagina per la prima volta (o fai un hard reload), il server Next.js legge questo cookie. Grazie a questa informazione, può pre-renderizzare la pagina (SSR - Server-Side Rendering) direttamente nella lingua corretta. Questo è vitale per la SEO e per evitare che la pagina appaia in inglese per un istante per poi "switchare" alla lingua scelta.

2.  **Store Zustand (`useLocaleStore`):** Il suo scopo è gestire lo stato della lingua **sul client**, una volta che la pagina è stata caricata e l'applicazione è interattiva. È il "cuore pulsante" che permette di cambiare la lingua dinamicamente *senza* dover ricaricare la pagina.

---

### Il Workflow Completo (dall'interazione al re-render)

Ecco la sequenza di eventi che permette l'aggiornamento istantaneo:

#### Fase 1: Setup Iniziale

Il componente provider per la gestione dell'internazionalizzazione è `IntlClientProvider`, e si trova all'interno di `@frontend/src/app/providers.tsx`. Questo componente è il responsabile di fornire le traduzioni e la lingua corrente a tutti i componenti figli.

La sua configurazione è la seguente:

```tsx
// In /frontend/src/app/providers.tsx

'use client';

import { ReactNode, useEffect } from 'react';
import { IntlClientProvider } from '@/lib/IntlClientProvider'; // Il tuo provider personalizzato

interface ProvidersProps {
    children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
    // ... (altri provider e logica)

    return (
        <IntlClientProvider>
            {/* Qui vengono avvolti gli altri provider e i children dell'applicazione */}
            {children}
        </IntlClientProvider>
    );
}
```
All'interno di `@/lib/IntlClientProvider`, viene effettivamente utilizzato il `NextIntlClientProvider` di `next-intl` per gestire il contesto delle traduzioni. Questo componente ottiene la `locale` dallo `useLocaleStore` e carica i `messages` dinamicamente tramite `getMessagesForLocale`.

#### Fase 2: L'Utente Cambia Lingua

1.  L'utente va nelle impostazioni e seleziona una lingua.
2.  Un gestore di eventi (es. `onClick`) chiama la funzione `setLocale` dello store Zustand: `useLocaleStore.getState().setLocale('it');`.
3.  Il middleware `persist` configurato nello store fa due cose:
    *   Aggiorna lo stato interno di Zustand: `locale` diventa `'it'`.
    *   Chiama lo `storage` custom, che a sua volta aggiorna il cookie `NEXT_LOCALE` a `'it'`. Questo assicura che il prossimo hard reload della pagina avvenga già in italiano.

#### Fase 3: La "Magia" della Reattività di React

1.  **Zustand Notifica il Cambiamento:** Zustand, essendo basato sui React Hooks, notifica a tutti i componenti che usano il hook `useLocaleStore()` che lo stato è cambiato.

2.  **Il Provider si Aggiorna:** Il componente che renderizza `NextIntlClientProvider` sta usando `useLocaleStore()`. Riceve la notifica, si ri-renderizza e ora passa il nuovo valore `locale="it"` al `NextIntlClientProvider`.

3.  **`next-intl` Propaga il Contesto:** `NextIntlClientProvider` aggiorna il suo "contesto" interno. Il contesto in React è un meccanismo per passare dati in profondità nell'albero dei componenti senza doverli passare manualmente tramite le props.

4.  **I Componenti si Ri-traducono:** Qualsiasi componente nell'applicazione che mostra del testo tradotto userà quasi certamente il hook `useTranslations()` di `next-intl` (es. `const t = useTranslations('HomePage');`).
    *   Questo hook `useTranslations` è "abbonato" al contesto fornito da `NextIntlClientProvider`.
    *   Quando il contesto cambia (perché la `locale` è passata da `'en'` a `'it'`), React automaticamente ri-renderizza **tutti** i componenti che dipendono da quel contesto.
    *   Durante il nuovo render, il hook `useTranslations()` sa che deve pescare le traduzioni dal file `it.json` (che `NextIntlClientProvider` ha a disposizione) invece che da `en.json`.

**In Sintesi:**

> **Utente Clicca -> Zustand Store si aggiorna -> Il Provider `NextIntlClientProvider` riceve la nuova lingua -> Il Contesto di `next-intl` cambia -> Tutti i componenti che usano `useTranslations()` si ri-renderizzano con le nuove traduzioni.**

Questo è il pattern standard "Provider/Consumer" (o "Provider/Hook") che sta alla base di quasi tutta la gestione dello stato moderna in React. Zustand agisce come una sorgente di stato globale e centralizzata, e `next-intl` si integra perfettamente in questo ecosistema per rendere le traduzioni reattive.

---

## 2. Componenti Chiave

Il sistema è composto dai seguenti file che lavorano in sinergia:

### `frontend/i18n.config.ts`
- **Scopo**: File di configurazione centrale per le lingue. Invariato.

### `frontend/messages/{locale}.json`
- **Scopo**: Contenere le traduzioni per ogni lingua. Invariato.

### `frontend/src/store/localeStore.ts`
- **Scopo**: È la **nuova unica fonte di verità** per la lingua corrente.
- **Tecnologia**: Store Zustand con middleware `persist`.
- **Funzionamento**:
    - Mantiene lo stato `locale`.
    - Espone un'azione `setLocale` per aggiornare la lingua.
    - Utilizza uno `storage` custom per sincronizzare automaticamente lo stato con il cookie `NEXT_LOCALE`, rendendolo disponibile sia lato client (per lo store) sia lato server (per i Server Components).

### `frontend/src/lib/i18n-client.ts`
- **Scopo**: Fornire utility per il caricamento dei messaggi.
- **Contenuto**: Contiene solo la funzione asincrona `getMessagesForLocale(locale)`, che importa dinamicamente il file `.json` corretto. L'hook `useLocale` è stato rimosso.

### `frontend/src/lib/IntlClientProvider.tsx`
- **Scopo**: È il cuore del sistema reattivo.
- **Funzionamento**:
    1.  Si sottoscrive a `useLocaleStore` per ottenere la `locale` corrente.
    2.  Usa `useEffect` per reagire ai cambi di `locale`.
    3.  Quando la `locale` cambia, attiva lo spinner globale (`usePageLoaderStore`), carica i nuovi messaggi e, a operazione completata, aggiorna il contesto di `next-intl` e nasconde lo spinner.

---

## 3. Come Utilizzare le Traduzioni in un Componente

Questa parte rimane **invariata**. Per tradurre un componente, si continua a usare l'hook `useTranslations` come descritto nella versione precedente della guida.

**Esempio:**
```typescript
'use client';
import { useTranslations } from 'next-intl';

export default function MyComponent() {
  const t = useTranslations('settings');
  return <h1>{t('title')}</h1>;
}
```

---

## 4. Come Aggiungere una Nuova Lingua (Es. Spagnolo)

Anche questo processo rimane quasi identico.

1.  **Crea il File dei Messaggi**: Aggiungi `frontend/messages/es.json`.
2.  **Aggiorna la Configurazione**: Aggiungi `'es'` all'array `locales` in `frontend/i18n.config.ts`.
3.  **Aggiungi l'Opzione nell'UI**: Aggiungi il `RadioGroupItem` per lo spagnolo in `settings/page.tsx`. La logica sottostante `handleLanguageChange` è già predisposta per gestire qualsiasi nuova lingua.

---

## 5. Gestione del Caricamento (Approccio Soft Navigation)

Per eliminare il flicker del ricaricamento pagina, abbiamo sostituito il vecchio approccio con una transizione "soft", gestita dai seguenti componenti.

### Architettura della Soluzione

1.  **Store Globale di Lingua (`useLocaleStore`)**: Funge da trigger per il cambio di lingua.
2.  **Provider Reattivo (`IntlClientProvider`)**: Ascolta lo store, orchestra il caricamento dei nuovi messaggi e gestisce la visibilità dello spinner.
3.  **Router di Next.js**: La funzione `router.refresh()` viene usata per aggiornare i Server Components in background.

### Componenti Chiave della Transizione

#### `frontend/src/store/localeStore.ts`
Come descritto sopra, centralizza lo stato della lingua.

#### `frontend/src/lib/IntlClientProvider.tsx`
Gestisce la logica di reazione al cambio di lingua, incluso mostrare/nascondere lo spinner.

#### `frontend/src/app/(private)/(guest)/settings/page.tsx`
La funzione `handleLanguageChange` è stata semplificata e resa molto più potente.

```typescript
// Import necessari
import { useLocaleStore } from "@/store/localeStore";
import { useRouter } from "next/navigation";

// Dentro al componente AppearanceSection
const router = useRouter();
const { locale, setLocale } = useLocaleStore();

const handleLanguageChange = (newLanguage: string) => {
  // 1. Non fare nulla se la lingua è già quella selezionata
  if (locale === newLanguage) return;

  // 2. Aggiorna lo store globale. Questo attiverà la reazione a catena.
  setLocale(newLanguage as any);
  
  // 3. Avvia un "soft refresh" per aggiornare i Server Components.
  router.refresh();
};
```
Questo approccio garantisce un'esperienza utente fluida, moderna e professionale, eliminando completamente i problemi legati al ricaricamento della pagina.