# Riepilogo Funzionamento Servizio MQTT

Questo documento riassume il funzionamento del servizio MQTT, le sue componenti principali e il suo ciclo di vita, basandosi sulle ultime modifiche.

## 1. Avvio del Container e Processi Permanenti

Quando il container `bfg_backend` viene avviato tramite `docker-compose up`, succede quanto segue:

1.  **Processo Principale**: Il `CMD` del Dockerfile (non mostrato, ma dedotto da `supervisord.conf`) avvia `supervisord`. Questo è il **processo padre** che gestisce tutti gli altri servizi all'interno del container.
2.  **Servizi Gestiti**: `supervisord` legge il file di configurazione `/app/supervisord.conf` e avvia i programmi definiti:
    *   `gunicorn`: Il server web che esegue l'applicazione Django.
    *   `mqtt_service`: Il nostro servizio MQTT.
3.  **Script Permanente**: Il programma `mqtt_service` esegue il comando `python manage.py start_mqtt_service`. Questo script avvia un'istanza singleton della classe `MQTTService` e la mantiene **permanentemente in esecuzione** (`self.running = True`).
4.  **Controllo e Riavvio**: **`supervisord` è il controllore**. Grazie alle direttive `autostart=true` e `autorestart=true`, `supervisord` garantisce che lo script `start_mqtt_service` venga avviato all'inizio e riavviato automaticamente in caso di crash.

## 2. Ciclo di Vita del Servizio (Start, Stop, Monitoraggio)

### Cosa succede con `supervisorctl start mqtt_service`

1.  **Avvio**: Viene eseguito il metodo `mqtt_service.start()`.
2.  **Caricamento Connessioni**: Il servizio interroga il database e carica tutte le connessioni MQTT configurate con `is_enabled=True`.
3.  **Connessione al Broker**: Per ogni connessione abilitata, viene creato un `MQTTConnectionManager` che gestisce il ciclo di vita di una singola connessione al broker. Le nuove best practice implementate sono:
    *   **Client ID Fisso**: L'ID del client non è più random ma costruito usando l'hostname del container (es: `site_88_bfg_back`). Questo permette al broker di identificare in modo univoco l'istanza del servizio.
    *   **Clean Session (`true`)**: Al momento della connessione, viene richiesto al broker di eliminare qualsiasi sessione precedente associata a quel Client ID. Questo previene "connessioni zombie".
    *   **Last Will and Testament (LWT)**: Il client informa il broker che, in caso di disconnessione imprevista (crash), deve pubblicare un messaggio (es: `offline`) su un topic di stato (es: `site_88/backend/status`). Ciò consente un rilevamento quasi istantaneo dei crash (<10s).
4.  **Avvio Monitor**: Parte un thread in background (`monitor_connections`) che funge da "guardiano".

### Il "Guardiano": Il Thread di Monitoraggio

Lo script non resta passivo. Il thread `monitor_connections` esegue un ciclo di controllo **ogni 30 secondi**:

*   **Controlla Connessioni Perse**: Verifica se qualche connessione attiva ha perso il contatto con il broker. Se sì, tenta di ristabilirla.
*   **Aggiunge Nuove Connessioni**: Se una nuova connessione viene abilitata nel database, il monitor la rileva e la avvia.
*   **Rimuove Connessioni Disabilitate**: Se una connessione viene disabilitata, il monitor la ferma e la rimuove.
*   **Gestisce Riconnessioni (Cooldown)**: Se una connessione fallisce ripetutamente (specialmente con errore `code 7`, che indica un possibile ID client duplicato), il monitor applica un cooldown prima di riprovare, per evitare loop infiniti.

### Cosa succede con `supervisorctl stop mqtt_service`

1.  **Segnale di Stop**: `supervisord` invia un segnale di terminazione al processo.
2.  **Shutdown Controllato**: Il metodo `mqtt_service.stop()` viene invocato.
3.  **Disconnessione Parallela**: Invece di chiudere le connessioni una per una, il servizio avvia un thread separato per ogni connessione attiva, chiudendole **tutte in parallelo**.
4.  **Timeout e Uscita Pulita**: L'intero processo di shutdown ha un timeout (configurato a 5 secondi). Questo approccio garantisce una chiusura quasi istantanea (< 1 secondo), evitando che `supervisord` debba "uccidere" il processo forzatamente (con `SIGKILL`).

## 3. Riepilogo Punti Chiave

| Funzionalità | Implementazione | Scopo |
| :--- | :--- | :--- |
| **Process Manager** | `supervisord` | Garantire che il servizio MQTT sia sempre in esecuzione. |
| **Script Principale** | `manage.py start_mqtt_service` | Avvia e mantiene attivo il singleton `MQTTService`. |
| **Controllo Periodico** | Thread `monitor_connections` | Ogni 30 secondi, controlla lo stato, riavvia connessioni fallite e aggiorna la configurazione. |
| **Stabilità Connessione**| Client ID fisso + Clean Session | Previene sessioni duplicate e garantisce che solo un'istanza per sito sia attiva. |
| **Rilevamento Crash** | Last Will and Testament (LWT) | Notifica immediata da parte del broker in caso di crash del servizio. |
| **Shutdown Veloce** | Disconnessione parallela | Arresto pulito e rapido (<1s) per evitare `SIGKILL` e perdita di dati. |
| **Anti-Loop** | Cooldown su errore `code 7` | Previene cicli di riconnessione infiniti in caso di conflitti di Client ID. |
| **Monitoring** | Endpoint `/api/v1/mqtt/health/` | Fornisce uno stato di salute in tempo reale del servizio e di tutte le sue connessioni. |
