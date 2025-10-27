# Modelli del Database MQTT

## Overview

I modelli del database sono progettati per supportare:
- Multi-site con connessioni MQTT indipendenti
- Auto-discovery dei dispositivi
- Versioning del protocollo MQTT
- Monitoring dinamico dello stato dei dispositivi

## Diagramma ER

```
┌─────────────────┐
│      Site       │
│  (sites app)    │
└────────┬────────┘
         │ 1
         │
         │ 1:1
         ▼
┌─────────────────┐         ┌─────────────────┐
│ MqttConnection  │◄───1:N──┤   MqttTopic     │
│                 │         │                 │
│ - broker_host   │         │ - topic_pattern │
│ - broker_port   │         │ - qos_level     │
│ - status        │         │ - is_active     │
└─────────────────┘         └─────────────────┘
         │ 1
         │
         │ 1:N
         ▼
┌──────────────────┐
│ DiscoveredTopic  │
│                  │
│ - topic_path     │
│ - message_count  │
│ - is_processed   │
└──────────────────┘

┌─────────────────┐         ┌─────────────────┐
│    Gateway      │         │   Datalogger    │
│                 │         │                 │
│ - serial_number │         │ - serial_number │
│ - firmware_ver  │         │ - device_id     │
│ - is_online     │         │ - is_online     │
└────────┬────────┘         └────────┬────────┘
         │                           │
         │ belongs to Site           │ belongs to Site
         │                           │ 1:N
         │                           ▼
         │                  ┌─────────────────┐
         │                  │  SensorDevice   │
         │                  │                 │
         │                  │ - serial_number │
         │                  │ - sensor_type   │
         │                  │ - is_online     │
         │                  └─────────────────┘
```

## Modelli Principali

### MqttConnection

Configurazione della connessione MQTT per ogni sito.

**Campi principali:**
```python
site = OneToOneField('sites.Site')          # Relazione 1:1 con Site
broker_host = CharField(max_length=255)     # Host broker MQTT
broker_port = IntegerField(default=1883)    # Porta broker
username = CharField(max_length=100)        # Username autenticazione
password = CharField(max_length=100)        # Password autenticazione
client_id_prefix = CharField(max_length=50) # Prefisso topic (es: site_001)
status = CharField(choices=STATUS_CHOICES)  # connected/disconnected/error
is_enabled = BooleanField(default=True)     # Abilita/disabilita connessione
```

**Stati possibili:**
- `disconnected`: Non connesso
- `connecting`: In fase di connessione
- `connected`: Connesso e attivo
- `error`: Errore di connessione
- `disabled`: Disabilitato manualmente

**Esempio configurazione:**
```python
connection = MqttConnection.objects.create(
    site=site,
    broker_host='mqtt.example.com',
    broker_port=1883,
    username='site_001_user',
    password='secret',
    client_id_prefix='site_001',
    is_enabled=True
)
```

### MqttTopic

Topic MQTT configurabili per ogni connessione.

**Campi principali:**
```python
mqtt_connection = ForeignKey(MqttConnection)  # Connessione di appartenenza
topic_pattern = CharField(max_length=255)     # Pattern topic (senza prefix)
is_active = BooleanField(default=True)        # Attivo per subscription
qos_level = IntegerField(default=0)           # QoS 0/1/2
priority = IntegerField(default=0)            # Priorità processing
```

**Pattern topic comuni:**
- `gateway/1/heartbeat` - Heartbeat gateway
- `datalogger/+/heartbeat` - Heartbeat datalogger (wildcard +)
- `sensor/+/data` - Dati sensori

**Metodo helper:**
```python
def get_full_topic(self):
    """Ritorna topic completo con prefix"""
    return f"{self.mqtt_connection.client_id_prefix}/{self.topic_pattern}"
```

**Esempio:**
```python
topic = MqttTopic.objects.create(
    mqtt_connection=connection,
    topic_pattern='datalogger/+/heartbeat',
    qos_level=1,
    is_active=True
)
# Full topic: "site_001/datalogger/+/heartbeat"
```

### DiscoveredTopic

Tracciamento automatico di tutti i topic scoperti.

**Campi principali:**
```python
site = ForeignKey('sites.Site')              # Sito di appartenenza
topic_path = CharField(max_length=500)       # Topic completo ricevuto
topic_pattern = CharField(max_length=500)    # Pattern senza prefix
first_seen_at = DateTimeField()              # Prima apparizione
last_seen_at = DateTimeField()               # Ultimo messaggio
message_count = IntegerField()               # Contatore messaggi
sample_payload = JSONField()                 # Sample payload per analisi
is_processed = BooleanField()                # Ha logica di processing?
processor_name = CharField()                 # Nome processore
```

**Utilizzo:**
- Auto-discovery automatico di nuovi topic
- Analisi pattern messaggi
- Debugging topic non processati
- Statistiche traffico MQTT

### Gateway

Sistema gateway principale del sito (evoluzione di SystemInfo).

**Campi principali:**
```python
site = ForeignKey('sites.Site')              # Sito di appartenenza
serial_number = CharField(unique=True)       # S/N univoco gateway
label = CharField(max_length=255)            # Nome editabile
hostname = CharField()                       # Hostname sistema
ip_address = GenericIPAddressField()         # IP address
firmware_version = CharField()               # Versione firmware
os_version = CharField()                     # Sistema operativo
is_online = BooleanField()                   # Stato online
last_heartbeat_at = DateTimeField()          # Ultimo heartbeat
total_heartbeats = IntegerField()            # Contatore heartbeats
missed_heartbeats = IntegerField()           # Heartbeats persi
uptime_percentage = FloatField()             # % uptime
```

**Tracking metriche:**
```python
# Update heartbeat
gateway.last_heartbeat_at = timezone.now()
gateway.total_heartbeats += 1
gateway.is_online = True
gateway.calculate_uptime()  # Ricalcola uptime %
gateway.save()
```

### Datalogger

Dispositivo datalogger che acquisisce dati dai sensori.

**Campi principali:**
```python
site = ForeignKey('sites.Site')              # Sito di appartenenza
gateway = ForeignKey(Gateway)                # Gateway associato
serial_number = CharField(unique=True)       # S/N univoco
label = CharField(max_length=255)            # Nome editabile
datalogger_type = CharField()                # Tipo (monstro, generic, etc)
device_id = CharField()                      # ID dispositivo nel tipo
is_online = BooleanField()                   # Stato online
last_seen_at = DateTimeField()               # Ultima comunicazione
firmware_version = CharField()               # Versione firmware
ip_address = GenericIPAddressField()         # IP address
total_heartbeats = IntegerField()            # Totale heartbeats
missed_heartbeats = IntegerField()           # Heartbeats persi
uptime_percentage = FloatField()             # % uptime
mqtt_api_version = CharField()               # Versione API MQTT
```

**Costruzione topic MQTT:**
```python
# Pattern: site_001/gateway/1/datalogger/monstro/15/heartbeat
def get_topic_base(self):
    site_code = f"site_{self.site.id:03d}"
    gateway_id = self.gateway.id if self.gateway else 1
    return f"{site_code}/gateway/{gateway_id}/datalogger/{self.datalogger_type}/{self.device_id}"
```

**Relazione con sensori:**
```python
# Get all sensors for datalogger
sensors = datalogger.sensors.filter(is_online=True)
```

### SensorDevice

Sensore fisico connesso a un datalogger.

**Campi principali:**
```python
datalogger = ForeignKey(Datalogger)          # Datalogger parent
serial_number = CharField()                  # S/N sensore
label = CharField(max_length=255)            # Nome editabile
sensor_type = CharField()                    # Tipo sensore
unit_of_measure = CharField()                # Unità misura (°C, mm, g)
is_online = BooleanField()                   # Stato online
current_value = FloatField()                 # Ultimo valore letto
last_reading = DateTimeField()               # Ultima lettura
total_messages = IntegerField()              # Totale messaggi
total_readings = IntegerField()              # Totale letture valide
min_value_ever = FloatField()                # Minimo mai registrato
max_value_ever = FloatField()                # Massimo mai registrato
uptime_percentage = FloatField()             # % uptime
consecutive_misses = IntegerField()          # Letture consecutive perse
latest_readings = JSONField()                # Ultimi N valori
```

**Tipi di sensori supportati:**
- `temperature` - Temperatura
- `humidity` - Umidità
- `pressure` - Pressione
- `accelerometer` - Accelerometro (X, Y, Z)
- `strain_gauge` - Estensimetro
- `displacement` - Spostamento
- `vibration` - Vibrazione
- `tilt` - Inclinazione
- `wind_speed` - Velocità vento
- `wind_direction` - Direzione vento

**Update lettura:**
```python
def update_reading(self, value, timestamp=None):
    """Aggiorna lettura sensore"""
    self.current_value = value
    self.last_reading = timestamp or timezone.now()
    self.total_readings += 1
    self.consecutive_misses = 0

    # Update min/max
    if self.min_value_ever is None or value < self.min_value_ever:
        self.min_value_ever = value
    if self.max_value_ever is None or value > self.max_value_ever:
        self.max_value_ever = value

    self.save()
```

## Relazioni tra Modelli

### Site → MqttConnection (1:1)
```python
site = Site.objects.get(id=1)
mqtt_connection = site.mqttconnection
```

### MqttConnection → MqttTopic (1:N)
```python
connection = MqttConnection.objects.get(site_id=1)
topics = connection.topics.filter(is_active=True)
```

### Site → Gateway (1:N)
```python
site = Site.objects.get(id=1)
gateways = site.gateways.filter(is_online=True)
```

### Site → Datalogger (1:N)
```python
site = Site.objects.get(id=1)
dataloggers = site.dataloggers.all()
```

### Datalogger → SensorDevice (1:N)
```python
datalogger = Datalogger.objects.get(id=15)
sensors = datalogger.sensors.filter(is_online=True)
```

## Query Comuni

### Get all online dataloggers for a site
```python
from mqtt.models import Datalogger

dataloggers = Datalogger.objects.filter(
    site_id=1,
    is_online=True
).select_related('gateway').prefetch_related('sensors')
```

### Get sensors with recent readings
```python
from django.utils import timezone
from datetime import timedelta

threshold = timezone.now() - timedelta(minutes=5)

recent_sensors = SensorDevice.objects.filter(
    last_reading__gte=threshold
).select_related('datalogger', 'datalogger__site')
```

### Get MQTT connections with errors
```python
error_connections = MqttConnection.objects.filter(
    status='error',
    is_enabled=True
).select_related('site')
```

### Calculate aggregate metrics for site
```python
from django.db.models import Count, Avg

site_metrics = Datalogger.objects.filter(site_id=1).aggregate(
    total=Count('id'),
    online=Count('id', filter=Q(is_online=True)),
    avg_uptime=Avg('uptime_percentage'),
    total_sensors=Count('sensors')
)
```

## Indici e Performance

### Indici principali
```python
# In models.py Meta class
indexes = [
    models.Index(fields=['site', 'is_online']),
    models.Index(fields=['last_seen_at']),
    models.Index(fields=['serial_number']),
]
```

### Best Practices Query

1. **Sempre usare select_related per FK:**
   ```python
   Datalogger.objects.select_related('site', 'gateway')
   ```

2. **Usare prefetch_related per M2N:**
   ```python
   Datalogger.objects.prefetch_related('sensors')
   ```

3. **Filtrare prima di aggregare:**
   ```python
   Datalogger.objects.filter(site_id=1).aggregate(...)
   ```

4. **Usare bulk operations:**
   ```python
   Datalogger.objects.bulk_update(dataloggers, ['is_online', 'last_seen_at'])
   ```

## Migrations

Le migration sono in `/backend/mqtt/migrations/`

**Migration più importanti:**
- `0008`: Introduzione modelli Gateway, Datalogger, SensorDevice
- `0012`: Introduzione DiscoveredTopic per auto-discovery
- `0016`: Aggiunta versioning e dynamic monitoring
- `0019`: Rimozione campi legacy

## Validazioni

### Serial Number Pattern
```python
validators=[
    RegexValidator(
        regex=r'^[a-zA-Z0-9_-]+$',
        message='Serial number può contenere solo lettere, numeri, underscore e trattini'
    )
]
```

### Label Sanitization
```python
validators=[
    RegexValidator(
        regex=r'^[^<>\"\'&]+$',
        message='Label non può contenere caratteri HTML pericolosi'
    )
]
```

## Signals

Non ci sono signals Django attivi sui modelli MQTT per evitare race conditions. Tutti gli update sono gestiti esplicitamente nei servizi.

## Admin Interface

Tutti i modelli sono registrati nel Django Admin (`mqtt/admin.py`) con:
- List display customizzato
- Filtri per site, status, online
- Search fields per serial number, label
- Actions bulk per enable/disable
