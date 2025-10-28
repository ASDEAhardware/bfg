# Changelog

Tutte le modifiche notevoli a questo progetto saranno documentate in questo file.

Il formato si basa su [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) e questo progetto aderisce al [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.1] - 2025-10-28

### Added

- **Settings Page**: Aggiunta la sezione "Appearance" (Aspetto), predisponendo l'area per la futura personalizzazione dell'interfaccia.

### Fixed

- **Grid Mode Navigation**: Risolto un bug per cui la pagina delle impostazioni non disattivava correttamente la visualizzazione "Grid Mode", impedendo il ritorno alla griglia principale.
- **Tab Mode Navigation**: Risolto un bug analogo per cui la pagina delle impostazioni veniva nascosta dall'interfaccia a schede dopo la navigazione, uniformando il comportamento a quello delle altre pagine di sistema.

## [1.2.1] - 2025-10-08

### Added

- **Modularità**: nel frontend le app sono state suddivise in moduli tramite un'apposita architettura per facilitarne l'aggiunta e lo sgancio del modulo.

- **Refresh token BFF Endpoint**: è stato aggiunto l'endpoint del refresh dell'access_token nel server BFF in quanto questa chiamata API deve essere effettuata dal Client (che comunica obbligatoriamente con il server BFF) e non più dal middleware.ts, rispettando le regole dell'architettura BFF Pattern.

- **Tooltips**: sono stati aggiunti dei Tooltips, per spiegare brevemente la funzione di un dato button all'hover del mouse.

### Fixed
- **Token race condition**: è stata fixata la race condition per cui l'access_token non veniva refreshato correttamente per cui ogni 5 minuti, al suo refresh, si veniva redirectati alla `/dashboard`.

- **Save Theme race condition**: fixata tramite un `debouncer` la race condition del tema per cui il tema mostrato nella UI non era sempre sincronizzato con il rispettivo valore all'interno del database.

- **Issue #6 Fixed**: è stato fixato l'issue #6 aperto in quanto nel terminale poteva essere visualizzato un error 400 durante il refresh dell'access_token. Questo errore era causato dalla token race condition.

- **Scroll on Grid contents**: è stato fixato lo scroll per il contenuto delle pagine che eccedevano lo spazio disponibile durante la Grid Mode.

- **Header Version Page**: fixato lo z-index dell'header della pagina per visualizzare i rilasci delle varie versioni, in quanto scrollando si sovrapponeva all'header della sidebar.

- **nav-user.tsx**: Fixata la tipizzazione di user nel file, utilizzando il tipo `User` definito in `/types/user.ts`.


## [1.2.0] - 2025-10-03

### Added

#### Grid System
- **Grid Mode**: Implementazione del sistema di griglia per visualizzazione multi-schermo all'interno dell'applicazione.
- **Grid Layout Manager**: Sistema completo di gestione layout con supporto per divisione orizzontale e verticale delle sezioni.
- **Section Management**: Funzionalità per aggiungere, rimuovere e gestire sezioni della griglia dinamicamente.
- **Tab Integration**: Integrazione completa tra modalità griglia e sistema di tabs con assegnazione automatica.
- **Virtual Pages**: Sistema di pagine virtuali per contenuti dinamici all'interno delle sezioni grid.
- **Drag & Drop**: Supporto per trascinamento e rilascio di schede nelle sezioni della griglia.
- **Responsive Grid**: Layout reattivo che si adatta a diverse dimensioni dello schermo.
- **Grid State Persistence**: Persistenza dello stato della griglia tra sessioni utente.
- **Smart Navigation**: Navigazione intelligente che si integra automaticamente con il grid mode attivo.

#### Components
- **GridSection**: Componente principale per rendering e gestione delle sezioni individuali.
- **GridModeToggle**: Toggle per abilitare/disabilitare la modalità griglia.
- **PageSelector**: Selettore per assegnare pagine specifiche alle sezioni grid.
- **TabContentRenderer**: Renderer specializzato per contenuti tab all'interno delle sezioni.

#### Store Management
- **GridStore**: Store Zustand dedicato per gestione stato griglia con persistenza automatica.
- **Layout algorithms**: Algoritmi per gestione automatica di posizionamento e ridimensionamento sezioni.

## [1.1.0] - 2025-10-02

### Added

#### Tabs
- **Tabs**: Aggiunta la funzionalità per navigare gli elementi della sidebar tramite le Tabs.

## [1.0.0] - 2025-10-02

### Added

Release iniziale dell'applicazione web.

#### Architettura Core
- **Containerizzazione:** Setup completamente containerizzato con Docker e Docker Compose per i servizi di backend e frontend, garantendo ambienti di sviluppo e produzione coerenti.
- **Backend for Frontend (BFF):** Un server Next.js funge da BFF, gestendo il rendering lato server, la protezione delle API route e la validazione locale dei token JWT.
- **Comunicazione Server-to-Server:** Comunicazione sicura stabilita tra i container del frontend e del backend all'interno della rete Docker.

#### Backend (Django)
- **Framework API:** Sviluppato con Django e Django REST Framework.
- **Autenticazione:**
    - Autenticazione basata su token JWT utilizzando `dj-rest-auth` e `djangorestframework-simplejwt`.
    - Implementa una strategia di validazione asimmetrica dei JWT: il backend firma i token con una chiave privata.
    - Un endpoint API espone la chiave pubblica per consentire la verifica dei token da parte del BFF.
    - Memorizzazione sicura dei token in cookie: il `refresh_token` è un cookie `httpOnly`, mentre l'`access_token` è un cookie standard accessibile dal client.
- **API Endpoints:** Endpoint principali per registrazione utente, login, logout, reset password e recupero dati utente.
- **Dipendenze Chiave:** `Django`, `djangorestframework`, `psycopg2-binary`, `djangorestframework-simplejwt`, `dj-rest-auth`.

#### Frontend (Next.js & React)
- **Framework:** Frontend moderno sviluppato con Next.js (App Router), React e TypeScript.
- **State Management:** Gestione dello stato globale affidata a Zustand per una soluzione minimale ed efficiente.
- **Data Fetching:** Utilizzo di TanStack Query (React Query) per la gestione dello stato del server, caching, e sincronizzazione dei dati.
- **API Client:** Axios configurato per effettuare richieste HTTP verso il BFF.
- **UI/UX:**
    - Libreria di componenti UI basata su Radix UI, Shadcn UI e tailwind (come si evince da `package.json`).
    - Supporto per tema light/dark con `next-themes`.
    - Routing protetto basato su ruoli gestito tramite la struttura delle directory e il middleware di Next.js.
- **Sicurezza:**
    - Un middleware in Next.js (`middleware.ts`) protegge le route private.
    - Il BFF valida i token JWT lato server prima di renderizzare le pagine protette, utilizzando la libreria `jose` per la decodifica asimmetrica.
- **Dipendenze Chiave:** `next`, `react`, `typescript`, `zustand`, `@tanstack/react-query`, `axios`, `jose`.

#### Tooling e Sviluppo
- **Code Quality:** ESLint configurato per il frontend per mantenere standard di codice elevati.
- **Gestione Variabili d'Ambiente:** File di esempio (`example.env`, `example.env.local`) per una facile configurazione degli ambienti di backend e frontend.