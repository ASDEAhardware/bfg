# Analisi Stato Attuale Sistema MQTT - BFG

**Data**: 2025-11-20
**Analisi per**: Sostituzione placeholder grafici con dati reali MQTT

---

## 📋 Indice

1. [Architettura Stack](#architettura-stack)
2. [Stato Backend MQTT](#stato-backend-mqtt)
3. [Stato Frontend](#stato-frontend)
4. [Gap Analysis](#gap-analysis)
5. [Prossimi Step](#prossimi-step)
6. [Domande per il Team](#domande-per-il-team)

---

## 1. Architettura Stack

### Backend
- **Framework**: Django 3.13 + PostgreSQL
- **Process Manager**: supervisord
- **MQTT Client**: paho-mqtt
- **Servers**:
  - Gunicorn (WSGI) porta 8000 - API REST
  - Daphne (ASGI) porta 8001 - WebSocket real-time
  - MQTT Service - Servizio permanente gestito da supervisord

### Frontend
- **Framework**: Next.js 15 + React 19 + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Data Fetching**: @tanstack/react-query (React Query)
- **State Management**: zustand
- **HTTP Client**: axios
- **WebSocket**: Native WebSocket + custom hooks

### Flusso Dati
```
IoT Devices (MQTT)
  ↓
MQTT Broker (Mosquitto/EMQ)
  ↓
Backend MQTT Service (paho-mqtt)
  ↓
Message Processor → Database (PostgreSQL)
  ↓ (WebSocket via Channels)
Frontend (React Query) ← HTTP REST API
```

---

## 2. Stato Backend MQTT

### ✅ Implementazione Completa

#### 2.1 MQTT Service (Singleton)
**File**: `backend/mqtt/services/mqtt_service.py`

- ✅ Servizio singleton gestito da supervisord
- ✅ Monitor thread attivo (ciclo ogni 30 secondi)
- ✅ Auto-start connessioni abilitate (`is_enabled=True`)
- ✅ Auto-stop connessioni disabilitate (`is_enabled=False`)
- ✅ Retry automatico con exponential backoff
- ✅ Graceful shutdown con timeout 5s
- ✅ Disconnessioni parallele (non sequenziali)

**Funzionalità Monitor Thread**:
```python
# Ogni 30 secondi:
1. Trova siti is_enabled=True senza connessione attiva
2. Avvia connessioni mancanti
3. Ferma connessioni per siti disabilitati
4. Check dispositivi offline (check_offline_devices)
```

#### 2.2 Message Processor
**File**: `backend/mqtt/services/message_processor.py`

- ✅ **Auto-Discovery**: OGNI messaggio MQTT ricevuto viene loggato in `DiscoveredTopic`
- ✅ **Versioning**: Supporto multi-versione payload tramite `versioned_processor`
- ✅ **Topic Parser**: Parse nuova struttura topic:
  - `[sito]/gateway/[n]/heartbeat`
  - `[sito]/gateway/[n]/datalogger/[tipo]/[n]/heartbeat`
- ✅ **Processing Gateway Heartbeat**: Popola tabella `Gateway` con metriche sistema
- ✅ **Processing Datalogger Heartbeat**: Popola tabella `Datalogger` + `Sensor`
- ✅ **Offline Detection**: Check automatico dispositivi offline ogni 30s

#### 2.3 Database Models
**File**: `backend/mqtt/models.py`

Tabelle implementate:

1. **MqttConnection**
   - Configurazione connessioni MQTT per sito
   - Campi: broker_host, broker_port, username, password, is_enabled, status
   - Retry management: mqtt_retry_count, mqtt_next_retry

2. **MqttTopic**
   - Topic configurabili per subscription
   - Campi: topic_pattern, is_active, qos_level, priority

3. **DiscoveredTopic** ⭐
   - Traccia TUTTI i topic MQTT scoperti automaticamente
   - Campi: topic_path, topic_pattern, message_count, sample_payload
   - Flag: `is_processed` (True se ha processore implementato)
   - Flag: `processor_name` (nome del processore)

4. **Gateway**
   - Sistema principale del sito
   - Campi: serial_number, hostname, ip_address, firmware_version
   - Metriche: cpu_load_percent, ram_*, disk_*
   - Status: is_online, connection_status, last_seen_at

5. **Datalogger**
   - Datalogger auto-discovered
   - Campi: serial_number, label (editabile), datalogger_type, device_id
   - Foreign Key: gateway (relazione con Gateway)
   - Metriche: total_heartbeats, missed_heartbeats, uptime_percentage
   - Status: is_online, last_seen_at

6. **Sensor**
   - Sensori auto-discovered
   - Campi: serial_number, label (editabile), sensor_type, unit_of_measure
   - Foreign Key: datalogger
   - **Near Real-Time Data**: ultimi 3 valori salvati
     - last_timestamp_1 + last_data_1 (più recente)
     - last_timestamp_2 + last_data_2 (penultimo)
     - last_timestamp_3 + last_data_3 (terzultimo)
   - Statistiche: min_value_ever, max_value_ever, uptime_percentage
   - Status: is_online, last_reading

7. **MqttApiVersionUsage**
   - Tracking versioni API per analytics

8. **MqttDowntimeEvent**
   - Eventi downtime per SLA monitoring

### 🔄 Auto-Discovery Flow

```
1. Messaggio MQTT ricevuto
   ↓
2. _log_discovered_topic() - Salva in DiscoveredTopic
   - topic_path completo
   - sample_payload (JSON)
   - message_count incrementato
   - payload_size_avg calcolato
   ↓
3. versioned_processor.process_message() - Analizza versione payload
   ↓
4. Se topic riconosciuto:
   - Gateway heartbeat → _process_new_gateway_heartbeat()
   - Datalogger heartbeat → _process_new_datalogger_heartbeat()
   ↓
5. Popola database (Gateway, Datalogger, Sensor)
   ↓
6. _mark_topic_as_processed() - Setta is_processed=True
```

### 📊 Stato Attuale Database

```sql
-- Esempio query per vedere discovery status
SELECT
  site_id,
  topic_path,
  message_count,
  is_processed,
  processor_name,
  last_seen_at
FROM mqtt_discoveredtopic
ORDER BY last_seen_at DESC;

-- Datalogger attivi per sito
SELECT
  site_id,
  serial_number,
  label,
  datalogger_type,
  is_online,
  sensors_count,
  uptime_percentage,
  last_seen_at
FROM mqtt_datalogger
WHERE is_online = TRUE;
```

---

## 3. Stato Frontend

### ✅ Hook MQTT Pronti

**File**: `frontend/src/hooks/useMqtt.ts`

Implementati:
- ✅ `useMqttConnectionStatus(siteId)` - Stato connessione MQTT
- ✅ `useMqttControl()` - Start/Stop/Discovery MQTT
- ✅ `useDataloggers(siteId)` - **Fetch datalogger reali dal backend**
- ✅ `useMqttStatusSocket()` - WebSocket real-time updates

### ✅ Componenti UI Pronti

**File**: `frontend/src/components/DeviceCard.tsx`

Componente **DeviceCard** già implementato con:
- ✅ Label editabile inline
- ✅ Status badge (Online/Offline)
- ✅ Serial number
- ✅ Tipo datalogger + device_id
- ✅ IP address, firmware version
- ✅ Conteggio sensori (attivi/totali)
- ✅ Uptime percentuale + heartbeats
- ✅ Ultima comunicazione (formatDistanceToNow)

### ⚠️ Problema Pagina `/devices`

**File**: `frontend/src/plugins/devices/DevicesListPage.tsx`

**SITUAZIONE ATTUALE (linee 62-136)**:
```typescript
// Mock data per sviluppo UI
const mockDevices = {
  monstro: { id: "monstro-1", label: "Monstr-o Master", ... },
  adaq: [
    { id: "adaq-1", label: "ADAQ 4CH - Zona A", ... },
    { id: "adaq-2", label: "ADAQ 8CH - Zona B", ... },
    { id: "adaq-3", label: "ADAQ 4CH - Zona C", status: "offline", ... }
  ],
  weatherStations: [
    { id: "ws-1", label: "Stazione Meteo Nord", ... },
    { id: "ws-2", label: "Stazione Meteo Sud", ... }
  ]
};
```

**IL PROBLEMA**:
- ✅ Hook `useDataloggers(selectedSiteId)` fetcha dati reali
- ✅ Variabili `dataloggers`, `filteredDataloggers` esistono
- ✅ Raggruppamento per tipo (`monstroDevice`, `adaqDevices`, `weatherStationDevices`)
- ❌ **Ma il rendering usa solo `mockDevices`** (linee 534-1007)!

### 📍 Punti di Integrazione Frontend

Linee da modificare in `DevicesListPage.tsx`:

1. **Linea 534-654**: Monstr-o Card - Usa `mockDevices.monstro`
   → Sostituire con `monstroDevice` (datalogger reale)

2. **Linea 656-840**: ADAQ Group/Cards - Usa `mockDevices.adaq`
   → Sostituire con `adaqDevices` (array datalogger reali)

3. **Linea 842-1007**: Weather Stations - Usa `mockDevices.weatherStations`
   → Sostituire con `weatherStationDevices` (array datalogger reali)

4. **Linea 450-458**: Toggle TEST 28 cards - Rimuovere

---

## 4. Gap Analysis

### ✅ Completamente Implementato

- [x] Servizio MQTT con monitor thread 30s
- [x] Auto-discovery topic in `DiscoveredTopic`
- [x] Processing gateway heartbeat
- [x] Processing datalogger heartbeat
- [x] Database models completi (Gateway, Datalogger, Sensor)
- [x] Offline detection automatica
- [x] API REST per fetch datalogger
- [x] Frontend hooks pronti
- [x] Componente DeviceCard pronto

### ⚠️ Da Completare

- [ ] **Sostituire mock devices con dati reali** in DevicesListPage.tsx
- [ ] Rimuovere toggle TEST 28 cards
- [ ] Verificare payload MQTT attuali (utente dice che sono cambiati)
- [ ] Testare discovery con payload reali
- [ ] Verificare mapping topic → processore

### ❓ Da Chiarire con l'Utente

1. **Payload MQTT Attuali**: L'utente ha menzionato che i payload sono cambiati. Serve esempio payload reali per verificare:
   - Formato gateway heartbeat
   - Formato datalogger heartbeat
   - Path topic completi
   - Quali topic vengono ricevuti attualmente

2. **Tipologie Dispositivi**: Nel frontend ci sono segnaposti per:
   - Monstr-o (singolo master controller)
   - ADAQ (gruppo datalogger analogici)
   - Weather Stations (gruppo stazioni meteo)

   Domande:
   - Questi nomi corrispondono ai `datalogger_type` nel DB?
   - Ci sono altri tipi di dispositivi da visualizzare?

3. **Logica Raggruppamento**:
   - Attualmente il frontend raggruppa per tipo
   - Serve raggruppare anche per gateway parent?
   - Serve mostrare la gerarchia Gateway → Datalogger → Sensor?

4. **Discovery Status**:
   - Serve una UI per vedere topic discovered?
   - Serve una pagina admin per vedere `DiscoveredTopic` con flag `is_processed`?
   - Serve force discovery manuale (già implementato in backend)?

---

## 5. Prossimi Step

### Step 1: Verifica Payload MQTT ✋ ATTESA INPUT UTENTE

Prima di procedere, l'utente deve fornire:

```json
// Esempio gateway heartbeat attuale
{
  "topic": "???",
  "payload": {
    // ... dati reali
  }
}

// Esempio datalogger heartbeat attuale
{
  "topic": "???",
  "payload": {
    // ... dati reali
  }
}
```

### Step 2: Verifica Discovery

```bash
# Check topic scoperti
podman exec bfg_backend python manage.py shell -c "
from mqtt.models import DiscoveredTopic
topics = DiscoveredTopic.objects.all()
for t in topics:
    print(f'{t.topic_path} | processed: {t.is_processed} | count: {t.message_count}')
"

# Check datalogger presenti
podman exec bfg_backend python manage.py shell -c "
from mqtt.models import Datalogger
dataloggers = Datalogger.objects.all()
for d in dataloggers:
    print(f'{d.label} | type: {d.datalogger_type} | online: {d.is_online} | sensors: {d.sensors.count()}')
"
```

### Step 3: Sostituzione Mock → Dati Reali

**File**: `frontend/src/plugins/devices/DevicesListPage.tsx`

Modifiche da fare:
1. Rimuovere `const mockDevices` (linea 62-136)
2. Rimuovere toggle TEST (linea 450-458, 1009-1066)
3. Sostituire rendering mock con rendering datalogger reali
4. Usare componente `DeviceCard` esistente
5. Mantenere logica raggruppamento

Pseudocodice:
```typescript
// PRIMA (mock)
{mockDevices.adaq.map((device) => (
  <Card>...</Card>
))}

// DOPO (reale)
{adaqDevices.map((datalogger) => (
  <DeviceCard
    datalogger={datalogger}
    onConnect={handleDeviceClick}
    onLabelUpdate={refreshDataloggers}
  />
))}
```

### Step 4: Testing

1. ✅ Backend: Verificare discovery funzionante
2. ✅ Database: Verificare datalogger popolati
3. ✅ Frontend: Verificare fetch datalogger
4. ✅ UI: Verificare rendering card reali
5. ✅ WebSocket: Verificare aggiornamenti real-time
6. ✅ Offline Detection: Verificare badge status

---

## 6. Domande per il Team

### 🔴 PRIORITÀ ALTA (Blocca Sviluppo)

1. **Payload MQTT Attuali**:
   - Puoi fornire esempi di payload reali con path topic completi?
   - Quali topic vengono ricevuti attualmente dal broker?
   - Sono cambiati rispetto alla documentazione MQTT_DOCUMENTATION.md?

2. **Tipologie Dispositivi**:
   - Monstr-o, ADAQ, Weather Stations corrispondono ai `datalogger_type`?
   - Ci sono altri tipi da gestire?

### 🟡 PRIORITÀ MEDIA

3. **UI/UX Devices Page**:
   - Vuoi mantenere la logica di raggruppamento attuale?
   - Serve visualizzare la gerarchia Gateway → Datalogger?
   - Il componente DeviceCard va bene o serve customizzazione?

4. **Discovery Management**:
   - Serve una pagina admin per gestire topic discovered?
   - Serve UI per flaggare topic come "da processare"?

### 🟢 PRIORITÀ BASSA

5. **Features Future**:
   - Serve visualizzazione sensor data nella pagina `/devices`?
   - Serve filtro per gateway oltre che per tipo?
   - Serve export CSV/Excel dei dispositivi?

---

## 📊 Metriche Attuali

```bash
# Verifica stato sistema
curl http://localhost:8000/api/v1/mqtt/health/

# Output atteso:
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

---

## 🎯 Goal Finale

Sostituire completamente i placeholder grafici mock con:
- ✅ Dati reali dal database aggiornato da MQTT
- ✅ Aggiornamenti real-time via WebSocket
- ✅ UI responsive e performante
- ✅ Offline detection automatica
- ✅ Label editing inline
- ✅ Raggruppamento intelligente per tipo/gateway

---

**Prossima Azione**: Attendere payload MQTT reali dall'utente per procedere con Step 1 🚀
