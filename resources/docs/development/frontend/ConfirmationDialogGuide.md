# Guida all'utilizzo del Dialogo di Conferma Globale

Questo documento descrive come utilizzare il sistema di dialogo di conferma globale implementato nel frontend, basato su Zustand e sui componenti UI di Shadcn. Questo dialogo è progettato per richiedere una conferma all'utente prima di eseguire azioni potenzialmente disruptive, come uscire da una modalità di visualizzazione complessa (Grid Mode o Tab Mode).

---

## 1. Componenti Chiave

Il sistema si compone di due elementi principali:

*   **`useConfirmationDialogStore`**: Uno store Zustand che gestisce lo stato del dialogo (aperto/chiuso, contenuto, azione di conferma).
*   **`GlobalConfirmationDialog`**: Un componente React che si connette allo store e renderizza il dialogo UI quando necessario.

---

## 2. Lo Store Zustand: `useConfirmationDialogStore`

Lo store `useConfirmationDialogStore` (definito in `frontend/src/store/dialogStore.ts`) è il cuore del sistema. Permette di controllare il dialogo da qualsiasi punto dell'applicazione.

### Stato dello Store

Lo store gestisce il seguente stato:

*   `isOpen: boolean`: Indica se il dialogo è attualmente visibile.
*   `title: string`: Il titolo del dialogo.
*   `description: string`: La descrizione o il messaggio principale del dialogo.
*   `onConfirm: () => void`: Una funzione di callback che viene eseguita quando l'utente clicca sul pulsante "Confirm".

### Azioni dello Store

Lo store espone due azioni principali:

*   `show(options: { title: string; description: string; onConfirm: () => void }): void`
    *   Utilizza questa azione per aprire il dialogo. Devi passare un oggetto con `title`, `description` e la funzione `onConfirm` da eseguire.
*   `hide(): void`
    *   Utilizza questa azione per chiudere il dialogo. Viene chiamata automaticamente dal componente `GlobalConfirmationDialog` quando l'utente conferma o annulla.

### Esempio di Utilizzo dello Store

```typescript
import { useConfirmationDialogStore } from '@/store/dialogStore';

// All'interno di un componente funzionale React:
function MyComponent() {
  const showConfirmation = useConfirmationDialogStore(state => state.show);

  const handleClick = () => {
    showConfirmation({
      title: "Sei sicuro?",
      description: "Questa azione è irreversibile e potrebbe causare la perdita di dati non salvati.",
      onConfirm: () => {
        // Logica da eseguire se l'utente conferma
        console.log("Azione confermata!");
        // Esegui qui la tua logica principale
      },
    });
  };

  return (
    <button onClick={handleClick}>Esegui Azione</button>
  );
}
```

---

## 3. Il Componente React: `GlobalConfirmationDialog`

Il componente `GlobalConfirmationDialog` (definito in `frontend/src/components/GlobalConfirmationDialog.tsx`) è il renderizzatore del dialogo.

*   **Componente Globale:** È stato inserito una sola volta nel layout principale dell'applicazione (`frontend/src/app/(private)/layout.tsx`).
*   **Nessuna Prop Necessaria:** Non richiede alcuna prop. Si connette direttamente a `useConfirmationDialogStore` per leggere il suo stato e renderizzare il dialogo di conseguenza.
*   **Gestione Automatica:** Gestisce automaticamente l'apertura, la chiusura e l'esecuzione del callback `onConfirm` quando l'utente interagisce con i pulsanti "Confirm" o "Cancel".

Non è necessario interagire direttamente con questo componente nel tuo codice; basta usare le azioni `show` e `hide` dello store.

---

## 4. Esempio di Utilizzo Reale: Navigazione Standalone

Un esempio pratico dell'utilizzo di questo dialogo è la gestione della navigazione verso pagine "standalone" (come Settings o Version) quando l'utente si trova in modalità Grid o Tab.

Nel file `frontend/src/components/app-sidebar.tsx`, la funzione `handleStandaloneNav` utilizza il dialogo:

```typescript
import { useConfirmationDialogStore } from '@/store/dialogStore';
import { useGridStore } from '@/store/gridStore';
import { useTabStore } from '@/store/tabStore';
import { useRouter } from 'next/navigation';

// ... all'interno di AppSidebar ...

const { isTabModeEnabled, setActiveTab, toggleTabMode } = useTabStore();
const { isGridModeEnabled, toggleGridMode } = useGridStore();
const showConfirmationDialog = useConfirmationDialogStore(state => state.show);
const router = useRouter();

const handleStandaloneNav = (path: string) => {
  const isModeActive = isGridModeEnabled || isTabModeEnabled;

  const navigate = () => {
    // Logica da eseguire se l'utente conferma:
    if (isGridModeEnabled) {
      toggleGridMode(); // Disattiva Grid Mode
    }
    if (isTabModeEnabled) {
      toggleTabMode(); // Disattiva Tab Mode
    }
    setActiveTab(null); // Assicura che nessuna tab sia attiva
    router.push(path); // Naviga alla pagina desiderata
  };

  if (isModeActive) {
    // Se una modalità è attiva, mostra il dialogo di conferma
    showConfirmationDialog({
      title: "Uscire dalla vista corrente?",
      description: "La navigazione a questa pagina chiuderà la tua vista a griglia o a schede attuale. Il tuo layout verrà salvato e ripristinato al tuo ritorno.",
      onConfirm: navigate, // Passa la logica di navigazione come callback
    });
  } else {
    // Se nessuna modalità è attiva, naviga direttamente
    navigate();
  }
};
```

---

## 5. Best Practices

*   **Centralizzazione:** Utilizza sempre lo store `useConfirmationDialogStore` per attivare il dialogo.
*   **Callback `onConfirm`:** Assicurati che la logica da eseguire alla conferma sia contenuta nel callback `onConfirm`.
*   **Messaggi Chiari:** Fornisci `title` e `description` chiari e concisi per guidare l'utente.
*   **Nessuna Gestione Manuale:** Non è necessario gestire manualmente lo stato `isOpen` o chiamare `hide()` dopo `onConfirm`; il componente `GlobalConfirmationDialog` si occupa di tutto.
