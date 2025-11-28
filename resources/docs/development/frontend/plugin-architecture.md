# Architettura dei Plugin

Questo documento descrive l'architettura dei plugin utilizzata nel frontend dell'applicazione. Questo sistema è stato progettato per garantire modularità, estensibilità e una gestione efficiente del codice.

## Core Concepts

L'architettura si basa su tre concetti fondamentali:

1.  **Plugin**: Un'unità di codice autonoma che rappresenta una specifica funzionalità dell'applicazione (es. Dashboard, Gestione Dispositivi). Ogni plugin è un oggetto che definisce:
    *   `metadata`: Informazioni identificative (ID, nome, versione).
    *   `routes`: Le rotte (URL) gestite dal plugin e i componenti da renderizzare.
    *   `navItems`: I link di navigazione da mostrare nella sidebar.
    *   `permissions`: Il livello di accesso richiesto per visualizzare il plugin.

2.  **Plugin Registry (`src/plugins/registry.ts`)**: È il gestore centrale, un "elenco telefonico" di tutti i plugin. Ha il compito di:
    *   **Registrare** i plugin che vengono abilitati.
    *   Fornire metodi per **recuperare** le rotte, i link di navigazione e i permessi di tutti i plugin registrati.

3.  **Inizializzazione (`src/plugins/index.ts`)**: Questo è il punto di ingresso del sistema. La funzione `initializePlugins` in questo file importa le definizioni dei singoli plugin e le passa al `pluginRegistry` per la registrazione. **Questo è l'unico file da modificare per abilitare o disabilitare un plugin nell'intera applicazione.**

## Flusso di Funzionamento

### 1. Rendering di una Pagina (Rotta)

1.  L'utente naviga a un URL (es. `/dashboard`).
2.  Il componente `PluginRouteRenderer` (utilizzato nelle pagine principali) viene attivato.
3.  `PluginRouteRenderer` interroga il `pluginRegistry` per trovare quale plugin ha registrato una rotta che corrisponde all'URL `/dashboard`.
4.  Se viene trovato un plugin corrispondente, il suo componente associato viene caricato dinamicamente (tramite `import()`) e renderizzato a schermo.
5.  Se nessun plugin registrato corrisponde alla rotta, non viene renderizzato nulla.

### 2. Costruzione della Sidebar di Navigazione

1.  Il componente `AppSidebar` chiede al `pluginRegistry` l'elenco di tutti i `navItems` dei plugin registrati.
2.  La sidebar itera su questo elenco e renderizza dinamicamente i link di navigazione.

## Gestione dei Plugin

### Aggiungere un Nuovo Plugin

1.  Creare la cartella del nuovo plugin in `src/plugins/`.
2.  Definire l'oggetto plugin (rotte, navigazione, ecc.).
3.  Importarlo e registrarlo nel file `src/plugins/index.ts` aggiungendolo alla funzione `initializePlugins`.

### Disabilitare un Plugin e Tree-Shaking

Per disabilitare un plugin, è sufficiente **commentare o rimuovere la sua riga di registrazione** nel file `src/plugins/index.ts`.

Grazie al processo di **Tree-Shaking** degli strumenti di build moderni (Webpack, usato da Next.js), questo ha un'implicazione fondamentale sulla performance:

*   Al momento della creazione della build di produzione, Webpack analizza il codice partendo dai punti di ingresso.
*   Se il codice di un plugin non viene mai importato in `src/plugins/index.ts`, Webpack lo identifica come "codice morto".
*   **Questo codice morto viene completamente eliminato dal bundle finale** dell'applicazione.

In questo modo, un plugin disabilitato non solo non è utilizzabile, ma non occupa nemmeno spazio e non rallenta i tempi di caricamento per l'utente finale.
