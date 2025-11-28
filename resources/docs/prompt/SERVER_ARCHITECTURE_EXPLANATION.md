# Spiegazione dell'Architettura dei Server Backend

Questo documento chiarisce quali server sono in esecuzione nel container `backend`, il loro scopo e perché sono necessari.

## 1. Il Container `backend`

Il tuo ambiente di backend è incapsulato in un singolo container Docker (`bfg_backend`). All'interno di questo container, un gestore di processi chiamato **`supervisord`** è responsabile di avviare, monitorare e mantenere in esecuzione più processi figli. Questo è un pattern comune e una best practice per gestire applicazioni multi-processo all'interno di un singolo container.

## 2. I Processi in Esecuzione

Attualmente, `supervisord` gestisce i seguenti processi principali:

### 2.1. `gunicorn` (Server WSGI)

-   **Scopo**: `gunicorn` è il server principale per tutte le **richieste HTTP/HTTPS** standard. Questo include:
    -   Le chiamate API REST dal frontend (es. per recuperare la lista dei datalogger, avviare/fermare connessioni MQTT).
    -   L'interfaccia di amministrazione di Django.
-   **Standard**: Implementa lo standard **WSGI (Web Server Gateway Interface)**, che è l'interfaccia tradizionale per le applicazioni web sincrone in Python.
-   **Necessità**: È assolutamente necessario per servire l'API REST e qualsiasi altra funzionalità web tradizionale della tua applicazione Django in un ambiente di produzione.

### 2.2. `daphne` (Server ASGI)

-   **Scopo**: `daphne` è il server dedicato alla gestione delle **connessioni WebSocket**. Questo include:
    -   Gli aggiornamenti in tempo reale dello stato delle connessioni MQTT che abbiamo appena implementato.
-   **Standard**: Implementa lo standard **ASGI (Asynchronous Server Gateway Interface)**, che è l'interfaccia più recente per le applicazioni Python asincrone e i protocolli come i WebSockets.
-   **Necessità**: È assolutamente necessario per abilitare la funzionalità WebSocket in tempo reale fornita da Django Channels.
-   **Porta**: Attualmente è configurato per ascoltare sulla porta **8001**.

### 2.3. `mqtt_service` (Servizio in Background)

-   **Scopo**: Questo è un processo Python a lunga esecuzione che gestisce la logica specifica del servizio MQTT (mantenere le connessioni ai broker, monitorare lo stato, ecc.).
-   **Necessità**: È essenziale per il funzionamento del core della tua applicazione MQTT.

### 2.4. `uvicorn` (Non in Esecuzione)

-   **Chiarimento**: `uvicorn` **NON è attualmente in esecuzione** nel tuo setup.
-   **Ruolo Alternativo**: `uvicorn` è un altro popolare server ASGI. Potrebbe essere utilizzato come alternativa a `daphne`, oppure come tipo di worker per `gunicorn` (configurando `gunicorn` per usare worker `uvicorn`) per permettere a `gunicorn` di servire sia il traffico WSGI (HTTP) che ASGI (WebSocket) sulla stessa porta.

## 3. Perché `gunicorn` e `daphne` separati?

La scelta di avere `gunicorn` e `daphne` in esecuzione come processi separati (su porte diverse) è una strategia valida e comune per le seguenti ragioni:

-   **Separazione dei Compiti**: `gunicorn` è specializzato in HTTP, `daphne` in WebSockets. Questa separazione può semplificare la configurazione e l'ottimizzazione per ciascun tipo di traffico.
-   **Chiarezza Architetturale**: Rende esplicito quali server gestiscono quali tipi di richieste.
-   **Flessibilità**: Permette di scalare o configurare in modo diverso i server HTTP e WebSocket se necessario (anche se in questo setup sono gestiti insieme da `supervisord`).

L'alternativa sarebbe configurare `gunicorn` per usare worker ASGI (come `uvicorn`) e servire entrambi i tipi di traffico sulla stessa porta (8000). Questa è un'altra soluzione valida, spesso preferita in produzione per consolidare gli endpoint, ma richiede una configurazione più specifica di `gunicorn`.

## 4. Conclusione

Il tuo container `backend` esegue i server `gunicorn` e `daphne` (più il servizio `mqtt_service`) sotto la supervisione di `supervisord`. Questa configurazione è **corretta e necessaria** per gestire sia le richieste HTTP/REST che le connessioni WebSocket in tempo reale della tua applicazione Django.
