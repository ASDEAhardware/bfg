# MQTT Architecture - Current State Audit

## Scopo
Questo documento analizza lo stato **attuale** dell'implementazione MQTT per identificare cosa funziona, cosa manca, e cosa va modificato.

---

## 1. Database Models - STATO ATTUALE

### ✅ **Site Model** (sites/models.py)
```python
class Site(models.Model):
    name = CharField
    is_active = BooleanField(default=True)  # ✅ Usato per visibilità sito
```
**Status**: ✅ **OK** - Il campo `is_active` è corretto per la visibilità del sito.

---

### 🔄 **MqttConnection Model** (mqtt/models.py)
```python
class MqttConnection(models.Model):
    site = OneToOneField(Site)  # ✅ Relazione 1:1 corretta

    # Connection settings
    broker_host = CharField
    broker_port = IntegerField(default=1883)
    username = CharField
    password = CharField
    client_id_prefix = CharField

    # Status tracking
    is_enabled = BooleanField(default=True)  # 🔄 DA RINOMINARE → is_active
    status = CharField(choices=STATUS_CHOICES)  # connected, disconnected, error, etc.

    # Retry management
    mqtt_retry_count = IntegerField(default=0)
    mqtt_next_retry = DateTimeField(null=True)
```

**Issues da fixare:**
- 🔄 **Rinominare** `is_enabled` → `is_active` (omogeneità naming)
- ✅ Relazione 1:1 con Site già corretta

---

### ✅ **MqttTopic Model** (mqtt/models.py)
```python
class MqttTopic(models.Model):
    mqtt_connection = ForeignKey(MqttConnection)
    topic_pattern = CharField  # Es: "site_001/gateway/1/dataloggers/telemetry"
    is_active = BooleanField(default=True)  # ✅ Controlla se parsare questo topic
    qos_level = IntegerField(default=0)
```

**Status**: ✅ **OK** - Il campo `is_active` è già corretto.

---

### 🔄 **DiscoveredTopic Model** (mqtt/models.py)
```python
class DiscoveredTopic(models.Model):
    site = ForeignKey(Site)
    topic_path = CharField  # Topic completo ricevuto
    topic_pattern = CharField

    # Discovery info
    first_seen_at = DateTimeField
    last_seen_at = DateTimeField
    message_count = IntegerField
    sample_payload = JSONField

    is_processed = BooleanField(default=False)  # 🔄 SIGNIFICATO DA CHIARIRE
    processor_name = CharField
```

**Issues da fixare:**
- 🔄 **Rinominare/Chiarire** `is_processed`:
  - **Attuale**: Flag se topic ha logica di processing implementata
  - **Desiderato**: `is_processable` = True se il parser ha riconosciuto il topic come parsabile
  - **Logica**: Quando arriva un messaggio, se il parser registry lo riconosce → `is_processable=True`, altrimenti `False`

---

### ❌ **Log Models - MANCANTI**
```python
# DA CREARE
class MqttConnectionLog(models.Model):
    """Log errori connessione MQTT"""
    connection = ForeignKey(MqttConnection)
    timestamp = DateTimeField
    level = CharField  # ERROR, WARNING, INFO
    message = TextField
    exception_traceback = TextField

class MqttParsingLog(models.Model):
    """Log errori parsing messaggi"""
    site = ForeignKey(Site)
    topic = CharField
    timestamp = DateTimeField
    payload_sample = JSONField
    error_message = TextField
    exception_traceback = TextField
```

**Status**: ❌ **DA IMPLEMENTARE**

---

## 2. MQTT Service - STATO ATTUALE

### ✅ **MQTTService (Singleton)** (mqtt/services/mqtt_service.py)

**Cosa c'è:**
```python
class MQTTService:
    def __init__(self):
        self.connections = {}  # {mqtt_connection_id: MQTTConnectionManager}
        self.monitor_thread = None
        self.running = False

    def start(self):
        # ✅ Avvia tutte le connessioni enabled
        # ✅ Avvia monitor thread
        # ✅ Check offline devices all'avvio

    def stop(self):
        # ✅ Disconnette tutte le connessioni in parallelo

    def monitor_connections(self):
        # ✅ Loop ogni 30 secondi
        # ✅ Cerca connessioni enabled non ancora connesse
        # ✅ Disconnette connessioni disabled
        # ✅ Check offline devices
```

**Valutazione**:
- ✅ **Architettura corretta**: Monitor thread + service singleton
- ✅ **Polling 30s**: Già implementato
- ✅ **Auto-start**: Già implementato
- 🔄 **Naming**: Usa `is_enabled` invece di `is_active` (da fixare)

---

### ✅ **MQTTConnectionManager** (mqtt/services/mqtt_connection.py)

**Cosa c'è:**
```python
class MQTTConnectionManager:
    def connect(self):
        # ✅ Connette al broker MQTT
        # ✅ Gestisce retry esponenziale
        # ✅ Aggiorna status nel DB
        # ✅ Broadcast WebSocket status

    def disconnect(self):
        # ✅ Disconnette pulito

    def _on_message(self, client, userdata, msg):
        # ✅ Chiama message_processor.process_message()
```

**Valutazione**: ✅ **Architettura corretta**

---

## 3. Message Processor - STATO ATTUALE

### 🔄 **MqttMessageProcessor** (mqtt/services/message_processor.py)

**Cosa c'è:**
```python
class MqttMessageProcessor:
    def process_message(self, site_id, topic, payload, qos, retain):
        # ✅ Parse JSON payload
        # ✅ Save to DiscoveredTopic (auto-discovery)
        # ✅ Parse topic structure
        # ✅ Dispatcher per tipo topic

    def _parse_topic_structure(self, topic):
        # ✅ Riconosce 3 pattern:
        #    - gateway_status
        #    - datalogger_status_aggregated
        #    - dataloggers_telemetry

    def _process_dataloggers_telemetry(self, ...):
        # ✅ Parsa payload telemetria
        # ✅ Salva Gateway, Datalogger, Sensors
        # ✅ Broadcast WebSocket events
```

**Issues:**
- 🔄 **Hardcoded parsers**: I parser sono metodi hardcoded nella classe invece di essere in un registry configurabile
- 🔄 **No Pydantic validation**: Validazione JSON manuale invece di schema Pydantic
- 🔄 **No MqttTopic.is_active check**: Non controlla se il topic ha parsing abilitato
- 🔄 **is_processed semantics**: Flag settato in `_save_discovered_topic` ma logica poco chiara

**Status**: 🔄 **DA REFACTORARE** (funziona ma non estensibile)

---

## 4. WebSocket Service - STATO ATTUALE

### ✅ **MqttStatusConsumer** (mqtt/consumers.py)

**Cosa c'è:**
```python
class MqttStatusConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # ✅ Join gruppo "mqtt_status_updates"
        # ✅ Invia "connection_established"

    async def status_update(self, event):
        # ✅ Forward message al client
```

**Valutazione**: ✅ **Architettura corretta**

---

### ✅ **broadcast_status_update** (mqtt/services/broadcast.py)

**Cosa c'è:**
```python
def broadcast_status_update(site_id, status, is_enabled):
    # ✅ Invia eventi al gruppo WebSocket
```

**Valutazione**: ✅ **Funziona** ma potrebbe essere più generico

---

## 5. Frontend - STATO ATTUALE

### ✅ **useMqttStatusSocket Hook** (frontend/src/hooks/useMqttStatusSocket.ts)

**Cosa c'è:**
```typescript
- ✅ Auto-connect al WebSocket all'avvio
- ✅ Auto-reconnect con backoff
- ✅ Gestisce eventi:
    - connection_established
    - mqtt_status / status_update
    - datalogger_update ← APPENA FIXATO
    - gateway_update
    - sensor_offline
- ✅ Invalida React Query automaticamente
```

**Status**: ✅ **APPENA FIXATO** - Ora gestisce correttamente tutti gli eventi

---

### ✅ **DevicesListPage** (frontend/src/plugins/devices/DevicesListPage.tsx)

**Cosa c'è:**
```typescript
- ✅ Visualizza devices auto-discovered
- ✅ Admin controls per Start/Stop MQTT (via dropdown Shield)
- ✅ MQTT status badge
- ✅ useDataloggers hook con auto-refresh
```

**Issues minori:**
- 🔄 I controlli Start/Stop chiamano API ma aspettano max 30s (corretto, ma potrebbe essere più chiaro nell'UI con timer countdown)

---

## 6. API Endpoints - STATO ATTUALE

### ✅ **MQTT API** (mqtt/api/views.py)

**Endpoint esistenti:**
```python
GET /api/v1/mqtt/connection-status/    # ✅ List status tutte connessioni
GET /api/v1/mqtt/site/{site_id}/status/  # ✅ Status singolo sito
POST /api/v1/mqtt/site/{site_id}/start/  # ✅ Start connessione
POST /api/v1/mqtt/site/{site_id}/stop/   # ✅ Stop connessione
POST /api/v1/mqtt/site/{site_id}/force-discovery/  # ✅ Force discovery
```

**Valutazione**:
- ✅ **Endpoint presenti**
- 🔄 **Logica da verificare**: Gli endpoint start/stop modificano `is_enabled` e poi chiamano direttamente il service OPPURE solo modificano il DB?

**DA VERIFICARE NEL CODICE:**
```python
# Attuale (da verificare):
def start_connection(request, site_id):
    # Opzione A: Chiama direttamente mqtt_service.start_connection() ← IMMEDIATO
    # Opzione B: Setta is_enabled=True e aspetta monitor thread ← DESIDERATO
```

---

## 7. Logging - STATO ATTUALE

### 🔄 **Logging Configuration**

**Cosa c'è:**
```python
# Django logging standard
logger = logging.getLogger(__name__)
logger.error("Connection error: ...")
logger.warning("Retry attempt...")
```

**Issues:**
- 🔄 **No file separation**: Tutti i log vanno nello stesso file/stream
- 🔄 **No DB logging**: Errori non salvati in tabelle dedicate
- ❌ **No Sentry**: Error tracking non configurato

---

## 8. Entry Point - STATO ATTUALE

### ✅ **Django Management Command** (mqtt/management/commands/run_mqtt.py)

**Cosa c'è:**
```python
class Command(BaseCommand):
    def handle(self):
        mqtt_service.start()  # ✅ Avvia service
        # ✅ Keep alive con signal handling
```

**Chiamato da:**
```bash
# entrypoint.sh o podman-compose exec
python manage.py run_mqtt
```

**Status**: ✅ **OK** - Ma dobbiamo verificare che parta automaticamente all'avvio container

---

## 9. SUMMARY - Checklist Cosa Manca

### Database
- [x] Site.is_active (visibilità)
- [ ] MqttConnection.is_enabled → is_active (rename)
- [x] MqttTopic.is_active (enable/disable parsing)
- [ ] DiscoveredTopic.is_processed → is_processable (rename + logica)
- [ ] MqttConnectionLog (nuovo model)
- [ ] MqttParsingLog (nuovo model)

### Backend Services
- [x] Monitor thread loop 30s
- [x] Auto-start connessioni all'avvio
- [ ] API endpoints solo DB change (no direct service call)
- [ ] Parser Registry pattern
- [ ] Pydantic validation schemas
- [ ] MqttTopic.is_active check in processing
- [ ] Logging DB + file separati
- [ ] Sentry integration

### Frontend
- [x] WebSocket connection
- [x] Event handling (datalogger_update, etc.)
- [x] React Query invalidation
- [ ] UI feedback per delay 30s (opzionale)

### Infrastructure
- [ ] Auto-start MQTT service all'avvio container (entrypoint.sh)
- [ ] Log files separation (mqtt_connections.log, mqtt_parsing.log)
- [ ] Sentry DSN configuration

---

## Next Steps

Leggi `02_ARCHITECTURE.md` per vedere l'architettura target dettagliata, poi `03_IMPLEMENTATION_PLAN.md` per il piano di sviluppo fase per fase.

---

**Status**: ✅ Audit Completato
**Date**: 2025-01-27
