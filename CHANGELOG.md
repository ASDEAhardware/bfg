# Changelog

Tutte le modifiche notevoli a questo progetto saranno documentate in questo file.

Il formato si basa su [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) e questo progetto aderisce al [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.1] - 2025-11-18

### Changed

- **Automazione Avvio Backend**: Migliorato lo script `entrypoint.sh` del backend per automatizzare e rendere più robusto l'avvio del container.
    - Aggiunto un "wait loop" che attende la piena disponibilità del database prima di eseguire qualsiasi comando.
    - Aggiunta l'esecuzione automatica dei comandi `check` (per controlli di sistema) e `migrate` (per le migrazioni del database) all'avvio.

### Fixed

- **Configurazione Docker Backend**: Risolto un problema che impediva l'avvio del servizio backend a causa della mancata disponibilità delle variabili d'ambiente durante la fase di build.
    - Spostata la raccolta dei file statici (`collectstatic`) dal Dockerfile allo script `entrypoint.sh`, per garantirne l'esecuzione con le corrette variabili d'ambiente a runtime.
    - Aggiornato il Dockerfile per utilizzare il nuovo `entrypoint.sh`.

### Added

#### Bootstack
- **Bootstack**: raggiungibile in dev http://localhost:6875/ credenziali di default Email: admin@admin.com Password: password


## [1.5.0] - 2025-11-12

### Added

#### Sensor Configuration & Visualization
- **Sensor Configuration Page**: Aggiunta una nuova pagina dedicata alla configurazione dei sensori, che permette agli utenti di gestire e personalizzare i parametri dei sensori.
- **Sensor Diagram**: Implementato un componente per la visualizzazione dinamica di diagrammi di sensori, che mostra le connessioni e le relazioni tra i vari sensori.
- **SVG as Components**: Abilitata la possibilità di importare file SVG come componenti React per una maggiore flessibilità nella visualizzazione di icone e diagrammi.
- **Sensor Plugin**: Creato un nuovo plugin per il sensore per modularizzare e gestire la logica relativa ai sensori.
- **State Management for Sensors**: Introdotto uno store Zustand (`sensorConfigStore`) per gestire lo stato della configurazione dei sensori.
- **New Components**: Sviluppati nuovi componenti riutilizzabili come `SensorDiagram`, `SensorDiagramSkeleton`, `sensor-dropdown`, e `HorizontalLine`.
- **Documentation**: Aggiunta una guida per lo sviluppo del diagramma dei sensori in `resources/docs/development/frontend/sensor-diagram-guide.md`.

## [1.4.0] - 2025-10-29

### Added

#### MQTT System Integration
- **Real-time Communication**: Integrated a comprehensive MQTT system for real-time communication with dataloggers and sensors.
- **Multi-site Connections**: Each site now has its own configurable MQTT connection.
- **Auto-discovery**: Automatic discovery of topics and devices.
- **API Versioning**: Support for different versions of the MQTT protocol.
- **Dynamic Monitoring**: Automatic detection of offline devices.
- **Real-time Updates**: Real-time updates of sensor data.

#### Backend (Django)
- **MQTT Services Layer**:
    - `MqttManager`: Singleton to manage all active MQTT connections.
    - `MqttConnectionHandler`: Handler for a single MQTT connection with automatic retries.
    - `MessageProcessor`: Centralized processing of MQTT messages with multi-version support.
    - `DynamicOfflineMonitor`: Intelligent monitoring of online/offline status of devices.
- **API Endpoints**:
    - MQTT connection control (start, stop, status).
    - Datalogger and sensor data retrieval.
    - Publishing messages to MQTT topics.
- **Database Models**:
    - `MqttConnection`: Configuration for MQTT connection per site.
    - `MqttTopic`: Configurable MQTT topics for each connection.
    - `DiscoveredTopic`: Automatic tracking of all discovered topics.
    - `Gateway`: Main gateway system of the site.
    - `Datalogger`: Datalogger device that acquires data from sensors.
    - `SensorDevice`: Physical sensor connected to a datalogger.

#### Frontend (React)
- **MQTT Hooks**:
    - `useMqttConnectionStatus`: Hook to monitor the MQTT connection status of a site.
    - `useMqttControl`: Hook for MQTT connection control (for superusers).
    - `useDataloggers`: Hook to retrieve the list of dataloggers.
    - `useSensors`: Hook to retrieve the list of sensors.
    - `useDataloggerControl`: Advanced hook for datalogger acquisition control.
- **Zustand Store**:
    - `dataloggerControlStore`: Store to manage datalogger control sessions.
- **Components**:
    - `DataloggerCard`: Card to display a datalogger in the list.
    - `SensorCard`: Card to display a sensor.
- **Pages**:
    - `DataLoggerListPage`: List of all dataloggers for a site.
    - `DataLoggerDetailPage`: Detail of a single datalogger with acquisition control.

#### MQTT Protocol
- **Topic Hierarchy**: Defined a clear topic hierarchy for multi-site and multi-device communication.
- **Message Formats**: Standardized message formats for gateway/datalogger heartbeats, sensor data, and control commands.
- **Versioning**: Explicit versioning in message payloads for backward compatibility.

## [1.3.1] - 2025-10-28

### Added

- **Settings Page**: Aggiunta la sezione "Appearance" (Aspetto), predisponendo l'area per la futura personalizzazione dell'interfaccia.
- **Confirmation Dialog**: Implementato un dialogo di conferma che avvisa l'utente quando la navigazione verso una pagina standalone (es. Settings, Version o qualsiasi elemento della navigazione principale) è richiesta mentre una modalità Grid o Tab è attiva. Questo previene la chiusura accidentale della vista corrente.

### Fixed

- **Grid Mode Navigation**: Risolto un bug per cui la pagina delle impostazioni non disattivava correttamente la visualizzazione "Grid Mode", impedendo il ritorno alla griglia principale.
- **Tab Mode Navigation**: Risolto un bug analogo per cui la pagina delle impostazioni veniva oscurata dall'interfaccia a schede dopo la navigazione, uniformando il comportamento a quello delle altre pagine di sistema.
- **Grid/Tab Mode Auto-Disable**: Implementata la disattivazione automatica delle modalità Grid e Tab quando l'utente conferma la navigazione verso una pagina standalone, garantendo che la vista sia correttamente chiusa e che lo stato del layout venga salvato in background.

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
