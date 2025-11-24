# MQTT API Documentation

## Overview

IoT-standard MQTT API for managing sensor data collection, configuration, and monitoring.

**API Version:** `1.0.0` (configured via `MQTT_API_VERSION`)

**Protocol:** JSON-RPC-like message format over MQTT

## Topic Structure

All topics follow the pattern: `{SITE_ID}/gateway/{gateway_id}/datalogger/{datalogger_id}/{function}`

Example: `site_001/gateway/1/datalogger/all/cmd`

## Topics

### Command Topic (cmd)

**Topic:** `{SITE_ID}/gateway/{gateway_id}/datalogger/{datalogger_id}/cmd`

**Direction:** Client → Datalogger

**QoS:** 1 (recommended)

Single topic for all commands and requests.

#### Message Format

```json
{
  "method": "method_name",
  "params": {
    // method-specific parameters
  }
}
```

### Command Response Topic (cmdres)

**Topic:** `{SITE_ID}/gateway/{gateway_id}/datalogger/{datalogger_id}/cmdres`

**Direction:** Datalogger → Client

**QoS:** 1

Responses to commands sent via `cmd` topic.

#### Response Format

**Success:**
```json
{
  "method": "method_name",
  "status": "success",
  "result": {
    // method-specific result data
  }
}
```

**Error:**
```json
{
  "method": "method_name",
  "status": "error",
  "message": "Error description"
}
```

### Telemetry Topic (telemetry)

**Topic:** `{SITE_ID}/gateway/{gateway_id}/datalogger/{datalogger_id}/telemetry`

**Direction:** Datalogger → Client

**QoS:** 0

Periodic system status and sensor data (interval: `MESSAGE_INTERVAL_SECONDS`).

### Data Topic (data)

**Topic:** `{SITE_ID}/gateway/{gateway_id}/datalogger/{datalogger_id}/data`

**Direction:** Datalogger → Client

**QoS:** 1

Large data query results (historical sensor data).

---

## API Methods

### Collection Control

#### start_collection / start_acquisition

Start data collection from sensors.

**Request:**
```json
{
  "method": "start_collection"
}
```

Note: `start_acquisition` is also supported as an alias.

**Response:**
```json
{
  "method": "start_acquisition",
  "status": "success",
  "result": {
    "state": "running",
    "session_id": "f8d3f97e-db2a-4d4f-97de-9a08253014cd"
  }
}
```

#### stop_collection / stop_acquisition

Stop data collection.

**Request:**
```json
{
  "method": "stop_collection"
}
```

Note: `stop_acquisition` is also supported as an alias.

**Response:**
```json
{
  "method": "stop_acquisition",
  "status": "success",
  "result": {
    "state": "stopped"
  }
}
```

#### get_status

Get current collection status.

**Request:**
```json
{
  "method": "get_status"
}
```

**Response:**
```json
{
  "method": "get_status",
  "status": "success",
  "result": {
    "state": "running",
    "session_id": "f8d3f97e-db2a-4d4f-97de-9a08253014cd"
  }
}
```

**States:** `"running"` | `"stopped"`

---

### Configuration Management

#### get_config

Retrieve current configuration.

**Request:**
```json
{
  "method": "get_config",
  "params": {
    "type": "all"
  }
}
```

**Parameters:**
- `type` (string, optional): Configuration type. Default: `"all"`

**Response:**
```json
{
  "method": "get_config",
  "status": "success",
  "result": {
    "sensors": [...],
    "settings": {...}
  }
}
```

#### set_config

Update configuration.

**Request:**
```json
{
  "method": "set_config",
  "params": {
    "config_data": {
      "sensors": [...],
      "settings": {...}
    }
  }
}
```

**Parameters:**
- `config_data` (object, required): Configuration object

**Response:**
```json
{
  "method": "set_config",
  "status": "success",
  "result": {
    "action": "updated",
    "snapshot_id": "12345"
  }
}
```

---

### Data Queries

#### query_data

Query historical sensor data.

**Request:**
```json
{
  "method": "query_data",
  "params": {
    "query_type": "resampled_vibration",
    "device_names": ["MNA00542", "MNA00543"],
    "start_time": "2025-01-20T10:00:00Z",
    "end_time": "2025-01-20T11:00:00Z",
    "axes": ["X", "Y", "Z"],
    "target_total_points": 1000
  }
}
```

**Parameters:**
- `query_type` (string, required): Type of query
  - `"resampled_vibration"` - Resampled vibration data
- `device_names` (array, required): List of device serial numbers
- `start_time` (string, required): Start time (ISO 8601 or relative)
- `end_time` (string, required): End time (ISO 8601 or relative)
- `axes` (array, optional): Axes to include. Default: `["X", "Y", "Z"]`
- `target_total_points` (integer, optional): Target number of points. Default: `1000`

**Time Formats:**

1. **ISO 8601:**
   ```
   "2025-01-20T10:00:00Z"
   ```

2. **Relative time:**
   - `"now"` - current time
   - `"now-1h"` - 1 hour ago
   - `"now-30m"` - 30 minutes ago
   - `"now-5s"` - 5 seconds ago
   - `"now-2d"` - 2 days ago
   
   Units: `s` (seconds), `m` (minutes), `h` (hours), `d` (days)

**Response (published to `data` topic):**
```json
{
  "status": "success",
  "query_type": "resampled_vibration",
  "data": {
    "MNA00542": [
      {
        "ts": "2025-01-20T10:00:00",
        "X": [0.001, 0.005],
        "Y": [-0.002, 0.003],
        "Z": [0.998, 1.002]
      }
    ]
  }
}
```

**Error Response:**
```json
{
  "status": "error",
  "error": "Missing required params: device_names"
}
```

---

## Telemetry Format

Periodic status messages sent to `telemetry` topic.

**When collecting:**
```json
{
  "serial_number": "site_001-gateway_1-all_1",
  "timestamp": "2025-01-23T14:43:39.531000Z",
  "mqtt_api_version": "1.0.0",
  "message_interval_seconds": 5,
  "dataloggers": [
    {
      "serial_number": "all_1",
      "status": "running",
      "sensors_data": [
        {
          "serial_number": "MNA00542",
          "data": [
            {"channel": "acc00", "value": 0.001713},
            {"channel": "acc01", "value": -0.006148},
            {"channel": "acc02", "value": 1.009712}
          ]
        }
      ]
    }
  ]
}
```

**When stopped:**
```json
{
  "serial_number": "site_001-gateway_1-all_1",
  "timestamp": "2025-01-23T14:43:39.531000Z",
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

---

## Error Handling

All errors return a consistent format:

```json
{
  "status": "error",
  "message": "Error description"
}
```

**Common errors:**
- `"Invalid JSON payload"` - Malformed JSON
- `"Unknown method: {method}"` - Unsupported method
- `"Missing required params: {params}"` - Missing parameters

---

## Configuration

Environment variables (`.env` file):

| Variable | Description | Default |
|----------|-------------|---------|
| `MQTT_BROKER` | Remote MQTT broker address | - |
| `MQTT_PORT` | Remote MQTT broker port | `8883` |
| `MQTT_USERNAME` | MQTT username | - |
| `MQTT_PASSWORD` | MQTT password | - |
| `LOCAL_MQTT_BROKER` | Local MQTT broker | `localhost` |
| `LOCAL_MQTT_PORT` | Local MQTT port | `1883` |
| `SITE_ID` | Site identifier | - |
| `GATEWAY_SERIAL_NUMBER` | Gateway serial number | - |
| `DATALOGGER_SERIAL_NUMBER` | Datalogger serial number | - |
| `MQTT_API_VERSION` | API version | `1.0.0` |
| `MESSAGE_INTERVAL_SECONDS` | Telemetry interval | `5` |

---

## Examples

### Start Collection

**Publish to:** `site_001/gateway/1/datalogger/all/cmd`
```json
{"method": "start_collection"}
```

**Receive from:** `site_001/gateway/1/datalogger/all/cmdres`
```json
{
  "method": "start_acquisition",
  "status": "success",
  "result": {"state": "running", "session_id": "abc-123"}
}
```

### Query Recent Data

**Publish to:** `site_001/gateway/1/datalogger/all/cmd`
```json
{
  "method": "query_data",
  "params": {
    "query_type": "resampled_vibration",
    "device_names": ["MNA00542"],
    "start_time": "now-1h",
    "end_time": "now",
    "target_total_points": 500
  }
}
```

**Receive from:** `site_001/gateway/1/datalogger/all/data`
```json
{
  "status": "success",
  "query_type": "resampled_vibration",
  "data": {
    "MNA00542": [...]
  }
}
```

---

## Connection

The system connects to two MQTT brokers simultaneously:
- **Remote broker:** TLS with authentication
- **Local broker:** Unencrypted

All messages are published to both brokers.

---

## Standards Compliance

This API follows IoT industry standards:
- JSON-RPC-like message format
- Consistent topic hierarchy
- Unified command/response pattern
- Similar to AWS IoT, Azure IoT Hub, and Homie Convention
