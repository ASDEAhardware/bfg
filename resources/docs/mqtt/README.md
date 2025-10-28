# Sistema MQTT - Documentazione Sviluppo

## Panoramica

Il sistema MQTT del progetto BFG gestisce la comunicazione in tempo reale con i datalogger e i sensori distribuiti nei vari siti. L'architettura è progettata per:

- **Connessioni multi-sito**: ogni sito ha la propria connessione MQTT configurabile
- **Auto-discovery**: scoperta automatica di topic e dispositivi
- **Versioning API**: supporto per diverse versioni del protocollo MQTT
- **Monitoring dinamico**: rilevamento automatico di dispositivi offline
- **Real-time updates**: aggiornamenti in tempo reale dei dati dei sensori

## Accesso alle Pagine

### Pagine Principali

1. **Lista Datalogger**: `http://localhost:3000/datalogger/`
   - Visualizza tutti i datalogger del sito selezionato
   - Mostra stato online/offline, metriche, sensori
   - Controlli MQTT (Start/Stop/Discovery) per superuser
   - Filtri e ricerca

2. **Dettaglio Datalogger**: `http://localhost:3000/datalogger/{id}`
   - Vista dettagliata di un singolo datalogger
   - Lista sensori associati
   - Controlli per start/stop acquisizione dati
   - Scheduler per automazioni

## Architettura

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   useMqtt    │  │ DataloggerCard│  │ SensorCard  │      │
│  │   Hooks      │  │  Components  │  │  Components  │      │
│  └──────┬───────┘  └──────────────┘  └──────────────┘      │
│         │                                                    │
│         │ HTTP/REST                                          │
└─────────┼────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Django Backend                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  API Views   │  │   Models     │  │  Serializers │      │
│  └──────┬───────┘  └──────────────┘  └──────────────┘      │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────────────────────────────────────────┐       │
│  │              MQTT Services Layer                 │       │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐ │       │
│  │  │   MQTT     │  │ Connection │  │  Message   │ │       │
│  │  │  Manager   │  │  Handler   │  │ Processor  │ │       │
│  │  └────────────┘  └────────────┘  └────────────┘ │       │
│  │  ┌────────────┐  ┌────────────┐                 │       │
│  │  │ Versioning │  │  Dynamic   │                 │       │
│  │  │            │  │  Offline   │                 │       │
│  │  │            │  │  Monitor   │                 │       │
│  │  └────────────┘  └────────────┘                 │       │
│  └──────────────────────────────────────────────────┘       │
│         │                                                    │
└─────────┼────────────────────────────────────────────────────┘
          │
          ▼ MQTT Protocol
┌─────────────────────────────────────────────────────────────┐
│                    MQTT Broker                               │
│         (Mosquitto / EMQ X / HiveMQ)                        │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                IoT Devices Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Datalogger  │  │   Gateway    │  │   Sensors    │      │
│  │   (Monstro)  │  │              │  │  (Physical)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## Struttura del Progetto

### Backend (`/backend/mqtt/`)

```
mqtt/
├── models.py                      # Modelli Django
├── urls.py                        # URL patterns API
├── admin.py                       # Django Admin config
├── api/
│   ├── views.py                   # API endpoints MQTT control
│   ├── datalogger_views.py        # API endpoints datalogger/sensors
│   └── serializers.py             # Serializers DRF
├── services/
│   ├── mqtt_manager.py            # Singleton manager connessioni
│   ├── connection_handler.py      # Handler singola connessione
│   ├── message_processor.py       # Processing messaggi MQTT
│   ├── mqtt_versioning.py         # Gestione versioni API
│   └── dynamic_offline_monitor.py # Monitoring offline devices
└── management/
    └── commands/
        └── run_mqtt.py            # Django command per MQTT service
```

### Frontend (`/frontend/src/`)

```
frontend/src/
├── hooks/
│   ├── useMqtt.ts                 # Hooks per MQTT status/control
│   └── useDataloggerControl.ts    # Hook per controllo datalogger
├── store/
│   └── dataloggerControlStore.ts  # Zustand store per sessions
├── components/
│   ├── DataloggerCard.tsx         # Card datalogger con metrics
│   └── SensorCard.tsx             # Card sensore con trend
├── plugins/
│   └── datalogger/
│       └── DataLoggerListPage.tsx # Pagina lista datalogger
└── app/
    └── (private)/(staff)/
        └── datalogger/
            └── [id]/
                └── page.tsx       # Pagina dettaglio datalogger
```

## Componenti Chiave

### Backend

#### 1. MqttManager (Singleton)
- Gestisce tutte le connessioni MQTT attive
- Thread-safe per ambiente Django
- Monitoring automatico delle connessioni
- Start/stop dinamico delle connessioni per sito

#### 2. MqttConnectionHandler
- Handler per singola connessione MQTT
- Gestione retry automatici
- Subscriptions dinamiche
- Callback per messaggi ricevuti

#### 3. MessageProcessor
- Processing centralizzato messaggi MQTT
- Routing basato su topic pattern
- Supporto multi-versione
- Validazione e sanitizzazione payload

#### 4. DynamicOfflineMonitor
- Monitoring intelligente offline/online
- Timeout configurabili per tipo dispositivo
- Update automatico stato nel database

### Frontend

#### 1. Hooks MQTT

**`useMqttConnectionStatus(siteId)`**
- Recupera stato connessione MQTT per sito
- Gestione heartbeat timeout
- Auto-refresh opzionale

**`useMqttControl()`**
- Controllo connessione (start/stop)
- Force discovery
- Operazioni superuser only

**`useDataloggers(siteId)`**
- Lista datalogger per sito
- Filtering e ordering
- Refresh on-demand

**`useSensors(dataloggerId)`**
- Lista sensori per datalogger
- Latest readings
- Real-time updates

**`useDataloggerControl({ datalogger, siteId })`**
- Controllo acquisizione dati
- Publish comandi MQTT
- Session management

#### 2. Components

**DataloggerCard**
- Visualizzazione compatta/estesa
- Stato online/offline
- Metriche (uptime, sensors, heartbeats)
- Button "Visualizza" con loading state

**SensorCard**
- Trend chart background
- Valori in tempo reale
- Multi-axis per accelerometri
- Modalità compact/grid

## Documentazione Dettagliata

- [Modelli del Database](./models.md) - Struttura database e relazioni
- [API Endpoints](./api-endpoints.md) - Tutti gli endpoint REST disponibili
- [Servizi MQTT](./services.md) - Architettura servizi backend
- [Protocollo MQTT](./mqtt-protocol.md) - Topic structure e message format
- [Integrazione Frontend](./frontend-integration.md) - Hooks e components
- [Flussi Operativi](./workflows.md) - Diagrammi dei flussi principali

## Quick Start

### Avviare il Sistema MQTT

```bash
# Backend - Start MQTT service
python manage.py run_mqtt --log-level INFO

# Frontend - Dev server
npm run dev
```

### Configurare una Nuova Connessione

1. Django Admin → MQTT Connections → Add
2. Configurare broker (host, port, credentials)
3. Impostare `client_id_prefix` (es: `site_001`)
4. Abilitare `is_enabled = True`
5. Il servizio MQTT si connette automaticamente

### Testare la Connessione

```bash
# Via API
curl http://localhost:8000/api/v1/mqtt/sites/1/status/

# Via Frontend
# Aprire http://localhost:3000/datalogger/
# Verificare badge MQTT status
```

## Troubleshooting

### Connessione Non Si Avvia

1. Verificare broker MQTT raggiungibile
2. Controllare credenziali corrette
3. Verificare `is_enabled = True` nel database
4. Controllare logs: `python manage.py run_mqtt --log-level DEBUG`

### Dispositivi Offline

1. Verificare topic pattern corretti
2. Controllare ultimo heartbeat nel database
3. Verificare timeout configurati in `DynamicOfflineMonitor`
4. Testare publish manual su topic

### Frontend Non Aggiorna

1. Verificare API endpoint risponde
2. Controllare console browser per errori
3. Verificare `selectedSiteId` nel context
4. Testare refresh manuale

## Best Practices

### Backend

1. **Sempre usare transaction per update database**
   ```python
   with transaction.atomic():
       datalogger.is_online = True
       datalogger.save()
   ```

2. **Logging strutturato**
   ```python
   logger.info(f"[{site_id}] Processing message", extra={
       'site_id': site_id,
       'topic': topic,
       'payload_size': len(payload)
   })
   ```

3. **Gestire versioning API**
   ```python
   version = determine_api_version(topic, payload)
   processor = get_processor_for_version(version)
   ```

### Frontend

1. **Cleanup su unmount**
   ```typescript
   useEffect(() => {
       return () => {
           // cleanup
       };
   }, []);
   ```

2. **Loading states per tutti i pulsanti**
   ```typescript
   const [isLoading, setIsLoading] = useState(false);
   <Button disabled={isLoading}>
       {isLoading ? <Loader2 className="animate-spin" /> : "Text"}
   </Button>
   ```

3. **Error handling robusto**
   ```typescript
   try {
       await api.post(...);
       toast.success("Success");
   } catch (error) {
       toast.error(`Error: ${error.message}`);
   }
   ```

## Prossimi Sviluppi

- [ ] WebSocket per real-time updates senza polling
- [ ] Dashboard grafici real-time con Chart.js
- [ ] Export dati sensori (CSV, Excel)
- [ ] Alerting e notifiche configurabili
- [ ] Gestione firmware update OTA
- [ ] Multi-tenancy avanzato

## Contributori

- Sviluppo iniziale: Team BFG
- Refactoring MQTT: Q4 2024
- Documentazione: Ottobre 2024

## License

Proprietario - BFG Project
