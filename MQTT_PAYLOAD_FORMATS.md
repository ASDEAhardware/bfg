# MQTT Payload Formats - Analisi Completa

**Data**: 2025-11-20
**Scopo**: Documentare tutti i formati payload MQTT ricevuti e pianificare processori

---

## 📊 Situazione Attuale Database

**Servizio MQTT**: ✅ RUNNING (uptime 1h 18m)
**Connessioni attive**: 1/2 (Site 6 - Diga del Vajont)
**Topic discovered**: 3
**Datalogger in DB**: 0
**Gateway in DB**: 0

**❌ PROBLEMA**: Nessun datalogger creato, il message processor non riconosce i formati!

---

## 🔍 Formati Payload Trovati

### Formato 1: Backend Status (ATTIVO)

**Topic**: `site_88/backend/status`
**Frequenza**: 110 messaggi (ultimo: 13:59:15)
**Scopo**: Monitoring dello stato del backend MQTT stesso

```json
{
  "status": "online",
  "client_id": "site_88_bkode",
  "timestamp": "2025-11-20T13:59:15.317226Z",
  "instance_id": "bkode"
}
```

**Processore**: ❌ Non implementato
**Azione**: Creare processor per salvare in MqttConnection.status

---

### Formato 2: Datalogger Heartbeat (VECCHIO - IN DB)

**Topic**: `site_006/gateway/1/datalogger/monstro/1/heartbeat`
**Frequenza**: 2 messaggi (ultimo: 17 Nov 11:44)
**Scopo**: Heartbeat singolo datalogger con sensori

```json
{
  "timestamp": "2025-11-17T12:00:00.000000Z",
  "ip_address": "192.168.1.100",
  "serial_number": "MONSTRO-TEST-001",
  "firmware_version": "V.5.53.0.DB",
  "mqtt_api_version": "v1.0.0",
  "sensors_last_data": {
    "temp_sensor_1": {
      "unit": "C",
      "value": 22.5
    },
    "humidity_sensor_1": {
      "unit": "%",
      "value": 45
    }
  },
  "message_interval_seconds": 60
}
```

**❌ PROBLEMA**:
- `sensors_last_data` è un **OGGETTO** (chiave-valore)
- Il processor si aspetta un **ARRAY**
- Il processor attuale (linea 1142) cerca `sensors_last_data` come array

**Processore**: ⚠️ Parzialmente implementato ma non funziona con questo formato
**Azione**: Modificare per gestire sia array che oggetto

---

### Formato 3: Datalogger Output (IN DB)

**Topic**: `site_006/gateway/1/datalogger/monstro_test/1/output`
**Frequenza**: 2 messaggi (ultimo: 17 Nov 11:43)
**Scopo**: Output status del datalogger (non heartbeat)

```json
{
  "status": "running",
  "ip_address": "192.168.1.100",
  "session_id": "test-session-123",
  "tdengine_db": "connected",
  "serial_number": "MONSTRO-TEST-001",
  "monstr_datalogger": "V.5.53.0.DB"
}
```

**Processore**: ❌ Non implementato
**Azione**: Decidere se processare o ignorare (non è heartbeat)

---

### Formato 4: Datalogger Status (FUTURO - FORNITO DA UTENTE)

**Topic**: `site_001/gateway/1/datalogger/all/status`
**Frequenza**: Non ancora ricevuto
**Scopo**: Status aggregato di multipli datalogger

```json
{
  "serial_number": "site_001-gateway_1-all_1",
  "timestamp": "2025-11-20T15:10:07.839359Z",
  "mqtt_api_version": "1.0.0",
  "message_interval_seconds": 5,
  "dataloggers": [
    {
      "serial_number": "all_1",
      "status": "stopped",
      "sensors_data": []
    }
  ]
}
```

**❌ PROBLEMA**:
- Formato completamente diverso!
- Array `dataloggers` con multipli dispositivi
- Campo `sensors_data` invece di `sensors_last_data`
- Topic type: `all` invece di tipo specifico

**Processore**: ❌ Non implementato
**Azione**: Creare nuovo processor per formato aggregato

---

### Formato 5: Connection Status (FUTURO - FORNITO DA UTENTE)

**Topic**: `site_001/connection/status` (QoS 1, Retained)
**Frequenza**: Non ancora ricevuto (ma utente vede retained vecchio)
**Scopo**: Status connessione MQTT dal device

```json
{
  "status": "disconnected",
  "reason": "unexpected",
  "timestamp": "2025-11-04T08:51:53.304298",
  "client_id": "b6eda3f639ca_6ed5a73f_site_001_conn1",
  "site_id": 6,
  "site_name": "Diga del Vajont"
}
```

**❌ PROBLEMA**:
- Retained message vecchio (2025-11-04) ancora sul broker
- Causa confusione

**Processore**: ❌ Non implementato
**Azione**:
1. Implementare processor per salvare status
2. Pulire retained messages vecchi dal broker

---

## 🎯 Piano Implementazione

### Priority 1: Fix Formato Esistente (Formato 2)

**File**: `backend/mqtt/services/message_processor.py`

**Problema**: Linea 1142
```python
# Attuale - cerca array
sensors_data = data.get('sensors_last_data', []) or data.get('sensors', [])

# Problema: se sensors_last_data è OGGETTO, non funziona!
```

**Fix**:
```python
def _process_new_datalogger_heartbeat(self, ...):
    # ...

    # GESTIONE SENSORS_LAST_DATA - Supporto sia array che oggetto
    sensors_data_raw = data.get('sensors_last_data', []) or data.get('sensors_data', [])

    # Se è oggetto (chiave-valore), converti in array
    if isinstance(sensors_data_raw, dict):
        sensors_data = []
        for sensor_id, sensor_info in sensors_data_raw.items():
            # Crea oggetto sensor standard
            sensor_obj = {
                'serial_number': sensor_id,
                'value': sensor_info.get('value'),
                'unit': sensor_info.get('unit'),
                'timestamp': data.get('timestamp')
            }
            sensors_data.append(sensor_obj)
    else:
        sensors_data = sensors_data_raw

    # Processa array normalizzato
    for sensor_data in sensors_data:
        if isinstance(sensor_data, dict):
            success = self._process_sensor_data(datalogger, sensor_data)
```

**Test**: Con payload Formato 2 dovrebbe creare:
- ✅ Gateway (se non esiste)
- ✅ Datalogger `MONSTRO-TEST-001`
- ✅ Sensor `temp_sensor_1`
- ✅ Sensor `humidity_sensor_1`

---

### Priority 2: Nuovo Formato Aggregato (Formato 4)

**File**: `backend/mqtt/services/message_processor.py`

Creare nuovo metodo:
```python
def _process_datalogger_status_aggregated(self, site_id: int, topic: str, data: Dict[str, Any], topic_info: Dict[str, Any]) -> bool:
    """
    Processa formato aggregato datalogger status.
    Topic: [sito]/gateway/[n]/datalogger/all/status

    Payload:
    {
      "serial_number": "site_001-gateway_1-all_1",
      "dataloggers": [
        {
          "serial_number": "all_1",
          "status": "stopped",
          "sensors_data": []
        }
      ]
    }
    """
    try:
        timestamp = timezone.now()

        # Parse timestamp se presente
        if 'timestamp' in data:
            timestamp = self._parse_mqtt_timestamp(data['timestamp'])

        # Recupera il sito
        from sites.models import Site
        site = Site.objects.get(id=site_id)

        # Trova o crea gateway
        gateway_serial_number = f"{topic_info['site_code']}-gateway_{topic_info['gateway_number']}"
        gateway, _ = Gateway.objects.get_or_create(
            serial_number=gateway_serial_number,
            defaults={
                'site': site,
                'label': f"Gateway {topic_info['gateway_number']}",
                'is_online': True
            }
        )

        # Processa array dataloggers
        dataloggers_list = data.get('dataloggers', [])
        for dl_data in dataloggers_list:
            serial_number = dl_data.get('serial_number')
            status = dl_data.get('status', 'unknown')

            # Crea o aggiorna datalogger
            datalogger, created = Datalogger.objects.get_or_create(
                serial_number=serial_number,
                defaults={
                    'site': site,
                    'gateway': gateway,
                    'label': serial_number,
                    'datalogger_type': 'all',  # o topic_info['datalogger_type']
                    'is_online': status in ['running', 'online'],
                    'last_seen_at': timestamp
                }
            )

            if not created:
                datalogger.is_online = status in ['running', 'online']
                datalogger.last_seen_at = timestamp
                datalogger.save()

            # Processa sensors_data se presente
            sensors_data = dl_data.get('sensors_data', [])
            for sensor_data in sensors_data:
                self._process_sensor_data(datalogger, sensor_data)

        return True

    except Exception as e:
        logger.error(f"Error processing aggregated datalogger status: {e}")
        return False
```

**Integrare in `_parse_topic_structure`**:
```python
def _parse_topic_structure(self, topic: str) -> Dict[str, Any]:
    # ...

    # Caso datalogger/all/status (nuovo formato)
    if len(parts) == 6 and parts[3] == 'datalogger' and parts[5] == 'status':
        datalogger_type = parts[4]  # 'all'
        return {
            'type': 'datalogger_status_aggregated',
            'site_code': site_code,
            'gateway_number': gateway_number,
            'datalogger_type': datalogger_type,
            'function': 'status'
        }
```

**Integrare in `_process_versioned_message`**:
```python
def _process_versioned_message(self, site_id: int, topic: str, payload_data: dict, version_info: dict) -> bool:
    # ...

    elif topic_info['type'] == 'datalogger_status_aggregated':
        processed = self._process_datalogger_status_aggregated(site_id, topic, payload_data, topic_info)
```

---

### Priority 3: Backend Status (Formato 1)

**File**: `backend/mqtt/services/message_processor.py`

```python
def _process_backend_status(self, site_id: int, topic: str, data: Dict[str, Any]) -> bool:
    """
    Processa status del backend MQTT.
    Topic: [sito]/backend/status

    Payload:
    {
      "status": "online",
      "client_id": "site_88_bkode",
      "timestamp": "2025-11-20T13:59:15.317226Z",
      "instance_id": "bkode"
    }
    """
    try:
        status = data.get('status', 'unknown')
        timestamp_str = data.get('timestamp')

        # Aggiorna MqttConnection con status backend
        mqtt_conn = MqttConnection.objects.get(site_id=site_id)

        # Solo se status è diverso dall'attuale
        if mqtt_conn.status != status:
            mqtt_conn.status = status
            mqtt_conn.last_heartbeat_at = timezone.now()
            mqtt_conn.save(update_fields=['status', 'last_heartbeat_at'])
            logger.info(f"Backend status updated for site {site_id}: {status}")

        return True

    except MqttConnection.DoesNotExist:
        logger.warning(f"No MqttConnection for site {site_id}")
        return False
    except Exception as e:
        logger.error(f"Error processing backend status: {e}")
        return False
```

**Integrare in topic parser**:
```python
# In _parse_topic_structure
if len(parts) == 3 and parts[1] == 'backend' and parts[2] == 'status':
    return {
        'type': 'backend_status',
        'site_code': site_code
    }

# In _process_versioned_message
elif topic_info['type'] == 'backend_status':
    processed = self._process_backend_status(site_id, topic, payload_data)
```

---

### Priority 4: Connection Status (Formato 5)

**File**: `backend/mqtt/services/message_processor.py`

```python
def _process_connection_status(self, site_id: int, topic: str, data: Dict[str, Any]) -> bool:
    """
    Processa connection status dal device.
    Topic: [sito]/connection/status

    Payload:
    {
      "status": "disconnected",
      "reason": "unexpected",
      "timestamp": "2025-11-04T08:51:53.304298",
      "client_id": "...",
      "site_id": 6,
      "site_name": "..."
    }
    """
    try:
        status = data.get('status', 'unknown')
        reason = data.get('reason', '')
        timestamp_str = data.get('timestamp')

        # Log per debugging retained messages vecchi
        timestamp = self._parse_mqtt_timestamp(timestamp_str) if timestamp_str else timezone.now()
        age_hours = (timezone.now() - timestamp).total_seconds() / 3600

        if age_hours > 24:
            logger.warning(f"Old retained connection status detected (age: {age_hours:.1f}h) - ignoring")
            return True

        # Aggiorna MqttConnection
        mqtt_conn = MqttConnection.objects.get(site_id=site_id)

        if status == 'disconnected' and mqtt_conn.status != 'error':
            mqtt_conn.status = 'error'
            mqtt_conn.error_message = f"Device disconnected: {reason}"
            mqtt_conn.save(update_fields=['status', 'error_message'])
            logger.warning(f"Device connection lost for site {site_id}: {reason}")

        return True

    except MqttConnection.DoesNotExist:
        logger.warning(f"No MqttConnection for site {site_id}")
        return False
    except Exception as e:
        logger.error(f"Error processing connection status: {e}")
        return False
```

---

### Priority 5: Pulizia Retained Messages

**Script**: `backend/mqtt/management/commands/clean_retained_messages.py`

```python
from django.core.management.base import BaseCommand
from mqtt.services.mqtt_service import mqtt_service

class Command(BaseCommand):
    help = 'Clean old retained MQTT messages'

    def handle(self, *args, **options):
        # Per cancellare retained message: pubblica payload vuoto con retained=True
        topics_to_clean = [
            'site_001/connection/status',
            'site_006/connection/status',
            # Aggiungi altri topic da pulire
        ]

        for topic in topics_to_clean:
            # Extract site_id from topic
            site_id = self._extract_site_id(topic)

            if site_id:
                result = mqtt_service.publish_message(
                    site_id=site_id,
                    topic=topic,
                    message='',  # Empty payload
                    qos=1,
                    retain=True  # Sovrascrivi retained message
                )

                self.stdout.write(f"Cleaned retained message: {topic}")
```

**Uso**:
```bash
podman exec bfg_backend python manage.py clean_retained_messages
```

---

## 🔄 Topic Pattern Atteso vs Ricevuto

| Documentato | Ricevuto | Match? | Azione |
|-------------|----------|--------|--------|
| `[sito]/gateway/[n]/heartbeat` | ❌ | ❌ | Non ricevuto |
| `[sito]/gateway/[n]/datalogger/[tipo]/[n]/heartbeat` | ✅ `site_006/gateway/1/datalogger/monstro/1/heartbeat` | ⚠️ | Payload diverso (oggetto vs array) |
| `[sito]/gateway/[n]/datalogger/[tipo]/[n]/output` | ✅ `site_006/gateway/1/datalogger/monstro_test/1/output` | ❌ | Non documentato |
| `[sito]/gateway/[n]/datalogger/all/status` | ❌ (futuro) | ❌ | Non implementato |
| `[sito]/backend/status` | ✅ `site_88/backend/status` | ❌ | Non documentato |
| `[sito]/connection/status` | ❌ (futuro) | ❌ | Non implementato |

---

## ✅ Checklist Implementazione

### Fix Immediati
- [ ] Modificare `_process_sensor_data` per gestire oggetto sensors_last_data (Formato 2)
- [ ] Testare con payload esistente `site_006/.../monstro/1/heartbeat`
- [ ] Verificare creazione Datalogger + Sensor in DB

### Nuovi Processori
- [ ] Implementare `_process_backend_status` (Formato 1)
- [ ] Implementare `_process_datalogger_status_aggregated` (Formato 4)
- [ ] Implementare `_process_connection_status` (Formato 5)
- [ ] Integrare in topic parser e versioned processor

### Pulizia
- [ ] Creare management command `clean_retained_messages`
- [ ] Eseguire pulizia topic vecchi
- [ ] Verificare nessun retained message obsoleto

### Testing
- [ ] Test Formato 1: backend/status → aggiorna MqttConnection
- [ ] Test Formato 2: datalogger heartbeat → crea Datalogger + Sensor
- [ ] Test Formato 4: datalogger/all/status → crea multipli Datalogger
- [ ] Test Formato 5: connection/status → aggiorna status error

---

## 📝 Note Implementative

### Gestione Oggetto vs Array

```python
# Pattern riutilizzabile per gestire sia array che oggetto
def normalize_sensors_data(data):
    """Converte sensors_last_data da qualsiasi formato a array standard"""
    sensors_raw = data.get('sensors_last_data') or data.get('sensors_data', [])

    if isinstance(sensors_raw, dict):
        # Formato oggetto: {"sensor_id": {"value": ..., "unit": ...}}
        result = []
        for sensor_id, sensor_info in sensors_raw.items():
            result.append({
                'serial_number': sensor_id,
                'value': sensor_info.get('value'),
                'unit': sensor_info.get('unit'),
                'timestamp': data.get('timestamp')
            })
        return result
    elif isinstance(sensors_raw, list):
        # Formato array: già ok
        return sensors_raw
    else:
        return []
```

### Versioning Compatibility

Tutti i processori devono:
1. Supportare `mqtt_api_version` dal payload
2. Salvare versione in campo `mqtt_api_version` del model
3. Usare `message_interval_seconds` per offline detection dinamico

---

## 🚀 Ordine Implementazione Consigliato

1. **Fix Formato 2** (15 min) - Abilita payload esistenti
2. **Test Formato 2** (10 min) - Verifica funzionamento
3. **Formato 1: backend/status** (20 min) - Monitoring connessione
4. **Formato 4: all/status** (30 min) - Futuro formato aggregato
5. **Formato 5: connection/status** (20 min) - Device connection monitoring
6. **Pulizia retained** (15 min) - Cleanup broker
7. **Test completo** (30 min) - Verifica tutti i formati

**Tempo totale stimato**: ~2.5 ore

---

**Prossimo Step**: Implementare fix Formato 2 per sbloccare creazione datalogger dal database esistente! 🚀
