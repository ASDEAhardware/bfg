# MQTT Implementation Summary - WAVE 1 Completato

**Data**: 2025-11-28
**Fasi Completate**: PHASE 1, PHASE 2, PHASE 3
**Tempo Totale**: ~2 ore

---

## 📋 PANORAMICA GENERALE

Abbiamo implementato il sistema base MQTT con:
1. **Database refactoring** - Naming consistency e logging models
2. **Monitor thread** - Logging robusto e cicli monitorati
3. **API async pattern** - DB-only con HTTP 202

---

## PHASE 1: Database Refactoring (30 min)

### Modifiche al Database

#### 1. Rename Fields per Consistenza Naming

**`MqttConnection.is_enabled` → `MqttConnection.is_active`**
- **Rationale**: Omogeneità con `Site.is_active` e `MqttTopic.is_active`
- **Migration**: `0025_mqttconnectionlog_mqttparsinglog_and_more.py`

**`DiscoveredTopic.is_processed` → `DiscoveredTopic.is_processable`**
- **Rationale**: Più chiaro - "ha un parser disponibile?"
- **Migration**: Stessa migration 0025

#### 2. Nuovo Campo per DiscoveredTopic

**`DiscoveredTopic.is_active` (BONUS)**
- **Scopo**: Permette di disabilitare temporaneamente il processing di un topic (manutenzione)
- **Migration**: `0026_add_is_active_to_discovered_topic.py`

**Dual Flag System:**
```
is_processable (bool) - Ha un parser? (automatico)
is_active (bool)      - Processing abilitato? (manuale)
```

**Logic**: Un topic viene processato SOLO se `is_processable=True AND is_active=True`

#### 3. Nuovi Modelli di Logging

**`MqttConnectionLog`** - Log eventi connessioni
```python
class MqttConnectionLog:
    connection: FK -> MqttConnection
    timestamp: DateTime (auto)
    level: CharField (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    message: TextField
    exception_type: CharField
    exception_traceback: TextField
    broker_host: CharField
    retry_attempt: Integer
```

**`MqttParsingLog`** - Log errori parsing
```python
class MqttParsingLog:
    site: FK -> Site
    timestamp: DateTime (auto)
    topic: CharField
    parser_name: CharField
    error_type: CharField (VALIDATION_ERROR, PARSE_ERROR, DB_ERROR, UNKNOWN_ERROR)
    error_message: TextField
    exception_type: CharField
    exception_traceback: TextField
    payload_sample: JSONField
```

### File Modificati/Creati

**Creati:**
- `backend/mqtt/models.py` - Aggiunti 2 nuovi modelli

**Modificati:**
- `backend/mqtt/models.py` - Renamed 2 fields, added 1 field
- `backend/mqtt/admin.py` - Aggiunti admin per 2 nuovi modelli
- `backend/mqtt/api/serializers.py` - Aggiornato `is_enabled` → `is_active`
- `backend/mqtt/api/views.py` - Aggiornato in tutti i riferimenti
- `backend/mqtt/services/broadcast.py` - Aggiornato parametri
- `backend/mqtt/services/mqtt_connection.py` - Aggiornato riferimenti
- `backend/mqtt/services/mqtt_service.py` - Aggiornato query
- `backend/mqtt/services/message_processor.py` - Aggiornato + dual flag check
- `backend/mqtt/signals.py` - Aggiornato riferimenti
- `backend/mqtt/management/commands/start_mqtt_service.py` - Aggiornato

**Migrations:**
- `0025_mqttconnectionlog_mqttparsinglog_and_more.py`
- `0026_add_is_active_to_discovered_topic.py`

### Come Verificare PHASE 1

```bash
# 1. Verifica migrations applicate
podman exec bfg_backend python manage.py showmigrations mqtt | tail -5

# Expected output:
# [X] 0025_mqttconnectionlog_mqttparsinglog_and_more
# [X] 0026_add_is_active_to_discovered_topic

# 2. Verifica fields rinominati
podman exec bfg_backend python manage.py shell -c "
from mqtt.models import MqttConnection, DiscoveredTopic

# Test MqttConnection.is_active
conn = MqttConnection.objects.first()
print(f'MqttConnection.is_active: {conn.is_active}')
try:
    print(conn.is_enabled)
except AttributeError:
    print('✓ is_enabled no longer exists')

# Test DiscoveredTopic dual flags
topic = DiscoveredTopic.objects.first()
if topic:
    print(f'DiscoveredTopic.is_processable: {topic.is_processable}')
    print(f'DiscoveredTopic.is_active: {topic.is_active}')
"

# 3. Verifica nuovi modelli logging
podman exec bfg_backend python manage.py shell -c "
from mqtt.models import MqttConnectionLog, MqttParsingLog

print(f'MqttConnectionLog count: {MqttConnectionLog.objects.count()}')
print(f'MqttParsingLog count: {MqttParsingLog.objects.count()}')

# List recent logs
for log in MqttConnectionLog.objects.all()[:3]:
    print(f'  [{log.level}] {log.message[:50]}')
"

# 4. Verifica Django Admin
# Visit: http://localhost:8000/admin/mqtt/
# Should see:
# - MqttConnectionLog
# - MqttParsingLog
```

---

## PHASE 2: Monitor Thread Refactoring (1h)

### Nuova Utility per Logging

**File Creato**: `backend/mqtt/logging_utils.py`

**Funzioni:**
```python
log_connection_event(connection, level, message, exception, retry_attempt)
# - Log su file + DB
# - Livelli: DEBUG, INFO, WARNING, ERROR, CRITICAL

log_parsing_error(site, topic, parser_name, error_type, error_message, payload_sample)
# - Log errori parsing
# - Auto-truncate payload grandi (>5000 chars)
```

### Monitor Thread Enhanced

**File**: `backend/mqtt/services/mqtt_service.py`

**Logging Dettagliato Aggiunto:**
```python
def monitor_connections(self):
    logger.info(f"MQTT Monitor started (instance: {self.instance_id})")

    while not self._should_stop:
        cycle_start = time.time()

        # Log cycle start
        logger.debug(f"Monitor cycle started ({len(self.connections)} active)")

        # Log connessioni da avviare
        if sites_to_check.exists():
            logger.info(f"Monitor found {sites_to_check.count()} connections to start")

        # Log connessioni da fermare
        if disabled_connections.exists():
            logger.info(f"Monitor found {disabled_connections.count()} connections to stop")

        # Log offline devices
        if total_offline > 0:
            logger.info(f"Offline check: {stats['gateways_offline']} gateways, ...")

        # Log cycle completion
        cycle_duration = time.time() - cycle_start
        logger.debug(f"Monitor cycle completed in {cycle_duration:.2f}s")
```

### Connection Status Logging

**File**: `backend/mqtt/services/mqtt_connection.py`

**Integrato `log_connection_event` in `_update_connection_status`:**

```python
if status == 'connected':
    log_connection_event(mqtt_conn, level='INFO',
        message=f'Successfully connected to {host}:{port}')

elif status == 'error':
    log_connection_event(mqtt_conn, level='ERROR',
        message=error_message, retry_attempt=self.retry_count)

elif status == 'disconnected':
    log_connection_event(mqtt_conn, level='WARNING' if error else 'INFO',
        message=f'Disconnected: {error}' if error else 'Disconnected cleanly')
```

### File Modificati

**Creati:**
- `backend/mqtt/logging_utils.py`

**Modificati:**
- `backend/mqtt/services/mqtt_service.py` - Enhanced monitor logging
- `backend/mqtt/services/mqtt_connection.py` - Integrato connection logging
- `backend/mqtt/services/broadcast.py` - (già ok, verificato)

### Come Verificare PHASE 2

```bash
# 1. Verifica che logging_utils esista
ls -la backend/mqtt/logging_utils.py

# 2. Verifica monitor logs
podman logs --tail 50 bfg_backend | grep "Monitor"

# Expected output:
# MQTT Monitor started (instance: bkode)
# Monitor cycle started (X active connections)
# Monitor found X connections to start
# Monitor cycle completed in X.XXs

# 3. Test logging funziona
podman exec bfg_backend python manage.py shell -c "
from mqtt.models import MqttConnection
from mqtt.logging_utils import log_connection_event

conn = MqttConnection.objects.first()
log_connection_event(conn, 'INFO', 'Test log from verification')

# Verifica creato
from mqtt.models import MqttConnectionLog
logs = MqttConnectionLog.objects.filter(message__contains='Test log')
print(f'Test log created: {logs.exists()}')
"

# 4. Test monitor cycle funziona
# Abilita una connessione e aspetta 30s
podman exec bfg_backend python manage.py shell -c "
from mqtt.models import MqttConnection
conn = MqttConnection.objects.first()
conn.is_active = True
conn.save()
print('Connection enabled. Wait 30s for monitor...')
"

# Wait 35 seconds
sleep 35

# Verifica connessa
podman exec bfg_backend python manage.py shell -c "
from mqtt.models import MqttConnection
conn = MqttConnection.objects.first()
print(f'Status: {conn.status}')
print(f'Expected: connected')
"

# 5. Verifica log creato per la connessione
podman exec bfg_backend python manage.py shell -c "
from mqtt.models import MqttConnectionLog, MqttConnection
conn = MqttConnection.objects.first()
logs = MqttConnectionLog.objects.filter(connection=conn).order_by('-timestamp')[:5]
print('Recent connection logs:')
for log in logs:
    print(f'  [{log.level}] {log.timestamp} - {log.message[:60]}')
"
```

---

## PHASE 3: API Endpoints Refactoring (30min)

### API Pattern: DB-Only + Async

**Architettura:**
```
Client → API → DB (is_active flag)
              ↓
         HTTP 202 Accepted
              ↓
Client mostra "Connecting..." (loading)
              ↓
     [Wait max 30s]
              ↓
Monitor Thread → Vede cambio → Connette/Disconnette
              ↓
WebSocket → Notifica client → UI update
```

### Start Connection API

**File**: `backend/mqtt/api/views.py`

**Endpoint**: `POST /api/v1/mqtt/sites/{site_id}/start/`

**Comportamento:**
1. Set `is_active=True` nel DB (immediate)
2. Return HTTP 202 con status corrente (ancora "disconnected")
3. Monitor thread connette entro 30s
4. WebSocket notifica quando connesso

**Response:**
```json
{
  "success": true,
  "message": "MQTT connection for site X will start within 30 seconds...",
  "connection": {
    "site_id": 13,
    "site_name": "Laboratorio ASDEA",
    "status": "disconnected",  // ← Still disconnected!
    "is_active": true,
    "broker_host": "zionnode.ovh",
    "broker_port": 8883
  }
}
```

### Stop Connection API

**Endpoint**: `POST /api/v1/mqtt/sites/{site_id}/stop/`

**Comportamento:**
1. Set `is_active=False` nel DB (immediate)
2. Return HTTP 202 con status corrente (ancora "connected")
3. Monitor thread disconnette entro 30s
4. WebSocket notifica quando disconnesso

**Response:**
```json
{
  "success": true,
  "message": "MQTT connection for site X will stop within 30 seconds...",
  "connection": {
    "site_id": 13,
    "site_name": "Laboratorio ASDEA",
    "status": "connected",  // ← Still connected!
    "is_active": false
  }
}
```

### HTTP Status Codes

- **200 OK** - Already in desired state
- **202 Accepted** - Request accepted, async processing
- **404 Not Found** - Connection not found
- **403 Forbidden** - Not superuser

### File Modificati

**Modificati:**
- `backend/mqtt/api/views.py` - Enhanced start/stop endpoints
  - HTTP 202 invece di 200
  - Dettagli connessione nella response
  - Check se già active/inactive

### Come Verificare PHASE 3

```bash
# 1. Test START API behavior
podman exec bfg_backend python manage.py shell -c "
from mqtt.models import MqttConnection
import time

conn = MqttConnection.objects.first()
print('Initial state:')
print(f'  is_active: {conn.is_active}')
print(f'  status: {conn.status}')

# Simula API call
conn.is_active = True
conn.save(update_fields=['is_active'])

# Check immediately
conn.refresh_from_db()
print('\nImmediately after API (HTTP 202):')
print(f'  is_active: {conn.is_active}')
print(f'  status: {conn.status}  ← Should still be disconnected')

print('\nWait 35 seconds for monitor...')
time.sleep(35)

conn.refresh_from_db()
print('\nAfter monitor cycle:')
print(f'  is_active: {conn.is_active}')
print(f'  status: {conn.status}  ← Should be connected now')
"

# 2. Test STOP API behavior
podman exec bfg_backend python manage.py shell -c "
from mqtt.models import MqttConnection
import time

conn = MqttConnection.objects.first()
print('Initial state:')
print(f'  is_active: {conn.is_active}')
print(f'  status: {conn.status}')

# Simula STOP
conn.is_active = False
conn.save(update_fields=['is_active'])

# Check immediately
conn.refresh_from_db()
print('\nImmediately after STOP API (HTTP 202):')
print(f'  is_active: {conn.is_active}')
print(f'  status: {conn.status}  ← Should still be connected')

print('\nWait 35 seconds for monitor...')
time.sleep(35)

conn.refresh_from_db()
print('\nAfter monitor cycle:')
print(f'  is_active: {conn.is_active}')
print(f'  status: {conn.status}  ← Should be disconnected now')
"
```

---

## 📊 SUMMARY DI TUTTI I FILE MODIFICATI

### Creati (3)
1. `backend/mqtt/logging_utils.py` - Helper functions logging
2. `backend/mqtt/migrations/0025_*.py` - DB refactoring
3. `backend/mqtt/migrations/0026_*.py` - DiscoveredTopic.is_active

### Modificati (10)
1. `backend/mqtt/models.py` - Renamed fields, added models, added field
2. `backend/mqtt/admin.py` - Added 2 admin classes, updated display
3. `backend/mqtt/api/serializers.py` - Updated field names
4. `backend/mqtt/api/views.py` - Enhanced start/stop with HTTP 202
5. `backend/mqtt/services/mqtt_service.py` - Enhanced monitor logging
6. `backend/mqtt/services/mqtt_connection.py` - Integrated logging
7. `backend/mqtt/services/broadcast.py` - (verified, already ok)
8. `backend/mqtt/services/message_processor.py` - Dual flag check + auto-update
9. `backend/mqtt/signals.py` - Updated field references
10. `backend/mqtt/management/commands/start_mqtt_service.py` - Updated

---

## ✅ CHECKLIST COMPLETA DI VERIFICA

### Database & Models
- [ ] Migration 0025 applicata
- [ ] Migration 0026 applicata
- [ ] `MqttConnection.is_active` esiste (no più `is_enabled`)
- [ ] `DiscoveredTopic.is_processable` esiste (no più `is_processed`)
- [ ] `DiscoveredTopic.is_active` esiste (nuovo)
- [ ] `MqttConnectionLog` model esiste
- [ ] `MqttParsingLog` model esiste
- [ ] Django Admin mostra i 2 nuovi log models

### Logging System
- [ ] File `logging_utils.py` esiste
- [ ] `log_connection_event()` funziona
- [ ] `log_parsing_error()` funziona
- [ ] Logs vengono creati in DB quando connessione avviene
- [ ] Logs contengono level, message, timestamp

### Monitor Thread
- [ ] Monitor thread parte all'avvio backend
- [ ] Logs mostrano "Monitor started (instance: ...)"
- [ ] Logs mostrano cycle start/completion
- [ ] Monitor rileva `is_active=True` e connette entro 30s
- [ ] Monitor rileva `is_active=False` e disconnette entro 30s
- [ ] Logs dettagliati per ogni operazione

### API Endpoints
- [ ] `POST /api/v1/mqtt/sites/{id}/start/` ritorna HTTP 202
- [ ] Response contiene `connection` object con dettagli
- [ ] Status resta "disconnected" immediatamente dopo API
- [ ] Status diventa "connected" dopo monitor cycle (30s)
- [ ] `POST /api/v1/mqtt/sites/{id}/stop/` ritorna HTTP 202
- [ ] Status resta "connected" immediatamente dopo API
- [ ] Status diventa "disconnected" dopo monitor cycle (30s)

### Message Processing
- [ ] Topic processati SOLO se `is_processable=True AND is_active=True`
- [ ] `is_processable` viene auto-settato quando topic riconosciuto
- [ ] `is_active` può essere disabilitato manualmente per manutenzione

---

## 🔧 COMANDI RAPIDI PER TEST COMPLETO

```bash
# 1. Restart tutto per partire pulito
podman restart bfg_database bfg_redis bfg_backend
sleep 10

# 2. Verifica migrations
podman exec bfg_backend python manage.py showmigrations mqtt | tail -5

# 3. Verifica models
podman exec bfg_backend python manage.py shell -c "
from mqtt.models import *
print('✓ MqttConnection')
print('✓ MqttConnectionLog')
print('✓ MqttParsingLog')
print('✓ DiscoveredTopic')
conn = MqttConnection.objects.first()
print(f'  is_active field: {hasattr(conn, \"is_active\")}')
topic = DiscoveredTopic.objects.first()
if topic:
    print(f'  is_processable: {hasattr(topic, \"is_processable\")}')
    print(f'  is_active: {hasattr(topic, \"is_active\")}')
"

# 4. Test logging
podman exec bfg_backend python manage.py shell -c "
from mqtt.logging_utils import log_connection_event
from mqtt.models import MqttConnection
conn = MqttConnection.objects.first()
log_connection_event(conn, 'INFO', 'VERIFICATION TEST')
print('✓ Log created')
"

# 5. Test monitor + API cycle completo
podman exec bfg_backend python manage.py shell -c "
from mqtt.models import MqttConnection
import time

conn = MqttConnection.objects.first()

# Disable first
conn.is_active = False
conn.save()
print('Disabled. Waiting 35s...')
time.sleep(35)
conn.refresh_from_db()
print(f'Status: {conn.status} (should be disconnected)')

# Enable
conn.is_active = True
conn.save()
print('Enabled. Waiting 35s...')
time.sleep(35)
conn.refresh_from_db()
print(f'Status: {conn.status} (should be connected)')
print('✓ Full cycle working')
"

# 6. Verifica logs creati
podman exec bfg_backend python manage.py shell -c "
from mqtt.models import MqttConnectionLog
logs = MqttConnectionLog.objects.all().order_by('-timestamp')[:10]
print(f'Total logs: {MqttConnectionLog.objects.count()}')
print('Recent logs:')
for log in logs:
    print(f'  [{log.level}] {log.message[:50]}')
"

# 7. Check monitor logs
podman logs --tail 100 bfg_backend | grep -E "(Monitor|cycle)"
```

---

## 🎯 COSA ASPETTARSI

### Monitor Logs (ogni 30s circa)
```
MQTT Monitor started (instance: bkode)
Monitor cycle started (1 active connections)
Monitor found 1 connections to start
[Site 13] Starting connection (retry 0 or new)
Monitor cycle completed in 0.45s
```

### Connection Logs in DB
```
[INFO] Successfully connected to zionnode.ovh:8883
[ERROR] Connection failed: [Errno 111] Connection refused
[WARNING] Disconnected: Connection lost
```

### API Response (HTTP 202)
```json
{
  "success": true,
  "message": "... will start within 30 seconds...",
  "connection": {
    "status": "disconnected",  // ← Not changed yet!
    "is_active": true          // ← Changed immediately
  }
}
```

---

## 🚨 TROUBLESHOOTING

### Se monitor non parte
```bash
podman logs bfg_backend | grep "Monitor started"
# Se non vedi nulla, controlla errori
podman logs --tail 100 bfg_backend | grep ERROR
```

### Se connessione non avviene dopo 30s
```bash
# Check is_active
podman exec bfg_backend python manage.py shell -c "
from mqtt.models import MqttConnection
conn = MqttConnection.objects.first()
print(f'is_active: {conn.is_active}')
print(f'status: {conn.status}')
print(f'error_message: {conn.error_message}')
"

# Check logs
podman exec bfg_backend python manage.py shell -c "
from mqtt.models import MqttConnectionLog, MqttConnection
conn = MqttConnection.objects.first()
logs = MqttConnectionLog.objects.filter(connection=conn, level='ERROR').order_by('-timestamp')[:3]
for log in logs:
    print(f'ERROR: {log.message}')
"
```

### Se migrations non applicate
```bash
podman exec bfg_backend python manage.py migrate mqtt
```

---

**Fine Summary** - Tutto pronto per test completo! 🚀
