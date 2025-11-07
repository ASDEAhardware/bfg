# 🧪 MQTT Refactor - Guida Testing Manuale

## 📋 Checklist Pre-Test

Prima di iniziare, verifica di avere:
- ✅ Podman installato e funzionante
- ✅ File `.env` configurato correttamente con credenziali MQTT
- ✅ Almeno 1 sito nel database con MQTT abilitato

---

## 🚀 STEP 1: Build e Avvio Containers

### 1.1 Build containers

```bash
cd /home/bkode/Desktop/bfg

# Build dei containers
podman-compose build

# Verifica che il build sia riuscito
podman images | grep bfg
```

**Output atteso:**
- Dovresti vedere `bfg_backend` e `bfg_frontend` nelle immagini

### 1.2 Avvio containers

```bash
# Avvia i containers
podman-compose up -d

# Verifica che siano running
podman-compose ps
```

**Output atteso:**
```
NAME                COMMAND              STATUS              PORTS
bfg_backend         supervisord...       Up                  0.0.0.0:8000->8000/tcp
bfg_database        postgres             Up                  0.0.0.0:5432->5432/tcp
bfg_frontend        npm run dev          Up                  0.0.0.0:3000->3000/tcp
bfg_pgadmin         pgadmin4             Up                  0.0.0.0:8080->80/tcp
```

---

## 🗄️ STEP 2: Database Migration

### 2.1 Esegui migration

```bash
# Entra nel container backend
podman exec -it bfg_backend bash

# Esegui migration
python manage.py migrate

# Verifica che la migration 0021 sia applicata
python manage.py showmigrations mqtt
```

**Output atteso:**
```
mqtt
 [X] 0001_initial
 ...
 [X] 0020_remove_gateway_legacy_fields
 [X] 0021_add_retry_fields
```

### 2.2 Verifica modelli aggiornati

```bash
# Nel container backend
python manage.py shell
```

```python
from mqtt.models import MqttConnection

# Verifica che i nuovi campi esistano
conn = MqttConnection.objects.first()
print(f"mqtt_retry_count: {conn.mqtt_retry_count}")
print(f"mqtt_next_retry: {conn.mqtt_next_retry}")
# Dovrebbe stampare i valori senza errori

exit()
```

---

## 🔌 STEP 3: Verifica Supervisor

### 3.1 Controlla processi Supervisor

```bash
# Nel container backend
supervisorctl status
```

**Output atteso:**
```
gunicorn                         RUNNING   pid 12, uptime 0:00:45
mqtt_service                     RUNNING   pid 13, uptime 0:00:45
```

✅ **Entrambi i processi devono essere RUNNING**

### 3.2 Controlla logs

```bash
# Log Gunicorn
tail -f /var/log/supervisor/gunicorn.out.log

# Log MQTT Service (in altro terminale)
tail -f /var/log/mqtt/mqtt_service.out.log
```

**Output atteso nel log MQTT:**
```
MQTT SERVICE STARTING
Starting MQTT for X enabled connections
[Site 1] Connection initiated
[Site 1] Connected successfully
[Site 1] Subscribed to 'site_001/gateway/+/heartbeat'
MQTT Service started
```

### 3.3 Test restart automatico

```bash
# Simula crash del servizio MQTT
supervisorctl stop mqtt_service

# Aspetta 2-3 secondi
sleep 3

# Verifica che Supervisor lo abbia riavviato
supervisorctl status mqtt_service
```

**Output atteso:**
```
mqtt_service                     RUNNING   pid 45, uptime 0:00:02
```

✅ **Il processo deve riavviarsi automaticamente**

---

## 🌐 STEP 4: Test API Endpoints

### 4.1 Verifica status connessione

```bash
# Ottieni il token JWT (sostituisci con le tue credenziali)
TOKEN=$(curl -s -X POST http://localhost:8000/api/token/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}' \
  | jq -r '.access')

# Verifica status MQTT per site 1
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/mqtt/sites/1/status/ | jq
```

**Output atteso:**
```json
{
  "connection_id": 1,
  "site_id": 1,
  "site_name": "Site 001",
  "is_enabled": true,
  "status": "connected",
  "broker_host": "mqtt.example.com",
  "broker_port": 1883,
  "last_connected_at": "2024-11-05T...",
  "last_heartbeat_at": "2024-11-05T...",
  "connection_errors": 0,
  "error_message": "",
  "handler_running": true,
  "handler_connected": true,
  "retry_count": 0,
  "subscribed_topics": 5,
  "mqtt_retry_count": 0,
  "mqtt_next_retry": null,
  "topics_list": ["site_001/gateway/+/heartbeat", ...]
}
```

✅ **Verifica che `status="connected"` e `handler_connected=true`**

### 4.2 Test stop connessione

```bash
# Stop connessione (solo superuser)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/mqtt/sites/1/stop/ | jq
```

**Output atteso:**
```json
{
  "success": true,
  "message": "MQTT connection stopped for site 1",
  "connection_id": 1
}
```

Verifica nel log MQTT:
```
[Site 1] MQTT disabled, stopping connection
[Site 1] Disconnected
```

### 4.3 Test start connessione

```bash
# Start connessione
curl -X POST -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/api/v1/mqtt/sites/1/start/ | jq
```

**Output atteso:**
```json
{
  "success": true,
  "message": "MQTT connection started for site 1",
  "connection_id": 1
}
```

Verifica nel log MQTT:
```
[Site 1] Connection initiated
[Site 1] Connected successfully
```

---

## 📡 STEP 5: Test Ricezione Messaggi MQTT

### 5.1 Monitora log message processing

```bash
# Nel container backend
tail -f /var/log/mqtt/mqtt_service.out.log | grep "Message on"
```

### 5.2 Pubblica messaggio test (con mosquitto_pub)

```bash
# Su un terminale esterno (con mosquitto-clients installato)
mosquitto_pub -h mqtt.example.com -p 1883 \
  -u username -P password \
  -t "site_001/gateway/1/heartbeat" \
  -m '{"version":"v1.2.0","timestamp":"2024-11-05T10:00:00Z","gateway":{"serial_number":"GW-TEST"}}'
```

**Output atteso nel log:**
```
[MQTT Connection 1] Message on site_001/gateway/1/heartbeat (123 bytes)
[Site 1] Message processed: site_001/gateway/1/heartbeat
```

### 5.3 Verifica database aggiornato

```bash
# Nel container backend
python manage.py shell
```

```python
from mqtt.models import Gateway, DiscoveredTopic

# Verifica gateway aggiornato
gw = Gateway.objects.filter(serial_number='GW-TEST').first()
if gw:
    print(f"Gateway trovato: {gw.label}")
    print(f"Last heartbeat: {gw.last_heartbeat_at}")

# Verifica topic discovered
topics = DiscoveredTopic.objects.filter(site_id=1)
print(f"Discovered topics: {topics.count()}")
for topic in topics[:5]:
    print(f"  - {topic.topic_path} ({topic.message_count} msgs)")

exit()
```

---

## ⚠️ STEP 6: Test Retry Automatico

### 6.1 Simula disconnect

```bash
# Ferma il broker MQTT (se hai accesso) OPPURE
# Cambia le credenziali nel DB per simulare errore

python manage.py shell
```

```python
from mqtt.models import MqttConnection

conn = MqttConnection.objects.get(site_id=1)
conn.password = "password_sbagliata"
conn.save()

# Riavvia connessione
from mqtt.services.mqtt_service import mqtt_service
mqtt_service.stop_connection(1)
mqtt_service.start_connection(1, manual=False)

exit()
```

### 6.2 Monitora retry

```bash
# Controlla log per vedere retry automatici
tail -f /var/log/mqtt/mqtt_service.out.log | grep -i retry
```

**Output atteso:**
```
[MQTT Connection 1] Connection failed with code 4 (Bad username or password)
[MQTT Connection 1] Retry 1/10 scheduled in 5s
[Connection 1] Attempting connection (retry 1 or new)
[MQTT Connection 1] Retry 2/10 scheduled in 10s
...
```

### 6.3 Verifica DB aggiornato

```bash
python manage.py shell
```

```python
from mqtt.models import MqttConnection

conn = MqttConnection.objects.get(site_id=1)
print(f"Status: {conn.status}")  # Dovrebbe essere 'error'
print(f"Retry count: {conn.mqtt_retry_count}")
print(f"Next retry: {conn.mqtt_next_retry}")
print(f"Error message: {conn.error_message}")

exit()
```

### 6.4 Ripristina credenziali corrette

```python
from mqtt.models import MqttConnection

conn = MqttConnection.objects.get(site_id=1)
conn.password = "password_corretta"
conn.save()

# Riavvia manualmente
from mqtt.services.mqtt_service import mqtt_service
mqtt_service.start_connection(1, manual=True)

exit()
```

---

## 🖥️ STEP 7: Test Frontend

### 7.1 Accedi a frontend

```bash
# Apri browser
xdg-open http://localhost:3000/datalogger/
```

### 7.2 Verifica UI

✅ **Controlla:**
- Badge MQTT status (verde = connected, rosso = disconnected)
- Lista datalogger caricata
- Controlli Start/Stop MQTT (solo per superuser)
- Pulsante "Force Discovery"

### 7.3 Test controllo manuale da UI

1. Click su "Stop MQTT" → Verifica che il badge diventi rosso
2. Click su "Start MQTT" → Verifica che il badge diventi verde
3. Click su "Force Discovery" → Verifica toast success

---

## 🛑 STEP 8: Test Graceful Shutdown

### 8.1 Stop containers pulito

```bash
# Stop containers
podman-compose down

# Verifica log finale
podman logs bfg_backend | tail -20
```

**Output atteso:**
```
Received signal SIGTERM - shutting down gracefully
Stopping MQTT Service...
[Site 1] Disconnected
MQTT Service stopped
supervisord: stopped
```

✅ **Nessun errore o exception traceback**

---

## 🐛 STEP 9: Troubleshooting Comuni

### Problema: Supervisor non parte

**Sintomi:** Container crasha subito dopo avvio

**Debug:**
```bash
# Controlla log container
podman logs bfg_backend

# Verifica che supervisord.conf sia valido
podman exec bfg_backend cat /app/supervisord.conf
```

**Fix:**
- Verifica che il file `supervisord.conf` sia stato copiato nel container
- Rebuild: `podman-compose build --no-cache`

---

### Problema: MQTT service non si connette

**Sintomi:** `handler_connected=false` nell'API

**Debug:**
```bash
# Controlla log MQTT
podman exec bfg_backend tail -100 /var/log/mqtt/mqtt_service.err.log

# Controlla configurazione DB
podman exec bfg_backend python manage.py shell
```

```python
from mqtt.models import MqttConnection

conn = MqttConnection.objects.get(site_id=1)
print(f"Enabled: {conn.is_enabled}")
print(f"Broker: {conn.broker_host}:{conn.broker_port}")
print(f"Username: {conn.username}")
print(f"Status: {conn.status}")
print(f"Error: {conn.error_message}")
```

**Fix comuni:**
- Verifica credenziali broker MQTT corrette
- Verifica broker raggiungibile: `ping mqtt.example.com`
- Verifica `is_enabled=True` nel DB

---

### Problema: Messaggi MQTT non processati

**Sintomi:** Nessun log "Message on" / DB non aggiornato

**Debug:**
```bash
# Verifica subscriptions
podman exec bfg_backend python manage.py shell
```

```python
from mqtt.services.mqtt_service import mqtt_service

status = mqtt_service.get_connection_status(1)
print(f"Subscribed topics: {status['subscribed_topics']}")
print(f"Topics list: {status.get('topics_list', [])}")
```

**Fix:**
- Verifica che i topic configurati nel DB siano corretti
- Verifica pattern wildcard (es: `gateway/+/heartbeat`)
- Pubblica su topic corretto con prefix: `site_001/...`

---

## ✅ Checklist Finale

Dopo aver completato tutti i test, verifica:

- [ ] Container `bfg_backend` running senza crash
- [ ] Supervisor gestisce gunicorn + mqtt_service
- [ ] Migration `0021_add_retry_fields` applicata
- [ ] API status restituisce `handler_connected=true`
- [ ] Messaggi MQTT ricevuti e processati (log + DB)
- [ ] Start/Stop manuale funziona
- [ ] Retry automatico funziona (con credenziali errate)
- [ ] Graceful shutdown senza errori
- [ ] Frontend UI mostra stato MQTT corretto

---

## 📝 Report Bug

Se trovi problemi, raccogli queste informazioni:

```bash
# 1. Log Supervisor
podman exec bfg_backend cat /var/log/supervisor/supervisord.log

# 2. Log MQTT Service
podman exec bfg_backend tail -100 /var/log/mqtt/mqtt_service.out.log
podman exec bfg_backend tail -100 /var/log/mqtt/mqtt_service.err.log

# 3. Log Gunicorn
podman exec bfg_backend tail -100 /var/log/supervisor/gunicorn.err.log

# 4. Status connessioni
podman exec bfg_backend python manage.py start_mqtt_service --status

# 5. Versione Podman
podman --version
```

Poi condividi con lo sviluppatore:
- Descrizione problema
- Step per riprodurlo
- Log sopra raccolti
- Output comando `podman-compose ps`

---

## 🎯 Performance Check

### Verifica consumo risorse

```bash
# Memoria container
podman stats bfg_backend --no-stream

# Connessioni DB
podman exec bfg_backend python manage.py shell
```

```python
from django.db import connection
print(f"DB queries: {len(connection.queries)}")

from mqtt.models import DiscoveredTopic
print(f"Discovered topics: {DiscoveredTopic.objects.count()}")
```

**Target:**
- Memoria backend: < 500MB
- CPU backend: < 10% idle
- Discovered topics: crescita lineare (no explosion)

---

Buon testing! 🚀
