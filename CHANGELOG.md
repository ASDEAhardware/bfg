# Changelog

Tutte le modifiche notevoli a questo progetto saranno documentate in questo file.

Il formato si basa su [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) e questo progetto aderisce al [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
