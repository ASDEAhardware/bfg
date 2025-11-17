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