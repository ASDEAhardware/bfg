# MQTT Architecture - Target Architecture

## Scopo
Questo documento descrive l'**architettura target** completa del sistema MQTT, con dettagli implementativi.

---

## 1. Database Schema Target

### **Site Model**
```python
class Site(models.Model):
    """Sito/Location fisico"""
    name = CharField(max_length=255)
    is_active = BooleanField(default=True)  # Visibilità sito nell'applicazione
    # ... altri campi ...
```
**Usage**: `is_active` controlla se il sito è visibile nell'applicazione (dropdown, liste, etc.)

---

### **MqttConnection Model**
```python
class MqttConnection(models.Model):
    """Configurazione connessione MQTT per ogni sito (relazione 1:1)"""
    site = OneToOneField('sites.Site', on_delete=CASCADE)

    # Connection settings
    broker_host = CharField(max_length=255)
    broker_port = IntegerField(default=1883)
    username = CharField(max_length=100, blank=True)
    password = CharField(max_length=100, blank=True)
    client_id_prefix = CharField(max_length=50)

    # ⭐ RENAMED: is_enabled → is_active
    is_active = BooleanField(
        default=True,
        help_text="Enable/disable questa connessione MQTT. Monitor thread usa questo flag."
    )

    # Status tracking (read-only, aggiornato dal service)
    status = CharField(
        max_length=20,
        choices=[
            ('disconnected', 'Disconnected'),
            ('connecting', 'Connecting'),
            ('connected', 'Connected'),
            ('error', 'Error'),
        ],
        default='disconnected'
    )

    # Retry management (gestito dal service)
    mqtt_retry_count = IntegerField(default=0)
    mqtt_next_retry = DateTimeField(null=True, blank=True)

    # Timestamps
    last_connected_at = DateTimeField(null=True, blank=True)
    last_heartbeat_at = DateTimeField(null=True, blank=True)
    created_at = DateTimeField(auto_now_add=True)
    updated_at = DateTimeField(auto_now=True)
```

**Migration Needed:**
```python
# Migration file
operations = [
    migrations.RenameField(
        model_name='mqttconnection',
        old_name='is_enabled',
        new_name='is_active',
    ),
]
```

---

### **MqttTopic Model**
```python
class MqttTopic(models.Model):
    """Topic patterns da sottoscrivere per ogni connessione"""
    mqtt_connection = ForeignKey(MqttConnection, on_delete=CASCADE, related_name='topics')
    topic_pattern = CharField(
        max_length=255,
        help_text="MQTT topic pattern (supporta wildcards +/#). Es: 'site_001/gateway/+/dataloggers/telemetry'"
    )

    is_active = BooleanField(
        default=True,
        help_text="Se False, i messaggi di questo topic vengono ignorati dal parser"
    )

    qos_level = IntegerField(default=0, choices=[(0, 'QoS 0'), (1, 'QoS 1'), (2, 'QoS 2')])
    description = TextField(blank=True)

    # Parser association
    parser_name = CharField(
        max_length=100,
        blank=True,
        help_text="Nome del parser da usare (from PARSER_REGISTRY). Es: 'telemetry', 'gateway_status'"
    )

    # Stats
    subscription_count = IntegerField(default=0)
    last_subscribed_at = DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('mqtt_connection', 'topic_pattern')
```

**Usage**:
- Admin configura i topic patterns per ogni sito
- `is_active` permette di disabilitare temporaneamente il parsing di un topic senza cancellarlo
- `parser_name` associa il topic a un parser nel registry

---

### **DiscoveredTopic Model**
```python
class DiscoveredTopic(models.Model):
    """Auto-discovery di tutti i topic ricevuti (anche non configurati)"""
    site = ForeignKey('sites.Site', on_delete=CASCADE, related_name='discovered_topics')
    topic_path = CharField(max_length=500, help_text="Topic completo ricevuto")

    # Discovery timestamps
    first_seen_at = DateTimeField(auto_now_add=True)
    last_seen_at = DateTimeField(auto_now=True)
    message_count = IntegerField(default=1)

    # Sample data
    sample_payload = JSONField(null=True, blank=True)
    payload_size_avg = FloatField(null=True, blank=True)

    # ⭐ RENAMED: is_processed → is_processable
    is_processable = BooleanField(
        default=False,
        help_text="True se questo topic è riconosciuto da un parser nel registry"
    )
    parser_name = CharField(
        max_length=100,
        blank=True,
        help_text="Nome del parser che ha riconosciuto questo topic"
    )

    class Meta:
        unique_together = ('site', 'topic_path')
        ordering = ['-last_seen_at']
```

**Migration Needed:**
```python
operations = [
    migrations.RenameField(
        model_name='discoveredtopic',
        old_name='is_processed',
        new_name='is_processable',
    ),
]
```

---

### **⭐ NEW: MqttConnectionLog Model**
```python
class MqttConnectionLog(models.Model):
    """Log errori/eventi connessione MQTT"""
    connection = ForeignKey(MqttConnection, on_delete=CASCADE, related_name='logs')
    timestamp = DateTimeField(auto_now_add=True)

    level = CharField(
        max_length=10,
        choices=[
            ('DEBUG', 'Debug'),
            ('INFO', 'Info'),
            ('WARNING', 'Warning'),
            ('ERROR', 'Error'),
            ('CRITICAL', 'Critical'),
        ]
    )

    message = TextField()
    exception_type = CharField(max_length=255, blank=True)
    exception_traceback = TextField(blank=True)

    # Context
    broker_host = CharField(max_length=255, blank=True)
    retry_attempt = IntegerField(null=True, blank=True)

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['connection', '-timestamp']),
            models.Index(fields=['level', '-timestamp']),
        ]

    def __str__(self):
        return f"[{self.level}] {self.connection.site.name} - {self.message[:50]}"
```

**Usage**:
- Loggato ogni errore di connessione/disconnessione
- Visibile in Django Admin con filtri per level/connection
- Query facili: `MqttConnectionLog.objects.filter(level='ERROR')`

---

### **⭐ NEW: MqttParsingLog Model**
```python
class MqttParsingLog(models.Model):
    """Log errori parsing messaggi MQTT"""
    site = ForeignKey('sites.Site', on_delete=CASCADE, related_name='parsing_logs')
    timestamp = DateTimeField(auto_now_add=True)

    topic = CharField(max_length=500)
    parser_name = CharField(max_length=100, blank=True)

    error_type = CharField(
        max_length=50,
        choices=[
            ('VALIDATION_ERROR', 'JSON Validation Error'),
            ('PARSE_ERROR', 'Topic Parse Error'),
            ('DB_ERROR', 'Database Error'),
            ('UNKNOWN_ERROR', 'Unknown Error'),
        ]
    )

    error_message = TextField()
    exception_type = CharField(max_length=255, blank=True)
    exception_traceback = TextField(blank=True)

    # Payload sample (truncated se troppo grande)
    payload_sample = JSONField(null=True, blank=True)

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['site', '-timestamp']),
            models.Index(fields=['error_type', '-timestamp']),
            models.Index(fields=['topic']),
        ]

    def __str__(self):
        return f"[{self.error_type}] {self.site.name} - {self.topic}"
```

**Usage**:
- Loggato ogni errore di parsing (Pydantic validation failed, DB error, etc.)
- Include sample payload per debug
- Visibile in Django Admin

---

## 2. Parser Registry Architecture

### **Registry Pattern**

```python
# backend/mqtt/parsers/base.py
from abc import ABC, abstractmethod
from pydantic import BaseModel, ValidationError
from typing import Optional, Type
import logging

logger = logging.getLogger('mqtt.parsing')

class TopicParser(ABC):
    """
    Base class per tutti i parser MQTT.
    Ogni parser:
    - Definisce un topic_pattern (può usare wildcards)
    - Definisce uno schema Pydantic per validazione
    - Implementa la logica di processing/saving
    """

    # Nome univoco del parser (usato in MqttTopic.parser_name)
    parser_name: str

    # Pattern topic che questo parser gestisce (supporta * come wildcard)
    topic_pattern: str

    # Schema Pydantic per validazione payload
    schema: Type[BaseModel]

    def matches(self, topic: str) -> bool:
        """
        Controlla se questo parser può gestire il topic.
        Override se serve logica custom, altrimenti usa pattern matching.
        """
        import re
        pattern = self.topic_pattern.replace('+', '[^/]+').replace('#', '.+')
        return re.fullmatch(pattern, topic) is not None

    def validate(self, payload: dict) -> Optional[BaseModel]:
        """
        Valida il payload usando lo schema Pydantic.
        Returns: Oggetto validato o None se validazione fallisce.
        """
        try:
            return self.schema(**payload)
        except ValidationError as e:
            logger.error(f"[{self.parser_name}] Validation error: {e}")
            return None

    @abstractmethod
    def process(self, site_id: int, topic: str, validated_data: BaseModel) -> bool:
        """
        Processa i dati validati e salva nel DB.
        Returns: True se successo, False se errore.
        """
        pass

    def parse_and_process(self, site_id: int, topic: str, payload: dict) -> bool:
        """
        Pipeline completa: valida + processa.
        """
        validated = self.validate(payload)
        if validated is None:
            return False
        return self.process(site_id, topic, validated)
```

---

### **Parser Registry**

```python
# backend/mqtt/parsers/registry.py
from typing import Dict, Optional
from .base import TopicParser
from .telemetry_parser import TelemetryParser
from .gateway_status_parser import GatewayStatusParser
# ... import altri parser ...

class ParserRegistry:
    """Registry singleton per tutti i parser MQTT"""

    def __init__(self):
        self._parsers: Dict[str, TopicParser] = {}

    def register(self, parser: TopicParser):
        """Registra un parser"""
        self._parsers[parser.parser_name] = parser

    def get(self, parser_name: str) -> Optional[TopicParser]:
        """Ottiene parser per nome"""
        return self._parsers.get(parser_name)

    def find_parser(self, topic: str) -> Optional[TopicParser]:
        """Trova il primo parser che matcha il topic"""
        for parser in self._parsers.values():
            if parser.matches(topic):
                return parser
        return None

    def list_parsers(self):
        """Lista tutti i parser registrati"""
        return list(self._parsers.keys())

# Singleton instance
parser_registry = ParserRegistry()

# Auto-register all parsers
parser_registry.register(TelemetryParser())
parser_registry.register(GatewayStatusParser())
# ... register altri parser ...
```

---

### **Example Parser: Telemetry**

```python
# backend/mqtt/parsers/telemetry_parser.py
from pydantic import BaseModel, Field
from typing import List
from datetime import datetime
from .base import TopicParser
from mqtt.models import Gateway, Datalogger, Sensor
from django.db import transaction
import logging

logger = logging.getLogger('mqtt.parsing')

# ⭐ Pydantic Schemas
class SensorData(BaseModel):
    type: str
    value: List[float] | float | dict

class DeviceData(BaseModel):
    type: str
    serial_number_device: str = Field(alias="serial number device")  # Support spaces in JSON keys
    data: List[SensorData]

    class Config:
        populate_by_name = True

class DataloggerData(BaseModel):
    serial_number_datalogger: str
    status_datalogger: str
    devices: List[DeviceData]

class TelemetryPayload(BaseModel):
    serial_number_gateway: str
    timestamp: str
    message_interval_seconds: int = 60
    mqtt_api_version: str = "1.0.0"
    dataloggers: List[DataloggerData]

# ⭐ Parser Implementation
class TelemetryParser(TopicParser):
    parser_name = "telemetry"
    topic_pattern = "*/gateway/*/dataloggers/telemetry"
    schema = TelemetryPayload

    def process(self, site_id: int, topic: str, validated_data: TelemetryPayload) -> bool:
        """Processa telemetria e salva Gateway/Dataloggers/Sensors"""
        try:
            from sites.models import Site
            site = Site.objects.get(id=site_id)

            timestamp = self._parse_timestamp(validated_data.timestamp)

            # 1. Create/Update Gateway
            with transaction.atomic():
                gateway, _ = Gateway.objects.update_or_create(
                    serial_number=validated_data.serial_number_gateway,
                    defaults={
                        'site': site,
                        'is_online': True,
                        'expected_heartbeat_interval': validated_data.message_interval_seconds,
                        'last_seen_at': timestamp,
                        'raw_metadata': validated_data.dict(),
                    }
                )

            # 2. Process each datalogger/device
            for dl_data in validated_data.dataloggers:
                for device in dl_data.devices:
                    self._process_device(site, gateway, dl_data, device, timestamp)

            logger.info(f"[{self.parser_name}] Processed telemetry for site {site_id}")
            return True

        except Exception as e:
            logger.error(f"[{self.parser_name}] Error processing telemetry: {e}", exc_info=True)
            return False

    def _process_device(self, site, gateway, dl_data, device, timestamp):
        """Helper per processare singolo device"""
        with transaction.atomic():
            # Create/Update Datalogger
            datalogger, _ = Datalogger.objects.update_or_create(
                serial_number=device.serial_number_device,
                defaults={
                    'site': site,
                    'gateway': gateway,
                    'datalogger_type': device.type.replace('-', '').lower(),
                    'is_online': True,
                    'last_seen_at': timestamp,
                }
            )

            # Process sensors
            for sensor_data in device.data:
                self._process_sensor(datalogger, device.serial_number_device, sensor_data, timestamp)

    def _process_sensor(self, datalogger, device_serial, sensor_data, timestamp):
        """Helper per processare singolo sensore"""
        sensor_serial = f"{device_serial}-{sensor_data.type}"

        with transaction.atomic():
            sensor, _ = Sensor.objects.get_or_create(
                datalogger=datalogger,
                serial_number=sensor_serial,
                defaults={
                    'label': sensor_serial,
                    'sensor_type': sensor_data.type,
                    'is_online': True,
                }
            )

            # Format and save reading
            reading_data = self._format_sensor_value(sensor_data.type, sensor_data.value)
            sensor.add_new_reading(timestamp, reading_data)
            sensor.save()

    def _format_sensor_value(self, sensor_type: str, value) -> dict:
        """Formatta valore sensore in dict appropriato"""
        if isinstance(value, dict):
            return value

        if isinstance(value, list):
            if sensor_type == 'accelerometer' and len(value) == 3:
                return {"x": value[0], "y": value[1], "z": value[2]}
            elif sensor_type == 'inclinometer' and len(value) >= 2:
                return {"pitch": value[0], "roll": value[1]}
            elif len(value) == 1:
                return {"value": value[0]}
            else:
                return {"values": value}

        return {"value": value}

    def _parse_timestamp(self, timestamp_str: str) -> datetime:
        """Parse ISO timestamp"""
        from django.utils import timezone
        try:
            if timestamp_str.endswith('Z'):
                timestamp_str = timestamp_str[:-1] + '+00:00'
            return datetime.fromisoformat(timestamp_str)
        except:
            return timezone.now()
```

---

## 3. Message Processing Pipeline

### **Updated MqttMessageProcessor**

```python
# backend/mqtt/services/message_processor.py
from mqtt.parsers.registry import parser_registry
from mqtt.models import MqttTopic, DiscoveredTopic, MqttParsingLog
import logging

logger = logging.getLogger('mqtt.parsing')

class MqttMessageProcessor:
    def process_message(self, site_id: int, topic: str, payload: bytes, qos: int, retain: bool) -> bool:
        """
        Pipeline di processing:
        1. Auto-discovery (salva in DiscoveredTopic)
        2. Check MqttTopic.is_active
        3. Valida e processa con parser appropriato
        4. Log errori
        5. Broadcast WebSocket
        """
        try:
            # 1. Parse JSON
            payload_dict = self._parse_json(payload)
            if payload_dict is None:
                return False  # Not JSON or invalid

            # 2. Auto-discovery
            self._save_discovered_topic(site_id, topic, payload_dict, payload)

            # 3. Check if topic is configured and active
            mqtt_topic = self._get_configured_topic(site_id, topic)
            if mqtt_topic is None:
                logger.debug(f"Topic {topic} not configured for site {site_id}, skipping parsing")
                return True  # Not an error, just not configured

            if not mqtt_topic.is_active:
                logger.debug(f"Topic {topic} is disabled, skipping parsing")
                return True  # Not an error, just disabled

            # 4. Get parser
            parser = None
            if mqtt_topic.parser_name:
                parser = parser_registry.get(mqtt_topic.parser_name)
            else:
                # Try to auto-detect parser
                parser = parser_registry.find_parser(topic)

            if parser is None:
                logger.warning(f"No parser found for topic {topic}")
                self._update_discovered_topic(site_id, topic, is_processable=False)
                return False

            # 5. Parse and process
            success = parser.parse_and_process(site_id, topic, payload_dict)

            if success:
                # Mark as processable
                self._update_discovered_topic(site_id, topic, is_processable=True, parser_name=parser.parser_name)

                # Broadcast WebSocket
                self._broadcast_update(site_id, "data_update", {"topic": topic})
            else:
                # Log parsing error
                self._log_parsing_error(site_id, topic, parser.parser_name, "Parsing failed", payload_dict)

            return success

        except Exception as e:
            logger.error(f"Error in message pipeline for topic {topic}: {e}", exc_info=True)
            self._log_parsing_error(site_id, topic, None, str(e), payload_dict if 'payload_dict' in locals() else None)
            return False

    def _get_configured_topic(self, site_id, topic) -> Optional[MqttTopic]:
        """Trova MqttTopic configurato che matcha questo topic"""
        from mqtt.models import MqttConnection
        try:
            conn = MqttConnection.objects.get(site_id=site_id)
            for mqtt_topic in conn.topics.all():
                if self._topic_matches_pattern(topic, mqtt_topic.topic_pattern):
                    return mqtt_topic
        except:
            pass
        return None

    def _topic_matches_pattern(self, topic: str, pattern: str) -> bool:
        """Match MQTT topic con pattern (supporta +/#)"""
        import re
        regex_pattern = pattern.replace('+', '[^/]+').replace('#', '.+')
        return re.fullmatch(regex_pattern, topic) is not None

    def _update_discovered_topic(self, site_id, topic, is_processable, parser_name=None):
        """Aggiorna flag is_processable su DiscoveredTopic"""
        try:
            DiscoveredTopic.objects.filter(site_id=site_id, topic_path=topic).update(
                is_processable=is_processable,
                parser_name=parser_name or ''
            )
        except Exception as e:
            logger.error(f"Error updating discovered topic: {e}")

    def _log_parsing_error(self, site_id, topic, parser_name, error_msg, payload_sample):
        """Salva errore in MqttParsingLog"""
        try:
            import traceback
            MqttParsingLog.objects.create(
                site_id=site_id,
                topic=topic,
                parser_name=parser_name or '',
                error_type='PARSE_ERROR',
                error_message=error_msg,
                exception_traceback=traceback.format_exc(),
                payload_sample=payload_sample
            )
        except Exception as e:
            logger.error(f"Error saving parsing log: {e}")
```

---

## 4. API Endpoints Target

### **Behavior: DB-only Changes (No Direct Service Calls)**

```python
# backend/mqtt/api/views.py

class MqttConnectionStartView(APIView):
    """
    Start MQTT connection (sets flag, monitor thread does actual work)
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request, site_id):
        try:
            conn = MqttConnection.objects.get(site_id=site_id)

            # ⭐ Only change DB flag, don't call service directly
            conn.is_active = True
            conn.save(update_fields=['is_active'])

            return Response({
                'success': True,
                'message': f'MQTT connection for site {site_id} will start within 30 seconds',
                'status': conn.status,  # Current status (may still be 'disconnected')
                'is_active': conn.is_active,
            })

        except MqttConnection.DoesNotExist:
            return Response({'error': 'Connection not found'}, status=404)

class MqttConnectionStopView(APIView):
    """
    Stop MQTT connection (sets flag, monitor thread does actual work)
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request, site_id):
        try:
            conn = MqttConnection.objects.get(site_id=site_id)

            # ⭐ Only change DB flag
            conn.is_active = False
            conn.save(update_fields=['is_active'])

            return Response({
                'success': True,
                'message': f'MQTT connection for site {site_id} will stop within 30 seconds',
                'status': conn.status,
                'is_active': conn.is_active,
            })

        except MqttConnection.DoesNotExist:
            return Response({'error': 'Connection not found'}, status=404)
```

**Rationale**:
- API cambia solo il flag `is_active` nel DB
- Monitor thread (ogni 30s) vede il cambio e agisce
- WebSocket notifica il frontend quando effettivamente connesso/disconnesso
- Frontend mostra loading state durante i max 30s di attesa

---

## 5. Logging Architecture

### **File-based Logging**

```python
# backend/settings.py

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,

    'formatters': {
        'verbose': {
            'format': '[{levelname}] {asctime} {name} {message}',
            'style': '{',
        },
    },

    'handlers': {
        'mqtt_connection_file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': '/app/logs/mqtt_connections.log',
            'maxBytes': 10 * 1024 * 1024,  # 10MB
            'backupCount': 5,
            'formatter': 'verbose',
        },
        'mqtt_parsing_file': {
            'level': 'WARNING',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': '/app/logs/mqtt_parsing.log',
            'maxBytes': 10 * 1024 * 1024,
            'backupCount': 5,
            'formatter': 'verbose',
        },
    },

    'loggers': {
        'mqtt.connection': {
            'handlers': ['mqtt_connection_file'],
            'level': 'INFO',
            'propagate': False,
        },
        'mqtt.parsing': {
            'handlers': ['mqtt_parsing_file'],
            'level': 'WARNING',
            'propagate': False,
        },
    },
}
```

### **DB Logging Helpers**

```python
# backend/mqtt/logging_utils.py
from mqtt.models import MqttConnectionLog, MqttParsingLog
import traceback

def log_connection_error(connection, message, exception=None):
    """Helper per loggare errori connessione"""
    MqttConnectionLog.objects.create(
        connection=connection,
        level='ERROR',
        message=message,
        exception_type=type(exception).__name__ if exception else '',
        exception_traceback=traceback.format_exc() if exception else '',
        broker_host=connection.broker_host,
        retry_attempt=connection.mqtt_retry_count,
    )

def log_parsing_error(site, topic, parser_name, error_type, message, payload_sample=None):
    """Helper per loggare errori parsing"""
    MqttParsingLog.objects.create(
        site=site,
        topic=topic,
        parser_name=parser_name or '',
        error_type=error_type,
        error_message=message,
        exception_traceback=traceback.format_exc(),
        payload_sample=payload_sample,
    )
```

---

## 6. Container Auto-start

### **Entrypoint Script**

```bash
# backend/entrypoint.sh

#!/bin/bash
set -e

echo "Running migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Starting MQTT service in background..."
python manage.py run_mqtt &
MQTT_PID=$!

echo "Starting Daphne (ASGI server)..."
daphne -b 0.0.0.0 -p 8000 backend.asgi:application &
DAPHNE_PID=$!

# Wait for both processes
wait $MQTT_PID $DAPHNE_PID
```

**Alternative (Supervisord)**:
```ini
# supervisord.conf
[program:mqtt_service]
command=python manage.py run_mqtt
autostart=true
autorestart=true
stderr_logfile=/app/logs/mqtt_service.err.log
stdout_logfile=/app/logs/mqtt_service.out.log

[program:daphne]
command=daphne -b 0.0.0.0 -p 8000 backend.asgi:application
autostart=true
autorestart=true
```

---

## 7. Sentry Integration

### **Simple Setup**

```python
# backend/settings.py

import sentry_sdk
from sentry_sdk.integrations.django import DjangoIntegration

SENTRY_DSN = os.getenv('SENTRY_DSN', None)

if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[DjangoIntegration()],
        traces_sample_rate=0.1,  # 10% tracing
        send_default_pii=False,
        environment=os.getenv('ENVIRONMENT', 'production'),
        release=os.getenv('APP_VERSION', 'unknown'),
    )
```

```bash
# .env
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project
ENVIRONMENT=production
APP_VERSION=1.0.0
```

**Usage in code**:
```python
import sentry_sdk

try:
    # risky operation
except Exception as e:
    sentry_sdk.capture_exception(e)
    raise
```

---

**Next**: Leggi `03_IMPLEMENTATION_PLAN.md` per il piano di sviluppo fase per fase.
