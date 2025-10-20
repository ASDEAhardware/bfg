# MQTT Heartbeat & Discovery Development Plan

## OVERVIEW
Implementazione sistema MQTT con:
1. Connessioni permanenti (no disconnessione su heartbeat timeout)
2. Device discovery automatico da topic pattern
3. Offline detection dopo 30 secondi senza heartbeat

## TOPIC STRUCTURE
```
sito_001/datalogger/{tipo}/{id}/input
sito_001/datalogger/{tipo}/{id}/output
sito_001/datalogger/{tipo}/{id}/heartbeat

sito_001/gateway/{id}/input
sito_001/gateway/{id}/output
sito_001/gateway/{id}/heartbeat
```

## DATABASE LOGIC
- **Key Discriminant:** `serial_number` dal payload heartbeat
- **Discovery:** Primo heartbeat con serial nuovo → CREATE record
- **Updates:** Heartbeat con serial esistente → UPDATE (online + timestamp)
- **Offline:** 30 secondi senza heartbeat → `is_online=False` (mantieni record)

---

## FASE 1: FIX HEARTBEAT TIMEOUT LOGIC

### Obiettivo
Rimuovere disconnessione automatica MQTT, mantenere connessioni sempre attive

### File da modificare:
- `/backend/mqtt/services/mqtt_manager.py`

### Modifiche necessarie:
1. **Rimuovere logica disconnessione heartbeat timeout:**
   - Linee 224-237 in `health_check()` method
   - Rimuovere `conn.status = 'error'` e `conn.error_message = 'Heartbeat timeout'`

2. **Aggiornare health_check per device offline:**
   ```python
   def health_check(self):
       """Controlla salute connessioni e device offline"""
       try:
           # Mantieni solo logica riconnessione connessioni mancanti
           # RIMUOVI: Heartbeat timeout che marca connessione come error

           # AGGIUNGI: Device offline detection (30 sec)
           timeout_threshold = timezone.now() - timezone.timedelta(seconds=30)

           # Marca dataloggers offline
           offline_dataloggers = Datalogger.objects.filter(
               is_online=True,
               last_seen_at__lt=timeout_threshold
           )
           offline_dataloggers.update(is_online=False)

           # Marca gateways offline
           offline_gateways = Gateway.objects.filter(
               is_online=True,
               last_heartbeat__lt=timeout_threshold
           )
           offline_gateways.update(is_online=False)

       except Exception as e:
           logger.error(f"Error during health check: {e}")
   ```

3. **Aggiornare intervallo health_check:**
   - Cambiare da 30 secondi a 15 secondi per detection più rapida
   - In `start_health_check()` method

### Test Fase 1:
- Connessione MQTT rimane attiva anche senza heartbeat
- Device vengono marcati offline dopo 30 secondi
- Connessione non va mai in stato "error" per heartbeat timeout

---

## FASE 2: ENHANCED TOPIC PARSING

### Obiettivo
Parsing completo di tutti i topic per discovery automatico

### File da modificare:
- `/backend/mqtt/services/autodiscovery.py` (aggiornare o sostituire)

### Nuova implementazione:
```python
class EnhancedMqttAutoDiscovery:
    def __init__(self):
        self.logger = logging.getLogger(__name__)

    def process_mqtt_message(self, site, topic, payload):
        """Process ogni messaggio MQTT per discovery e updates"""
        try:
            # Parse topic structure
            topic_parts = topic.split('/')

            if len(topic_parts) < 3:
                return  # Topic malformato

            site_code, device_category = topic_parts[0], topic_parts[1]

            # Verifica che corrisponda al site
            if site_code != site.code:
                return

            if device_category == 'datalogger':
                self._process_datalogger_topic(site, topic_parts, payload)
            elif device_category == 'gateway':
                self._process_gateway_topic(site, topic_parts, payload)

        except Exception as e:
            self.logger.error(f"Error processing MQTT message: {e}")

    def _process_datalogger_topic(self, site, topic_parts, payload):
        """Process datalogger topics: sito_001/datalogger/tipo/id/action"""
        if len(topic_parts) != 5:
            return

        _, _, datalogger_type, device_id, action = topic_parts

        # Estrai serial dal payload
        serial_number = payload.get('serial_number')
        if not serial_number:
            return

        if action == 'heartbeat':
            self._update_or_create_datalogger(site, datalogger_type, device_id, serial_number, payload)
        elif action in ['input', 'output']:
            self._process_datalogger_data(site, serial_number, action, payload)

    def _process_gateway_topic(self, site, topic_parts, payload):
        """Process gateway topics: sito_001/gateway/id/action"""
        if len(topic_parts) != 4:
            return

        _, _, gateway_id, action = topic_parts

        # Estrai serial dal payload
        serial_number = payload.get('serial_number')
        if not serial_number:
            return

        if action == 'heartbeat':
            self._update_or_create_gateway(site, gateway_id, serial_number, payload)
        elif action in ['input', 'output']:
            self._process_gateway_data(site, serial_number, action, payload)

    @transaction.atomic
    def _update_or_create_datalogger(self, site, datalogger_type, device_id, serial_number, payload):
        """Create o update datalogger basato su serial_number"""
        try:
            datalogger, created = Datalogger.objects.get_or_create(
                serial_number=serial_number,
                defaults={
                    'site': site,
                    'datalogger_type': datalogger_type,
                    'device_id': device_id,
                    'label': f"{datalogger_type}/{device_id}",
                    'is_online': True,
                    'last_seen_at': timezone.now(),
                }
            )

            if not created:
                # Update existing
                datalogger.is_online = True
                datalogger.last_seen_at = timezone.now()
                datalogger.datalogger_type = datalogger_type
                datalogger.device_id = device_id
                datalogger.save()

            self.logger.info(f"{'Created' if created else 'Updated'} datalogger {serial_number}")

        except Exception as e:
            self.logger.error(f"Error updating datalogger {serial_number}: {e}")

    @transaction.atomic
    def _update_or_create_gateway(self, site, gateway_id, serial_number, payload):
        """Create o update gateway basato su serial_number"""
        try:
            gateway, created = Gateway.objects.get_or_create(
                serial_number=serial_number,
                defaults={
                    'site': site,
                    'label': f"Gateway {gateway_id}",
                    'is_online': True,
                    'last_heartbeat': timezone.now(),
                    'last_communication': timezone.now(),
                }
            )

            if not created:
                # Update existing
                gateway.is_online = True
                gateway.last_heartbeat = timezone.now()
                gateway.last_communication = timezone.now()
                gateway.save()

            self.logger.info(f"{'Created' if created else 'Updated'} gateway {serial_number}")

        except Exception as e:
            self.logger.error(f"Error updating gateway {serial_number}: {e}")

    def _process_datalogger_data(self, site, serial_number, action, payload):
        """Process input/output data per datalogger"""
        # TODO: Implementare processing dati input/output
        pass

    def _process_gateway_data(self, site, serial_number, action, payload):
        """Process input/output data per gateway"""
        # TODO: Implementare processing dati input/output
        pass

# Singleton instance
enhanced_auto_discovery = EnhancedMqttAutoDiscovery()
```

### Test Fase 2:
- Parsing topic corretti per datalogger e gateway
- Create automatico device al primo heartbeat
- Update record esistenti su heartbeat successivi

---

## FASE 3: DATABASE MODEL UPDATES

### Obiettivo
Aggiornare modelli per supportare nuova logica

### File da modificare:
- `/backend/mqtt/models.py`

### Modifiche necessarie:

1. **Datalogger model:**
```python
class Datalogger(models.Model):
    # Existing fields...
    device_id = models.CharField(max_length=50, blank=True)  # "1", "2", etc.
    datalogger_type = models.CharField(max_length=50, blank=True)  # "monstro", "adaq"

    # Aggiorna __str__ method
    def __str__(self):
        return f"{self.datalogger_type}/{self.device_id} ({self.serial_number})" if self.datalogger_type else self.serial_number
```

2. **Gateway model:** (probabilmente già ok, verifica)

### Test Fase 3:
- Nuovi campi salvati correttamente
- Display corretto in admin Django

---

## FASE 4: INTEGRATION & TESTING

### Obiettivo
Integrare tutto nel sistema esistente

### File da modificare:
- `/backend/mqtt/services/mqtt_manager.py` (update import)

### Modifiche:
1. **Update import autodiscovery:**
```python
# Sostituisci
from .autodiscovery import auto_discovery_service
# Con
from .autodiscovery import enhanced_auto_discovery
```

2. **Update process message:**
```python
# In _on_message method
enhanced_auto_discovery.process_mqtt_message(site, topic, payload_dict)
```

### Test Fase 4:
- Sistema completo funzionante
- Device discovery automatico
- Heartbeat timeout corretto (30 sec offline, no disconnessione)

---

## FASE 5: FRONTEND INTEGRATION

### Obiettivo
Aggiornare frontend per nuova logica

### File da modificare:
- `/frontend/src/hooks/useMqttStatus.ts`
- `/frontend/src/plugins/datalogger/DataLoggerPage.tsx`

### Modifiche:
1. **Update status badge logic** per non mostrare "error" su heartbeat timeout
2. **Aggiungere indicatori device offline** nel UI
3. **Test pulsanti MQTT control** funzionanti

---

## COMANDI TEST RAPIDI

### Test Connessione MQTT:
```bash
podman exec bfg_backend python manage.py shell -c "
from mqtt.services.mqtt_manager import MqttClientManager
manager = MqttClientManager.get_instance()
print(f'Client attivi: {len(manager.clients)}')
"
```

### Test Device Offline:
```bash
podman exec bfg_backend python manage.py shell -c "
from mqtt.models import Datalogger, Gateway
print('Dataloggers offline:', Datalogger.objects.filter(is_online=False).count())
print('Gateways offline:', Gateway.objects.filter(is_online=False).count())
"
```

### Simulate Discovery:
```bash
podman exec bfg_backend python manage.py shell -c "
from mqtt.services.autodiscovery import enhanced_auto_discovery
from sites.models import Site
site = Site.objects.first()
payload = {'serial_number': 'TEST123', 'timestamp': '2025-10-17T10:00:00Z'}
enhanced_auto_discovery.process_mqtt_message(site, 'sito_001/datalogger/monstro/1/heartbeat', payload)
"
```

---

## NOTE SVILUPPO

### Backup Files:
- Crea backup di `mqtt_manager.py` e `autodiscovery.py` prima delle modifiche
- Test ogni fase prima di procedere alla successiva

### Logging:
- Aggiungi logging dettagliato per debugging
- Monitor console per errori discovery

### Performance:
- Discovery su ogni messaggio: considera caching se troppo pesante
- Health check ogni 15 secondi: monitor performance

### Future Enhancements:
- Sensor discovery da datalogger data
- Metrics collection input/output
- Advanced device management UI

---

**COMANDO RIPRESA LAVORO:**
```
"Prosegui dalla fase N" dove N = 1,2,3,4,5
```