# 🚀 Piano di Sviluppo MQTT IoT System

## 📋 Overview del Sistema
- **Scalabilità**: 20-100 siti (possibilità istanze separate per cliente)
- **QoS**: Level 0 (fire-and-forget)
- **Retention**: 3 record per sensore (current + 2 storici)
- **Real-time**: Updates ogni 5-15 secondi via WebSocket
- **Focus**: Monitoring continuità servizio e stato connessioni

---

## 🏗️ FASE 1: Database & Models Django

### 1.1 Modelli Database

#### **MqttConnection** (per sito)
```python
# backend/apps/mqtt/models.py
class MqttConnection(models.Model):
    site = models.OneToOneField('sites.Site', on_delete=models.CASCADE)

    # Connection settings
    broker_host = models.CharField(max_length=255)
    broker_port = models.IntegerField(default=1883)
    username = models.CharField(max_length=100, blank=True)
    password = models.CharField(max_length=100, blank=True)
    client_id_prefix = models.CharField(max_length=50)

    # Retry settings
    keep_alive_interval = models.IntegerField(default=60)  # secondi
    retry_attempts = models.IntegerField(default=5)
    retry_delay = models.IntegerField(default=5)  # secondi
    max_retry_delay = models.IntegerField(default=300)  # 5 min max

    # SSL settings
    ssl_enabled = models.BooleanField(default=False)
    ca_cert_path = models.CharField(max_length=500, blank=True)

    # Status tracking
    status = models.CharField(max_length=20, choices=[
        ('disconnected', 'Disconnected'),
        ('connecting', 'Connecting'),
        ('connected', 'Connected'),
        ('error', 'Error'),
        ('disabled', 'Disabled')
    ], default='disconnected')

    last_connected_at = models.DateTimeField(null=True, blank=True)
    last_heartbeat_at = models.DateTimeField(null=True, blank=True)
    connection_errors = models.IntegerField(default=0)
    error_message = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

#### **SensorDevice** (registro sensori)
```python
class SensorDevice(models.Model):
    site = models.ForeignKey('sites.Site', on_delete=models.CASCADE)
    device_name = models.CharField(max_length=100)  # es: "MNA00542"

    # Metadata
    device_type = models.CharField(max_length=50, blank=True)
    is_active = models.BooleanField(default=True)

    # Status tracking
    last_seen_at = models.DateTimeField(null=True, blank=True)
    is_online = models.BooleanField(default=False)
    consecutive_misses = models.IntegerField(default=0)

    # Stats per benchmark
    total_messages = models.IntegerField(default=0)
    uptime_percentage = models.FloatField(default=100.0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('site', 'device_name')
```

#### **SensorData** (3 record rolling)
```python
class SensorData(models.Model):
    sensor_device = models.ForeignKey(SensorDevice, on_delete=models.CASCADE)

    # Raw data dal JSON
    timestamp = models.DateTimeField()  # dal campo "ts"
    raw_data = models.JSONField()  # tutto il payload del sensore

    # Parsed common fields
    acc_x = models.FloatField(null=True, blank=True)
    acc_y = models.FloatField(null=True, blank=True)
    acc_z = models.FloatField(null=True, blank=True)
    incli_x = models.FloatField(null=True, blank=True)
    incli_y = models.FloatField(null=True, blank=True)

    # Optional fields (solo per alcuni sensori)
    mag_x = models.FloatField(null=True, blank=True)
    mag_y = models.FloatField(null=True, blank=True)
    mag_z = models.FloatField(null=True, blank=True)
    gyro_x = models.FloatField(null=True, blank=True)
    gyro_y = models.FloatField(null=True, blank=True)
    gyro_z = models.FloatField(null=True, blank=True)

    received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['sensor_device', '-timestamp']),
        ]
```

#### **ConnectionLog** (benchmark continuità)
```python
class ConnectionLog(models.Model):
    mqtt_connection = models.ForeignKey(MqttConnection, on_delete=models.CASCADE)

    event_type = models.CharField(max_length=20, choices=[
        ('connected', 'Connected'),
        ('disconnected', 'Disconnected'),
        ('heartbeat_missed', 'Heartbeat Missed'),
        ('error', 'Error')
    ])

    message = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']
```

### 1.2 Admin Interface
```python
# backend/apps/mqtt/admin.py
@admin.register(MqttConnection)
class MqttConnectionAdmin(admin.ModelAdmin):
    list_display = ['site', 'broker_host', 'status', 'last_connected_at', 'connection_errors']
    list_filter = ['status', 'ssl_enabled']
    search_fields = ['site__name', 'broker_host']
    readonly_fields = ['last_connected_at', 'last_heartbeat_at', 'connection_errors']

    fieldsets = (
        ('Connection', {
            'fields': ('site', 'broker_host', 'broker_port', 'client_id_prefix')
        }),
        ('Authentication', {
            'fields': ('username', 'password')
        }),
        ('Settings', {
            'fields': ('keep_alive_interval', 'retry_attempts', 'retry_delay', 'max_retry_delay')
        }),
        ('SSL', {
            'fields': ('ssl_enabled', 'ca_cert_path')
        }),
        ('Status', {
            'fields': ('status', 'last_connected_at', 'last_heartbeat_at', 'connection_errors', 'error_message')
        })
    )
```

### ✅ Test Fase 1:
- [ ] Creazione modelli e migrazione
- [ ] Admin interface funzionante
- [ ] CRUD operations via admin
- [ ] Seed data per testing

---

## 🔌 FASE 2: MQTT Core Service

### 2.1 MQTT Client Manager
```python
# backend/apps/mqtt/services/mqtt_manager.py
import paho.mqtt.client as mqtt
import threading
import time
from typing import Dict, Optional
from django.utils import timezone

class MqttClientManager:
    def __init__(self):
        self.clients: Dict[int, mqtt.Client] = {}  # site_id -> client
        self.threads: Dict[int, threading.Thread] = {}
        self.running = False

    def start_all_connections(self):
        """Avvia tutte le connessioni MQTT configurate"""
        connections = MqttConnection.objects.filter(status__in=['disconnected', 'error'])
        for conn in connections:
            self.start_connection(conn.site.id)

    def start_connection(self, site_id: int):
        """Avvia connessione MQTT per un sito specifico"""
        try:
            conn = MqttConnection.objects.get(site_id=site_id)

            # Crea client MQTT
            client_id = f"{conn.client_id_prefix}_{site_id}"
            client = mqtt.Client(client_id=client_id)

            # Setup callbacks
            client.on_connect = lambda c, ud, flags, rc: self._on_connect(c, ud, flags, rc, site_id)
            client.on_disconnect = lambda c, ud, rc: self._on_disconnect(c, ud, rc, site_id)
            client.on_message = lambda c, ud, msg: self._on_message(c, ud, msg, site_id)

            # Setup credentials
            if conn.username:
                client.username_pw_set(conn.username, conn.password)

            # Setup SSL
            if conn.ssl_enabled and conn.ca_cert_path:
                client.tls_set(conn.ca_cert_path)

            # Connect
            conn.status = 'connecting'
            conn.save()

            client.connect(conn.broker_host, conn.broker_port, conn.keep_alive_interval)
            client.loop_start()

            self.clients[site_id] = client

        except Exception as e:
            self._handle_connection_error(site_id, str(e))

    def _on_connect(self, client, userdata, flags, rc, site_id):
        """Callback connessione riuscita"""
        if rc == 0:
            conn = MqttConnection.objects.get(site_id=site_id)
            conn.status = 'connected'
            conn.last_connected_at = timezone.now()
            conn.connection_errors = 0
            conn.error_message = ''
            conn.save()

            # Subscribe ai topic
            site_code = conn.site.code  # assumendo che Site abbia un campo code
            topics = [
                f"{site_code}/datalogger_o/heartbeat",
                f"{site_code}/sys_info"
            ]

            for topic in topics:
                client.subscribe(topic, qos=0)

            # Log evento
            ConnectionLog.objects.create(
                mqtt_connection=conn,
                event_type='connected',
                message=f'Connected to {conn.broker_host}:{conn.broker_port}'
            )
        else:
            self._handle_connection_error(site_id, f'Connection failed with code {rc}')
```

### 2.2 Message Parser
```python
# backend/apps/mqtt/services/message_parser.py
import json
from datetime import datetime
from django.utils import timezone

class MqttMessageParser:

    @staticmethod
    def parse_heartbeat(payload: str, site_id: int) -> bool:
        """Parse heartbeat message e salva sensor data"""
        try:
            data = json.loads(payload)

            # Update heartbeat timestamp
            conn = MqttConnection.objects.get(site_id=site_id)
            conn.last_heartbeat_at = timezone.now()
            conn.save()

            # Process sensors data
            sensors_data = data.get('sensors_last_data', [])

            for sensor_info in sensors_data:
                device_name = sensor_info.get('device_name')
                if not device_name:
                    continue

                # Get or create sensor device
                sensor_device, created = SensorDevice.objects.get_or_create(
                    site_id=site_id,
                    device_name=device_name,
                    defaults={'is_active': True}
                )

                # Parse timestamp
                ts_str = sensor_info.get('ts')
                if ts_str:
                    sensor_timestamp = datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
                else:
                    sensor_timestamp = timezone.now()

                # Update sensor status
                sensor_device.last_seen_at = timezone.now()
                sensor_device.is_online = True
                sensor_device.consecutive_misses = 0
                sensor_device.total_messages += 1
                sensor_device.save()

                # Save sensor data (with 3-record rolling)
                MqttMessageParser._save_sensor_data_rolling(sensor_device, sensor_info, sensor_timestamp)

            # Mark missing sensors as offline
            MqttMessageParser._update_missing_sensors(site_id, [s.get('device_name') for s in sensors_data])

            return True

        except Exception as e:
            logger.error(f"Error parsing heartbeat for site {site_id}: {e}")
            return False

    @staticmethod
    def _save_sensor_data_rolling(sensor_device, sensor_info, timestamp):
        """Mantiene solo 3 record per sensore (rolling)"""

        # Crea nuovo record
        sensor_data = SensorData.objects.create(
            sensor_device=sensor_device,
            timestamp=timestamp,
            raw_data=sensor_info,
            acc_x=sensor_info.get('last_acc00'),
            acc_y=sensor_info.get('last_acc01'),
            acc_z=sensor_info.get('last_acc02'),
            incli_x=sensor_info.get('last_incli_x'),
            incli_y=sensor_info.get('last_incli_y'),
            mag_x=sensor_info.get('last_mag_x'),
            mag_y=sensor_info.get('last_mag_y'),
            mag_z=sensor_info.get('last_mag_z'),
            gyro_x=sensor_info.get('last_gyro_x'),
            gyro_y=sensor_info.get('last_gyro_y'),
            gyro_z=sensor_info.get('last_gyro_z')
        )

        # Mantieni solo gli ultimi 3 record
        old_records = SensorData.objects.filter(
            sensor_device=sensor_device
        ).order_by('-timestamp')[3:]  # Skip primi 3, prendi il resto

        for record in old_records:
            record.delete()

    @staticmethod
    def _update_missing_sensors(site_id, active_devices):
        """Marca come offline i sensori non presenti nel heartbeat"""
        missing_sensors = SensorDevice.objects.filter(
            site_id=site_id,
            is_online=True
        ).exclude(device_name__in=active_devices)

        for sensor in missing_sensors:
            sensor.consecutive_misses += 1
            if sensor.consecutive_misses >= 3:  # Offline dopo 3 heartbeat mancanti
                sensor.is_online = False
            sensor.save()
```

### 2.3 Management Command
```python
# backend/apps/mqtt/management/commands/run_mqtt.py
from django.core.management.base import BaseCommand
from apps.mqtt.services.mqtt_manager import MqttClientManager

class Command(BaseCommand):
    help = 'Run MQTT client manager'

    def handle(self, *args, **options):
        self.stdout.write("Starting MQTT Client Manager...")

        manager = MqttClientManager()
        try:
            manager.start_all_connections()

            # Keep running
            while True:
                time.sleep(10)
                # Health check connections ogni 10 secondi
                manager.health_check()

        except KeyboardInterrupt:
            self.stdout.write("Shutting down MQTT Manager...")
            manager.shutdown_all()
```

### ✅ Test Fase 2:
- [ ] Service MQTT funzionante
- [ ] Parsing messaggi heartbeat
- [ ] Rolling data (max 3 record per sensore)
- [ ] Detection sensori offline
- [ ] Logging connessioni
- [ ] Management command avvio

---

## 🖥️ FASE 3: Admin Dashboard MQTT

### 3.1 Views Dashboard
```python
# backend/apps/mqtt/views.py
class MqttDashboardView(TemplateView):
    template_name = 'mqtt/dashboard.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)

        # Statistics
        total_connections = MqttConnection.objects.count()
        active_connections = MqttConnection.objects.filter(status='connected').count()
        total_sensors = SensorDevice.objects.count()
        online_sensors = SensorDevice.objects.filter(is_online=True).count()

        context.update({
            'total_connections': total_connections,
            'active_connections': active_connections,
            'total_sensors': total_sensors,
            'online_sensors': online_sensors,
            'connections': MqttConnection.objects.select_related('site').all(),
            'recent_logs': ConnectionLog.objects.select_related('mqtt_connection').order_by('-timestamp')[:50]
        })

        return context

class MqttConnectionControlView(View):
    """API per start/stop connessioni"""

    def post(self, request, site_id):
        action = request.POST.get('action')

        if action == 'start':
            # Logic per avviare connessione
            pass
        elif action == 'stop':
            # Logic per fermare connessione
            pass

        return JsonResponse({'status': 'success'})
```

### 3.2 Real-time Updates (WebSocket)
```python
# backend/apps/mqtt/consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer

class MqttStatusConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.channel_layer.group_add("mqtt_status", self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard("mqtt_status", self.channel_name)

    async def mqtt_status_update(self, event):
        """Invia updates in real-time"""
        await self.send(text_data=json.dumps({
            'type': 'status_update',
            'data': event['data']
        }))

# Signal per notificare changes
from django.db.models.signals import post_save
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

def notify_mqtt_status_change(sender, instance, **kwargs):
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        "mqtt_status",
        {
            "type": "mqtt_status_update",
            "data": {
                "site_id": instance.site.id,
                "status": instance.status,
                "last_heartbeat": instance.last_heartbeat_at.isoformat() if instance.last_heartbeat_at else None
            }
        }
    )

post_save.connect(notify_mqtt_status_change, sender=MqttConnection)
```

### ✅ Test Fase 3:
- [ ] Dashboard admin MQTT
- [ ] Start/stop connessioni via UI
- [ ] Real-time status updates
- [ ] Logs visualizzazione
- [ ] Statistics e monitoring

---

## 📱 FASE 4: Frontend Datalogger Real-time

### 4.1 WebSocket Hook
```typescript
// frontend/src/hooks/useMqttStatus.ts
import { useState, useEffect } from 'react';

interface SensorData {
  device_name: string;
  timestamp: string;
  is_online: boolean;
  acc_x?: number;
  acc_y?: number;
  acc_z?: number;
  incli_x?: number;
  incli_y?: number;
}

export const useMqttStatus = (siteId: string) => {
  const [sensors, setSensors] = useState<SensorData[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('disconnected');

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8000/ws/mqtt/site/${siteId}/`);

    ws.onopen = () => setConnectionStatus('connected');
    ws.onclose = () => setConnectionStatus('disconnected');

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'sensor_update') {
        setSensors(prev => {
          const updated = [...prev];
          const index = updated.findIndex(s => s.device_name === data.sensor.device_name);

          if (index >= 0) {
            updated[index] = data.sensor;
          } else {
            updated.push(data.sensor);
          }

          return updated;
        });
      }
    };

    return () => ws.close();
  }, [siteId]);

  return { sensors, connectionStatus };
};
```

### 4.2 Sensor Cards Component
```tsx
// frontend/src/components/SensorCard.tsx
interface SensorCardProps {
  sensor: SensorData;
}

export const SensorCard: React.FC<SensorCardProps> = ({ sensor }) => {
  const lastUpdate = new Date(sensor.timestamp);
  const isStale = Date.now() - lastUpdate.getTime() > 30000; // 30 sec

  return (
    <div className={`p-4 border rounded-lg ${
      sensor.is_online && !isStale ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'
    }`}>
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold">{sensor.device_name}</h3>
        <span className={`px-2 py-1 rounded text-xs ${
          sensor.is_online && !isStale ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
        }`}>
          {sensor.is_online && !isStale ? 'Online' : 'Offline'}
        </span>
      </div>

      <div className="text-sm text-gray-600 mb-3">
        Last update: {lastUpdate.toLocaleString()}
      </div>

      {sensor.is_online && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>Acc X: {sensor.acc_x?.toFixed(3)}</div>
          <div>Acc Y: {sensor.acc_y?.toFixed(3)}</div>
          <div>Acc Z: {sensor.acc_z?.toFixed(3)}</div>
          <div>Incli X: {sensor.incli_x?.toFixed(3)}</div>
        </div>
      )}
    </div>
  );
};
```

### ✅ Test Fase 4:
- [ ] WebSocket connection frontend
- [ ] Real-time sensor updates
- [ ] Sensor cards con status
- [ ] Online/offline detection
- [ ] Performance con molti sensori

---

## 📊 FASE 5: Analytics & Monitoring

### 5.1 Uptime Calculation
```python
# backend/apps/mqtt/services/analytics.py
class UptimeCalculator:

    @staticmethod
    def calculate_sensor_uptime(sensor_device: SensorDevice, hours: int = 24) -> float:
        """Calcola uptime sensore nelle ultime X ore"""
        from datetime import timedelta

        end_time = timezone.now()
        start_time = end_time - timedelta(hours=hours)

        # Count expected heartbeats (ogni 5 secondi = 720 per ora)
        expected_beats = hours * 720

        # Count actual data points
        actual_beats = SensorData.objects.filter(
            sensor_device=sensor_device,
            received_at__gte=start_time,
            received_at__lte=end_time
        ).count()

        return (actual_beats / expected_beats) * 100 if expected_beats > 0 else 0

    @staticmethod
    def get_connection_downtime_periods(mqtt_connection: MqttConnection, hours: int = 24):
        """Identifica periodi di disconnessione"""
        from datetime import timedelta

        end_time = timezone.now()
        start_time = end_time - timedelta(hours=hours)

        disconnection_logs = ConnectionLog.objects.filter(
            mqtt_connection=mqtt_connection,
            event_type__in=['disconnected', 'heartbeat_missed'],
            timestamp__gte=start_time
        ).order_by('timestamp')

        # Logic per calcolare downtime periods
        # Return list di periodi con start/end time
```

### ✅ Test Fase 5:
- [ ] Calcolo uptime accurato
- [ ] Identificazione pattern disconnessioni
- [ ] Export dati per reporting
- [ ] Alert su anomalie

---

## 🔧 Configurazione Deployment

### Docker Compose Addition
```yaml
# docker-compose.yml - aggiungere servizio
services:
  mqtt-worker:
    build: ./backend
    command: python manage.py run_mqtt
    depends_on:
      - postgres
      - redis
    environment:
      - DJANGO_SETTINGS_MODULE=config.settings
    volumes:
      - ./backend:/app
    restart: unless-stopped
```

### Settings MQTT
```python
# backend/config/settings.py
MQTT_SETTINGS = {
    'HEARTBEAT_TIMEOUT': 30,  # secondi
    'MAX_CONSECUTIVE_MISSES': 3,
    'DEFAULT_QOS': 0,
    'RECONNECT_DELAY': 5,
    'MAX_RECONNECT_DELAY': 300,
    'SENSOR_DATA_RETENTION': 3,  # numero record da mantenere
}
```

---

## 🧪 Piano di Testing

### Test di Integrazione per ogni fase:
1. **Database**: Migrations, relationships, constraints
2. **MQTT Service**: Mock broker, message parsing, error handling
3. **Admin Dashboard**: UI functionality, real-time updates
4. **Frontend**: WebSocket connections, state management
5. **Analytics**: Accuracy calcoli, performance queries

### Load Testing:
- 20 connessioni simultanee
- 100 sensori per sito
- Heartbeat ogni 5 secondi
- Monitor memory/CPU usage

---

## 📋 Checklist Avanzamento

### ✅ Fase 1: Database & Models
- [ ] Modelli creati e testati
- [ ] Admin interface configurato
- [ ] Seed data per testing

### ⏳ Fase 2: MQTT Core Service
- [ ] Client manager funzionante
- [ ] Message parsing implementato
- [ ] Rolling data system
- [ ] Error handling e retry logic

### ⏳ Fase 3: Admin Dashboard
- [ ] Dashboard MQTT operativo
- [ ] Controls start/stop
- [ ] Real-time monitoring

### ⏳ Fase 4: Frontend Real-time
- [ ] WebSocket integration
- [ ] Sensor cards responsive
- [ ] State management ottimizzato

### ⏳ Fase 5: Analytics & Monitoring
- [ ] Uptime calculations
- [ ] Alerting system
- [ ] Performance monitoring

**Pronto per iniziare con la Fase 1?** 🚀