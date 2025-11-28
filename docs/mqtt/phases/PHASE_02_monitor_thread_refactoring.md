# PHASE 2: Monitor Thread Refactoring

**Priority**: 🔴 CRITICAL
**Complexity**: ⭐⭐ MEDIUM
**Duration**: 1 hour
**Dependencies**: PHASE 1 (Database Refactoring)

---

## Obiettivo

Garantire che il monitor thread usi `is_active` correttamente e implementi logging robusto.

---

## Current State

**File**: `backend/mqtt/services/mqtt_service.py`

```python
def monitor_connections(self):
    """Thread che monitora e riavvia connessioni"""
    while not self._should_stop:
        # Cerca connessioni enabled non ancora connesse
        sites_to_check = MqttConnection.objects.filter(
            is_enabled=True  # ← DA CAMBIARE in is_active
        ).exclude(
            id__in=list(self.connections.keys())
        )
        # ...
```

---

## Changes Required

### 1. **Update Query to Use `is_active`**

**File**: `backend/mqtt/services/mqtt_service.py`

**Find**:
```python
sites_to_check = MqttConnection.objects.filter(
    is_enabled=True
).exclude(...)
```

**Replace with**:
```python
sites_to_check = MqttConnection.objects.filter(
    is_active=True
).exclude(...)
```

**Also find**:
```python
def start_all(self):
    enabled_connections = MqttConnection.objects.filter(is_enabled=True)
```

**Replace with**:
```python
def start_all(self):
    enabled_connections = MqttConnection.objects.filter(is_active=True)
```

**Also find**:
```python
disabled_connections = MqttConnection.objects.filter(
    id__in=list(self.connections.keys()),
    is_enabled=False
)
```

**Replace with**:
```python
disabled_connections = MqttConnection.objects.filter(
    id__in=list(self.connections.keys()),
    is_active=False
)
```

---

### 2. **Add Connection Logging**

**Create helper file**: `backend/mqtt/logging_utils.py`

```python
"""
Helper functions for MQTT logging
"""
import traceback
import logging
from mqtt.models import MqttConnectionLog, MqttParsingLog

logger = logging.getLogger('mqtt.connection')


def log_connection_event(connection, level, message, exception=None, retry_attempt=None):
    """
    Log evento connessione (INFO, WARNING, ERROR)

    Args:
        connection: MqttConnection instance
        level: str - DEBUG, INFO, WARNING, ERROR, CRITICAL
        message: str - Messaggio descrittivo
        exception: Exception instance (optional)
        retry_attempt: int (optional)
    """
    try:
        # Log to file
        log_method = getattr(logger, level.lower())
        log_method(f"[Site {connection.site.name}] {message}")

        # Log to DB
        MqttConnectionLog.objects.create(
            connection=connection,
            level=level,
            message=message,
            exception_type=type(exception).__name__ if exception else '',
            exception_traceback=traceback.format_exc() if exception else '',
            broker_host=connection.broker_host,
            retry_attempt=retry_attempt,
        )
    except Exception as e:
        # Fallback se DB logging fallisce
        logger.error(f"Failed to log connection event: {e}")


def log_parsing_error(site, topic, parser_name, error_type, error_message, payload_sample=None):
    """
    Log errore parsing messaggio MQTT

    Args:
        site: Site instance
        topic: str - Topic MQTT
        parser_name: str - Nome parser (optional)
        error_type: str - VALIDATION_ERROR, PARSE_ERROR, DB_ERROR, UNKNOWN_ERROR
        error_message: str - Descrizione errore
        payload_sample: dict - Sample payload (optional, truncated se troppo grande)
    """
    try:
        # Truncate payload se troppo grande
        if payload_sample and len(str(payload_sample)) > 5000:
            payload_sample = {'_truncated': True, 'sample': str(payload_sample)[:5000]}

        # Log to file
        logger = logging.getLogger('mqtt.parsing')
        logger.error(f"[Site {site.name}] [{error_type}] {topic}: {error_message}")

        # Log to DB
        MqttParsingLog.objects.create(
            site=site,
            topic=topic,
            parser_name=parser_name or '',
            error_type=error_type,
            error_message=error_message,
            exception_type='',
            exception_traceback=traceback.format_exc(),
            payload_sample=payload_sample,
        )
    except Exception as e:
        logger.error(f"Failed to log parsing error: {e}")
```

---

### 3. **Update MQTTConnectionManager to Use Logging**

**File**: `backend/mqtt/services/mqtt_connection.py`

**Add import**:
```python
from mqtt.logging_utils import log_connection_event
```

**Update `_update_connection_status` method**:

**Find**:
```python
def _update_connection_status(self, status: str, error_message: str = ''):
    # ...
    if status == 'connected':
        # ...
        self.retry_count = 0

    elif status == 'error':
        mqtt_conn.error_message = error_message
        mqtt_conn.connection_errors += 1
        # ...
```

**Replace with**:
```python
def _update_connection_status(self, status: str, error_message: str = ''):
    from mqtt.models import MqttConnection
    from mqtt.services.broadcast import broadcast_status_update
    from mqtt.logging_utils import log_connection_event

    try:
        with transaction.atomic():
            mqtt_conn = MqttConnection.objects.select_for_update().get(id=self.mqtt_connection_id)
            mqtt_conn.status = status
            mqtt_conn.mqtt_retry_count = self.retry_count

            if status == 'connected':
                mqtt_conn.last_connected_at = django_tz.now()
                mqtt_conn.error_message = ''
                mqtt_conn.mqtt_next_retry = None
                mqtt_conn.connection_errors = 0
                self.retry_count = 0

                # ⭐ LOG SUCCESS
                log_connection_event(
                    mqtt_conn,
                    level='INFO',
                    message=f'Successfully connected to {mqtt_conn.broker_host}:{mqtt_conn.broker_port}'
                )

            elif status == 'error':
                mqtt_conn.error_message = error_message
                mqtt_conn.connection_errors += 1

                # ⭐ LOG ERROR
                log_connection_event(
                    mqtt_conn,
                    level='ERROR',
                    message=error_message,
                    retry_attempt=self.retry_count
                )

                if self.retry_count < self.MAX_RETRIES:
                    delay = self._get_retry_delay()
                    mqtt_conn.mqtt_next_retry = django_tz.now() + timedelta(seconds=delay)
                    logger.warning(
                        f"[MQTT Connection {self.mqtt_connection_id}] "
                        f"Retry {self.retry_count}/{self.MAX_RETRIES} scheduled in {delay}s"
                    )
                else:
                    logger.error(
                        f"[MQTT Connection {self.mqtt_connection_id}] "
                        f"Max retries reached. Giving up."
                    )
                    mqtt_conn.mqtt_next_retry = None

            elif status == 'disconnected':
                # ⭐ LOG DISCONNECT
                log_connection_event(
                    mqtt_conn,
                    level='WARNING' if error_message else 'INFO',
                    message=f'Disconnected: {error_message}' if error_message else 'Disconnected cleanly'
                )

            mqtt_conn.save(update_fields=[
                'status', 'last_connected_at', 'error_message',
                'mqtt_retry_count', 'mqtt_next_retry', 'connection_errors'
            ])

            # Broadcast status update via WebSocket
            if self.site_id:
                broadcast_status_update(
                    site_id=self.site_id,
                    status=status,
                    is_active=mqtt_conn.is_active  # ⭐ CHANGED from is_enabled
                )

    except Exception as e:
        logger.error(f"[MQTT Connection {self.mqtt_connection_id}] Error updating status: {e}")
```

---

### 4. **Update `broadcast_status_update`**

**File**: `backend/mqtt/services/broadcast.py`

**Find**:
```python
def broadcast_status_update(site_id: int, status: str, is_enabled: bool):
```

**Replace with**:
```python
def broadcast_status_update(site_id: int, status: str, is_active: bool):
    """
    Broadcast MQTT connection status update via WebSocket

    Args:
        site_id: ID del sito
        status: Status connessione (connected, disconnected, error, etc.)
        is_active: Se connessione è attiva
    """
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer

        channel_layer = get_channel_layer()
        if not channel_layer:
            return

        message = {
            "type": "mqtt_status",
            "site_id": site_id,
            "status": status,
            "is_active": is_active,  # ⭐ CHANGED
            "timestamp": timezone.now().isoformat()
        }

        async_to_sync(channel_layer.group_send)(
            "mqtt_status_updates",
            {
                "type": "status_update",
                "message": message
            }
        )

        logger.debug(f"Broadcast MQTT status update for site {site_id}: {status}")

    except Exception as e:
        logger.error(f"Error broadcasting status update: {e}")
```

---

### 5. **Update Monitor Thread Logging**

**File**: `backend/mqtt/services/mqtt_service.py`

**Find**:
```python
def monitor_connections(self):
    logger.info("MQTT Monitor started")
    # ...
```

**Add more detailed logging**:
```python
def monitor_connections(self):
    """Thread che monitora e riavvia connessioni ogni 30s"""
    logger.info(f"MQTT Monitor started (instance: {self.instance_id})")

    while not self._should_stop:
        try:
            cycle_start = time.time()

            # Log monitor cycle start
            logger.debug(f"Monitor cycle started ({len(self.connections)} active connections)")

            # 1. Check for new connections to start
            now = timezone.now()
            sites_to_check = MqttConnection.objects.filter(
                is_active=True  # ⭐ CHANGED
            ).exclude(
                id__in=list(self.connections.keys())
            ).filter(
                Q(mqtt_next_retry__isnull=True) | Q(mqtt_next_retry__lte=now)
            ).select_related('site')

            if sites_to_check.exists():
                logger.info(f"Monitor found {sites_to_check.count()} connections to start")

            for mqtt_conn in sites_to_check:
                logger.info(
                    f"[Site {mqtt_conn.site.id}] Starting connection "
                    f"(retry {mqtt_conn.mqtt_retry_count} or new)"
                )
                self.start_connection(mqtt_conn.site.id, manual=False)

            # 2. Disconnect inactive connections
            disabled_connections = MqttConnection.objects.filter(
                id__in=list(self.connections.keys()),
                is_active=False  # ⭐ CHANGED
            )

            if disabled_connections.exists():
                logger.info(f"Monitor found {disabled_connections.count()} connections to stop")

            for mqtt_conn in disabled_connections:
                logger.info(f"[Site {mqtt_conn.site.id}] Stopping connection (is_active=False)")
                self.stop_connection(mqtt_conn.site.id)

            # 3. Check offline devices
            try:
                from mqtt.services.message_processor import message_processor
                stats = message_processor.check_offline_devices()
                total_offline = stats['gateways_offline'] + stats['dataloggers_offline'] + stats['sensors_offline']
                if total_offline > 0:
                    logger.info(
                        f"Offline check: {stats['gateways_offline']} gateways, "
                        f"{stats['dataloggers_offline']} dataloggers, "
                        f"{stats['sensors_offline']} sensors marked offline"
                    )
            except Exception as e:
                logger.error(f"Error checking offline devices: {e}")

            # Log cycle completion
            cycle_duration = time.time() - cycle_start
            logger.debug(f"Monitor cycle completed in {cycle_duration:.2f}s")

        except Exception as e:
            logger.error(f"Monitor error: {e}", exc_info=True)

        # Sleep 30 seconds
        time.sleep(30)

    logger.info("MQTT Monitor stopped")
```

---

## Testing

### Unit Tests

```python
# backend/mqtt/tests/test_monitor_thread.py

import time
from mqtt.models import MqttConnection
from mqtt.services.mqtt_service import mqtt_service

class TestMonitorThread:
    def test_monitor_starts_active_connections(self):
        """Monitor thread connette siti con is_active=True"""
        conn = MqttConnection.objects.first()
        conn.is_active = True
        conn.save()

        # Wait for monitor cycle (max 35s)
        time.sleep(35)

        conn.refresh_from_db()
        assert conn.status in ['connected', 'connecting']

    def test_monitor_stops_inactive_connections(self):
        """Monitor thread disconnette siti con is_active=False"""
        conn = MqttConnection.objects.first()
        conn.is_active = True
        conn.save()
        time.sleep(35)  # Let it connect

        # Disable
        conn.is_active = False
        conn.save()
        time.sleep(35)  # Let monitor stop it

        conn.refresh_from_db()
        assert conn.status == 'disconnected'

    def test_connection_logging_on_error(self):
        """Errori connessione vengono loggati"""
        from mqtt.models import MqttConnectionLog

        # Create connection con broker invalido
        conn = MqttConnection.objects.create(
            site=Site.objects.first(),
            broker_host='invalid.broker.local',
            broker_port=9999,
            is_active=True
        )

        time.sleep(35)

        # Check log entry created
        logs = MqttConnectionLog.objects.filter(connection=conn, level='ERROR')
        assert logs.exists()
```

### Manual Testing

1. **Start container con MQTT service**:
   ```bash
   podman-compose up -d
   podman logs -f bfg_backend
   ```

2. **Check monitor logs**:
   ```bash
   tail -f logs/mqtt_connections.log
   ```
   Should see:
   ```
   [INFO] MQTT Monitor started (instance: ...)
   [DEBUG] Monitor cycle started (X active connections)
   ```

3. **Test manual enable/disable**:
   ```bash
   # Enable connection via Django shell
   python manage.py shell
   ```
   ```python
   from mqtt.models import MqttConnection
   conn = MqttConnection.objects.first()
   conn.is_active = True
   conn.save()
   # Wait 30s, check logs
   ```

4. **Check DB logs created**:
   ```bash
   python manage.py shell
   ```
   ```python
   from mqtt.models import MqttConnectionLog
   MqttConnectionLog.objects.all().order_by('-timestamp')[:10]
   ```

---

## Success Criteria

- [ ] Monitor thread usa `is_active` invece di `is_enabled`
- [ ] Logging su file funziona (`logs/mqtt_connections.log`)
- [ ] Logging su DB funziona (MqttConnectionLog entries)
- [ ] WebSocket broadcast usa `is_active`
- [ ] Monitor thread log dettagliati per ogni ciclo
- [ ] No errori nei log Django

---

## Next Phase

After completion: **PHASE 3 - API Endpoints Refactoring**

```
"Leggi docs/mqtt/phases/PHASE_03_api_endpoints.md e implementa"
```

---

**Status**: 📋 Ready for Implementation
**Estimated Time**: 1 hour
