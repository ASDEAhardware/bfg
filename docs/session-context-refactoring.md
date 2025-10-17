# Session Context - Refactoring MQTT Auto-Discovery

## CONTESTO PROGETTO
- Progetto BFG con Django backend + Next.js frontend
- Architettura: Podman containers, MQTT per comunicazioni con datalogger
- Branch attuale: `man_site_datalogger_sensor`

## RICHIESTA UTENTE - REFACTORING GRANDE

### Problema Attuale
1. **Site Management** ha modelli `Datalogger` e `Sensor` legati a `Site`
2. **MQTT app** ha `SensorDevice`, `MqttConnection`, `SystemInfo`
3. I dati sono separati e la topologia di rete è manuale

### Obiettivo Target
1. **ELIMINARE** `Datalogger` e `Sensor` da site management
2. **USARE** solo modelli MQTT con auto-discovery
3. **CREARE** topologia rete automaticamente dai messaggi MQTT
4. **MANTENERE** interfaccia grafica esistente (che piace all'utente)

### Pattern Messaggi MQTT Specificati
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

### Requisiti Specifici
1. **Serial Number + Label**: Ogni datalogger/sensore ha serial_number (ID univoco) + label (nome utente, default=serial)
2. **Auto-Discovery**: Quando arriva messaggio MQTT, auto-crea/aggiorna record
3. **Gestione Utente**: Utente può rinominare label, eliminare dispositivi vecchi
4. **Single Record**: Un record per serial_number, se nuovo serial → nuovo record
5. **Campo ultimo aggiornamento**: Per tracking comunicazioni
6. **UI Esistente**: Mantenere grafica attuale in `/datalogger` page

## ANALISI ARCHITETTURA ATTUALE

### Backend Models Trovati
**sites/models.py:**
- `Site`: Con code per MQTT topics
- `Datalogger`: serial_number, model, status, last_communication (DA ELIMINARE)
- `Sensor`: channel, sensor_type, min/max_value, calibration (DA ELIMINARE)

**mqtt/models.py:**
- `MqttConnection`: Per connessioni MQTT per sito
- `SensorDevice`: device_name, is_online, last_seen_at (DA EVOLVERE)
- `SensorData`: Dati sensori con rolling 3 record
- `SystemInfo`: Info sistema con uptime, CPU, memoria

### Frontend Analizzato
**DataLoggerPage.tsx:**
- Interfaccia ben strutturata con schede datalogger
- Vista connessa con sensori per datalogger specifico
- Controlli MQTT (start/stop/restart)
- Auto-refresh ogni 10s
- Cerca, filtri, system info modal
- API calls: `/v1/sites/dataloggers/` e `/v1/sites/sensors/by-datalogger/`

## PIANO ARCHITETTURA TARGET

### Nuovi Modelli Progettati
```python
class MqttDatalogger(models.Model):
    site = models.ForeignKey('sites.Site', on_delete=models.CASCADE)
    serial_number = models.CharField(max_length=100, unique=True)  # ID univoco
    label = models.CharField(max_length=255)  # Nome utente, default=serial
    datalogger_type = models.CharField(max_length=50)  # monstro, adaq
    instance_number = models.PositiveIntegerField()  # 1, 2, 3

    status = models.CharField(max_length=20, default='disconnected')
    last_heartbeat = models.DateTimeField(null=True, blank=True)
    last_communication = models.DateTimeField(null=True, blank=True)
    is_online = models.BooleanField(default=False)

    firmware_version = models.CharField(max_length=50, blank=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)

class MqttSensor(models.Model):  # Evoluzione di SensorDevice
    datalogger = models.ForeignKey(MqttDatalogger, on_delete=models.CASCADE)
    serial_number = models.CharField(max_length=100)  # Serial sensore fisico
    label = models.CharField(max_length=255)  # Nome utente, default=serial

    sensor_type = models.CharField(max_length=50, blank=True)
    channel = models.PositiveSmallIntegerField(null=True, blank=True)
    unit_of_measure = models.CharField(max_length=50, blank=True)

    status = models.CharField(max_length=20, default='unknown')
    last_reading = models.DateTimeField(null=True, blank=True)
    is_online = models.BooleanField(default=False)
    raw_metadata = models.JSONField(default=dict, blank=True)
```

### Auto-Discovery Logic
1. **Topic Subscription**: Ogni sito si abbona a `{site_code}/#`
2. **Message Processing**: Parse topic per estrarre type/instance
3. **Auto-Create**: Get_or_create datalogger con serial_number
4. **Update Status**: last_communication, is_online, metadata
5. **Sensors**: Process da payload se presente

### API Compatibility
- Nuove API `/v1/mqtt/dataloggers/` e `/v1/mqtt/sensors/by-datalogger/`
- Mantenere stessa interfaccia TypeScript per frontend
- Mapping: name→label, model→datalogger_type

## FASI SVILUPPO DEFINITE

### Fase 1: Creazione Nuovi Modelli MQTT
- Creare MqttDatalogger in mqtt/models.py
- Evolvere SensorDevice → MqttSensor
- Migrations
- Test con dati esempio

### Fase 2: Implementazione Auto-Discovery
- Funzioni auto-discovery datalogger/sensori
- Integrazione sistema MQTT esistente
- Test con messaggi simulati

### Fase 3: Nuove API Endpoints
- API /v1/mqtt/dataloggers/ compatibile con frontend
- API /v1/mqtt/sensors/by-datalogger/
- Endpoint gestione label utente

### Fase 4: Migrazione Frontend
- Update chiamate API
- UI edit label per datalogger/sensori
- Test interfaccia completa

### Fase 5: Migrazione Dati e Cleanup
- Script migrazione old→new models
- Backup dati esistenti
- Rimozione modelli deprecati sites
- Cleanup API deprecate

### Fase 6: Testing e Ottimizzazione
- Test completi auto-discovery
- Performance con molti dispositivi
- Gestione disconnessioni
- Monitoring

## DOMANDE CRITICHE DA RISPONDERE

### 1. Struttura Serial Numbers
- Come viene passato serial number nei messaggi MQTT?
- È nel payload JSON o derivato dal topic?
- Formato specifico serial numbers?

### 2. Gestione Messaggi
- Messaggi heartbeat contengono info datalogger E sensori insieme?
- Messaggi input/output contengono dati sensori o comandi?
- Frequenza messaggi heartbeat?

### 3. Backward Compatibility
- Mantenere dati esistenti durante migrazione?
- Periodo overlap vecchio/nuovo sistema?
- Strategia rollback se necessario?

### 4. User Experience
- Dove UI per edit label?
- Gestione datalogger "fantasma" non più attivi?
- Notifiche nuovi dispositivi auto-scoperti?

### 5. Business Logic
- Timeout per marcare dispositivi offline?
- Gestione conflitti serial numbers duplicati?
- Politiche ritenzione dati storici?

## FILES CHIAVE INDIVIDUATI

### Backend
- `/backend/sites/models.py` - Modelli da eliminare
- `/backend/mqtt/models.py` - Da estendere con nuovi modelli
- `/backend/mqtt/` - Logic MQTT esistente da integrare

### Frontend
- `/frontend/src/app/(private)/(staff)/datalogger/page.tsx` - Router page
- `/frontend/src/plugins/datalogger/DataLoggerPage.tsx` - Main UI component
- `/frontend/src/components/DataloggerCard.tsx` - Card component
- `/frontend/src/components/SensorCard.tsx` - Sensor component
- `/frontend/src/hooks/useMqttStatus.ts` - MQTT hooks (USER OPENED THIS)

### API Endpoints Attuali
- `/frontend/src/app/api/v1/sites/dataloggers/route.ts`
- `/frontend/src/app/api/v1/sites/sensors/by-datalogger/[datalogger_id]/route.ts`

### Docs Creati
- `/docs/refactoring-mqtt-models.md` - Piano completo architettura
- `/docs/session-context-refactoring.md` - Questo file context

## STATUS CONVERSAZIONE
- ✅ Analisi completa architettura esistente
- ✅ Progettazione nuova architettura
- ✅ Piano di sviluppo in 6 fasi definito
- ⏳ In attesa risposte domande critiche per iniziare sviluppo
- 🔄 Pronto per iniziare Fase 1 al return

## ISTRUZIONI PER RIPRESA
1. **Leggere questo file** per recovery context completo
2. **Ricevere risposte** alle domande critiche sopra
3. **Iniziare Fase 1** - Creazione nuovi modelli MQTT
4. **Seguire piano** nel file refactoring-mqtt-models.md

## NOTE TECNICHE IMPORTANTI
- Usare `unique_together` per (site, serial_number) su MqttDatalogger
- Usare `unique_together` per (datalogger, serial_number) su MqttSensor
- Indexing su serial_number per performance
- Mantenere compatibilità API per evitare breaking changes frontend
- Strategy: parallel running → gradual cutover → cleanup