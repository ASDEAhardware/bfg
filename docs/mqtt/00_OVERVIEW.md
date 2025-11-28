# MQTT Architecture - Overview

## Contesto Globale

**Progetto**: BFG - Sistema di monitoraggio dispositivi IoT via MQTT
**Stack**: React + Next.js BFF + Django + PostgreSQL + Redis (Channels) + MQTT Broker
**Obiettivo**: Sistema real-time di acquisizione, parsing e visualizzazione dati da dispositivi IoT

## Componenti Principali

### 1. **Backend Django**
- **MQTT Service**: Gestisce connessioni MQTT ai broker esterni
- **Message Processor**: Parsa e salva messaggi MQTT nel DB
- **WebSocket Service**: Notifiche real-time al frontend via Django Channels
- **REST API**: CRUD per configurazione MQTT e controllo manuale

### 2. **Frontend React/Next.js**
- **Devices Page**: Visualizzazione real-time devices/sensori
- **WebSocket Hook**: Riceve notifiche real-time dal backend
- **Admin Controls**: Start/Stop connessioni MQTT manuali

### 3. **Database PostgreSQL**
- **Site**: Siti/Locations (is_active controlla visibilità)
- **MqttConnection**: Configurazione connessione MQTT (is_enabled → is_active)
- **MqttTopic**: Topic patterns da sottoscrivere (is_active per enable/disable parsing)
- **DiscoveredTopic**: Auto-discovery topic ricevuti (is_processed flag)
- **Gateway/Datalogger/Sensor**: Entità dispositivi auto-discovered
- **Log Models**: MqttConnectionLog, MqttParsingLog

### 4. **MQTT Broker Esterno**
- Mosquitto o altro broker
- Pubblica messaggi JSON strutturati
- Topics pattern: `{site}/gateway/{n}/...`

## Flusso Architetturale Target

```
┌─────────────────────────────────────────────────────────────────┐
│                      CONTAINER STARTUP                          │
│  podman-compose up → Django entrypoint → MQTT Service Start     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   MONITOR THREAD (Loop 30s)                     │
│  1. Query DB: SELECT * FROM mqtt_connection WHERE is_active=T  │
│  2. Match con connection stack in-memory                       │
│  3. Connect missing / Disconnect disabled                       │
│  4. Log errors → MqttConnectionLog + file logs/mqtt_conn.log   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    MANUAL CONTROL (Admin UI)                    │
│  Admin clicks "Start MQTT"                                      │
│    → API: PATCH /api/mqtt/connection/{site_id}/                │
│    → DB: MqttConnection.is_active = True                        │
│    → Frontend: Loading state on label                           │
│    → [WAIT max 30s]                                             │
│    → Monitor Thread: Sees change, calls service.start()         │
│    → Service: Actually connects to broker                       │
│    → Service: Broadcast WebSocket "connected"                   │
│    → Frontend: Updates label via WebSocket                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   MESSAGE PARSING PIPELINE                      │
│  1. MQTT message arrives → on_message callback                  │
│  2. Save to DiscoveredTopic (auto-discovery)                    │
│  3. Match topic against MqttTopic patterns                      │
│  4. If is_active=False → skip parsing                           │
│  5. Load parser from PARSER_REGISTRY                            │
│  6. Validate JSON with Pydantic schema                          │
│     ├─ Valid: Process & save to DB (Gateway/Datalogger/Sensor)  │
│     └─ Invalid: Log to MqttParsingLog + logs/mqtt_parsing.log   │
│  7. Flag DiscoveredTopic.is_processed = True                    │
│  8. Broadcast WebSocket event (datalogger_update, etc.)         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                  FRONTEND REAL-TIME UPDATE                      │
│  1. WebSocket receives "datalogger_update"                      │
│  2. React Query invalidates ['dataloggers', siteId]             │
│  3. Automatic refetch → UI updates                              │
└─────────────────────────────────────────────────────────────────┘
```

## Obiettivo Finale

Un sistema robusto e scalabile dove:

1. ✅ **Auto-start**: MQTT connections auto-avviano all'avvio container
2. ✅ **Auto-healing**: Monitor thread garantisce connessioni sempre allineate al DB
3. ✅ **Manual override**: Admin può start/stop connessioni via UI
4. ✅ **Real-time feedback**: WebSocket notifica istantaneamente lo stato
5. ✅ **Flexible parsing**: Parser configurabili tramite Registry pattern
6. ✅ **Auto-discovery**: Tutti i topic vengono tracciati anche se non parsati
7. ✅ **Logging robusto**: Errori loggati in DB + file separati per debug
8. ✅ **Type-safe**: Validazione Pydantic per JSON MQTT
9. ✅ **Observability**: Integrazione Sentry per error tracking
10. ✅ **Scalabile**: Architettura pronta per Celery/Redis se necessario

## Naming Conventions (Refactoring)

| Old Name | New Name | Purpose |
|----------|----------|---------|
| `Site.is_active` | `Site.is_active` | ✅ Controlla visibilità sito (OK) |
| `MqttConnection.is_enabled` | **`MqttConnection.is_active`** | 🔄 Enable/disable connessione MQTT |
| `MqttTopic.is_active` | `MqttTopic.is_active` | ✅ Enable/disable parsing topic (OK) |
| `DiscoveredTopic.is_processed` | **`DiscoveredTopic.is_processable`** | 🔄 Flag se topic riconosciuto da parser |

## Struttura Documentazione

```
docs/mqtt/
├── 00_OVERVIEW.md              ← Questo file (contesto globale)
├── 01_CURRENT_STATE.md         ← Audit dello stato attuale
├── 02_ARCHITECTURE.md          ← Architettura target dettagliata
├── 03_IMPLEMENTATION_PLAN.md   ← Piano di sviluppo con priorità
├── phases/
│   ├── PHASE_01_database_refactoring.md
│   ├── PHASE_02_monitor_thread_refactoring.md
│   ├── PHASE_03_api_endpoints.md
│   ├── PHASE_04_parser_registry.md
│   ├── PHASE_05_websocket_events.md
│   ├── PHASE_06_frontend_integration.md
│   ├── PHASE_07_logging_system.md
│   └── PHASE_08_sentry_integration.md
└── testing/
    ├── integration_tests.md
    └── manual_test_checklist.md
```

## Come Usare Questa Documentazione

**Per un'AI che deve implementare:**
1. Leggi `00_OVERVIEW.md` (questo file) per contesto globale
2. Leggi `01_CURRENT_STATE.md` per capire cosa esiste già
3. Leggi `02_ARCHITECTURE.md` per capire dove andare
4. Leggi `03_IMPLEMENTATION_PLAN.md` per ordine di lavoro
5. Implementa fase per fase leggendo `phases/PHASE_XX_*.md`
6. Testa con `testing/*.md`

**Per un developer umano:**
- Usa come reference architecture
- Segui le fasi in ordine di priorità
- Ogni fase è self-contained e testabile

---

**Status**: 🟡 In Progress
**Last Updated**: 2025-01-27
**Next Step**: Audit current state → `01_CURRENT_STATE.md`
