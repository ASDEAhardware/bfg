# Indice

1. [Introduzione — Architettura di Integrazione MQTT per Django/IoT](#introduzione)
2. [Componenti chiave e funzionamento](#componenti-chiave)
   - [Django Channels e ASGI](#django-channels-e-asgi)
   - [Redis come Channel Layer](#redis-come-channel-layer)
   - [Il Consumer di Channels (MqttConsumer)](#il-consumer-di-channels-mqttconsumer)
   - [Il Servizio MQTT (mqtt/services/)](#il-servizio-mqtt)
3. [Flusso dei dati: Sensore → Frontend (tempo reale)](#flusso-dei-dati)
4. [Riepilogo](#riepilogo)
5. [Notifica in tempo reale: segnali e broadcast](#notifica-in-tempo-reale)
   - [Ruolo di backend/mqtt/signals.py (Il Trigger)](#ruolo-signals)
   - [Ruolo di backend/mqtt/services/broadcast.py (L'Esecutore)](#ruolo-broadcast)
6. [Flusso di notifica aggiornato (cambio di stato)](#flusso-notifica-aggiornato)
7. [Interazione sincrona e livello API / Dati](#interazione-sincrona)
   - [Livello API (interazione HTTP)](#livello-api)
   - [Livello dati (ORM)](#livello-dati)
   - [Amministrazione e comandi di gestione](#amministrazione)
8. [Conclusione / Sommario](#conclusione)

<a id="introduzione"></a>
# 🤖 Architettura di Integrazione MQTT per Django/IoT

Questa architettura è progettata per integrare un sistema di messaggistica MQTT-based all'interno di un'applicazione web Django, permettendo la comunicazione in tempo reale e la gestione di dispositivi IoT.

<a id="componenti-chiave"></a>
## 🔑 Componenti Chiave e Funzionamento

### 1. Django Channels e ASGI

    Scopo: Django, di base, è WSGI (sincrono) e pensato per il ciclo richiesta/risposta HTTP. Django Channels estende Django all'ambiente ASGI (Asynchronous Server Gateway Interface), permettendo di gestire connessioni a lunga durata come WebSockets (necessarie per comunicare con il frontend) o altre connessioni TCP/asincrone.

    Implementazione:

        backend/config/asgi.py: Il punto d'ingresso ASGI. Configura un ProtocolTypeRouter che smista le richieste: HTTP standard a Django, WebSockets a Channels.

        backend/mqtt/routing.py: Simile a urls.py, definisce quali "Consumer" gestiscono le connessioni WebSocket in base al percorso URL.

<a id="redis-come-channel-layer"></a>
### 2. Redis come Channel Layer

    Scopo: Fornire un "luogo" centrale per la comunicazione tra le diverse istanze dell'applicazione (es. in un ambiente di produzione con più processi). Il Channel Layer è il meccanismo di Channels per la comunicazione inter-processo e inter-thread.

    Implementazione:

        backend/config/settings.py: La configurazione CHANNEL_LAYERS specifica l'uso di Redis (channels_redis.core.RedisChannelLayer).

        Funzionamento: Quando un'istanza (es. il Servizio MQTT) deve inviare un messaggio a un Consumer (che potrebbe essere in un'altra istanza), lo invia al server Redis. Redis inoltra poi il messaggio al Consumer corretto, garantendo scalabilità e comunicazione distribuita.

<a id="il-consumer-di-channels-mqttconsumer"></a>
### 3. Il Consumer di Channels (MqttConsumer)

    Scopo: L'equivalente di una "View" Django, ma per connessioni asincrone. Gestisce il ciclo di vita di una connessione WebSocket tra il backend e il frontend.

    Implementazione (backend/mqtt/consumers.py):

        connect(): Gestisce l'apertura della connessione WebSocket. È qui che viene tipicamente avviato il servizio asincrono che si connette al broker MQTT esterno.

        disconnect(): Gestisce la chiusura della connessione (pulizia, disconnessione dal broker MQTT).

        receive(): Elabora i messaggi inviati dal client frontend tramite il WebSocket (es. richieste di sottoscrizione a un nuovo topic).

        Metodi Personalizzati: Ricevono ed elaborano i messaggi inviati internamente tramite il Channel Layer (es. i dati grezzi appena arrivati dal broker MQTT).

<a id="il-servizio-mqtt"></a>
### 4. Il Servizio MQTT (mqtt/services/)

    Scopo: Incapsulare la logica di connessione, interazione e ascolto con il broker MQTT esterno (es. Mosquitto, AWS IoT), separandola dalla logica del Consumer.

    Implementazione (mqtt_connection.py, mqtt_service.py):

        Utilizza una libreria client MQTT (es. Paho-MQTT) per:

            Stabilire e mantenere la connessione con il broker.

            Gestire i callback di Paho-MQTT, in particolare on_message.

            Sottoscrivere/de-sottoscrivere i topic.

<a id="flusso-dei-dati"></a>
## 📈 Flusso dei Dati: Sensore a Frontend (Tempo Reale)

    Dispositivo IoT → Broker: Un sensore pubblica un messaggio su un topic MQTT (es. data/sensor/123).

    Broker → Servizio: Il broker invia il messaggio al Servizio MQTT sul backend, che è sottoscritto a quel topic. Il messaggio viene ricevuto nel callback on_message.

    Servizio → Channel Layer (Redis): Dentro on_message, il Servizio MQTT invia i dati grezzi a un "Gruppo" del Channel Layer tramite channel_layer.group_send(...).

    Channel Layer (Redis) → Consumer: Redis inoltra il messaggio a tutte le istanze di MqttConsumer iscritte a quel Gruppo.

    Consumer → MessageProcessor: Il Consumer riceve il messaggio e lo passa al servizio di Business Logic (message_processor.py).

    MessageProcessor:

        Esegue il parsing (es. JSON) e la validazione dei dati.

        Interagisce con i modelli Django (mqtt/models.py) per salvare i dati nel database (es. Datalogger, SensorDevice).

    Consumer → Frontend: Infine, il Consumer utilizza la connessione WebSocket attiva per inviare i dati puliti e processati direttamente al client (frontend), aggiornando l'interfaccia utente in tempo reale.

<a id="riepilogo"></a>
## 🎯 Riepilogo

L'architettura utilizza Django Channels come "ponte" per portare l'asincronicità di MQTT in Django. Redis funge da collante scalabile, permettendo al Servizio MQTT di comunicare in modo sicuro con i Consumer di Channels, che a loro volta gestiscono l'elaborazione dei dati e l'interazione con il database e il frontend.

<a id="notifica-in-tempo-reale"></a>
## 🔔 Notifica in Tempo Reale: Segnali e Broadcast

I file signals.py e broadcast.py implementano la logica per la notifica in tempo reale dal backend al frontend, assicurando che le modifiche di stato nel database vengano immediatamente comunicate all'interfaccia utente tramite WebSockets.

<a id="ruolo-signals"></a>
## 🚦 Ruolo di backend/mqtt/signals.py (Il Trigger)

Questo file è il "trigger" basato su eventi che reagisce ai cambiamenti del database (la sorgente di verità).

    Azione Principale: Utilizza il sistema di "segnali" di Django. La funzione mqtt_connection_post_save si aggancia all'evento post_save del modello MqttConnection, venendo eseguita automaticamente dopo ogni salvataggio.

    Condizione Cruciale (Filtro): La logica procede solo se l'operazione di salvataggio ha modificato specificamente il campo status (controllato da if update_fields and 'status' in update_fields:).

        Perché? Questo impedisce notifiche non necessarie, assicurando che il frontend venga aggiornato solo quando c'è un effettivo cambiamento di stato della connessione (es. da connecting a connected).

    Azione Successiva: Se la condizione è soddisfatta, il segnale invoca la funzione broadcast_status_update, delegando il compito di invio.

<a id="ruolo-broadcast"></a>
## 📡 Ruolo di backend/mqtt/services/broadcast.py (L'Esecutore)

Questo file è l'"esecutore" che traduce il segnale del database in un messaggio per il Channel Layer.

    Funzione: Fornisce la funzione di utility broadcast_status_update, che si occupa di inviare messaggi di notifica.

    Meccanismo di Invio:

        Ottiene l'accesso al Channel Layer (Redis).

        Prepara un messaggio standardizzato in formato dizionario, contenente il dato del cambiamento (es. l'id e il nuovo status).

        Il campo cruciale è 'type': 'status.update', che istruisce il Consumer (il destinatario finale) su quale metodo eseguire per gestire il messaggio.

        Utilizza async_to_sync per inviare il messaggio tramite channel_layer.group_send(GROUP_NAME, message), dato che i segnali di Django sono sincroni, mentre le operazioni di Channels sono asincrone. Il GROUP_NAME aggrega tutti i client interessati a questi aggiornamenti.

<a id="flusso-notifica-aggiornato"></a>
## 🔄 Flusso di Notifica Aggiornato (Cambio di Stato)

Il flusso illustra come una modifica nel database si propaga in tempo reale a tutti gli utenti connessi:

    Stato del Servizio Aggiornato: Il Servizio MqttService nel backend (es. in un thread dedicato) si connette al broker, e il suo stato cambia. Aggiorna il database: instance.save(update_fields=['status']).

    Scatto del Segnale: Il .save() fa scattare il segnale post_save. La funzione mqtt_connection_post_save in signals.py viene eseguita.

    Filtro: Il segnale verifica che solo il campo status sia stato modificato.

    Delega al Broadcast: Il segnale chiama broadcast_status_update() in broadcast.py con i nuovi dati.

    Invio al Layer: Il Broadcaster usa async_to_sync e group_send per inviare il messaggio strutturato ({'type': 'status.update', ...}) al gruppo mqtt_status_updates tramite Redis.

    Ricezione dal Consumer: Redis inoltra il messaggio a tutti i MqttConsumer (in consumers.py) che hanno aderito al gruppo. Il Consumer esegue il metodo corrispondente al type, ovvero status_update(self, event).

    Notifica al Frontend: All'interno di status_update, il Consumer prende i dati e li invia, tramite la connessione WebSocket, direttamente al browser del client.

    Aggiornamento UI: Il frontend riceve il dato e aggiorna l'interfaccia utente in tempo reale (es. cambia un indicatore da rosso/giallo a verde) senza ricaricare la pagina.

In sintesi, i segnali di Django sono la chiave per trasformare un'azione sincrona del database in un evento asincrono globale attraverso il Channel Layer.

<a id="interazione-sincrona"></a>
## 🌐 Interazione Sincrona e Livello Dati

Mentre i componenti precedenti gestiscono il flusso di dati asincroni in tempo reale (MQTT e Channels), i file descritti qui sotto gestiscono l'interazione sincrona (HTTP/API), la persistenza dei dati (Database) e la gestione amministrativa del sistema.

### 1. ⚙️ Livello API (Interazione HTTP)

Questo livello espone le funzionalità del backend al frontend (o ad altri client) tramite le classiche chiamate REST su protocollo HTTP, usate per gestire la configurazione e recuperare dati storici.

    backend/mqtt/api/views.py (Logica Endpoint):

        Contiene le View che definiscono la logica per gli endpoint HTTP, come ad esempio:

            Gestire le richieste per abilitare/disabilitare una connessione MQTT (MqttConnection).

            Fornire la lista e lo stato attuale di tutte le connessioni.

            Recuperare i dati storici registrati da un Datalogger.

    backend/mqtt/api/serializers.py (Conversione Dati):

        Componente cruciale che converte le istanze complesse dei modelli Django in un formato standard di rete (tipicamente JSON) per le risposte API.

        Gestisce anche il processo inverso: validare i dati JSON in ingresso dalle richieste e convertirli in oggetti Python per la manipolazione.

    backend/mqtt/urls.py & backend/api/v1/urls.py (Routing):

        Sono i "router" HTTP che mappano un URL specifico (es. /api/v1/mqtt/connections/1/enable/) alla View corretta definita in views.py.

### 2. 🧱 Livello Dati (La Fondazione ORM)

Questo è il cuore della persistenza dei dati, definito dal sistema ORM (Object-Relational Mapping) di Django.

    backend/mqtt/models.py (Definizione del Database):

        Definisce la struttura del database per l'integrazione MQTT/IoT, inclusi i modelli (tabelle) più importanti:

            MqttConnection: Memorizza la configurazione (host, porta, credenziali, ecc.) e lo stato corrente (connected/error, se è is_enabled) di ogni connessione al broker.

            Datalogger, Gateway, SensorDevice: Modelli che archiviano i dati telemetrici, le informazioni sui dispositivi fisici e sui sensori IoT.

            DiscoveredTopic: Probabilmente logga i topic identificati dinamicamente durante l'operazione.

### 3. 🛠️ Amministrazione e Comandi di Gestione

Questi componenti facilitano la manutenzione, il debug e la gestione del sistema da parte degli sviluppatori e degli amministratori.

    backend/mqtt/admin.py (Pannello Amministrativo):

        Registra i modelli del database (MqttConnection, Datalogger, ecc.) nell'interfaccia di amministrazione di Django.

        Fornisce agli amministratori uno strumento potente e rapido per visualizzare, modificare e debuggare i dati e la configurazione del sistema.

    backend/mqtt/management/commands/ (Script di Manutenzione):

        Contiene script personalizzati (python manage.py <nome_comando>) usati per task specifici di manutenzione o batch.

        Esempi tipici includono: pulizia di vecchi log, ri-sottoscrizione forzata ai topic, o controlli di salute programmati del sistema.

Il quadro dell'architettura è ora completo:

    Tempo Reale (Asincrono): Channels, Consumers, MqttService, Redis.

    Gestione (Sincrona): Livello API (Views/Serializers), Modelli, Admin.
