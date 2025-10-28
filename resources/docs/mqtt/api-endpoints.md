# API Endpoints MQTT

## Base URL

```
http://localhost:8000/api/v1/mqtt/
```

## Autenticazione

Tutti gli endpoint richiedono autenticazione tramite JWT token.

```http
Authorization: Bearer <access_token>
```

## Endpoints

### 1. Controllo Connessioni MQTT

#### Start Connection

Avvia la connessione MQTT per un sito specifico.

```http
POST /api/v1/mqtt/sites/{site_id}/start/
```

**Permessi:** Superuser only

**Response:**
```json
{
  "success": true,
  "message": "MQTT connection started successfully for Site Site Name",
  "connection_id": 1
}
```

**Errori:**
```json
{
  "success": false,
  "message": "MQTT connection not found for this site"
}
```

**Esempio curl:**
```bash
curl -X POST http://localhost:8000/api/v1/mqtt/sites/1/start/ \
  -H "Authorization: Bearer <token>"
```

---

#### Stop Connection

Ferma la connessione MQTT per un sito.

```http
POST /api/v1/mqtt/sites/{site_id}/stop/
```

**Permessi:** Superuser only

**Response:**
```json
{
  "success": true,
  "message": "MQTT connection stopped successfully for Site Site Name"
}
```

---

#### Connection Status

Ottiene lo stato della connessione MQTT per un sito.

```http
GET /api/v1/mqtt/sites/{site_id}/status/
```

**Permessi:** Tutti gli utenti autenticati del sito

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
  "last_connected_at": "2024-10-27T10:30:00Z",
  "last_heartbeat_at": "2024-10-27T10:35:12Z",
  "connection_errors": 0,
  "error_message": "",
  "handler_running": true,
  "handler_connected": true,
  "retry_count": 0,
  "subscribed_topics": 5
}
```

**Stati possibili:**
- `connected`: Connesso e operativo
- `connecting`: In fase di connessione
- `disconnected`: Disconnesso
- `error`: Errore di connessione
- `disabled`: Connessione disabilitata

---

#### Force Discovery

Forza la scoperta di tutti i topic attivi.

```http
POST /api/v1/mqtt/sites/{site_id}/discover/
```

**Permessi:** Superuser only

**Response:**
```json
{
  "success": true,
  "message": "Topic discovery completed",
  "success_count": 12,
  "error_count": 0,
  "topics": [
    {
      "topic": "site_001/gateway/1/heartbeat",
      "processed": true
    },
    {
      "topic": "site_001/datalogger/monstro/15/heartbeat",
      "processed": true
    }
  ]
}
```

---

### 2. Manager Status

#### Manager Status

Ottiene lo stato generale del MQTT Manager.

```http
GET /api/v1/mqtt/manager/status/
```

**Permessi:** Superuser only

**Response:**
```json
{
  "is_running": true,
  "active_connections": 3,
  "total_messages_processed": 15847,
  "uptime_seconds": 3600,
  "connections": [
    {
      "site_id": 1,
      "site_name": "Site 001",
      "status": "connected",
      "messages_today": 5230
    }
  ]
}
```

---

#### Restart Manager

Riavvia il MQTT Manager (tutte le connessioni).

```http
POST /api/v1/mqtt/manager/restart/
```

**Permessi:** Superuser only

**Response:**
```json
{
  "success": true,
  "message": "MQTT Manager restarted successfully",
  "active_connections": 3
}
```

---

### 3. Liste Connessioni

#### Connections List

Lista tutte le connessioni MQTT configurate.

```http
GET /api/v1/mqtt/connections/
```

**Permessi:** Superuser only

**Query params:**
- `site_id` (optional): Filtra per sito

**Response:**
```json
{
  "count": 3,
  "results": [
    {
      "id": 1,
      "site_id": 1,
      "site_name": "Site 001",
      "broker_host": "mqtt.example.com",
      "broker_port": 1883,
      "is_enabled": true,
      "status": "connected",
      "last_connected_at": "2024-10-27T10:30:00Z"
    }
  ]
}
```

---

#### All Connections Status

Stato di tutte le connessioni attive.

```http
GET /api/v1/mqtt/connections/status/
```

**Permessi:** Staff users

**Response:**
```json
{
  "total_connections": 3,
  "connected": 2,
  "errors": 1,
  "disabled": 0,
  "connections": [
    {
      "site_id": 1,
      "site_name": "Site 001",
      "status": "connected"
    }
  ]
}
```

---

### 4. Datalogger Endpoints

#### Dataloggers List

Lista datalogger con filtri opzionali.

```http
GET /api/v1/mqtt/dataloggers/
```

**Permessi:** Tutti gli utenti autenticati

**Query params:**
- `site_id` (optional): Filtra per sito
- `is_online` (optional): Filtra online/offline
- `datalogger_type` (optional): Filtra per tipo
- `ordering` (optional): Campo per ordinamento (es: `-last_seen_at`)

**Response:**
```json
{
  "count": 12,
  "results": [
    {
      "id": 15,
      "site_id": 1,
      "site_name": "Site 001",
      "serial_number": "MONSTR-001",
      "label": "Datalogger Edificio A",
      "datalogger_type": "monstro",
      "device_id": "15",
      "is_online": true,
      "last_seen_at": "2024-10-27T10:35:00Z",
      "last_heartbeat": "2024-10-27T10:35:00Z",
      "firmware_version": "V.5.53.0",
      "ip_address": "192.168.1.100",
      "total_heartbeats": 1523,
      "missed_heartbeats": 12,
      "uptime_percentage": 99.21,
      "sensors_count": 8,
      "active_sensors_count": 7,
      "mqtt_api_version": "v1.2.0",
      "created_at": "2024-10-01T00:00:00Z",
      "updated_at": "2024-10-27T10:35:00Z"
    }
  ]
}
```

---

#### Datalogger Detail

Dettagli di un singolo datalogger.

```http
GET /api/v1/mqtt/dataloggers/{datalogger_id}/
```

**Response:**
```json
{
  "id": 15,
  "site_id": 1,
  "site_name": "Site 001",
  "serial_number": "MONSTR-001",
  "label": "Datalogger Edificio A",
  "datalogger_type": "monstro",
  "device_id": "15",
  "is_online": true,
  "last_seen_at": "2024-10-27T10:35:00Z",
  "firmware_version": "V.5.53.0",
  "ip_address": "192.168.1.100",
  "total_heartbeats": 1523,
  "missed_heartbeats": 12,
  "uptime_percentage": 99.21,
  "sensors_count": 8,
  "active_sensors_count": 7,
  "mqtt_api_version": "v1.2.0",
  "gateway": {
    "id": 1,
    "serial_number": "GW-001",
    "label": "Gateway Principale"
  }
}
```

---

#### Update Datalogger Label

Aggiorna il label di un datalogger.

```http
PATCH /api/v1/mqtt/dataloggers/{datalogger_id}/update_label/
```

**Body:**
```json
{
  "label": "Nuovo Nome Datalogger"
}
```

**Response:**
```json
{
  "id": 15,
  "label": "Nuovo Nome Datalogger",
  "message": "Label updated successfully"
}
```

---

### 5. Sensor Endpoints

#### Sensors by Datalogger

Lista sensori filtrati per datalogger.

```http
GET /api/v1/mqtt/sensors/by_datalogger/
```

**Query params:**
- `datalogger_id` (required): ID del datalogger
- `is_online` (optional): Filtra online/offline
- `sensor_type` (optional): Filtra per tipo sensore

**Response:**
```json
{
  "count": 8,
  "results": [
    {
      "id": 42,
      "datalogger_id": 15,
      "datalogger_label": "Datalogger Edificio A",
      "site_name": "Site 001",
      "serial_number": "SENS-TMP-001",
      "label": "Temperatura Esterna",
      "sensor_type": "temperature",
      "unit_of_measure": "°C",
      "is_online": true,
      "current_value": 22.5,
      "last_reading": "2024-10-27T10:35:00Z",
      "total_messages": 8523,
      "total_readings": 8521,
      "min_value_ever": -5.2,
      "max_value_ever": 38.7,
      "first_seen_at": "2024-10-01T00:00:00Z",
      "last_seen_at": "2024-10-27T10:35:00Z",
      "uptime_percentage": 99.85,
      "consecutive_misses": 0,
      "latest_readings": [
        {
          "timestamp": "2024-10-27T10:35:00Z",
          "data": {
            "value": 22.5,
            "quality": "good"
          }
        },
        {
          "timestamp": "2024-10-27T10:34:00Z",
          "data": {
            "value": 22.4,
            "quality": "good"
          }
        }
      ],
      "created_at": "2024-10-01T00:00:00Z",
      "updated_at": "2024-10-27T10:35:00Z"
    }
  ]
}
```

---

#### Sensor Detail

Dettagli di un singolo sensore.

```http
GET /api/v1/mqtt/sensors/{sensor_id}/
```

**Response:**
```json
{
  "id": 42,
  "datalogger_id": 15,
  "datalogger_label": "Datalogger Edificio A",
  "site_name": "Site 001",
  "serial_number": "SENS-TMP-001",
  "label": "Temperatura Esterna",
  "sensor_type": "temperature",
  "unit_of_measure": "°C",
  "is_online": true,
  "current_value": 22.5,
  "last_reading": "2024-10-27T10:35:00Z",
  "total_messages": 8523,
  "total_readings": 8521,
  "min_value_ever": -5.2,
  "max_value_ever": 38.7,
  "uptime_percentage": 99.85,
  "latest_readings": [...]
}
```

---

#### Update Sensor Label

Aggiorna il label di un sensore.

```http
PATCH /api/v1/mqtt/sensors/{sensor_id}/update_label/
```

**Body:**
```json
{
  "label": "Nuovo Nome Sensore"
}
```

**Response:**
```json
{
  "id": 42,
  "label": "Nuovo Nome Sensore",
  "message": "Label updated successfully"
}
```

---

### 6. MQTT Publish/Subscribe

#### Publish Message

Pubblica un messaggio su un topic MQTT.

```http
POST /api/v1/mqtt/sites/{site_id}/publish/
```

**Permessi:** Staff users

**Body:**
```json
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
  "message": "Message published successfully",
  "topic": "site_001/gateway/1/datalogger/monstro/15/input",
  "qos": 1
}
```

**Errori comuni:**
- Connection not active
- Invalid topic format
- Message too large

---

#### Subscribe Topic

Sottoscrive un topic MQTT (per callback).

```http
POST /api/v1/mqtt/sites/{site_id}/subscribe/
```

**Permessi:** Staff users

**Body:**
```json
{
  "topic": "site_001/gateway/1/datalogger/monstro/15/output",
  "callback_url": "/api/datalogger-control/15/mqtt-callback/"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Subscribed to topic successfully",
  "topic": "site_001/gateway/1/datalogger/monstro/15/output"
}
```

---

## Codici di Errore

### 400 Bad Request
- Missing required parameters
- Invalid data format
- Validation errors

### 403 Forbidden
- Insufficient permissions
- Not superuser

### 404 Not Found
- Resource not found
- Connection not configured

### 500 Internal Server Error
- MQTT broker unreachable
- Database error
- Unexpected exception

---

## Rate Limiting

Gli endpoint sono protetti da rate limiting:

- **Publish/Subscribe**: 60 requests/minute per user
- **Status/List**: 120 requests/minute per user
- **Control (Start/Stop)**: 10 requests/minute per user

---

## Esempi Completi

### Python con requests

```python
import requests

BASE_URL = "http://localhost:8000/api/v1/mqtt"
TOKEN = "your_jwt_token"

headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}

# Get dataloggers
response = requests.get(
    f"{BASE_URL}/dataloggers/",
    headers=headers,
    params={"site_id": 1, "is_online": True}
)
dataloggers = response.json()

# Publish command
response = requests.post(
    f"{BASE_URL}/sites/1/publish/",
    headers=headers,
    json={
        "topic": "site_001/gateway/1/datalogger/monstro/15/input",
        "message": "start",
        "qos": 1
    }
)
result = response.json()
```

### JavaScript con fetch

```javascript
const BASE_URL = "http://localhost:8000/api/v1/mqtt";
const TOKEN = "your_jwt_token";

// Get sensors
const response = await fetch(
  `${BASE_URL}/sensors/by_datalogger/?datalogger_id=15`,
  {
    headers: {
      "Authorization": `Bearer ${TOKEN}`,
      "Content-Type": "application/json"
    }
  }
);
const sensors = await response.json();

// Update label
const updateResponse = await fetch(
  `${BASE_URL}/dataloggers/15/update_label/`,
  {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      label: "Nuovo Nome"
    })
  }
);
```

---

## Webhook / Callbacks

Alcuni endpoint supportano callback HTTP per notifiche asincrone:

### Subscribe con Callback

```json
{
  "topic": "site_001/datalogger/+/status",
  "callback_url": "https://your-app.com/mqtt-callback",
  "callback_method": "POST"
}
```

Il sistema invierà POST request al callback_url quando arrivano messaggi:

```json
POST https://your-app.com/mqtt-callback
Content-Type: application/json

{
  "topic": "site_001/datalogger/monstro/15/status",
  "payload": {
    "status": "running",
    "session_id": "sess_12345"
  },
  "timestamp": "2024-10-27T10:35:00Z",
  "qos": 1
}
```
