# Refactoring MQTT Models - Piano di Sviluppo

## Obiettivo
Eliminare i modelli `Datalogger` e `Sensor` da site management e implementare auto-discovery tramite MQTT con modelli dedicati nell'app mqtt.

## Architettura Target

### Pattern Messaggi MQTT
```
sito_001/datalogger/monstro/1/input
sito_001/datalogger/monstro/1/output
sito_001/datalogger/monstro/1/heartbeat

sito_001/datalogger/adaq/1/input
sito_001/datalogger/adaq/2/input
sito_001/datalogger/adaq/3/input

sito_001/system/input
sito_001/system/output
sito_001/system/heartbeat
```

### Nuovi Modelli MQTT

#### 1. MqttDatalogger
```python
class MqttDatalogger(models.Model):
    site = models.ForeignKey('sites.Site', on_delete=models.CASCADE)
    serial_number = models.CharField(max_length=100, unique=True)  # Identificativo univoco
    label = models.CharField(max_length=255)  # Nome utente-modificabile, default=serial_number
    datalogger_type = models.CharField(max_length=50)  # monstro, adaq, etc.
    instance_number = models.PositiveIntegerField()  # 1, 2, 3, etc.

    # Status e comunicazione
    status = models.CharField(max_length=20, choices=DataloggerStatus.choices, default='disconnected')
    last_heartbeat = models.DateTimeField(null=True, blank=True)
    last_communication = models.DateTimeField(null=True, blank=True)
    is_online = models.BooleanField(default=False)

    # Metadata auto-discovery
    firmware_version = models.CharField(max_length=50, blank=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('site', 'serial_number')
        unique_together = ('site', 'datalogger_type', 'instance_number')  # evita duplicati
```

#### 2. MqttSensor (evoluzione di SensorDevice)
```python
class MqttSensor(models.Model):
    datalogger = models.ForeignKey(MqttDatalogger, on_delete=models.CASCADE)
    serial_number = models.CharField(max_length=100)  # Serial del sensore fisico
    label = models.CharField(max_length=255)  # Nome utente-modificabile, default=serial_number

    # Configurazione sensore
    sensor_type = models.CharField(max_length=50, blank=True)  # accelerometer, strain_gauge, etc.
    channel = models.PositiveSmallIntegerField(null=True, blank=True)
    unit_of_measure = models.CharField(max_length=50, blank=True)

    # Status e comunicazione
    status = models.CharField(max_length=20, choices=SensorStatus.choices, default='unknown')
    last_reading = models.DateTimeField(null=True, blank=True)
    is_online = models.BooleanField(default=False)

    # Metadata dal payload MQTT
    raw_metadata = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('datalogger', 'serial_number')
```

### Auto-Discovery Logic

#### 1. Topic Subscription
Ogni sito si abbona a `{site_code}/#` per ricevere tutti i messaggi.

#### 2. Message Processing
```python
def process_mqtt_message(site, topic, payload):
    """
    Processa messaggi MQTT per auto-discovery

    Topic format: sito_001/datalogger/monstro/1/heartbeat
    """
    parts = topic.split('/')
    if len(parts) >= 5 and parts[1] == 'datalogger':
        datalogger_type = parts[2]  # monstro, adaq
        instance_number = int(parts[3])
        message_type = parts[4]  # input, output, heartbeat

        # Auto-create/update datalogger
        datalogger = auto_discover_datalogger(
            site, datalogger_type, instance_number, payload
        )

        # Process sensors from payload
        if 'sensors' in payload:
            auto_discover_sensors(datalogger, payload['sensors'])
```

#### 3. Auto-Discovery Functions
```python
def auto_discover_datalogger(site, datalogger_type, instance_number, payload):
    """Auto-create or update datalogger from MQTT message"""
    serial_number = payload.get('serial_number', f"{datalogger_type}_{instance_number}")

    datalogger, created = MqttDatalogger.objects.get_or_create(
        site=site,
        serial_number=serial_number,
        defaults={
            'label': serial_number,  # Default label = serial
            'datalogger_type': datalogger_type,
            'instance_number': instance_number,
        }
    )

    # Update status and metadata
    datalogger.last_communication = timezone.now()
    datalogger.is_online = True
    datalogger.status = 'connected'
    if 'firmware_version' in payload:
        datalogger.firmware_version = payload['firmware_version']

    datalogger.save()
    return datalogger

def auto_discover_sensors(datalogger, sensors_data):
    """Auto-create or update sensors from MQTT payload"""
    for sensor_data in sensors_data:
        serial_number = sensor_data.get('serial_number')
        if not serial_number:
            continue

        sensor, created = MqttSensor.objects.get_or_create(
            datalogger=datalogger,
            serial_number=serial_number,
            defaults={
                'label': serial_number,  # Default label = serial
                'sensor_type': sensor_data.get('type', ''),
                'channel': sensor_data.get('channel'),
            }
        )

        # Update status and metadata
        sensor.last_reading = timezone.now()
        sensor.is_online = True
        sensor.status = 'active'
        sensor.raw_metadata = sensor_data
        sensor.save()
```

## Fasi di Sviluppo

### Fase 1: Creazione Nuovi Modelli MQTT
- [ ] Creare `MqttDatalogger` model in `mqtt/models.py`
- [ ] Estendere/modificare `SensorDevice` → `MqttSensor`
- [ ] Creare migrations
- [ ] Testare modelli con dati di esempio

### Fase 2: Implementazione Auto-Discovery
- [ ] Creare funzioni auto-discovery per datalogger
- [ ] Creare funzioni auto-discovery per sensori
- [ ] Integrare nel sistema MQTT esistente
- [ ] Testare con messaggi MQTT simulati

### Fase 3: Nuove API Endpoints
- [ ] Creare API `/v1/mqtt/dataloggers/` che sostituisce `/v1/sites/dataloggers/`
- [ ] Creare API `/v1/mqtt/sensors/by-datalogger/` che sostituisce l'equivalente sites
- [ ] Mantenere interfacce identiche per compatibilità frontend
- [ ] Aggiungere endpoint per gestione label utente

### Fase 4: Migrazione Frontend
- [ ] Aggiornare chiamate API nel frontend
- [ ] Aggiungere funzionalità edit label per datalogger/sensori
- [ ] Testare interfaccia con nuovi modelli
- [ ] Verificare che tutti i controlli MQTT funzionino

### Fase 5: Migrazione Dati e Cleanup
- [ ] Script di migrazione dati da old models → new models
- [ ] Backup dati esistenti
- [ ] Rimozione modelli deprecati da sites
- [ ] Cleanup API endpoints deprecati
- [ ] Aggiornamento documentazione

### Fase 6: Testing e Ottimizzazione
- [ ] Test completi auto-discovery
- [ ] Test performance con molti datalogger/sensori
- [ ] Test gestione disconnessioni/reconnessioni
- [ ] Monitoring e logging

## Domande e Chiarimenti Necessari

### 1. Struttura Serial Numbers
- Come viene passato il serial number nei messaggi MQTT?
- È nel payload JSON o derivato dal topic?
- Formato specifico per serial numbers?

### 2. Gestione Messaggi
- I messaggi heartbeat contengono info datalogger e sensori insieme?
- Messaggi input/output contengono dati sensori o comandi?
- Frequenza dei messaggi heartbeat?

### 3. Backward Compatibility
- Mantenere dati esistenti durante migrazione?
- Periodo di overlap tra vecchio/nuovo sistema?
- Strategia rollback se necessario?

### 4. User Experience
- Dove posizionare UI per edit label?
- Gestione datalogger "fantasma" (non più attivi)?
- Notifiche per nuovi dispositivi auto-scoperti?

### 5. Business Logic
- Timeout per marcare dispositivi offline?
- Gestione conflitti serial numbers duplicati?
- Politiche di ritenzione dati storici?

## Note Tecniche

### Compatibilità API
Mantenere stesse interfacce TypeScript nel frontend:
```typescript
interface Datalogger {
  id: string;
  name: string;  // Ora mappato su 'label'
  serial_number: string;
  model: string;  // Ora mappato su 'datalogger_type'
  // ... resto invariato
}
```

### Migration Strategy
1. Deploy nuovi modelli senza rimuovere vecchi
2. Parallel running per testing
3. Gradual cutover per sito
4. Final cleanup after verification

### Performance Considerations
- Indexing su serial_number e site per query veloci
- Batch processing per auto-discovery multipli
- Caching per status online/offline
- Pagination per siti con molti dispositivi