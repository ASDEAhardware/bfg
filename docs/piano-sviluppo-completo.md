# Piano di Sviluppo Completo - Refactoring MQTT Auto-Discovery

## Analisi Situazione Attuale

### Architettura Esistente
**Sites App:**
- ✅ `Site` - Manteniamo (ha già il campo `code` per MQTT)
- ✅ `UserSiteAccess` - Manteniamo
- ❌ `Datalogger` - DA ELIMINARE (98 righe di codice da rimuovere)
- ❌ `Sensor` - DA ELIMINARE (218 righe di codice da rimuovere)

**MQTT App:**
- ✅ `MqttConnection` - Manteniamo (già corretto per multi-connessione)
- ✅ `MqttTopic` - Manteniamo
- 🔄 `SensorDevice` - DA RINOMINARE in `Sensor` + estendere
- 🔄 `SensorData` - DA INTEGRARE dentro nuovo `Sensor`
- 🔄 `SystemInfo` - DA RINOMINARE in `Gateway`

### Nuova Struttura Target

#### MQTT (Connection Management)
- `Connection` ✅ (già esistente come MqttConnection)
- `Topic` ✅ (già esistente come MqttTopic)

#### SITE MANAGEMENT (Business Logic)
- `Site` ✅ (già corretto)
- `UserSiteAccess` ✅ (già corretto)

#### MONITORING SYSTEM (Device Topology Auto-Discovery)
- `Gateway` (da SystemInfo, gestisce info sistema generale del sito)
- `Datalogger` (nuovo, auto-discovery da MQTT heartbeat)
- `Sensor` (da SensorDevice, con dati integrati per near real-time)

## Pattern Messaggi MQTT Gestiti

```text
sito_001/datalogger/monstro/1/input
sito_001/datalogger/monstro/2/input
sito_001/datalogger/monstro/3/input
sito_001/datalogger/monstro/1/output
sito_001/datalogger/monstro/2/output
sito_001/datalogger/monstro/3/output
sito_001/datalogger/monstro/1/heartbeat
sito_001/datalogger/monstro/2/heartbeat
sito_001/datalogger/monstro/3/heartbeat

sito_001/datalogger/adaq/1/input
sito_001/datalogger/adaq/2/input
sito_001/datalogger/adaq/3/input
sito_001/datalogger/adaq/1/output
sito_001/datalogger/adaq/2/output
sito_001/datalogger/adaq/3/output
sito_001/datalogger/adaq/1/heartbeat
sito_001/datalogger/adaq/2/heartbeat
sito_001/datalogger/adaq/3/heartbeat

sito_001/gateway/input
sito_001/gateway/output
sito_001/gateway/heartbeat
```

### Esempio Payload Heartbeat
```json
{
  "heart_beat": "sito_001",
  "sensors_last_data": [
    {
      "device_name": "MNA00542",
      "ts": "2025-10-14 13:57:16.288000",
      "last_acc00": 0.001188,
      "last_acc01": -0.005231,
      "last_acc02": 1.010827,
      "last_incli_x": -0.314565,
      "last_incli_y": -0.14058
    },
    {
      "device_name": "MOM00002",
      "ts": "2025-10-14 13:57:16.375000",
      "last_acc00": -0.00272,
      "last_acc01": -0.001974,
      "last_acc02": 0.995306,
      "last_incli_x": -0.0911767,
      "last_incli_y": 0.149944,
      "last_mag_x": -0.912792,
      "last_mag_y": 0.34894,
      "last_mag_z": -1.99874,
      "last_gyro_x": 0.30625,
      "last_gyro_y": 0.4025,
      "last_gyro_z": -0.65625
    }
  ]
}
```

## Architettura Target Dettagliata

### 1. Gateway Model (da SystemInfo)
```python
class Gateway(models.Model):
    """Informazioni sistema generale del sito (era SystemInfo)"""
    site = models.OneToOneField('sites.Site', on_delete=models.CASCADE)
    serial_number = models.CharField(max_length=100, unique=True)
    label = models.CharField(max_length=255)  # Default = serial_number

    # System info
    hostname = models.CharField(max_length=255, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    firmware_version = models.CharField(max_length=50, blank=True)

    # Status tracking
    is_online = models.BooleanField(default=False)
    last_heartbeat = models.DateTimeField(null=True, blank=True)
    last_communication = models.DateTimeField(null=True, blank=True)

    # Performance metrics
    cpu_usage_percent = models.FloatField(null=True, blank=True)
    memory_usage_percent = models.FloatField(null=True, blank=True)
    uptime_seconds = models.BigIntegerField(null=True, blank=True)

    # Raw MQTT payload for debugging
    raw_metadata = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

### 2. Datalogger Model (nuovo)
```python
class Datalogger(models.Model):
    """Datalogger auto-discovered via MQTT"""
    site = models.ForeignKey('sites.Site', on_delete=models.CASCADE)
    serial_number = models.CharField(max_length=100)  # Dal payload heartbeat
    label = models.CharField(max_length=255)  # Default = serial_number, editabile utente

    # Auto-discovery info dal topic
    datalogger_type = models.CharField(max_length=50)  # monstro, adaq
    instance_number = models.PositiveIntegerField()  # 1, 2, 3

    # Status e comunicazione
    is_online = models.BooleanField(default=False)
    last_heartbeat = models.DateTimeField(null=True, blank=True)
    last_communication = models.DateTimeField(null=True, blank=True)

    # Metadata dal payload
    firmware_version = models.CharField(max_length=50, blank=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    raw_metadata = models.JSONField(default=dict, blank=True)

    # Statistiche per benchmark continuità servizio
    total_heartbeats = models.IntegerField(default=0)
    missed_heartbeats = models.IntegerField(default=0)
    uptime_percentage = models.FloatField(default=100.0)
    last_downtime_start = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('site', 'serial_number')
        indexes = [
            models.Index(fields=['site', 'datalogger_type', 'instance_number']),
            models.Index(fields=['serial_number']),
            models.Index(fields=['is_online']),
        ]
```

### 3. Sensor Model (da SensorDevice + integra SensorData)
```python
class Sensor(models.Model):
    """Sensori auto-discovered con dati near real-time integrati"""
    datalogger = models.ForeignKey(Datalogger, on_delete=models.CASCADE)
    serial_number = models.CharField(max_length=100)  # device_name nel payload
    label = models.CharField(max_length=255)  # Default = serial_number, editabile

    # Metadata sensore
    sensor_type = models.CharField(max_length=50, blank=True)
    unit_of_measure = models.CharField(max_length=50, blank=True)

    # Status tracking
    is_online = models.BooleanField(default=False)
    last_reading = models.DateTimeField(null=True, blank=True)

    # === DATI NEAR REAL-TIME (ultimi 3 valori) ===
    # Ultimo dato (più recente)
    last_timestamp_1 = models.DateTimeField(null=True, blank=True)
    last_data_1 = models.JSONField(default=dict, blank=True)

    # Penultimo dato
    last_timestamp_2 = models.DateTimeField(null=True, blank=True)
    last_data_2 = models.JSONField(default=dict, blank=True)

    # Terzultimo dato
    last_timestamp_3 = models.DateTimeField(null=True, blank=True)
    last_data_3 = models.JSONField(default=dict, blank=True)

    # === STATISTICHE AGGREGATE ===
    # Contatori
    total_messages = models.IntegerField(default=0)
    total_readings = models.IntegerField(default=0)

    # Valori min/max da sempre registrati
    min_value_ever = models.FloatField(null=True, blank=True)
    max_value_ever = models.FloatField(null=True, blank=True)
    min_recorded_at = models.DateTimeField(null=True, blank=True)
    max_recorded_at = models.DateTimeField(null=True, blank=True)

    # Periodo di attività
    first_seen_at = models.DateTimeField(null=True, blank=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)

    # Benchmark qualità comunicazione
    uptime_percentage = models.FloatField(default=100.0)
    consecutive_misses = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('datalogger', 'serial_number')
        indexes = [
            models.Index(fields=['datalogger', 'is_online']),
            models.Index(fields=['serial_number']),
            models.Index(fields=['last_reading']),
        ]

    def add_new_reading(self, timestamp, data):
        """Aggiunge nuovo dato shiftando gli ultimi 3"""
        # Shift dei dati: 1→2, 2→3, nuovo→1
        self.last_timestamp_3 = self.last_timestamp_2
        self.last_data_3 = self.last_data_2

        self.last_timestamp_2 = self.last_timestamp_1
        self.last_data_2 = self.last_data_1

        self.last_timestamp_1 = timestamp
        self.last_data_1 = data

        # Update statistiche
        self.total_readings += 1
        self.last_reading = timestamp
        self.last_seen_at = timestamp

        if not self.first_seen_at:
            self.first_seen_at = timestamp

    def update_min_max_stats(self, value):
        """Aggiorna statistiche min/max globali"""
        if self.min_value_ever is None or value < self.min_value_ever:
            self.min_value_ever = value
            self.min_recorded_at = timezone.now()

        if self.max_value_ever is None or value > self.max_value_ever:
            self.max_value_ever = value
            self.max_recorded_at = timezone.now()
```

## Auto-Discovery Logic Dettagliata

### 1. MQTT Message Processing Flow
```python
def process_mqtt_message(site, topic, payload):
    """
    Router principale per messaggi MQTT

    Esempi topic:
    - sito_001/datalogger/monstro/1/heartbeat
    - sito_001/gateway/heartbeat
    """
    parts = topic.split('/')
    site_code = parts[0]  # sito_001

    if len(parts) >= 3 and parts[1] == 'datalogger':
        # Datalogger message: sito_001/datalogger/monstro/1/heartbeat
        process_datalogger_message(site, parts, payload)

    elif len(parts) >= 3 and parts[1] == 'gateway':
        # Gateway message: sito_001/gateway/heartbeat
        process_gateway_message(site, parts, payload)

def process_datalogger_message(site, topic_parts, payload):
    """Gestisce messaggi datalogger con auto-discovery"""
    datalogger_type = topic_parts[2]  # monstro, adaq
    instance_number = int(topic_parts[3])  # 1, 2, 3
    message_type = topic_parts[4]  # input, output, heartbeat

    if message_type == 'heartbeat':
        # Auto-discovery datalogger
        serial_number = payload.get('serial_number', f"{datalogger_type}_{instance_number}")
        datalogger = auto_discover_datalogger(site, datalogger_type, instance_number, serial_number, payload)

        # Process sensors dal payload
        sensors_data = payload.get('sensors_last_data', [])
        for sensor_data in sensors_data:
            auto_discover_sensor(datalogger, sensor_data)

def auto_discover_datalogger(site, datalogger_type, instance_number, serial_number, payload):
    """Auto-create/update datalogger"""
    datalogger, created = Datalogger.objects.get_or_create(
        site=site,
        serial_number=serial_number,
        defaults={
            'label': serial_number,  # Default editabile dall'utente
            'datalogger_type': datalogger_type,
            'instance_number': instance_number,
        }
    )

    # Update status e metadata
    datalogger.is_online = True
    datalogger.last_heartbeat = timezone.now()
    datalogger.last_communication = timezone.now()
    datalogger.total_heartbeats += 1
    datalogger.raw_metadata = payload

    # Update firmware se presente
    if 'firmware_version' in payload:
        datalogger.firmware_version = payload['firmware_version']

    datalogger.save()
    return datalogger

def auto_discover_sensor(datalogger, sensor_data):
    """Auto-create/update sensor con dati near real-time"""
    device_name = sensor_data.get('device_name')
    if not device_name:
        return

    sensor, created = Sensor.objects.get_or_create(
        datalogger=datalogger,
        serial_number=device_name,
        defaults={
            'label': device_name,  # Default editabile
        }
    )

    # Parse timestamp dal payload
    timestamp_str = sensor_data.get('ts')
    if timestamp_str:
        timestamp = timezone.datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
    else:
        timestamp = timezone.now()

    # Aggiorna dati near real-time (rolling 3)
    sensor.add_new_reading(timestamp, sensor_data)

    # Update statistiche min/max se ci sono valori numerici
    for key, value in sensor_data.items():
        if key.startswith('last_') and isinstance(value, (int, float)):
            sensor.update_min_max_stats(value)

    sensor.is_online = True
    sensor.total_messages += 1
    sensor.save()
```

### 2. Retry Logic e Resilienza
```python
class MqttConnectionManager:
    """Gestisce multiple connessioni MQTT con retry esponenziale"""

    def __init__(self):
        self.connections = {}  # site_id -> MqttClient
        self.retry_delays = {}  # site_id -> current_delay

    def start_connection(self, site):
        """Avvia connessione MQTT per un sito"""
        connection = site.mqttconnection
        client_id = f"{connection.client_id_prefix}_bfg_backend"

        try:
            client = mqtt.Client(client_id=client_id)
            client.username_pw_set(connection.username, connection.password)
            client.on_connect = partial(self.on_connect, site.id)
            client.on_message = partial(self.on_message, site.id)
            client.on_disconnect = partial(self.on_disconnect, site.id)

            client.connect(connection.broker_host, connection.broker_port, connection.keep_alive_interval)
            client.loop_start()

            self.connections[site.id] = client
            self.retry_delays[site.id] = connection.retry_delay  # Reset delay

            connection.status = 'connected'
            connection.last_connected_at = timezone.now()
            connection.save()

        except Exception as e:
            self.handle_connection_error(site, str(e))

    def handle_connection_error(self, site, error_msg):
        """Gestisce errori con retry esponenziale"""
        connection = site.mqttconnection
        connection.status = 'error'
        connection.error_message = error_msg
        connection.connection_errors += 1
        connection.save()

        # Calcola delay prossimo retry (esponenziale)
        current_delay = self.retry_delays.get(site.id, connection.retry_delay)
        next_delay = min(current_delay * 2, connection.max_retry_delay)
        self.retry_delays[site.id] = next_delay

        # Schedule retry
        threading.Timer(next_delay, self.start_connection, args=[site]).start()

    def on_connect(self, site_id, client, userdata, flags, rc):
        """Callback connessione riuscita"""
        site = Site.objects.get(id=site_id)

        # Subscribe ai topic configurati
        for topic in site.mqttconnection.topics.filter(is_active=True):
            full_topic = topic.get_full_topic()
            client.subscribe(full_topic, qos=topic.qos_level)

        # Subscribe al topic generico del sito per auto-discovery
        site_topic = f"{site.mqttconnection.client_id_prefix}/#"
        client.subscribe(site_topic, qos=0)

    def on_message(self, site_id, client, userdata, msg):
        """Callback ricezione messaggio"""
        try:
            site = Site.objects.get(id=site_id)
            topic = msg.topic
            payload = json.loads(msg.payload.decode())

            # Process tramite auto-discovery
            process_mqtt_message(site, topic, payload)

        except Exception as e:
            logger.error(f"Error processing MQTT message: {e}")
```

## Fasi di Sviluppo

### Fase 1: Setup Nuovi Modelli MQTT
**Obiettivo:** Creare nuova struttura modelli senza toccare l'esistente
**Durata stimata:** 2-3 ore

#### 1.1 Backup e Preparazione
- [ ] Backup database esistente
- [ ] Creazione branch di sviluppo `refactor-mqtt-autodiscovery`
- [ ] Verifica che Docker/Podman containers siano funzionanti

#### 1.2 Creazione Nuovi Modelli
- [ ] Creare `Gateway` model (rinomina SystemInfo)
- [ ] Creare `Datalogger` model (nuovo)
- [ ] Estendere `SensorDevice` → `Sensor` con campi near real-time
- [ ] Aggiornare `__init__.py` e imports

#### 1.3 Migrations e Test
- [ ] Generare migrations: `python manage.py makemigrations mqtt`
- [ ] Applicare migrations: `python manage.py migrate`
- [ ] Test inserimento dati di esempio per validazione modelli
- [ ] Verificare constraints e indexes

### Fase 2: Auto-Discovery Logic
**Obiettivo:** Implementare logica auto-discovery da messaggi MQTT
**Durata stimata:** 4-5 ore

#### 2.1 MQTT Message Processing
- [ ] Creare `mqtt/services/autodiscovery.py`
- [ ] Implementare `process_mqtt_message()`
- [ ] Implementare `auto_discover_datalogger()`
- [ ] Implementare `auto_discover_sensor()`
- [ ] Implementare `process_gateway_message()`

#### 2.2 Connection Manager
- [ ] Estendere `MqttConnectionManager` per multi-sito
- [ ] Implementare retry logic esponenziale
- [ ] Aggiungere logging strutturato per monitoring
- [ ] Test con messaggi MQTT simulati

#### 2.3 Near Real-Time Data Logic
- [ ] Implementare `Sensor.add_new_reading()` per rolling 3 dati
- [ ] Implementare `Sensor.update_min_max_stats()`
- [ ] Test logica shift dati 1→2→3
- [ ] Validation constraints e performance

### Fase 3: API Endpoints Migration
**Obiettivo:** Nuove API compatibili con frontend esistente
**Durata stimata:** 3-4 ore

#### 3.1 Nuove API Views
- [ ] `/api/v1/monitoring/gateways/` (da system info)
- [ ] `/api/v1/monitoring/dataloggers/` (sostituisce sites/dataloggers)
- [ ] `/api/v1/monitoring/sensors/by-datalogger/{datalogger_id}/`
- [ ] `/api/v1/monitoring/sensors/{sensor_id}/readings/` (ultimi 3 dati)

#### 3.2 Endpoints Gestione Labels
- [ ] `PUT /api/v1/monitoring/dataloggers/{id}/label/`
- [ ] `PUT /api/v1/monitoring/sensors/{id}/label/`
- [ ] `DELETE /api/v1/monitoring/dataloggers/{id}/` (soft delete)
- [ ] `DELETE /api/v1/monitoring/sensors/{id}/`

#### 3.3 Compatibilità Frontend
- [ ] Mantenere stesso formato JSON response
- [ ] Mapping: `name` → `label`, `model` → `datalogger_type`
- [ ] Test API con Postman/curl
- [ ] Documentazione OpenAPI/Swagger

### Fase 4: Frontend Integration
**Obiettivo:** Aggiornare frontend per nuovi endpoint
**Durata stimata:** 3-4 ore

#### 4.1 API Calls Update
- [ ] Update hooks in `useMqttStatus.ts`
- [ ] Update `DataLoggerPage.tsx` API calls
- [ ] Update `DataloggerCard.tsx` per nuovi campi
- [ ] Update `SensorCard.tsx` per dati near real-time

#### 4.2 Label Editing UI
- [ ] Componente inline edit per datalogger labels
- [ ] Componente inline edit per sensor labels
- [ ] Validation e error handling
- [ ] Update immediate UI dopo edit successful

#### 4.3 Enhanced Data Display
- [ ] Visualizzazione ultimi 3 dati sensori
- [ ] Statistiche min/max/total da sempre
- [ ] Indicatori uptime/connectivity
- [ ] Real-time updates ogni 5-10s

### Fase 5: Production Deployment
**Obiettivo:** Deploy sicuro in produzione con migration
**Durata stimata:** 2-3 ore

#### 5.1 Data Migration Script
- [ ] Script per migrare dati da `sites.Datalogger` → `mqtt.Datalogger`
- [ ] Script per migrare dati da `sites.Sensor` → `mqtt.Sensor`
- [ ] Validation dati migrati
- [ ] Rollback script se necessario

#### 5.2 Gradual Cutover
- [ ] Feature flag per switch new/old API
- [ ] Test in staging con dati reali
- [ ] Deploy backend con entrambi sistemi attivi
- [ ] Switch frontend progressivo per sito
- [ ] Monitoring errori e performance

#### 5.3 Cleanup Final
- [ ] Disabilitazione old API endpoints
- [ ] Rimozione modelli `sites.Datalogger` e `sites.Sensor`
- [ ] Cleanup migrations obsolete
- [ ] Update documentazione
- [ ] Performance optimization finale

### Fase 6: Monitoring e Ottimizzazione
**Obiettivo:** Monitoring completo e performance tuning
**Durata stimata:** 2-3 ore

#### 6.1 Monitoring Dashboard
- [ ] Dashboard admin per status connessioni MQTT
- [ ] Monitoring auto-discovery eventi
- [ ] Alerts per device offline oltre soglia
- [ ] Statistiche benchmark uptime per cliente

#### 6.2 Performance Optimization
- [ ] Query optimization con select_related/prefetch_related
- [ ] Caching per status dispositivi frequenti
- [ ] Batch processing per multiple device updates
- [ ] Database indexing review

#### 6.3 Final Testing
- [ ] Load testing con 50+ dispositivi per sito
- [ ] Test disconnessioni/reconnessioni
- [ ] Test resilienza broker MQTT down
- [ ] Validazione completa auto-discovery flow

## Metriche di Successo

### Performance Targets
- **Latency auto-discovery:** < 2s dal messaggio MQTT al database
- **Frontend update:** < 5s refresh real-time data
- **Concurrent connections:** 20+ siti simultaneous senza degrado
- **API response time:** < 500ms per endpoint principali

### Business Targets
- **Zero downtime:** Deploy senza interruzione servizio
- **Data preservation:** 100% dati esistenti preservati
- **User experience:** Stesso workflow per utenti finali
- **Scalability:** Architecture pronta per 100+ siti

## Domande e Decisioni da Confermare

### 1. Formato Serial Numbers
- **Q:** Come identificare univocamente datalogger senza serial nel payload?
- **Proposta:** Fallback su `{datalogger_type}_{instance_number}`

### 2. Timeout Offline Detection
- **Q:** Dopo quanto tempo marcare device offline?
- **Proposta:** 3x heartbeat interval parametrizzabile per connessione

### 3. Data Retention Policy
- **Q:** Rolling 3 dati enough or serve history più lunga?
- **Proposta:** Start con 3, estendibile a configurable N in futuro

### 4. Real-time Delivery Method
- **Q:** WebSocket vs Server-Sent Events vs Polling?
- **Proposta:** Start con polling ogni 5s, evolve a WebSocket

### 5. Multiple Instances Scaling
- **Q:** Come gestire multiple istanze app per load balancing?
- **Proposta:** Redis pub/sub per coordinamento MQTT connections

## Files di Configurazione e Setup

### Environment Variables
```bash
# In .env o docker-compose
MQTT_MAX_CONNECTIONS=50
MQTT_DEFAULT_RETRY_DELAY=5
MQTT_MAX_RETRY_DELAY=300
MQTT_AUTO_DISCOVERY_ENABLED=true
MQTT_HEARTBEAT_TIMEOUT_MULTIPLIER=3
```

### Docker Compose Updates
```yaml
# Aggiunte necessarie per Redis/WebSocket se needed
services:
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
```

### Database Settings
```python
# In settings.py
DATABASES['default']['OPTIONS'] = {
    'init_command': "SET sql_mode='STRICT_TRANS_TABLES'",
    'charset': 'utf8mb4',
}

# Index optimization per performance
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
```

## Conclusione

Questo piano copre una migrazione completa e sicura dall'attuale architettura manuale a un sistema auto-discovery completamente automatizzato. La struttura modulare permette testing incrementale e rollback safety in ogni fase.

**Priorità:** Iniziare con Fase 1 dopo conferma approach e risposte domande critiche.