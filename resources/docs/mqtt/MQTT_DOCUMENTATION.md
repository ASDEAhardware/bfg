# Sistema MQTT - Documentazione Completa

**Versione:** 2.0
**Data Ultimo Aggiornamento:** 2025-11-11
**Status:** Produzione

---

## 📑 Indice

1. [Overview & Architettura](#1-overview--architettura)
2. [Backend Implementation](#2-backend-implementation)
3. [Frontend Implementation](#3-frontend-implementation)
4. [Flussi Operativi Completi](#4-flussi-operativi-completi)
5. [API Reference](#5-api-reference)
6. [Testing & Troubleshooting](#6-testing--troubleshooting)
7. [Deploy & Configurazione](#7-deploy--configurazione)

---

## 1. Overview & Architettura

### 1.1 Cos'è il Sistema MQTT

Il sistema MQTT di BFG gestisce la comunicazione in tempo reale con datalogger e sensori distribuiti nei vari siti. Supporta:

- **Multi-sito**: Ogni sito ha la propria connessione MQTT configurabile
- **Auto-discovery**: Scoperta automatica di topic e dispositivi
- **Real-time updates**: Aggiornamenti in tempo reale tramite WebSocket
- **Monitoring dinamico**: Rilevamento automatico dispositivi offline
- **Versioning API**: Supporto diverse versioni protocollo MQTT

### 1.2 Architettura Completa

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Frontend (Next.js)                          │
│  ┌────────────────┐  ┌─────────────────┐  ┌───────────────────┐   │
│  │  DataLogger    │  │   useMqtt       │  │  useMqttStatus    │   │
│  │  ListPage      │  │   Hooks         │  │  Socket (WS)      │   │
│  └────────┬───────┘  └────────┬────────┘  └─────────┬─────────┘   │
│           │                    │                      │              │
│           │ HTTP/REST          │ HTTP/REST            │ WebSocket   │
└───────────┼────────────────────┼──────────────────────┼─────────────┘
            │                    │                      │
            ▼                    ▼                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Backend Container (Docker)                        │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Supervisor Process Manager                 │  │
│  │  ┌────────────┐  ┌────────────┐  ┌─────────────────────┐   │  │
│  │  │ Gunicorn   │  │  Daphne    │  │  MQTT Service       │   │  │
│  │  │ :8000      │  │  :8001     │  │  (Permanent)        │   │  │
│  │  │ (REST API) │  │ (WebSocket)│  │  manage.py start... │   │  │
│  │  └─────┬──────┘  └─────┬──────┘  └──────────┬──────────┘   │  │
│  └────────┼───────────────┼────────────────────┼──────────────┘  │
│           │               │                    │                   │
│           │               │                    │                   │
│  ┌────────▼───────────────▼────────────────────▼────────────────┐ │
│  │              Django Application Layer                         │ │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │ │
│  │  │ API Views   │  │  Signals     │  │  MQTTService     │   │ │
│  │  │             │  │  (post_save) │  │  (Singleton)     │   │ │
│  │  └──────┬──────┘  └──────┬───────┘  └────────┬─────────┘   │ │
│  │         │                 │                   │              │ │
│  │         │                 ▼                   │              │ │
│  │         │      ┌──────────────────┐          │              │ │
│  │         │      │ WebSocket        │          │              │ │
│  │         │      │ Broadcast        │          │              │ │
│  │         │      └──────────────────┘          │              │ │
│  │         │                                     │              │ │
│  │         ▼                                     ▼              │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │              PostgreSQL Database                      │  │ │
│  │  │  MqttConnection, Datalogger, Sensor, etc.           │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                              │                                      │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
                               ▼ MQTT Protocol
                    ┌──────────────────────┐
                    │   MQTT Broker        │
                    │   (External)         │
                    │   - Mosquitto        │
                    │   - EMQ X            │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │  IoT Devices         │
                    │  - Dataloggers       │
                    │  - Sensors           │
                    └──────────────────────┘
```

### 1.3 Componenti Principali

| Componente | Tecnologia | Porta | Scopo |
|------------|-----------|-------|-------|
| **Frontend** | Next.js 14 | 3000 | UI React |
| **Gunicorn** | WSGI Server | 8000 | API REST Django |
| **Daphne** | ASGI Server | 8001 | WebSocket real-time |
| **Supervisor** | Process Manager | - | Gestione processi |
| **MQTTService** | Python Singleton | - | Gestione connessioni MQTT |
| **PostgreSQL** | Database | 5432 | Persistenza dati |
| **MQTT Broker** | Mosquitto/EMQ | 1883 | Message broker |

---

## 2. Backend Implementation

### 2.1 Startup Sequence

```bash
1. Docker avvia container backend
2. Dockerfile CMD: supervisord -c /app/supervisord.conf
3. Supervisor avvia 3 programmi:
   a) gunicorn (priority 100)
   b) daphne (priority 150)
   c) mqtt_service (priority 200)
4. mqtt_service esegue: python manage.py start_mqtt_service
5. start_mqtt_service avvia MQTTService singleton
6. MQTTService.start():
   - Carica connessioni is_enabled=True dal DB
   - Crea MQTTConnectionManager per ogni sito
   - Avvia monitor thread (loop ogni 30s)
7. Sistema operativo
```

**File:** `/backend/supervisord.conf`

```ini
[program:gunicorn]
command=python /app/start_gunicorn.py
autostart=true
autorestart=true
priority=100

[program:daphne]
command=daphne -b 0.0.0.0 -p 8001 config.asgi:application
autostart=true
autorestart=true
priority=150

[program:mqtt_service]
command=python manage.py start_mqtt_service --log-level INFO
autostart=true
autorestart=true
priority=200
stopwaitsecs=30
```

### 2.2 MQTTService (Singleton)

**File:** `/backend/mqtt/services/mqtt_service.py`

**Responsabilità:**
- Gestisce registry di tutte le connessioni MQTT attive
- Thread-safe con RLock
- Monitor thread per health check e riconnessioni
- Process messaggi MQTT tramite callback

**Metodi Principali:**

```python
class MQTTService:
    def start() -> bool:
        """Avvia servizio e tutte le connessioni abilitate"""

    def stop() -> bool:
        """Ferma servizio con graceful shutdown parallelo"""

    def start_connection(site_id: int) -> Dict:
        """Avvia connessione per sito specifico"""

    def stop_connection(site_id: int) -> Dict:
        """Ferma connessione per sito specifico"""

    def monitor_connections():
        """Thread che gira ogni 30s per:
        - Rilevare nuovi siti abilitati
        - Riconnettere connessioni perse
        - Fermare connessioni disabilitate
        - Check dispositivi offline
        """

    def process_message(site_id, topic, payload):
        """Callback per messaggi MQTT ricevuti"""
```

**Caratteristiche:**
- ✅ Singleton pattern (unica istanza)
- ✅ Instance ID basato su hostname (per client MQTT fissi)
- ✅ Graceful shutdown con timeout 5s
- ✅ Disconnessioni parallele (non sequenziali)

### 2.3 Monitor Thread (Cuore del Sistema)

**Frequenza:** Ogni 30 secondi

**Logica:**

```python
while not self._should_stop:
    # 1. Trova siti abilitati senza connessione attiva
    sites_to_check = MqttConnection.objects.filter(
        is_enabled=True
    ).exclude(
        id__in=list(self.connections.keys())
    ).filter(
        Q(mqtt_next_retry__isnull=True) | Q(mqtt_next_retry__lte=now)
    )

    # 2. Avvia connessioni mancanti
    for mqtt_conn in sites_to_check:
        self.start_connection(mqtt_conn.site.id, manual=False)

    # 3. Ferma connessioni per siti disabilitati
    disabled_connections = MqttConnection.objects.filter(
        id__in=list(self.connections.keys()),
        is_enabled=False
    )

    for mqtt_conn in disabled_connections:
        self.stop_connection(mqtt_conn.site.id)

    # 4. Check dispositivi offline
    message_processor.check_offline_devices()

    time.sleep(30)
```

**IMPORTANTE:** Questo è il motivo per cui start/stop API non avviano/fermano direttamente le connessioni, ma settano solo `is_enabled` e aspettano il monitor.

### 2.4 API Endpoints (Control)

**File:** `/backend/mqtt/api/views.py`

#### Start Connection

```python
@api_view(['POST'])
@permission_classes([IsAuthenticated])  # Superuser only
def start_connection(request, site_id):
    # 1. Setta is_enabled=True nel DB
    conn, created = MqttConnection.objects.update_or_create(
        site_id=int(site_id),
        defaults={'is_enabled': True}
    )

    # 2. Risponde immediatamente (non attende connessione)
    return Response({
        'success': True,
        'message': f'Site {site_id} enabled. Connection will be started by the monitor shortly.'
    })
```

#### Stop Connection

```python
@api_view(['POST'])
@permission_classes([IsAuthenticated])  # Superuser only
def stop_connection(request, site_id):
    # 1. Setta is_enabled=False nel DB
    connection = get_object_or_404(MqttConnection, site_id=int(site_id))
    connection.is_enabled = False
    connection.save()

    # 2. Risponde immediatamente (non attende disconnessione)
    return Response({
        'success': True,
        'message': f'Site {site_id} disabled. Connection will be stopped by the monitor shortly.'
    })
```

**⚠️ NOTA CRITICA:** Le API **NON** chiamano `mqtt_service.start_connection()` o `mqtt_service.stop_connection()` direttamente. Modificano solo il DB e lasciano al monitor thread il compito di applicare le modifiche.

### 2.5 WebSocket Real-Time Updates

**Componenti:**

1. **Signal Handler** (`/backend/mqtt/signals.py`)
2. **Broadcast Function** (`/backend/mqtt/services/broadcast.py`)
3. **WebSocket Consumer** (`/backend/mqtt/consumers.py`)

**Flusso:**

```python
# 1. MQTTConnectionManager aggiorna status nel DB
mqtt_conn.status = 'connected'
mqtt_conn.save(update_fields=['status'])

# 2. Django Signal post_save viene triggato
@receiver(post_save, sender=MqttConnection)
def mqtt_connection_post_save(sender, instance, created, update_fields, **kwargs):
    # Solo se 'status' è cambiato (non quando is_enabled cambia)
    if update_fields and 'status' in update_fields:
        broadcast_status_update(
            site_id=instance.site.id,
            status=instance.status,
            is_enabled=instance.is_enabled
        )

# 3. Broadcast invia messaggio al gruppo WebSocket
def broadcast_status_update(site_id: int, status: str, is_enabled: bool):
    channel_layer = get_channel_layer()
    message = {
        'type': 'status.update',
        'message': {
            'site_id': site_id,
            'status': status,
            'is_enabled': is_enabled
        }
    }
    async_to_sync(channel_layer.group_send)("mqtt_status_updates", message)

# 4. Consumer inoltra a tutti i client connessi
class MqttStatusConsumer(AsyncWebsocketConsumer):
    async def status_update(self, event):
        message = event["message"]
        await self.send(text_data=json.dumps(message))
```

**Best Practices Implementate:**
- ✅ Broadcast solo su cambio `status` (non `is_enabled`)
- ✅ Evita loop infiniti (ottimistic update + real update)
- ✅ Gruppo unico per tutti i client
- ✅ Reconnect automatico client-side

### 2.6 Database Models

**File:** `/backend/mqtt/models.py`

#### MqttConnection

```python
class MqttConnection(models.Model):
    site = OneToOneField('sites.Site')
    broker_host = CharField(max_length=255)
    broker_port = IntegerField(default=1883)
    username = CharField(max_length=100)
    password = CharField(max_length=100)
    client_id_prefix = CharField(max_length=50)

    # Status fields
    is_enabled = BooleanField(default=True)
    status = CharField(choices=STATUS_CHOICES)  # connected/connecting/disconnected/error/disabled

    # Monitoring fields
    last_connected_at = DateTimeField(null=True)
    last_heartbeat_at = DateTimeField(null=True)
    connection_errors = IntegerField(default=0)
    error_message = TextField(blank=True)

    # Retry fields
    mqtt_retry_count = IntegerField(default=0)
    mqtt_next_retry = DateTimeField(null=True)
```

**Stati possibili:**
- `connecting` - In fase di connessione
- `connected` - Connesso e operativo
- `disconnected` - Disconnesso
- `disabled` - Disabilitato manualmente (stato di transizione durante stop)
- `error` - Errore di connessione

---

## 3. Frontend Implementation

### 3.1 Hooks React

**File:** `/frontend/src/hooks/useMqtt.ts`

#### useMqttConnectionStatus

```typescript
export function useMqttConnectionStatus(siteId: number | null) {
  const { data: connection, isLoading, error, refetch } = useQuery<MqttConnectionStatus>({
    queryKey: ['mqttConnectionStatus', siteId],
    queryFn: async () => {
      const response = await api.get(`v1/mqtt/sites/${siteId}/status/`);
      return response.data;
    },
    enabled: !!siteId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  return {
    connection,
    loading: isLoading,
    error,
    refresh: refetch
  };
}
```

#### useMqttControl

```typescript
export function useMqttControl() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ siteId, action }) => {
      return api.post(`v1/mqtt/sites/${siteId}/${action}/`);
    },
    onMutate: async ({ siteId, action }) => {
      // Optimistic update
      queryClient.setQueryData(['mqttConnectionStatus', siteId], (old: any) => ({
        ...old,
        status: action === 'start' ? 'connecting' : 'disabled',
        is_enabled: action === 'start',
      }));
    },
    onSuccess: (data, variables) => {
      toast.success(`MQTT Connection ${variables.action === 'start' ? 'Started' : 'Stopped'}`);
    },
  });

  return {
    startConnection: (siteId) => mutation.mutate({ siteId, action: 'start' }),
    stopConnection: (siteId) => mutation.mutate({ siteId, action: 'stop' }),
    loading: mutation.isPending,
  };
}
```

### 3.2 WebSocket Hook

**File:** `/frontend/src/hooks/useMqttStatusSocket.ts`

```typescript
export const useMqttStatusSocket = () => {
  const queryClient = useQueryClient();
  const ws = useRef<WebSocket | null>(null);

  const connectWebSocket = useCallback(() => {
    const url = `ws://localhost:8001/ws/status/`;
    ws.current = new WebSocket(url);

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const { site_id, status, is_enabled } = data;

      // Invalida query per triggare refetch automatico
      queryClient.invalidateQueries({ queryKey: ['mqttConnectionStatus', site_id] });
      queryClient.invalidateQueries({ queryKey: ['dataloggers', site_id] });

      toast.info(`Site ${site_id} MQTT status: ${status}`);
    };

    ws.current.onclose = () => {
      // Reconnect automatico dopo 5s
      setTimeout(connectWebSocket, 5000);
    };
  }, [queryClient]);

  useEffect(() => {
    connectWebSocket();
    return () => ws.current?.close();
  }, [connectWebSocket]);
};
```

**Strategia di Update:**
- ✅ Usa `invalidateQueries` invece di `setQueryData`
- ✅ Lascia che React Query faccia refetch automatico
- ✅ Garantisce dati sempre sincronizzati con backend

### 3.3 UI Components

#### DataLoggerListPage

**File:** `/frontend/src/plugins/datalogger/DataLoggerListPage.tsx`

**Caratteristiche:**
- Badge MQTT status con colori dinamici
- Admin menu (shield icon) per start/stop/discovery
- Sincronizzazione label + icona (fix recente linea 278-284):

```typescript
<Button
  disabled={isMqttControlLoading || mqttConnection?.status === 'connecting' || mqttConnection?.status === 'disabled'}
>
  {(isMqttControlLoading || mqttConnection?.status === 'connecting' || mqttConnection?.status === 'disabled') ? (
    <RefreshCw className="h-4 w-4 animate-spin" />
  ) : (
    <Shield className="h-4 w-4" />
  )}
</Button>
```

**Logica Badge Status:**

```typescript
const getMqttStatusBadge = () => {
  switch (mqttConnection.status) {
    case 'connected':
      return { text: "MQTT connected", className: "bg-green-100" };
    case 'connecting':
      return { text: "Connecting...", className: "bg-blue-100 animate-pulse" };
    case 'disconnected':
      return { text: "MQTT disconnected", className: "bg-orange-100" };
    case 'disabled':
      return { text: "Disconnecting...", className: "bg-orange-100 animate-pulse" };
    case 'error':
      return { text: "MQTT error", className: "bg-red-100" };
  }
};
```

---

## 4. Flussi Operativi Completi

### 4.1 Scenario: Admin Clicca "Start MQTT"

**Timeline Dettagliata:**

```
T+0ms:    Admin clicca pulsante "Start MQTT"
          ↓
T+10ms:   useMqttControl hook chiama mutation
          ↓
T+20ms:   onMutate: Optimistic update
          - queryClient.setQueryData(['mqttConnectionStatus', site_id])
          - status → 'connecting'
          - UI: Badge mostra "Connecting..." con pulse
          - UI: Icona Shield mostra spinner
          ↓
T+50ms:   HTTP POST /api/v1/mqtt/sites/1/start/
          ↓
T+100ms:  Backend API:
          - MqttConnection.objects.update_or_create(is_enabled=True)
          - Risponde {"success": true, "message": "...monitor shortly"}
          ↓
T+150ms:  Frontend riceve response
          - onSuccess: toast.success("MQTT Started")
          - UI: Label continua a mostrare "Connecting..." ✅
          - UI: Icona continua spinner ✅
          ↓
T+200ms:  [ATTESA] Frontend in stato ottimistico
          ↓
T+0-30s:  Monitor thread nel suo ciclo periodico (30s)
          - Rileva is_enabled=True
          - Nessuna connessione attiva per site_id
          ↓
T+30s:    Monitor chiama mqtt_service.start_connection(site_id)
          ↓
T+30.1s:  MQTTConnectionManager:
          - Legge config da DB
          - Crea client paho-mqtt
          - client.connect(broker_host, broker_port)
          ↓
T+30.3s:  Broker MQTT risponde CONNACK
          ↓
T+30.4s:  MQTTConnectionManager on_connect callback:
          - mqtt_conn.status = 'connected'
          - mqtt_conn.last_connected_at = now()
          - mqtt_conn.save(update_fields=['status', 'last_connected_at'])
          ↓
T+30.5s:  Django Signal post_save:
          - Rileva update_fields contiene 'status'
          - broadcast_status_update(site_id, 'connected', True)
          ↓
T+30.6s:  Channels group_send al gruppo "mqtt_status_updates"
          ↓
T+30.7s:  MqttStatusConsumer inoltra a tutti i WebSocket client
          ↓
T+30.8s:  Frontend useMqttStatusSocket riceve:
          {"site_id": 1, "status": "connected", "is_enabled": true}
          ↓
T+30.9s:  queryClient.invalidateQueries(['mqttConnectionStatus', 1])
          ↓
T+31s:    React Query esegue refetch automatico
          - GET /api/v1/mqtt/sites/1/status/
          ↓
T+31.1s:  Frontend riceve status aggiornato dal DB
          ↓
T+31.2s:  UI AGGIORNATA:
          - Badge: "MQTT connected" (verde, no pulse) ✅
          - Icona: Shield statico (no spinner) ✅
          - toast.info("Site 1 MQTT status: connected")
```

**Durata Totale:** ~31 secondi (dipende da ciclo monitor)

### 4.2 Scenario: Admin Clicca "Stop MQTT"

**Timeline Simile ma al Contrario:**

```
T+0ms:    Click "Stop MQTT"
T+20ms:   Optimistic update: status → 'disabled'
          UI: Badge "Disconnecting..." con pulse
          UI: Icona spinner
T+100ms:  API: is_enabled=False salvato nel DB
T+0-30s:  Monitor rileva is_enabled=False
T+30s:    Monitor chiama stop_connection(site_id)
T+30.1s:  MQTTConnectionManager.disconnect()
T+30.2s:  DB: status = 'disconnected'
T+30.3s:  Signal → Broadcast → WebSocket
T+31s:    UI: Badge "MQTT disconnected" ✅
```

### 4.3 Scenario: Connessione Persa (Crash Broker)

```
T+0s:     Broker MQTT crasha
          ↓
T+1s:     paho-mqtt client rileva disconnessione
          ↓
T+2s:     MQTTConnectionManager on_disconnect callback:
          - mqtt_conn.status = 'error'
          - mqtt_conn.error_message = "Connection lost"
          - mqtt_conn.mqtt_retry_count += 1
          - mqtt_conn.save(update_fields=['status', 'error_message', 'mqtt_retry_count'])
          ↓
T+3s:     Signal → Broadcast → WebSocket
          ↓
T+4s:     Frontend riceve status='error'
          - UI: Badge "MQTT error" (rosso)
          ↓
T+0-30s:  Monitor thread nel prossimo ciclo
          - Rileva connessione persa
          - Retry automatico (exponential backoff)
          - Delay = min(5 * 2^retry_count, 300)
          ↓
T+30s+5s: Primo retry (5s delay)
          ↓
Se successo:
  - status = 'connected'
  - WebSocket notifica frontend
  - UI: Badge verde

Se fallito:
  - retry_count++
  - Prossimo retry dopo 10s, poi 20s, 40s, ...
```

---

## 5. API Reference

### 5.1 Control Endpoints

#### Start Connection

```http
POST /api/v1/mqtt/sites/{site_id}/start/
Authorization: Bearer <token>
```

**Permessi:** Superuser only

**Response:**
```json
{
  "success": true,
  "message": "Site 1 enabled. Connection will be started by the monitor shortly."
}
```

#### Stop Connection

```http
POST /api/v1/mqtt/sites/{site_id}/stop/
Authorization: Bearer <token>
```

**Permessi:** Superuser only

**Response:**
```json
{
  "success": true,
  "message": "Site 1 disabled. Connection will be stopped by the monitor shortly."
}
```

#### Connection Status

```http
GET /api/v1/mqtt/sites/{site_id}/status/
Authorization: Bearer <token>
```

**Permessi:** Authenticated users

**Response:**
```json
{
  "connection_id": 1,
  "site_id": 1,
  "site_name": "Site 001",
  "is_enabled": true,
  "status": "connected",
  "broker_host": "mqtt.example.com",
  "broker_port": 1883,
  "last_connected_at": "2025-11-11T10:30:00Z",
  "last_heartbeat_at": "2025-11-11T10:35:12Z",
  "connection_errors": 0,
  "error_message": "",
  "handler_running": true,
  "handler_connected": true,
  "retry_count": 0,
  "subscribed_topics": 5,
  "topics_list": [
    "site_001/gateway/+/heartbeat",
    "site_001/datalogger/+/+/heartbeat"
  ]
}
```

#### Health Check (No Auth)

```http
GET /api/v1/mqtt/health/
```

**Response:**
```json
{
  "status": "healthy",
  "service": {
    "running": true,
    "instance_id": "bfg_back"
  },
  "connections": {
    "total": 2,
    "enabled": 2,
    "healthy": 2,
    "unhealthy": 0
  }
}
```

### 5.2 Data Endpoints

#### Dataloggers List

```http
GET /api/v1/mqtt/dataloggers/?site_id=1&online_only=true
Authorization: Bearer <token>
```

**Response:**
```json
{
  "dataloggers": [
    {
      "id": 15,
      "site_id": 1,
      "serial_number": "MONSTR-001",
      "label": "Datalogger Edificio A",
      "is_online": true,
      "firmware_version": "V.5.53.0",
      "sensors_count": 8,
      "uptime_percentage": 99.21
    }
  ]
}
```

#### Sensors by Datalogger

```http
GET /api/v1/mqtt/sensors/by_datalogger?datalogger_id=15
Authorization: Bearer <token>
```

**Response:**
```json
{
  "sensors": [
    {
      "id": 42,
      "label": "Temperatura Esterna",
      "sensor_type": "temperature",
      "is_online": true,
      "current_value": 22.5,
      "unit_of_measure": "°C"
    }
  ]
}
```

### 5.3 Publish Message

```http
POST /api/v1/mqtt/sites/{site_id}/publish/
Authorization: Bearer <token>
Content-Type: application/json

{
  "topic": "site_001/gateway/1/datalogger/monstro/15/input",
  "message": "start",
  "qos": 1
}
```

**Response:**
```json
{
  "success": true,
  "message": "Message published successfully"
}
```

---

## 6. Testing & Troubleshooting

### 6.1 Verifica Sistema Attivo

```bash
# 1. Verifica container running
podman ps | grep bfg_backend

# 2. Verifica processi supervisor
podman exec bfg_backend supervisorctl status

# Output atteso:
# daphne                           RUNNING   pid 123, uptime 1:23:45
# gunicorn                         RUNNING   pid 124, uptime 1:23:45
# mqtt_service                     RUNNING   pid 125, uptime 1:23:45

# 3. Health check MQTT
curl http://localhost:8000/api/v1/mqtt/health/

# 4. Status dettagliato
podman exec bfg_backend python manage.py start_mqtt_service --status
```

### 6.2 Problemi Comuni

#### Badge UI rimane "Connecting..." infinito

**Causa:** Monitor thread non ha ancora processato la richiesta O connessione al broker fallita

**Debug:**
```bash
# 1. Verifica mqtt_service running
podman exec bfg_backend supervisorctl status mqtt_service

# 2. Controlla logs in tempo reale
podman logs bfg_backend -f | grep MQTT

# 3. Verifica status DB
podman exec bfg_backend python manage.py shell -c "
from mqtt.models import MqttConnection
conn = MqttConnection.objects.get(site_id=1)
print(f'Status: {conn.status}, Enabled: {conn.is_enabled}')
"

# 4. Verifica broker raggiungibile
podman exec bfg_backend ping -c 3 <broker_host>
```

**Soluzioni:**
- Attendere max 30s (ciclo monitor)
- Verificare credenziali MQTT corrette
- Verificare broker online

#### WebSocket non riceve aggiornamenti

**Causa:** Daphne non running O problema Redis (channels layer)

**Debug:**
```bash
# 1. Verifica Daphne
podman exec bfg_backend supervisorctl status daphne

# 2. Test WebSocket manuale
# Da browser console:
const ws = new WebSocket('ws://localhost:8001/ws/status/');
ws.onmessage = (e) => console.log(JSON.parse(e.data));

# 3. Verifica Redis (se usato)
podman exec bfg_backend redis-cli ping
```

**Soluzioni:**
- Restart Daphne: `supervisorctl restart daphne`
- Verificare CHANNEL_LAYERS in settings.py

#### Icona Shield e Label non sincronizzati

**Causa:** Logica UI obsoleta (FIX già applicato)

**Verifica Fix:**
```bash
# Controlla linea 278-284 in DataLoggerListPage.tsx
grep -A 5 "isMqttControlLoading || mqttConnection?.status" \
  frontend/src/plugins/datalogger/DataLoggerListPage.tsx
```

**Output atteso:**
```typescript
disabled={isMqttControlLoading || mqttConnection?.status === 'connecting' || mqttConnection?.status === 'disabled'}
```

### 6.3 Comandi Utili

```bash
# Restart singolo servizio
podman exec bfg_backend supervisorctl restart mqtt_service

# Logs separati
podman exec bfg_backend supervisorctl tail -f mqtt_service
podman exec bfg_backend supervisorctl tail -f gunicorn
podman exec bfg_backend supervisorctl tail -f daphne

# Stop/Start manuale
podman exec bfg_backend supervisorctl stop mqtt_service
podman exec bfg_backend supervisorctl start mqtt_service

# Verifica topic sottoscritti
podman exec bfg_backend python manage.py shell -c "
from mqtt.models import MqttConnection
conn = MqttConnection.objects.get(site_id=1)
for topic in conn.topics.filter(is_active=True):
    print(topic.get_full_topic())
"
```

---

## 7. Deploy & Configurazione

### 7.1 Variabili Ambiente

**File:** `.env` o `docker-compose.yml`

```bash
# MQTT Service Configuration
MQTT_INSTANCE_ID=bfg_back           # Instance ID per client MQTT fissi
MQTT_CLEAN_SESSION=true             # Elimina sessioni zombie
MQTT_LWT_ENABLED=true               # Last Will and Testament
MQTT_KEEP_ALIVE=60                  # Keepalive seconds
MQTT_SHUTDOWN_TIMEOUT=5             # Graceful shutdown timeout

# WebSocket
DJANGO_CHANNEL_LAYERS=redis         # Channels backend
REDIS_URL=redis://redis:6379/0      # Redis per WebSocket

# Database
DATABASE_URL=postgresql://...
```

### 7.2 Deploy Production

```bash
# 1. Stop containers
podman-compose down

# 2. Pull codice
git pull origin main

# 3. Rebuild immagini
podman-compose build --no-cache

# 4. Avvia
podman-compose up -d

# 5. Migrations
podman exec bfg_backend python manage.py migrate

# 6. Verifica
podman exec bfg_backend python manage.py start_mqtt_service --status

# 7. Logs real-time
podman logs bfg_backend -f
```

### 7.3 Backup Prima di Deploy

```bash
# Database
podman exec bfg_postgres pg_dump -U postgres bfg > backup_$(date +%Y%m%d).sql

# Environment
cp .env .env.backup

# Logs
podman logs bfg_backend > backend_logs_$(date +%Y%m%d).log
```

### 7.4 Rollback Procedure

```bash
# 1. Stop containers
podman-compose down

# 2. Restore codice
git checkout <previous-commit>

# 3. Restore DB (se necessario)
podman exec -i bfg_postgres psql -U postgres bfg < backup_20251111.sql

# 4. Restart
podman-compose up -d
```

### 7.5 Monitoring Production

**Metriche da Monitorare:**

| Metrica | Comando | Target |
|---------|---------|--------|
| MQTT Status | `curl /api/v1/mqtt/health/` | 200 OK |
| Supervisor | `supervisorctl status` | All RUNNING |
| Memoria | `docker stats bfg_backend` | < 80% |
| CPU | `docker stats bfg_backend` | < 70% |
| Logs Errori | `grep ERROR backend_logs.log` | 0 errors/hour |

**Alert Setup (opzionale):**

```bash
# Crontab monitoring script
*/5 * * * * /scripts/mqtt_health_check.sh

# /scripts/mqtt_health_check.sh
#!/bin/bash
STATUS=$(curl -s http://localhost:8000/api/v1/mqtt/health/ | jq -r '.status')
if [ "$STATUS" != "healthy" ]; then
    echo "MQTT Service UNHEALTHY" | mail -s "ALERT" admin@example.com
fi
```

---

## 📋 Checklist Pre-Produzione

- [ ] Backup database completo
- [ ] Test start/stop MQTT da UI
- [ ] Verifica WebSocket funzionante
- [ ] Test riconnessione automatica (simulare crash)
- [ ] Verifica logs senza errori per 15 minuti
- [ ] Test con tutti i siti configurati
- [ ] Verifica credenziali MQTT corrette
- [ ] Monitoring alert configurati
- [ ] Documentazione team aggiornata
- [ ] Rollback procedure testata

---

## 📚 Riferimenti

- **Paho MQTT:** https://www.eclipse.org/paho/index.php?page=clients/python/index.php
- **Django Channels:** https://channels.readthedocs.io/
- **Supervisor:** http://supervisord.org/
- **React Query:** https://tanstack.com/query/latest

---

**Fine Documentazione** ✅

**Versione:** 2.0
**Autore:** BFG Team
**Ultimo Aggiornamento:** 2025-11-11
