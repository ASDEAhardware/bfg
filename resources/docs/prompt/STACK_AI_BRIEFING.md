# Briefing Tecnico di Progetto per Assistente AI

Questo documento descrive l'architettura e lo stack tecnologico del progetto BFG per fornire contesto a un assistente AI. L'obiettivo è garantire che suggerimenti e implementazioni siano coerenti con le tecnologie e i pattern esistenti.

## 1. Architettura Generale

Il progetto ha una struttura quasi-monorepo con due componenti principali:

- **`backend/`**: Un'applicazione Django che funge da API principale e gestisce la logica di business.
- **`frontend/`**: Un'applicazione Next.js che serve l'interfaccia utente e agisce come Backend-for-Frontend (BFF).

La comunicazione tra frontend e backend avviene tramite una **API REST**. L'orchestrazione locale è gestita tramite `docker-compose` (o `podman-compose`).

---

## 2. Dettagli del Backend (Django)

- **Linguaggio**: Python 3.13
- **Framework**: Django
- **Database**: PostgreSQL, eseguito in un container Docker separato.
- **Containerizzazione**: L'applicazione è containerizzata con Docker utilizzando un **Dockerfile multi-stage** (`builder`/`runtime`) per ottimizzare la dimensione e la sicurezza dell'immagine finale.

### Gestione dei Processi

- **Process Manager**: **`supervisord`** è il processo principale (PID 1) nel container di produzione. Ha il compito di avviare e monitorare i servizi dell'applicazione.
- **Web Server**: **`gunicorn`** viene utilizzato come server WSGI di produzione per l'applicazione Django. Il numero di worker viene calcolato dinamicamente all'avvio in base ai core della CPU per ottimizzare le performance.
- **ASGI Server**: **`daphne`** è utilizzato come server ASGI per gestire le connessioni WebSocket. Viene eseguito su una porta separata (8001) e gestito da `supervisord`.
- **Logging**: Tutti i log (`supervisord`, `gunicorn`, `daphne` e servizi custom) sono reindirizzati su **`stdout`/`stderr`** per essere gestiti a livello di container, in linea con le best practice cloud-native.

### Servizio MQTT in Background

- **Esecuzione**: È un servizio custom (`manage.py start_mqtt_service`) gestito da `supervisord` come processo worker a lunga esecuzione.
- **Architettura**: Implementato come **Singleton** per garantire una singola istanza di gestione.
- **Pattern di Controllo**: Segue il pattern **"Single Authority"**. Un "guardiano" (thread `monitor_connections`) è l'unica autorità che agisce sullo stato delle connessioni. Le API si limitano a modificare lo stato desiderato sul database (flag `is_enabled`), che viene poi recepito e attuato dal guardiano.
- **Robustezza**: Implementa best practice MQTT critiche:
    - **Client ID Fisso**: Per sessioni stabili.
    - **Clean Session**: Per prevenire connessioni zombie.
    - **Last Will and Testament (LWT)**: Per il rilevamento rapido di disconnessioni anomale.
    - **Cooldown Anti-Loop**: Per prevenire loop di riconnessione in caso di conflitti di Client ID (errore codice 7).
    - **Shutdown Parallelo**: Per una chiusura rapida e pulita del servizio.

---

## 3. Dettagli del Frontend (Next.js)

- **Linguaggio**: TypeScript
- **Framework**: Next.js 15 / React 19
- **Styling**: **Tailwind CSS**.
- **Componenti UI**: La libreria di componenti è basata su **`shadcn/ui`**, che utilizza `Radix UI` come primitive headless e `tailwind-merge`/`clsx` per la gestione delle classi.

### Architettura Dati e Stato

- **Data Fetching e Server State**: **`@tanstack/react-query` (React Query)** è la libreria principale per il fetching, caching, e la sincronizzazione dei dati provenienti dal server.
- **Client State**: **`zustand`** viene utilizzato per la gestione dello stato globale lato client (es. preferenze UI, stato non legato ai dati del server).
- **Chiamate API**: **`axios`** è utilizzato come client HTTP, con un'istanza pre-configurata in `@/lib/axios`.

Il flusso di dati tipico è: Componente -> Custom Hook -> `useQuery` (React Query) -> Servizio (`axios`) -> API Backend.

### Comunicazione in Tempo Reale (WebSockets)

- **Backend**: Utilizza **`django-channels`** per gestire le connessioni WebSocket, servite da **`daphne`** sulla porta 8001. Un `MqttStatusConsumer` è responsabile di accettare le connessioni e inoltrare i messaggi di aggiornamento di stato.
- **Integrazione Backend**: I cambiamenti di stato del modello `MqttConnection` (salvataggio nel DB) attivano un **Django Signal**. Questo segnale invia un messaggio al `MqttStatusConsumer` che lo broadcasta a tutti i client WebSocket connessi.
- **Frontend**: Un custom hook (`useMqttStatusSocket`) gestisce la connessione WebSocket.
    - Aggiorna uno store `zustand` (`websocketStore`) con lo stato della connessione WebSocket stessa.
    - Quando riceve un messaggio di aggiornamento di stato (es. `{ site_id: 88, status: 'connected' }`), utilizza il `queryClient` di **`@tanstack/react-query`** per aggiornare la cache locale. Questo innesca automaticamente il re-rendering dei componenti React che dipendono da quei dati, garantendo aggiornamenti UI in tempo reale.
