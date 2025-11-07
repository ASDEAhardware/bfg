# Piano di Sviluppo: Integrazione WebSocket per Stato Connessioni MQTT

Questo documento descrive le fasi per implementare l'aggiornamento in tempo reale dello stato delle connessioni MQTT nell'interfaccia frontend, utilizzando WebSockets.

---

### Fase 1: Setup del Backend (Django Channels)

**Obiettivo**: Configurare il backend Django per accettare connessioni WebSocket.

1.  **Aggiungere Dipendenze**: Modificare il file `backend/requirements.txt` e aggiungere `channels` e `daphne`.
2.  **Aggiornare `settings.py`**:
    - Aggiungere `'channels'` alla lista `INSTALLED_APPS`.
    - Definire `ASGI_APPLICATION = 'config.asgi.application'` per indicare a Django di usare il nuovo entrypoint ASGI.
    - Aggiungere la configurazione `CHANNEL_LAYERS` (es. `InMemoryChannelLayer` per sviluppo).
3.  **Creare/Modificare `asgi.py`**: Modificare il file `backend/config/asgi.py` per configurare il `ProtocolTypeRouter`, che smisterà il traffico tra HTTP e WebSocket.
4.  **Definire Routing WebSocket**: Creare un nuovo file `backend/mqtt/routing.py` per definire gli URL per le connessioni WebSocket (es. `ws/status/`).
5.  **Configurare `supervisord`**: Modificare `backend/supervisord.conf` per aggiungere un nuovo programma (`daphne`) che avvierà il server ASGI sulla porta 8001 (es. `daphne -b 0.0.0.0 -p 8001 config.asgi:application`).
6.  **Esporre la Porta**: Modificare `docker-compose.yml` per esporre la porta 8001 per il servizio `backend`.

---

### Fase 2: Logica del Consumer (Backend)

**Obiettivo**: Creare la logica che gestisce i client WebSocket.

1.  **Creare `consumers.py`**: Creare un nuovo file `backend/mqtt/consumers.py`.
2.  **Implementare `MqttStatusConsumer`**: Creare una classe `MqttStatusConsumer` che eredita da `channels.generic.websocket.AsyncWebsocketConsumer`.
3.  **Logica di Connessione**: Implementare i metodi `connect` e `disconnect` nel consumer. Il metodo `connect` aggiungerà il client a un gruppo di notifica (es. `mqtt_status_updates`).

---

### Fase 3: Integrazione del Servizio (Backend)

**Obiettivo**: Far sì che il backend invii un messaggio via WebSocket quando lo stato di una connessione MQTT cambia.

1.  **Creare un Helper per il Broadcast**: In un file appropriato (es. `consumers.py` o un nuovo `services/broadcast.py`), creare una funzione `broadcast_status_update(site_id, status)` che invia un messaggio al gruppo WebSocket.
2.  **Utilizzare Django Signals**: Questo è l'approccio più pulito per disaccoppiare la logica.
    - Creare un file `signals.py` nell'app `mqtt`.
    - Definire un `post_save` signal sul modello `MqttConnection`.
    - La funzione del segnale controllerà se il campo `status` è cambiato e, in caso affermativo, chiamerà la funzione `broadcast_status_update`.
3.  **Collegare il Segnale**: Importare e collegare i segnali nel file `apps.py` dell'app `mqtt`.

---

### Fase 4: Setup del Frontend (Store e Hook)

**Obiettivo**: Preparare il frontend a ricevere e gestire gli aggiornamenti in tempo reale.

1.  **Creare `websocketStore.ts`**: Creare un nuovo store `zustand` in `frontend/src/store/` per gestire lo stato della connessione WebSocket stessa (Connesso, Disconnesso, etc.).
2.  **Creare `useMqttStatusSocket.ts`**: Creare un nuovo custom hook in `frontend/src/hooks/`. Questo hook si occuperà di:
    - Stabilire la connessione al backend WebSocket.
    - Aggiornare lo store `zustand` con lo stato della connessione.
    - Gestire l'evento `onmessage`.
    - **Azione chiave**: Quando riceve un messaggio, usare il `queryClient` di `@tanstack/react-query` per aggiornare la cache con i nuovi dati di stato (`queryClient.setQueryData`).
    - **Importante**: Aggiungere la direttiva `"use client";` all'inizio del file.

---

### Fase 5: Integrazione nella UI (Frontend)

**Obiettivo**: Collegare la logica WebSocket ai componenti UI.

1.  **Inizializzare l'Hook**: Chiamare il custom hook `useMqttStatusSocket()` una sola volta in un componente di alto livello (es. `frontend/src/app/(private)/layout.tsx`) per garantire che la connessione sia sempre attiva.
    - **Importante**: Per evitare errori di Server/Client Component, creare un piccolo Client Component (`WebSocketInitializer.tsx`) che chiama l'hook e renderizzarlo nel layout.
2.  **Modificare il Componente Card**: Nel componente che mostra lo stato e ha il pulsante di controllo (es. `DataloggerCard.tsx` o un suo discendente):
    - Implementare la logica di "UI ottimistica": al click del pulsante, disabilitarlo immediatamente e mostrare uno spinner.
    - La logica di aggiornamento dello stato (es. da "in attesa" a "disconnected") non sarà più manuale o basata su polling, ma avverrà automaticamente quando `react-query` ri-renderizzerà il componente a seguito dell'aggiornamento della cache fatto dal WebSocket.
    - Rimuovere ogni riferimento a `useMqttStatusPolling` e alla logica di polling.

---

### Fase 6: Aggiornamento Documentazione

**Obiettivo**: Mantenere la documentazione allineata con il codice.

1.  **Aggiornare `STACK_AI_BRIEFING.md`**: Al termine di tutte le implementazioni, modificare il documento di briefing per includere la nuova architettura basata su WebSockets per gli aggiornamenti di stato in tempo reale.