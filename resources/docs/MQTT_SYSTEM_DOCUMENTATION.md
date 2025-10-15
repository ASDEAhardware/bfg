# 📡 Sistema MQTT IoT - Guida Completa

## 🚀 Panoramica

Il sistema MQTT IoT di BFG consente il monitoraggio in tempo reale di sensori distribuiti su più siti. Il sistema raccoglie automaticamente dati da accelerometri, inclinometri, magnetometri e giroscopi tramite protocollo MQTT.

## 📊 Come Funzionano i Dati - Flusso Completo

```
🏭 SENSORI FISICI
    ⬇️ (pubblicano heartbeat ogni 30s)
📡 BROKER MQTT ESTERNO (zionnode.ovh:8883) ← NON NOSTRO
    ⬇️ (noi ci subscribiamo ai topic)
🐍 DJANGO MQTT SUBSCRIBER ← NOI SIAMO QUI
    ⬇️ (parsing e salvataggio)
🗄️ DATABASE POSTGRESQL
    ⬇️ (API REST)
⚛️ REACT FRONTEND
    ⬇️ (rendering real-time)
👥 INTERFACCIA UTENTE
```

### 🔄 Dettaglio del Flusso Dati

1. **Sensori → MQTT Broker Esterno**
   - I sensori **pubblicano** messaggi JSON ogni 30 secondi
   - Broker esterno: `zionnode.ovh:8883` (NON gestito da noi)
   - Topic: `sito_001/datalogger_o/heartbeat`, `sito_002/datalogger_o/heartbeat`, etc.
   - Formato: `{"MNA00542": {"acc_x": 0.005, "acc_y": -0.001, "acc_z": 1.014, ...}}`

2. **Django Subscriber → Database**
   - Django si **sottoscrive** ai topic MQTT del broker esterno
   - Riceve messaggi quando i sensori li inviano
   - Parser converte JSON in oggetti Python
   - Salva solo gli ultimi 3 record per sensore (rolling storage)
   - Aggiorna stato online/offline automaticamente

3. **Database → API**
   - API REST senza autenticazione per il frontend
   - Endpoint status: `/api/v1/mqtt/api/status/`
   - Endpoint sensori: `/api/v1/mqtt/api/sensors/{site_id}/`

4. **Frontend → Utente**
   - React hooks aggiornano ogni 5 secondi
   - Componenti mostrano dati in tempo reale
   - Interfaccia responsive con controlli connessione

## 🖥️ Come Usare l'Interfaccia

### 📍 Accesso alla Pagina MQTT

1. **Login**: Accedi come utente staff
2. **Navigazione**: Vai su `http://localhost:3000/mqtt-datalogger`
3. **Selezione Sito**: Usa il menu a tendina per selezionare il sito

### 🎛️ Controlli Principali

#### **Header della Pagina**
- 🔄 **Auto Refresh**: Toggle per aggiornamento automatico ogni 5s
- 👁️ **Solo Online**: Filtra solo sensori online
- 🔍 **Ricerca**: Cerca sensori per nome
- 📊 **Vista**: Griglia o lista
- ↻ **Aggiorna**: Refresh manuale

#### **Card Connessione MQTT**
```
🟢 Connesso    🔴 Errore    🟡 Connessione...    ⚫ Disconnesso
```

- **Status**: Stato connessione in tempo reale
- **Ultimo heartbeat**: Quando ricevuto ultimo messaggio
- **Errori**: Contatore errori di connessione
- **Controlli**: Start/Stop/Restart connessione

#### **Card Sensori**
- **Nome**: ID sensore (es. MNA00542)
- **Status**: Online/Offline con indicatori visivi
- **Dati Tempo Reale**:
  - 📈 **Accelerometro**: X, Y, Z (in g)
  - 📐 **Inclinometro**: X, Y (in gradi)
  - 🧭 **Magnetometro**: X, Y, Z (se disponibile)
  - 🔄 **Giroscopio**: X, Y, Z (se disponibile)

### 📱 Interfaccia Responsive

#### **Desktop (>600px)**
- Vista griglia con 2-3 colonne
- Tutti i dettagli sensori visibili
- Controlli completi nell'header

#### **Mobile (<600px)**
- Vista lista compatta
- Controlli essenziali
- Menu dropdown per opzioni avanzate

## ⚙️ Integrazione e Configurazione

### 🏗️ Struttura del Sistema

```
backend/mqtt/
├── models.py          # Database models
├── services/
│   ├── mqtt_manager.py    # Gestione connessioni MQTT
│   └── message_parser.py  # Parsing messaggi JSON
├── management/commands/
│   └── run_mqtt.py        # Comando Django per avvio servizio
├── views.py               # API endpoints
└── admin.py               # Interfaccia admin Django

frontend/src/
├── hooks/
│   └── useMqttStatus.ts   # React hooks per dati real-time
├── components/
│   ├── MqttConnectionStatus.tsx  # Status connessione
│   └── MqttSensorCard.tsx        # Card sensori
└── plugins/mqtt-datalogger/
    └── MqttDataLoggerPage.tsx    # Pagina principale
```

### 🚀 Avvio del Sistema

#### **⚠️ IMPORTANTE: Il Subscriber MQTT NON si avvia automaticamente!**

Il comando `podman-compose up` avvia solo:
- Database PostgreSQL
- Django web server
- Next.js frontend
- **NON avvia il subscriber MQTT**

#### **1. Avvio Container**
```bash
# Prima avvia tutti i container
podman-compose up -d

# Aspetta che i container siano pronti
sleep 10
```

#### **2. Avvio Manuale Subscriber MQTT**
```bash
# OBBLIGATORIO: Avvia il subscriber MQTT manualmente
podman exec bfg_backend python manage.py run_mqtt

# Con logging dettagliato (consigliato per debug)
podman exec bfg_backend python manage.py run_mqtt --log-level DEBUG

# In background (per produzione)
podman exec -d bfg_backend python manage.py run_mqtt
```

#### **⚠️ RISOLUZIONE PROBLEMI COMUNI**
```bash
# Se il frontend non carica:
# 1. Verifica che il container sia up
podman ps | grep frontend

# 2. Controlla i log per errori
podman logs bfg_frontend --tail 20

# 3. Riavvia se necessario
podman-compose restart frontend

# Se l'API non risponde:
# 1. Verifica il backend
curl http://localhost:8000/api/v1/mqtt/api/status/

# 2. Controlla se il subscriber è attivo
# Dovrebbe mostrare processi con 'run_mqtt'
podman exec bfg_backend python -c "
import os
print([l for l in os.popen('ps aux').readlines() if 'run_mqtt' in l])
"
```

#### **3. Verifica che il Subscriber sia Attivo**
```bash
# Controlla se il processo MQTT è running
podman exec bfg_backend ps aux | grep run_mqtt

# Controlla connessioni tramite API
curl http://localhost:8000/api/v1/mqtt/api/status/ | jq

# Controlla sensori sito specifico
curl http://localhost:8000/api/v1/mqtt/api/sensors/6/ | jq
```

#### **4. Sequenza di Avvio Completa**
```bash
# 1. Avvia container
podman-compose up -d

# 2. Aspetta che siano tutti running
sleep 10

# 3. Avvia subscriber MQTT
podman exec -d bfg_backend python manage.py run_mqtt

# 4. Verifica tutto funzioni
curl http://localhost:8000/api/v1/mqtt/api/status/
```

### 🔧 Configurazione Nuovi Siti

#### **1. Aggiungi Sito in Django Admin**
```
URL: http://localhost:8000/developers-admin/mqtt/mqttconnection/add/

Campi obbligatori:
- Site: Seleziona sito esistente
- Broker Host: zionnode.ovh
- Broker Port: 8883
- Topic Prefix: sito_XXX (dove XXX è il codice sito)
- Use SSL: ✓
- Username/Password: credenziali MQTT
```

#### **2. Riavvia Subscriber MQTT**
```bash
# Ferma subscriber esistente (se running)
podman exec bfg_backend pkill -f "run_mqtt"

# Riavvia subscriber con nuova configurazione
podman exec -d bfg_backend python manage.py run_mqtt
```

### 📡 Architettura MQTT

#### **🏗️ Ruoli nel Sistema**
- **Broker MQTT**: `zionnode.ovh:8883` (server esterno, NON nostro)
- **Publisher**: Sensori fisici (pubblicano dati)
- **Subscriber**: Django BFG (noi, riceviamo dati)

#### **📡 Topic Structure**
```
sito_001/datalogger_o/heartbeat  # Dati sensori (ci subscribiamo qui)
sito_001/sys_info                # Info sistema (futuro)
```

#### **🔐 Autenticazione**
- Username/Password per connettersi al broker esterno
- SSL/TLS su porta 8883

#### **Payload JSON**
```json
{
  "MNA00542": {
    "acc_x": 0.005,
    "acc_y": -0.001,
    "acc_z": 1.014,
    "incli_x": -0.0911767,
    "incli_y": 0.149944,
    "mag_x": -0.912792,
    "mag_y": 0.34894,
    "mag_z": -1.99874,
    "gyro_x": 0.30625,
    "gyro_y": 0.4025,
    "gyro_z": -0.65625
  }
}
```

## 🔧 API Reference

### **Status Endpoint**
```http
GET /api/v1/mqtt/api/status/
```
**Response:**
```json
{
  "connections": [
    {
      "id": 1,
      "site__name": "Diga del Vajont",
      "site__code": "sito_001",
      "status": "connected",
      "last_connected_at": "2025-10-15T10:40:54.065Z",
      "last_heartbeat_at": "2025-10-15T10:40:15.962Z",
      "connection_errors": 0,
      "error_message": ""
    }
  ],
  "sensor_stats": {
    "6": {
      "total_sensors": 2,
      "online_sensors": 0,
      "offline_sensors": 2,
      "active_sensors": 2,
      "total_messages": 7
    }
  }
}
```

### **Sensor Data Endpoint**
```http
GET /api/v1/mqtt/api/sensors/{site_id}/
```
**Response:**
```json
{
  "sensors": [
    {
      "device_name": "MNA00542",
      "is_online": false,
      "last_seen_at": "2025-10-15T10:24:22.537762+00:00",
      "total_messages": 6,
      "consecutive_misses": 3,
      "timestamp": "2025-10-14T18:57:20+00:00",
      "acc_x": 0.005,
      "acc_y": -0.001,
      "acc_z": 1.014,
      "incli_x": null,
      "incli_y": null
    }
  ]
}
```

### **Connection Control Endpoint**
```http
POST /api/v1/mqtt/connection/{site_id}/control/
Content-Type: application/json

{
  "action": "start|stop|restart"
}
```

## 🔍 Troubleshooting

### ❌ Problemi Comuni

#### **1. Sensori Offline**
- **Sintomo**: Badge rosso "Offline"
- **Causa**: Nessun heartbeat ricevuto > 1 minuto
- **Soluzione**: Verifica connessione fisica sensore

#### **2. Connessione MQTT Fallita**
- **Sintomo**: Status "Errore" o "Disconnesso"
- **Causa**: Problemi di rete o credenziali
- **Soluzione**: Controlla log Django e riavvia connessione

#### **3. Frontend Non Aggiorna**
- **Sintomo**: Dati fermi/vecchi
- **Causa**: API non raggiungibile o JS error
- **Soluzione**: F12 console browser, verifica endpoint API

#### **4. Errore "Failed to fetch MQTT status"**
- **Sintomo**: Console error nel browser
- **Causa**: API endpoint non raggiungibile dal frontend
- **Soluzione**:
  ```bash
  # Verifica variabile ambiente
  echo $NEXT_PUBLIC_API_URL
  # Deve essere: http://localhost:8000

  # Test API manuale
  curl http://localhost:8000/api/v1/mqtt/api/status/
  ```

#### **5. Errore "Cannot read properties of null"**
- **Sintomo**: Crash della pagina con errore JS
- **Causa**: Valori sensori null nel database
- **Soluzione**: ✅ **RISOLTO** - I componenti ora gestiscono valori null automaticamente

### 🔧 Comandi Diagnostici

```bash
# Log servizio MQTT
podman logs bfg_backend | grep mqtt

# Verifica subscriber MQTT attivo
podman exec bfg_backend python -c "
import os
for line in os.popen('ps aux').readlines():
    if 'run_mqtt' in line: print(line.strip())
"

# Test API endpoints
curl http://localhost:8000/api/v1/mqtt/api/status/ | jq
curl http://localhost:8000/api/v1/mqtt/api/sensors/6/ | jq

# Test frontend access
curl http://localhost:3000/mqtt-datalogger | head -20

# Verifica variabili ambiente frontend
podman exec bfg_frontend env | grep NEXT_PUBLIC

# Test connessione manuale
podman exec bfg_backend python manage.py shell
>>> from mqtt.services.mqtt_manager import MqttClientManager
>>> manager = MqttClientManager()
>>> manager.start_connection(1)

# Reset database MQTT
podman exec bfg_backend python manage.py shell
>>> from mqtt.models import *
>>> SensorData.objects.all().delete()
>>> SensorDevice.objects.all().delete()
```

## 📈 Monitoraggio e Performance

### 📊 Metriche di Sistema
- **Frequenza heartbeat**: 30 secondi per sensore
- **Retention dati**: 3 record per sensore (rolling)
- **Aggiornamento frontend**: 5 secondi
- **Timeout offline**: 60 secondi

### 🎯 Scalabilità
- **Siti supportati**: 20-100
- **Sensori per sito**: Illimitati
- **QoS MQTT**: 0 (fire-and-forget)
- **Threading**: Un thread per sito

---

## 🚀 Changelog - Aggiornamenti Recenti

### **v2.1 - Ottobre 2025** ✅
- **Fix API Communication**: Risolto errore "Failed to fetch MQTT status"
  - Configurato `NEXT_PUBLIC_API_URL` per comunicazione frontend-backend
  - Rimossa autenticazione non necessaria dagli endpoint MQTT
- **Fix Null Values**: Risolto crash per valori sensori null
  - Gestione null-safe per tutti i campi sensori (magnetometro, giroscopio)
  - Componenti ora mostrano solo dati disponibili
- **Improved Error Handling**: Diagnostica potenziata
  - Comandi per verificare subscriber MQTT attivo
  - Test API e frontend automatizzati

### **v2.0 - Ottobre 2025**
- Sistema MQTT IoT completo implementato
- Real-time dashboard con React hooks
- Multi-site MQTT subscriber
- Plugin system integration

---

## 🆘 Supporto

Per problemi o domande:

### **🔧 Checklist Diagnostica Rapida**
```bash
# 1. Verifica container attivi
podman ps

# 2. Test API backend
curl http://localhost:8000/api/v1/mqtt/api/status/

# 3. Test frontend
curl http://localhost:3000/mqtt-datalogger | head -5

# 4. Verifica subscriber MQTT
podman exec bfg_backend python -c "
import os
print('MQTT processes:')
for line in os.popen('ps aux').readlines():
    if 'run_mqtt' in line: print(line.strip())
"
```

### **📋 Sequenza Completa Avvio**
```bash
# Avvio completo sistema MQTT
podman-compose up -d
sleep 10
podman exec -d bfg_backend python manage.py run_mqtt
curl http://localhost:8000/api/v1/mqtt/api/status/ | jq '.connections | length'
echo "✅ Sistema MQTT operativo!"
```

**Il sistema è ora completamente operativo e pronto per il monitoraggio IoT in tempo reale! 🚀**