# Protocollo MQTT - Topic Structure e Message Format

## Overview

Il protocollo MQTT del sistema BFG è progettato per supportare:
- Multi-site con topic hierarchy isolati
- Auto-discovery dei dispositivi
- Versioning del protocollo
- Backward compatibility

## Topic Hierarchy

### Struttura Base

```
{site_prefix}/gateway/{gateway_id}/{component}/{type}/{device_id}/{channel}
```

**Componenti:**
- `site_prefix`: Prefisso sito (es: `site_001`, `company_sitea`)
- `gateway_id`: ID numerico gateway (di solito `1`)
- `component`: Tipo componente (`gateway`, `datalogger`, `sensor`)
- `type`: Sottotipo (es: `monstro`, `generic`)
- `device_id`: ID dispositivo univoco nel tipo
- `channel`: Canale comunicazione (`heartbeat`, `data`, `input`, `output`, `status`)

### Esempi Topic

```
site_001/gateway/1/heartbeat
site_001/gateway/1/datalogger/monstro/15/heartbeat
site_001/gateway/1/datalogger/monstro/15/input
site_001/gateway/1/datalogger/monstro/15/output
site_001/gateway/1/sensor/temperature/42/data
```

### Wildcard Subscriptions

```bash
# Tutti i datalogger di un sito
site_001/gateway/+/datalogger/+/+/heartbeat

# Tutti i sensori di un datalogger
site_001/gateway/1/datalogger/monstro/15/sensor/+/data

# Tutti i messaggi di un sito
site_001/#
```

---

## Message Formats

### 1. Gateway Heartbeat

**Topic:** `{site_prefix}/gateway/{gateway_id}/heartbeat`

**Versione v1.0.0:**
```json
{
  "version": "v1.0.0",
  "timestamp": "2024-10-27T10:35:12Z",
  "gateway": {
    "serial_number": "GW-001",
    "hostname": "gateway-001",
    "ip_address": "192.168.1.1",
    "firmware_version": "2.5.3",
    "os_version": "Ubuntu 22.04 LTS"
  },
  "system": {
    "uptime_seconds": 3600,
    "cpu_usage_percent": 15.2,
    "memory_usage_percent": 42.8,
    "disk_usage_percent": 55.3
  },
  "network": {
    "active_connections": 3,
    "bytes_sent": 1024000,
    "bytes_received": 2048000
  }
}
```

**Versione v1.2.0 (attuale):**
```json
{
  "version": "v1.2.0",
  "timestamp": "2024-10-27T10:35:12Z",
  "gateway": {
    "serial_number": "GW-001",
    "hostname": "gateway-001",
    "ip_address": "192.168.1.1",
    "firmware_version": "2.5.3"
  },
  "system": {
    "uptime_seconds": 3600
  },
  "dataloggers": {
    "total": 3,
    "online": 2
  }
}
```

---

### 2. Datalogger Heartbeat

**Topic:** `{site_prefix}/gateway/{gateway_id}/datalogger/{type}/{device_id}/heartbeat`

**Payload:**
```json
{
  "version": "v1.2.0",
  "timestamp": "2024-10-27T10:35:12Z",
  "datalogger": {
    "serial_number": "MONSTR-001",
    "type": "monstro",
    "device_id": "15",
    "firmware_version": "V.5.53.0",
    "ip_address": "192.168.1.100"
  },
  "status": {
    "is_logging": true,
    "session_id": "sess_20241027_103512",
    "tdengine_status": "connected",
    "last_log_time": "2024-10-27T10:35:10Z"
  },
  "sensors": {
    "total": 8,
    "online": 7,
    "logging": 7
  },
  "statistics": {
    "total_samples": 152300,
    "missed_samples": 45,
    "uptime_percentage": 99.85
  }
}
```

**Campi principali:**
- `version`: Versione API MQTT
- `timestamp`: Timestamp messaggio (ISO 8601)
- `datalogger.serial_number`: S/N univoco dispositivo
- `datalogger.type`: Tipo datalogger (`monstro`, `generic`)
- `datalogger.device_id`: ID numerico nel tipo
- `status.is_logging`: Se sta acquisendo dati
- `status.session_id`: ID sessione corrente
- `sensors.online`: Numero sensori online

---

### 3. Sensor Data

**Topic:** `{site_prefix}/gateway/{gateway_id}/sensor/{type}/{sensor_id}/data`

**Payload - Sensore Temperatura:**
```json
{
  "version": "v1.2.0",
  "timestamp": "2024-10-27T10:35:12Z",
  "sensor": {
    "serial_number": "SENS-TMP-001",
    "type": "temperature",
    "unit": "°C"
  },
  "reading": {
    "value": 22.5,
    "quality": "good",
    "timestamp": "2024-10-27T10:35:12Z"
  },
  "metadata": {
    "sample_rate_hz": 1,
    "calibration_date": "2024-01-15"
  }
}
```

**Payload - Accelerometro:**
```json
{
  "version": "v1.2.0",
  "timestamp": "2024-10-27T10:35:12.123Z",
  "sensor": {
    "serial_number": "SENS-ACC-001",
    "type": "accelerometer",
    "unit": "g"
  },
  "reading": {
    "acc00": 0.0123,
    "acc01": -0.0045,
    "acc02": 0.9876,
    "magnitude": 0.9877,
    "quality": "good",
    "timestamp": "2024-10-27T10:35:12.123Z"
  },
  "metadata": {
    "sample_rate_hz": 100,
    "axes": 3
  }
}
```

**Payload - Inclinometro:**
```json
{
  "version": "v1.2.0",
  "timestamp": "2024-10-27T10:35:12Z",
  "sensor": {
    "serial_number": "SENS-TILT-001",
    "type": "tilt",
    "unit": "°"
  },
  "reading": {
    "incli_x": 1.234,
    "incli_y": -0.567,
    "quality": "good",
    "timestamp": "2024-10-27T10:35:12Z"
  }
}
```

---

### 4. Datalogger Control (Input)

**Topic:** `{site_prefix}/gateway/{gateway_id}/datalogger/{type}/{device_id}/input`

Comandi inviati dal backend al datalogger.

**Comandi supportati:**

#### Start Acquisition
```
start
```

#### Start with Auto-detect
```
start --detect
```

#### Stop Acquisition
```
stop
```

#### Status Query
```
status
```

#### Configuration Update
```json
{
  "command": "config",
  "parameters": {
    "sample_rate_hz": 100,
    "enabled_sensors": [1, 2, 3, 4]
  }
}
```

---

### 5. Datalogger Status (Output)

**Topic:** `{site_prefix}/gateway/{gateway_id}/datalogger/{type}/{device_id}/output`

Risposte dal datalogger ai comandi.

**Payload - Start Success:**
```json
{
  "command": "start",
  "status": "running",
  "session_id": "sess_20241027_103512",
  "timestamp": "2024-10-27T10:35:12Z",
  "message": "Acquisition started successfully",
  "tdengine_db": "connected",
  "monstr_datalogger": "V.5.53.0",
  "number_connected_devices": "7"
}
```

**Payload - Stop Success:**
```json
{
  "command": "stop",
  "status": "stopped",
  "session_id": "sess_20241027_103512",
  "timestamp": "2024-10-27T10:36:45Z",
  "message": "Acquisition stopped",
  "samples_collected": 8523
}
```

**Payload - Status Response:**
```json
{
  "command": "status",
  "status": "running",
  "session_id": "sess_20241027_103512",
  "timestamp": "2024-10-27T10:35:30Z",
  "is_logging": true,
  "tdengine_db": "connected",
  "sensors_online": 7,
  "samples_collected": 152300
}
```

**Payload - Error:**
```json
{
  "command": "start",
  "status": "error",
  "timestamp": "2024-10-27T10:35:12Z",
  "error_code": "DB_CONNECTION_FAILED",
  "error_message": "Unable to connect to TDengine database",
  "details": {
    "host": "192.168.1.50",
    "port": 6041,
    "timeout_ms": 5000
  }
}
```

---

## Stati del Sistema

### Status Values

#### Datalogger
- `running`: In acquisizione
- `stopped`: Fermo
- `starting`: In fase di avvio
- `stopping`: In fase di stop
- `error`: Errore
- `unknown`: Stato sconosciuto (no risposta)
- `no process running`: Nessun processo attivo
- `terminated forcibly`: Terminato forzatamente

#### Sensors
- `online`: Online e funzionante
- `offline`: Offline o non risponde
- `calibrating`: In calibrazione
- `error`: Errore sensore

#### Connections
- `connected`: Connesso
- `connecting`: In connessione
- `disconnected`: Disconnesso
- `error`: Errore connessione
- `disabled`: Disabilitato

---

## Quality Indicators

### Reading Quality

Tutti i reading possono avere un campo `quality`:

- `good`: Lettura valida e affidabile
- `questionable`: Lettura dubbia (fuori range tipico)
- `bad`: Lettura non valida
- `calibrating`: Sensore in calibrazione
- `offline`: Sensore offline

---

## Versioning

### Supported Versions

- **v1.0.0** (legacy): Prima implementazione
- **v1.1.0**: Aggiunte statistiche avanzate
- **v1.2.0** (current): Versioning esplicito, dynamic monitoring

### Version Detection

Il backend rileva automaticamente la versione dal campo `version` nel payload. Se non presente, assume `v1.0.0`.

```python
def determine_api_version(payload):
    """Determina versione API dal payload"""
    if isinstance(payload, dict) and 'version' in payload:
        return payload['version']
    return 'v1.0.0'  # default legacy
```

### Backward Compatibility

Il sistema supporta tutti i payload legacy automaticamente:

```python
# Legacy payload (v1.0.0) - senza campo version
{
  "serial_number": "GW-001",
  "uptime": 3600
}

# Viene processato correttamente con retrocompatibilità
```

---

## Message Timing

### Heartbeat Intervals

- **Gateway**: Ogni 60 secondi
- **Datalogger**: Ogni 30 secondi (configurabile)
- **Sensor Data**: Variabile (dipende dal tipo sensore)
  - Temperature: 1 Hz
  - Accelerometer: 100 Hz
  - Strain gauge: 10 Hz

### Timeout Thresholds

Configurati in `DynamicOfflineMonitor`:

```python
TIMEOUT_CONFIG = {
    'gateway': 120,      # 2 minuti
    'datalogger': 90,    # 1.5 minuti
    'sensor_default': 60, # 1 minuto
    'sensor_high_freq': 30  # 30 secondi per sensori veloci
}
```

---

## QoS Levels

### Recommended QoS by Topic

- **Heartbeat**: QoS 0 (fire and forget)
- **Sensor Data**: QoS 0 (velocità prioritaria)
- **Control Commands**: QoS 1 (at least once)
- **Status Responses**: QoS 1 (at least once)
- **Configuration**: QoS 2 (exactly once)

### QoS Configuration

```python
# In MqttTopic model
QOS_CHOICES = [
    (0, 'QoS 0 - Fire and Forget'),
    (1, 'QoS 1 - At Least Once'),
    (2, 'QoS 2 - Exactly Once')
]
```

---

## Retained Messages

### When to Use

- **Gateway status**: Retained per last known status
- **Datalogger config**: Retained per configurazione attuale
- **Sensor calibration**: Retained per ultimi parametri

### When NOT to Use

- **Heartbeats**: No retain (data temporale)
- **Sensor readings**: No retain (troppo frequenti)
- **Commands**: No retain (one-time actions)

---

## Will Messages

### Last Will and Testament

Configurato su ogni connessione MQTT:

**Topic:** `{site_prefix}/gateway/{gateway_id}/lwt`

**Payload:**
```json
{
  "event": "connection_lost",
  "timestamp": "2024-10-27T10:35:12Z",
  "site_id": 1,
  "reason": "unexpected_disconnect"
}
```

---

## Error Codes

### Standard Error Codes

```
# Database Errors (1xx)
101 - DB_CONNECTION_FAILED
102 - DB_WRITE_FAILED
103 - DB_QUERY_FAILED

# Sensor Errors (2xx)
201 - SENSOR_NOT_FOUND
202 - SENSOR_CALIBRATION_FAILED
203 - SENSOR_OUT_OF_RANGE

# System Errors (3xx)
301 - INSUFFICIENT_MEMORY
302 - DISK_FULL
303 - CPU_OVERLOAD

# Network Errors (4xx)
401 - NETWORK_UNREACHABLE
402 - TIMEOUT
403 - CONNECTION_REFUSED

# Command Errors (5xx)
501 - INVALID_COMMAND
502 - COMMAND_FAILED
503 - ALREADY_RUNNING
504 - ALREADY_STOPPED
```

---

## Best Practices

### Message Design

1. **Keep payloads small**: < 1KB quando possibile
2. **Use timestamps**: Sempre in ISO 8601 UTC
3. **Include version**: Sempre il campo `version`
4. **Validate on receive**: Parser robusti con error handling
5. **Use compression**: Per payloads > 1KB

### Topic Design

1. **Use hierarchy**: Facilita filtering e wildcards
2. **Avoid deep nesting**: Max 7-8 levels
3. **Use numeric IDs**: Più efficiente di stringhe lunghe
4. **Be consistent**: Stesso pattern per tutti i siti
5. **Document wildcards**: Chiara documentazione subscriptions

### Performance

1. **Batch sensor data**: Group multiple readings quando possibile
2. **Use QoS wisely**: QoS 0 per default, QoS 1 solo quando necessario
3. **Limit retained**: Solo per config e status critici
4. **Monitor sizes**: Alert su payload > 10KB
5. **Clean sessions**: Usa clean session per clients transient

---

## Testing

### Manual Testing con mosquitto_pub

```bash
# Publish heartbeat
mosquitto_pub -h mqtt.example.com -p 1883 \
  -u username -P password \
  -t "site_001/gateway/1/heartbeat" \
  -m '{"version":"v1.2.0","timestamp":"2024-10-27T10:35:12Z","gateway":{"serial_number":"GW-001"}}'

# Publish command
mosquitto_pub -h mqtt.example.com -p 1883 \
  -u username -P password \
  -t "site_001/gateway/1/datalogger/monstro/15/input" \
  -m "start" \
  -q 1

# Subscribe to responses
mosquitto_sub -h mqtt.example.com -p 1883 \
  -u username -P password \
  -t "site_001/gateway/1/datalogger/monstro/15/output" \
  -q 1
```

### Python Testing

```python
import paho.mqtt.client as mqtt
import json

def on_connect(client, userdata, flags, rc):
    print(f"Connected with result code {rc}")
    client.subscribe("site_001/gateway/1/#")

def on_message(client, userdata, msg):
    print(f"Topic: {msg.topic}")
    print(f"Payload: {msg.payload.decode()}")

    try:
        data = json.loads(msg.payload.decode())
        print(f"Version: {data.get('version', 'unknown')}")
    except json.JSONDecodeError:
        print("Not JSON payload")

client = mqtt.Client()
client.username_pw_set("username", "password")
client.on_connect = on_connect
client.on_message = on_message

client.connect("mqtt.example.com", 1883, 60)
client.loop_forever()
```
