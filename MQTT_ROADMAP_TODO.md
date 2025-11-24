# MQTT System - Roadmap & TODO Completa

**Progetto**: BFG - Sistema Monitoraggio MQTT per Devices IoT
**Data Ultimo Aggiornamento**: 2025-11-20
**Stato Attuale**: Quick Win Completato - Frontend con dati reali funzionante
**Branch**: `mqtt`

---

## 📊 Executive Summary

### Cosa Funziona Ora (✅)

**Backend MQTT:**
- ✅ Servizio MQTT singleton attivo (supervisord)
- ✅ Auto-discovery di tutti i topic MQTT (tabella `DiscoveredTopic`)
- ✅ Processing formato heartbeat con `sensors_last_data` come oggetto o array
- ✅ Auto-creazione Gateway, Datalogger, Sensor da messaggi MQTT
- ✅ Campo `acquisition_status` aggiunto al model
- ✅ Funzione `_normalize_sensors_data()` per gestire formati multipli
- ✅ Offline detection automatica ogni 30s
- ✅ Retry automatico con exponential backoff

**Database:**
- ✅ 1 Gateway creato: `site_006-gateway_1`
- ✅ 1 Datalogger creato: `MONSTRO-TEST-001` (tipo: monstro)
- ✅ 2 Sensori creati: `temp_sensor_1`, `humidity_sensor_1`

**Frontend:**
- ✅ Pagina `/devices` usa dati reali (zero mock!)
- ✅ Hook `useDataloggers(siteId)` funzionante
- ✅ Componente `DeviceCard` renderizza dati reali
- ✅ Label editing inline funzionante
- ✅ Raggruppamento ADAQ/Weather Stations funzionante
- ✅ Status online/offline da database
- ✅ Badge MQTT connection status

### Cosa Manca (⏳)

**Backend MQTT:**
- ⏳ Processore per Formato 4: `datalogger/all/status` (aggregato multi-datalogger)
- ⏳ Processore per Formato 1: `backend/status` (monitoring backend MQTT)
- ⏳ Processore per Formato 5: `connection/status` (device connection events)
- ⏳ Comando pulizia retained messages vecchi dal broker
- ⏳ Allineamento nomi `datalogger_type` con frontend (monstro vs monstr-o)

**Frontend:**
- ⏳ DeviceCard layout 2 sezioni per UX familiare (come mock Monstr-o)
- ⏳ Calcolo dinamico sensor types per card raggruppate (ora hardcoded a 0)
- ⏳ Modal Force Discovery con info topic per sito
- ⏳ Gestione loading states migliore
- ⏳ Error handling per datalogger offline

**Testing:**
- ⏳ Test end-to-end con payload MQTT reali
- ⏳ Verifica creazione automatica dispositivi
- ⏳ Test label editing persistente
- ⏳ Test raggruppamento con multipli device

---

## 🎯 Roadmap Consigliata (Ordine di Esecuzione)

### FASE 1: UX Improvements (Alta Priorità) 🎨
**Tempo Stimato**: 2-3 ore
**Impatto**: Alto - UX completa per utente finale

#### 1.1 DeviceCard Layout 2 Sezioni
**File**: `frontend/src/components/DeviceCard.tsx`
**Obiettivo**: Layout familiare all'utente con 2 sezioni distinte (come mock Monstr-o)

**Dettagli Implementazione:**
```typescript
// Attuale: DeviceCard ha un layout singolo con lista verticale
// Target: Layout con 2 sezioni orizzontali con sfondo colorato

<CardContent>
  {/* Sezione 1: Metriche Dispositivi */}
  <div className="bg-background/50 rounded p-2.5 border border-primary/20 mb-3">
    <div className="grid grid-cols-3 gap-2 text-center">
      <div>
        <div className="text-xs text-muted-foreground mb-1">Sensori</div>
        <div className="text-sm font-semibold">{active}/{total}</div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground mb-1">Uptime</div>
        <div className="text-sm font-semibold">{uptime}%</div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground mb-1">Heartbeat</div>
        <div className="text-sm font-semibold">{hb_ok}/{hb_total}</div>
      </div>
    </div>
  </div>

  {/* Sezione 2: Tipologia Sensori (calcolata dinamicamente) */}
  <div className="bg-background/50 rounded p-2.5 border border-primary/20 mb-4">
    <div className="text-xs text-muted-foreground mb-2">Tipologia Sensori</div>
    <div className="grid grid-cols-4 gap-2">
      {sensorTypes.map((type, idx) => (
        <div key={idx} className="flex flex-col items-center">
          <type.icon className="h-4 w-4 text-muted-foreground mb-1" />
          <span className="text-xs font-semibold">{type.count}</span>
        </div>
      ))}
    </div>
  </div>
</CardContent>
```

**Proprietà da Aggiungere al DeviceCard:**
```typescript
interface DeviceCardProps {
  datalogger: Datalogger;
  onConnect: (datalogger: Datalogger) => void;
  onLabelUpdate?: (datalogger: Datalogger, newLabel: string) => void;
  compact?: boolean;
  showTwoSectionLayout?: boolean; // NUOVO - default true
}
```

**Calcolo Dinamico Sensor Types:**
```typescript
// In DeviceCard.tsx
const calculateSensorTypes = (datalogger: Datalogger) => {
  // TODO: Implementare query per ottenere sensor types aggregati
  // Per ora placeholder con dati mock
  const sensorTypes = [
    { icon: Thermometer, count: datalogger.sensors_count, label: "Sensori" },
    { icon: Activity, count: datalogger.active_sensors_count, label: "Attivi" },
  ];
  return sensorTypes;
};
```

**Checkpoint Verifica:**
- [ ] DeviceCard mostra 2 sezioni con bordi colorati
- [ ] Metriche sono visibili e corrette
- [ ] Layout è consistente tra device espansi e singoli
- [ ] Responsive su mobile

---

#### 1.2 Calcolo Dinamico Sensor Types per Card Raggruppate
**File**: `frontend/src/plugins/devices/DevicesListPage.tsx` (linee 450-490)
**Obiettivo**: Sostituire hardcoded `adaqSensorTypes` con calcolo reale

**Implementazione:**
```typescript
// Calcola aggregati da array di datalogger
const calculateAggregatedSensorTypes = (dataloggers: Datalogger[]) => {
  // Aggregare sensor_type da tutti i sensori di tutti i datalogger
  const typeCounts: Record<string, number> = {};

  dataloggers.forEach(dl => {
    // Fetch sensors per datalogger via API o hook
    // Aggregare per sensor_type
  });

  return [
    { icon: Thermometer, count: typeCounts.temperature || 0, label: "Temperatura" },
    { icon: Droplets, count: typeCounts.humidity || 0, label: "Umidità" },
    { icon: Zap, count: typeCounts.current || 0, label: "Corrente" }
  ];
};

// Usare nel render delle card raggruppate
const adaqSensorTypes = useMemo(() =>
  calculateAggregatedSensorTypes(adaqDevices),
  [adaqDevices]
);
```

**API Necessaria:**
- Endpoint: `GET /api/v1/mqtt/sensors/by_datalogger/?datalogger_id={id}`
- Response: Array di sensori con `sensor_type`

**Checkpoint Verifica:**
- [ ] Card raggruppate mostrano conteggi reali
- [ ] Conteggi si aggiornano quando cambiano i device
- [ ] Performance accettabile (usare useMemo)

---

#### 1.3 Modal Force Discovery
**File**: `frontend/src/plugins/devices/ForceDiscoveryModal.tsx` (NUOVO)
**Obiettivo**: Modal che mostra topic discovered per il sito selezionato

**Struttura Modal:**
```typescript
interface DiscoveredTopicInfo {
  topic_path: string;
  message_count: number;
  is_processed: boolean;
  processor_name: string | null;
  sample_payload: any;
  last_seen_at: string;
  payload_size_avg: number;
}

interface ForceDiscoveryModalProps {
  open: boolean;
  onClose: () => void;
  siteId: number;
}

export function ForceDiscoveryModal({ open, onClose, siteId }: ForceDiscoveryModalProps) {
  // Hook per fetch discovered topics
  const { data: topics, loading, refresh } = useDiscoveredTopics(siteId);

  // Handler force discovery
  const handleForceDiscovery = async () => {
    await forceDiscovery(siteId);
    await refresh();
    toast.success("Discovery forzata completata");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Topic Discovery - Site {siteId}</DialogTitle>
          <DialogDescription>
            Topic MQTT scoperti e stato processing
          </DialogDescription>
        </DialogHeader>

        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{topics?.length || 0}</div>
              <div className="text-xs text-muted-foreground">Topic Totali</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">
                {topics?.filter(t => t.is_processed).length || 0}
              </div>
              <div className="text-xs text-muted-foreground">Processati</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-orange-600">
                {topics?.filter(t => !t.is_processed).length || 0}
              </div>
              <div className="text-xs text-muted-foreground">Da Processare</div>
            </CardContent>
          </Card>
        </div>

        {/* Topics Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Topic Path</TableHead>
              <TableHead>Messaggi</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Processore</TableHead>
              <TableHead>Ultima Attività</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topics?.map(topic => (
              <TableRow key={topic.topic_path}>
                <TableCell className="font-mono text-xs">
                  {topic.topic_path}
                </TableCell>
                <TableCell>{topic.message_count}</TableCell>
                <TableCell>
                  <Badge variant={topic.is_processed ? "default" : "secondary"}>
                    {topic.is_processed ? "✓ Processed" : "⏳ Pending"}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">
                  {topic.processor_name || "—"}
                </TableCell>
                <TableCell className="text-xs">
                  {formatDistanceToNow(new Date(topic.last_seen_at), { addSuffix: true })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Actions */}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Chiudi</Button>
          <Button onClick={handleForceDiscovery} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Force Discovery
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Hook Necessario:**
```typescript
// frontend/src/hooks/useMqtt.ts
export function useDiscoveredTopics(siteId: number | null) {
  return useQuery({
    queryKey: ['discovered-topics', siteId],
    queryFn: async () => {
      if (!siteId) return [];
      const response = await api.get(`/v1/mqtt/sites/${siteId}/discovered-topics/`);
      return response.data;
    },
    enabled: !!siteId,
  });
}
```

**API Backend Necessaria:**
```python
# backend/mqtt/views.py
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_discovered_topics(request, site_id):
    """Get all discovered topics for a site"""
    topics = DiscoveredTopic.objects.filter(
        site_id=site_id
    ).order_by('-last_seen_at')

    data = [{
        'topic_path': t.topic_path,
        'message_count': t.message_count,
        'is_processed': t.is_processed,
        'processor_name': t.processor_name,
        'sample_payload': t.sample_payload,
        'last_seen_at': t.last_seen_at.isoformat(),
        'payload_size_avg': t.payload_size_avg,
    } for t in topics]

    return Response(data)
```

**Integrazione in DevicesListPage:**
```typescript
// In DevicesListPage.tsx
const [showDiscoveryModal, setShowDiscoveryModal] = useState(false);

// Nel dropdown admin (dopo Force Discovery button)
<DropdownMenuItem
  onClick={() => {
    setIsAdminDropdownOpen(false);
    setShowDiscoveryModal(true);
  }}
>
  <Search className="h-4 w-4 mr-2" />
  <span>Vedi Topic Discovery</span>
</DropdownMenuItem>

// A fine componente
{showDiscoveryModal && (
  <ForceDiscoveryModal
    open={showDiscoveryModal}
    onClose={() => setShowDiscoveryModal(false)}
    siteId={selectedSiteId}
  />
)}
```

**Checkpoint Verifica:**
- [ ] Modal si apre dal dropdown admin
- [ ] Mostra topic scoperti per il sito
- [ ] Differenzia topic processati vs pending
- [ ] Force Discovery trigger refresh
- [ ] Tabella responsive e scrollabile

---

### FASE 2: Backend MQTT Processors (Media Priorità) 🔧
**Tempo Stimato**: 3-4 ore
**Impatto**: Medio - Supporto formati payload futuri

#### 2.1 Processore Formato 4: datalogger/all/status (Aggregato)
**File**: `backend/mqtt/services/message_processor.py`
**Obiettivo**: Gestire payload aggregati con multipli datalogger

**Payload Target:**
```json
{
  "serial_number": "site_001-gateway_1-all_1",
  "timestamp": "2025-11-20T15:10:07.839359Z",
  "mqtt_api_version": "1.0.0",
  "message_interval_seconds": 5,
  "dataloggers": [
    {
      "serial_number": "all_1",
      "status": "stopped",
      "sensors_data": []
    },
    {
      "serial_number": "all_2",
      "status": "running",
      "sensors_data": [
        {
          "serial_number": "sensor_1",
          "value": 25.5,
          "unit": "C",
          "timestamp": "2025-11-20T15:10:07Z"
        }
      ]
    }
  ]
}
```

**Topic Pattern**: `[sito]/gateway/[n]/datalogger/all/status`

**Implementazione:**
```python
def _process_datalogger_status_aggregated(
    self,
    site_id: int,
    topic: str,
    data: Dict[str, Any],
    topic_info: Dict[str, Any]
) -> bool:
    """
    Processa formato aggregato datalogger status.

    Supporta array di datalogger in un singolo messaggio.
    Ogni datalogger può avere multipli sensori.
    """
    try:
        timestamp = timezone.now()
        if 'timestamp' in data:
            timestamp = self._parse_mqtt_timestamp(data['timestamp'])

        # Recupera sito
        from sites.models import Site
        site = Site.objects.get(id=site_id)

        # Trova o crea gateway
        gateway_serial = f"{topic_info['site_code']}-gateway_{topic_info['gateway_number']}"
        gateway, _ = Gateway.objects.get_or_create(
            serial_number=gateway_serial,
            defaults={
                'site': site,
                'label': f"Gateway {topic_info['gateway_number']}",
                'is_online': True,
                'mqtt_api_version': data.get('mqtt_api_version', 'v1.0.0'),
                'expected_heartbeat_interval': data.get('message_interval_seconds', 60)
            }
        )

        # Processa array dataloggers
        dataloggers_list = data.get('dataloggers', [])
        logger.info(f"Processing {len(dataloggers_list)} dataloggers in aggregated message")

        for dl_data in dataloggers_list:
            serial_number = dl_data.get('serial_number')
            if not serial_number:
                logger.warning("Skipping datalogger without serial_number")
                continue

            status = dl_data.get('status', 'unknown')

            # Crea o aggiorna datalogger
            datalogger, created = Datalogger.objects.get_or_create(
                serial_number=serial_number,
                defaults={
                    'site': site,
                    'gateway': gateway,
                    'label': serial_number,
                    'datalogger_type': topic_info.get('datalogger_type', 'all'),
                    'is_online': status in ['running', 'online'],
                    'acquisition_status': status,
                    'last_seen_at': timestamp,
                    'total_heartbeats': 1,
                    'missed_heartbeats': 0,
                    'uptime_percentage': 100.0,
                }
            )

            if not created:
                # Aggiorna esistente
                datalogger.is_online = status in ['running', 'online']
                datalogger.acquisition_status = status
                datalogger.last_seen_at = timestamp
                datalogger.total_heartbeats += 1
                datalogger.save()

            # Processa sensors_data se presente
            sensors_data = self._normalize_sensors_data(dl_data)
            processed_sensor_serials = set()

            for sensor_data in sensors_data:
                if isinstance(sensor_data, dict):
                    success = self._process_sensor_data(datalogger, sensor_data)
                    if success:
                        sensor_serial = sensor_data.get('serial_number', 'unknown')
                        processed_sensor_serials.add(sensor_serial)

            # Mark missing sensors as offline
            self._mark_missing_sensors_offline(datalogger, processed_sensor_serials)

            action = "Created" if created else "Updated"
            logger.info(f"{action} datalogger {serial_number} (status: {status})")

        # Mark topic as processed
        self._mark_topic_as_processed(
            site_id=site_id,
            topic=topic,
            processor_name='datalogger_status_aggregated'
        )

        return True

    except Exception as e:
        logger.error(f"Error processing aggregated datalogger status: {e}")
        import traceback
        traceback.print_exc()
        return False
```

**Integrazione in Topic Parser:**
```python
def _parse_topic_structure(self, topic: str) -> Dict[str, Any]:
    """Parse topic structure - AGGIORNATO"""
    parts = topic.split('/')

    # ... existing code ...

    # Caso: [sito]/gateway/[n]/datalogger/all/status
    if len(parts) == 6 and parts[3] == 'datalogger' and parts[5] == 'status':
        datalogger_type = parts[4]  # 'all'
        return {
            'type': 'datalogger_status_aggregated',
            'site_code': site_code,
            'gateway_number': gateway_number,
            'datalogger_type': datalogger_type,
            'function': 'status'
        }

    # ... rest of code ...
```

**Integrazione in Versioned Processor:**
```python
def _process_versioned_message(self, site_id: int, topic: str, payload_data: dict, version_info: dict) -> bool:
    """Process message - AGGIORNATO"""

    # ... existing code ...

    elif topic_info['type'] == 'datalogger_status_aggregated':
        processed = self._process_datalogger_status_aggregated(
            site_id, topic, payload_data, topic_info
        )

    # ... rest of code ...
```

**Test:**
```python
# backend/mqtt/tests/test_aggregated_processor.py
def test_process_aggregated_status():
    payload = {
        "serial_number": "site_001-gateway_1-all_1",
        "timestamp": "2025-11-20T15:10:07.839359Z",
        "mqtt_api_version": "1.0.0",
        "dataloggers": [
            {"serial_number": "all_1", "status": "running", "sensors_data": []},
            {"serial_number": "all_2", "status": "stopped", "sensors_data": []}
        ]
    }

    result = message_processor.process_message(
        site_id=1,
        topic="site_001/gateway/1/datalogger/all/status",
        payload=json.dumps(payload),
        qos=0,
        retain=False
    )

    assert result is True
    assert Datalogger.objects.filter(serial_number="all_1").exists()
    assert Datalogger.objects.filter(serial_number="all_2").exists()
```

**Checkpoint Verifica:**
- [ ] Topic `*/datalogger/all/status` viene riconosciuto
- [ ] Array dataloggers viene processato correttamente
- [ ] Ogni datalogger crea/aggiorna record in DB
- [ ] Sensori vengono associati correttamente
- [ ] Status acquisizione salvato correttamente

---

#### 2.2 Processore Formato 1: backend/status
**File**: `backend/mqtt/services/message_processor.py`
**Obiettivo**: Monitoring dello stato del backend MQTT stesso

**Payload:**
```json
{
  "status": "online",
  "client_id": "site_88_bkode",
  "timestamp": "2025-11-20T13:59:15.317226Z",
  "instance_id": "bkode"
}
```

**Topic Pattern**: `[sito]/backend/status`

**Implementazione:**
```python
def _process_backend_status(
    self,
    site_id: int,
    topic: str,
    data: Dict[str, Any]
) -> bool:
    """
    Processa status del backend MQTT.

    Aggiorna lo status della connessione MQTT nella tabella MqttConnection.
    """
    try:
        status = data.get('status', 'unknown')
        timestamp_str = data.get('timestamp')
        instance_id = data.get('instance_id', 'unknown')

        # Parse timestamp
        if timestamp_str:
            timestamp = self._parse_mqtt_timestamp(timestamp_str)
        else:
            timestamp = timezone.now()

        # Aggiorna MqttConnection
        try:
            mqtt_conn = MqttConnection.objects.get(site_id=site_id)

            # Solo se status è diverso dall'attuale
            if mqtt_conn.status != status:
                old_status = mqtt_conn.status
                mqtt_conn.status = status
                mqtt_conn.last_heartbeat_at = timestamp
                mqtt_conn.save(update_fields=['status', 'last_heartbeat_at'])

                logger.info(
                    f"Backend status updated for site {site_id}: "
                    f"{old_status} -> {status} (instance: {instance_id})"
                )
            else:
                # Aggiorna solo timestamp
                mqtt_conn.last_heartbeat_at = timestamp
                mqtt_conn.save(update_fields=['last_heartbeat_at'])

            # Mark topic as processed
            self._mark_topic_as_processed(
                site_id=site_id,
                topic=topic,
                processor_name='backend_status'
            )

            return True

        except MqttConnection.DoesNotExist:
            logger.warning(f"No MqttConnection found for site {site_id}")
            return False

    except Exception as e:
        logger.error(f"Error processing backend status: {e}")
        return False
```

**Integrazione Topic Parser:**
```python
# In _parse_topic_structure
if len(parts) == 3 and parts[1] == 'backend' and parts[2] == 'status':
    return {
        'type': 'backend_status',
        'site_code': site_code
    }
```

**Integrazione Versioned Processor:**
```python
elif topic_info['type'] == 'backend_status':
    processed = self._process_backend_status(site_id, topic, payload_data)
```

**Checkpoint Verifica:**
- [ ] Topic `*/backend/status` riconosciuto
- [ ] Status aggiorna MqttConnection.status
- [ ] Timestamp heartbeat aggiornato
- [ ] Log solo quando status cambia

---

#### 2.3 Processore Formato 5: connection/status
**File**: `backend/mqtt/services/message_processor.py`
**Obiettivo**: Eventi di connessione/disconnessione da device

**Payload:**
```json
{
  "status": "disconnected",
  "reason": "unexpected",
  "timestamp": "2025-11-04T08:51:53.304298",
  "client_id": "b6eda3f639ca_6ed5a73f_site_001_conn1",
  "site_id": 6,
  "site_name": "Diga del Vajont"
}
```

**Topic Pattern**: `[sito]/connection/status` (QoS 1, Retained)

**Implementazione:**
```python
def _process_connection_status(
    self,
    site_id: int,
    topic: str,
    data: Dict[str, Any]
) -> bool:
    """
    Processa connection status dal device.

    IMPORTANTE: Gestisce retained messages vecchi (ignora se > 24h).
    """
    try:
        status = data.get('status', 'unknown')
        reason = data.get('reason', '')
        timestamp_str = data.get('timestamp')

        # Parse timestamp
        if timestamp_str:
            timestamp = self._parse_mqtt_timestamp(timestamp_str)
        else:
            timestamp = timezone.now()

        # IMPORTANTE: Ignora retained messages vecchi
        age_hours = (timezone.now() - timestamp).total_seconds() / 3600
        if age_hours > 24:
            logger.warning(
                f"Old retained connection status detected "
                f"(age: {age_hours:.1f}h) for site {site_id} - ignoring"
            )
            return True

        # Aggiorna MqttConnection
        try:
            mqtt_conn = MqttConnection.objects.get(site_id=site_id)

            if status == 'disconnected':
                # Device si è disconnesso
                if mqtt_conn.status != 'error':
                    mqtt_conn.status = 'error'
                    mqtt_conn.error_message = f"Device disconnected: {reason}"
                    mqtt_conn.last_heartbeat_at = timestamp
                    mqtt_conn.save(update_fields=[
                        'status',
                        'error_message',
                        'last_heartbeat_at'
                    ])

                    logger.warning(
                        f"Device connection lost for site {site_id}: {reason}"
                    )

            elif status == 'connected':
                # Device si è riconnesso
                if mqtt_conn.status == 'error':
                    mqtt_conn.status = 'connected'
                    mqtt_conn.error_message = None
                    mqtt_conn.last_heartbeat_at = timestamp
                    mqtt_conn.save(update_fields=[
                        'status',
                        'error_message',
                        'last_heartbeat_at'
                    ])

                    logger.info(f"Device reconnected for site {site_id}")

            # Mark topic as processed
            self._mark_topic_as_processed(
                site_id=site_id,
                topic=topic,
                processor_name='connection_status'
            )

            return True

        except MqttConnection.DoesNotExist:
            logger.warning(f"No MqttConnection found for site {site_id}")
            return False

    except Exception as e:
        logger.error(f"Error processing connection status: {e}")
        return False
```

**Integrazione Topic Parser:**
```python
# In _parse_topic_structure
if len(parts) == 3 and parts[1] == 'connection' and parts[2] == 'status':
    return {
        'type': 'connection_status',
        'site_code': site_code
    }
```

**Checkpoint Verifica:**
- [ ] Topic `*/connection/status` riconosciuto
- [ ] Retained messages vecchi (>24h) ignorati
- [ ] Status error quando disconnected
- [ ] Status cleared quando reconnected
- [ ] Reason salvato in error_message

---

#### 2.4 Comando Pulizia Retained Messages
**File**: `backend/mqtt/management/commands/clean_retained_messages.py` (NUOVO)
**Obiettivo**: Pulizia retained messages vecchi dal broker

**Implementazione:**
```python
from django.core.management.base import BaseCommand
from mqtt.models import MqttConnection, DiscoveredTopic
from mqtt.services.mqtt_service import mqtt_service
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Clean old retained MQTT messages from broker'

    def add_arguments(self, parser):
        parser.add_argument(
            '--site-id',
            type=int,
            help='Clean only for specific site ID'
        )
        parser.add_argument(
            '--topic-pattern',
            type=str,
            help='Clean only topics matching pattern (e.g., */connection/status)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be cleaned without actually cleaning'
        )

    def handle(self, *args, **options):
        site_id = options.get('site_id')
        topic_pattern = options.get('topic_pattern')
        dry_run = options.get('dry_run', False)

        # Get topics to clean
        topics_query = DiscoveredTopic.objects.all()

        if site_id:
            topics_query = topics_query.filter(site_id=site_id)

        if topic_pattern:
            # Convert glob pattern to Django filter
            pattern = topic_pattern.replace('*', '%')
            topics_query = topics_query.filter(topic_path__like=pattern)

        # Filter topics that are retained and old
        from django.utils import timezone
        from datetime import timedelta
        cutoff = timezone.now() - timedelta(days=7)

        old_topics = topics_query.filter(
            last_seen_at__lt=cutoff
        )

        self.stdout.write(f"Found {old_topics.count()} old retained topics to clean")

        if dry_run:
            for topic in old_topics:
                self.stdout.write(f"Would clean: {topic.topic_path}")
            return

        # Clean each topic by publishing empty retained message
        cleaned_count = 0
        failed_count = 0

        for topic in old_topics:
            try:
                # Extract site_id from topic
                site_id = topic.site_id

                # Publish empty retained message
                result = mqtt_service.publish_message(
                    site_id=site_id,
                    topic=topic.topic_path,
                    message='',  # Empty payload clears retained
                    qos=1,
                    retain=True
                )

                if result.get('success'):
                    self.stdout.write(
                        self.style.SUCCESS(f"✓ Cleaned: {topic.topic_path}")
                    )
                    cleaned_count += 1

                    # Optionally delete from DiscoveredTopic
                    # topic.delete()
                else:
                    self.stdout.write(
                        self.style.ERROR(f"✗ Failed: {topic.topic_path}")
                    )
                    failed_count += 1

            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f"✗ Error cleaning {topic.topic_path}: {e}")
                )
                failed_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"\nCleaned {cleaned_count} topics, {failed_count} failed"
            )
        )
```

**Uso:**
```bash
# Dry run per vedere cosa verrà pulito
python manage.py clean_retained_messages --dry-run

# Pulisci tutto > 7 giorni
python manage.py clean_retained_messages

# Pulisci solo connection/status per site 6
python manage.py clean_retained_messages --site-id 6 --topic-pattern "*/connection/status"

# Via Docker
podman exec bfg_backend python manage.py clean_retained_messages
```

**Checkpoint Verifica:**
- [ ] Comando esegue senza errori
- [ ] Dry run mostra topic da pulire
- [ ] Topic vengono effettivamente rimossi dal broker
- [ ] Log chiari di successo/errore

---

### FASE 3: Allineamento e Polish (Bassa Priorità) 🎨
**Tempo Stimato**: 1-2 ore
**Impatto**: Basso - Consistency e naming

#### 3.1 Allineamento Nomi datalogger_type
**Obiettivo**: Consistency tra frontend e backend per nomi tipo

**Mapping Attuale vs Target:**
```
Backend DB  → Frontend Display
-----------   ----------------
monstro     → Monstr-o
adaq        → ADAQ
weather     → Stazione Meteo
all         → Generic
```

**Approccio:**
1. **Mantenere DB invariato** (monstro, adaq, weather, all)
2. **Mapping nel frontend** per display
3. **Helper function** per conversione

**Implementazione Frontend:**
```typescript
// frontend/src/utils/deviceTypeMapping.ts
export const DEVICE_TYPE_DISPLAY: Record<string, string> = {
  'monstro': 'Monstr-o',
  'adaq': 'ADAQ',
  'weather': 'Stazione Meteo',
  'weather-station': 'Stazione Meteo',
  'all': 'Generic',
};

export const DEVICE_TYPE_ICONS: Record<string, any> = {
  'monstro': Server,
  'adaq': Cpu,
  'weather': CloudRain,
  'weather-station': CloudRain,
  'all': HardDrive,
};

export function getDeviceTypeDisplay(type: string): string {
  return DEVICE_TYPE_DISPLAY[type.toLowerCase()] || type;
}

export function getDeviceTypeIcon(type: string) {
  return DEVICE_TYPE_ICONS[type.toLowerCase()] || HardDrive;
}
```

**Uso in DeviceCard:**
```typescript
import { getDeviceTypeDisplay, getDeviceTypeIcon } from '@/utils/deviceTypeMapping';

// Nel render
const DisplayIcon = getDeviceTypeIcon(datalogger.datalogger_type);
const displayName = getDeviceTypeDisplay(datalogger.datalogger_type);

<div className="flex items-center gap-2">
  <DisplayIcon className="h-4 w-4 text-primary" />
  <h3 className="text-sm font-semibold">{displayName}</h3>
</div>
```

**Checkpoint Verifica:**
- [ ] Frontend mostra nomi corretti (Monstr-o, ADAQ, etc.)
- [ ] Icone associate corrette per tipo
- [ ] Backend DB rimane invariato
- [ ] Filtri e raggruppamenti funzionano

---

#### 3.2 Loading States e Error Handling
**File**: `frontend/src/plugins/devices/DevicesListPage.tsx`
**Obiettivo**: UX migliore durante loading e errori

**Implementazione:**
```typescript
// Stati loading più granulari
const {
  dataloggers,
  loading: dataloggerLoading,
  error: dataloggerError,
  refresh: refreshDataloggers
} = useDataloggers(selectedSiteId);

// Loading skeleton
{dataloggerLoading && (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
    {Array.from({ length: 4 }).map((_, idx) => (
      <Card key={idx} className="card-standard">
        <CardContent className="card-content-detailed">
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-full mb-4" />
          <Skeleton className="h-20 w-full mb-4" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    ))}
  </div>
)}

// Error state
{dataloggerError && (
  <div className="flex flex-col items-center justify-center p-8">
    <AlertCircle className="h-12 w-12 text-destructive mb-4" />
    <h3 className="text-lg font-semibold mb-2">
      Errore Caricamento Dispositivi
    </h3>
    <p className="text-sm text-muted-foreground mb-4">
      {dataloggerError.message}
    </p>
    <Button onClick={() => refreshDataloggers()}>
      <RefreshCw className="h-4 w-4 mr-2" />
      Riprova
    </Button>
  </div>
)}

// Empty state
{!dataloggerLoading && !dataloggerError && dataloggers.length === 0 && (
  <div className="flex flex-col items-center justify-center p-8">
    <Server className="h-12 w-12 text-muted-foreground mb-4" />
    <h3 className="text-lg font-semibold mb-2">
      Nessun Dispositivo Trovato
    </h3>
    <p className="text-sm text-muted-foreground mb-4">
      Non ci sono dispositivi configurati per questo sito.
    </p>
    {hasAdminPermissions && (
      <Button variant="outline" onClick={() => setShowDiscoveryModal(true)}>
        <Search className="h-4 w-4 mr-2" />
        Avvia Discovery
      </Button>
    )}
  </div>
)}
```

**Checkpoint Verifica:**
- [ ] Loading skeleton visibile durante fetch
- [ ] Error state con messaggio chiaro
- [ ] Empty state quando nessun device
- [ ] Button retry funzionante

---

### FASE 4: Testing End-to-End (Alta Priorità) ✅
**Tempo Stimato**: 2 ore
**Impatto**: Critico - Verifica funzionamento completo

#### 4.1 Test Discovery Automatico
**Obiettivo**: Verificare che nuovi messaggi MQTT vengano scoperti e processati

**Test Steps:**
```bash
# 1. Verifica servizio MQTT attivo
curl http://localhost:8000/api/v1/mqtt/health/

# 2. Invia messaggio MQTT di test
podman exec bfg_backend python manage.py shell -c "
from mqtt.services.mqtt_service import mqtt_service
import json

# Pubblica test heartbeat
result = mqtt_service.publish_message(
    site_id=6,
    topic='site_006/gateway/1/datalogger/test/999/heartbeat',
    message=json.dumps({
        'serial_number': 'TEST-DEVICE-999',
        'timestamp': '2025-11-20T16:00:00Z',
        'mqtt_api_version': 'v1.0.0',
        'firmware_version': 'TEST-1.0',
        'ip_address': '192.168.1.999',
        'sensors_last_data': {
            'test_sensor': {
                'value': 100,
                'unit': 'test'
            }
        }
    }),
    qos=0
)
print(result)
"

# 3. Attendi processing (max 5s)
sleep 5

# 4. Verifica in DiscoveredTopic
podman exec bfg_backend python manage.py shell -c "
from mqtt.models import DiscoveredTopic, Datalogger
topic = DiscoveredTopic.objects.filter(topic_path__contains='test/999').first()
print(f'Topic discovered: {topic.topic_path if topic else None}')
print(f'Is processed: {topic.is_processed if topic else None}')

datalogger = Datalogger.objects.filter(serial_number='TEST-DEVICE-999').first()
print(f'Datalogger created: {datalogger is not None}')
if datalogger:
    print(f'  - Label: {datalogger.label}')
    print(f'  - Online: {datalogger.is_online}')
    print(f'  - Sensors: {datalogger.sensors.count()}')
"
```

**Expected Results:**
- [ ] Topic appare in `DiscoveredTopic` con `is_processed=True`
- [ ] Datalogger `TEST-DEVICE-999` creato
- [ ] Sensor `test_sensor` associato al datalogger
- [ ] Frontend mostra nuovo device dopo refresh

---

#### 4.2 Test Label Editing
**Obiettivo**: Verificare persistenza label editing

**Test Steps:**
```bash
# 1. Apri http://localhost:3000/devices (autenticato)

# 2. Clicca su pencil icon di un device

# 3. Cambia label in "TEST LABEL EDITED"

# 4. Premi Enter o click outside

# 5. Verifica nel database
podman exec bfg_backend python manage.py shell -c "
from mqtt.models import Datalogger
dl = Datalogger.objects.get(serial_number='MONSTRO-TEST-001')
print(f'Current label: {dl.label}')
"

# 6. Refresh pagina e verifica che label persiste
```

**Expected Results:**
- [ ] Label si aggiorna in UI immediatamente
- [ ] PATCH request a `/api/v1/mqtt/devices/{id}/update_label/` succede
- [ ] Database aggiornato
- [ ] Label persiste dopo refresh

---

#### 4.3 Test Raggruppamento
**Obiettivo**: Verificare expand/collapse gruppi

**Test Steps:**
1. Crea multipli device ADAQ via MQTT
2. Verifica card raggruppata mostra stats aggregati
3. Click "Espandi Gruppo"
4. Verifica tutte le card individuali appaiono
5. Click "Raggruppa Devices"
6. Verifica ritorno a card raggruppata

**Expected Results:**
- [ ] Stats aggregati corretti (online/total, sensors)
- [ ] Expand mostra tutte le card
- [ ] Collapse raggruppa
- [ ] Stato persist durante navigazione

---

### FASE 5: Documentazione e Manutenzione 📚
**Tempo Stimato**: 1 ora
**Impatto**: Medio - Manutenibilità futura

#### 5.1 Aggiornare MQTT_DOCUMENTATION.md
**File**: `resources/docs/mqtt/MQTT_DOCUMENTATION.md`
**Aggiunte necessarie:**
- Nuovi formati payload (1, 4, 5)
- Processo discovery automatico
- Comando clean_retained_messages
- Esempi uso API

#### 5.2 Schema Database ERD
**File**: `resources/docs/mqtt/DATABASE_SCHEMA.md` (NUOVO)
**Contenuto:**
- Diagramma ER delle tabelle MQTT
- Relazioni Gateway → Datalogger → Sensor
- Indici e performance considerations
- Esempi query comuni

#### 5.3 API Documentation
**File**: `resources/docs/mqtt/API_ENDPOINTS.md` (NUOVO)
**Contenuto:**
- Lista completa endpoint MQTT
- Request/Response examples
- Authentication
- Error codes

---

## 📝 Checklist Completa Finale

### Backend
- [ ] Formato 4: datalogger/all/status processore
- [ ] Formato 1: backend/status processore
- [ ] Formato 5: connection/status processore
- [ ] Comando clean_retained_messages
- [ ] Test unitari per nuovi processori
- [ ] Campo `acquisition_status` documentato

### Frontend
- [ ] DeviceCard layout 2 sezioni
- [ ] Calcolo dinamico sensor types
- [ ] Modal Force Discovery
- [ ] Loading states migliori
- [ ] Error handling completo
- [ ] Empty states
- [ ] Mapping device type names

### Testing
- [ ] Test discovery automatico
- [ ] Test label editing
- [ ] Test raggruppamento
- [ ] Test con payload Formato 4
- [ ] Test con payload Formato 1
- [ ] Test con payload Formato 5
- [ ] Performance test con 100+ devices

### Documentazione
- [ ] MQTT_DOCUMENTATION.md aggiornato
- [ ] DATABASE_SCHEMA.md creato
- [ ] API_ENDPOINTS.md creato
- [ ] Questo documento aggiornato

---

## 🚀 Come Riprendere il Lavoro

### Quick Start per AI Agent

**Contesto Progetto:**
```
Nome: BFG - Sistema Monitoraggio MQTT
Stack: Django 3.13 + PostgreSQL + Next.js 15 + React 19
Directory: /home/bkode/Desktop/bfg
Branch: mqtt
Servizi: podman-compose (bfg_backend, bfg_frontend)
```

**Stato Attuale (Sessione 2025-11-20):**
- ✅ Backend MQTT con discovery automatico funzionante
- ✅ Frontend `/devices` con dati reali (zero mock)
- ✅ Gateway + Datalogger + Sensor creati automaticamente
- ⏳ Mancano: Processori formati 1,4,5 + DeviceCard 2 sezioni + Modal Discovery

**Files Chiave Modificati:**
```
backend/mqtt/services/message_processor.py - Processore MQTT (1500+ righe)
backend/mqtt/models.py - Models con acquisition_status
frontend/src/plugins/devices/DevicesListPage.tsx - Pagina devices con dati reali
frontend/src/components/DeviceCard.tsx - Card device
```

**Come Testare:**
```bash
# Backend API
curl http://localhost:8000/api/v1/mqtt/health/

# Database
podman exec bfg_backend python manage.py shell -c "
from mqtt.models import Datalogger, Gateway, Sensor
print(f'Dataloggers: {Datalogger.objects.count()}')
print(f'Gateways: {Gateway.objects.count()}')
print(f'Sensors: {Sensor.objects.count()}')
"

# Frontend
curl http://localhost:3000/devices
```

**Per Iniziare una Fase:**
```bash
# Esempio: Fase 1.1 - DeviceCard Layout 2 Sezioni
cd /home/bkode/Desktop/bfg/frontend
# Modifica: src/components/DeviceCard.tsx
# Obiettivo: Aggiungere layout con 2 sezioni come mock Monstr-o
# Riferimento: src/plugins/devices/DevicesListPage.tsx linee 482-528 (vecchio mock)
```

**Comandi Utili:**
```bash
# Restart MQTT service
podman exec bfg_backend supervisorctl restart mqtt_service

# Watch logs
podman logs -f bfg_backend | grep -i mqtt

# Force discovery
curl -X POST http://localhost:8000/api/v1/mqtt/sites/6/discover/

# Frontend rebuild
podman restart bfg_frontend
```

---

## 📞 Note per Developer Umano

**Priorità Suggerita:**
1. **FASE 1.1** - DeviceCard 2 sezioni (impatto visivo immediato)
2. **FASE 4** - Test end-to-end (verificare che tutto funzioni)
3. **FASE 2.1** - Formato 4 aggregato (supporto payload futuri)
4. **FASE 1.3** - Modal Discovery (tool debug utile)
5. **FASE 2** - Altri processori (completezza)

**Attenzione:**
- Retained messages vecchi possono causare confusione → Usare Fase 2.4
- Frontend richiede rebuild dopo modifiche → `podman restart bfg_frontend`
- Topic discovery è automatico ma asincrono → Attendere 5-10s

**Per Domande/Supporto:**
- Documentazione: `/home/bkode/Desktop/bfg/MQTT_*.md`
- Payload examples: `/home/bkode/Desktop/bfg/MQTT_PAYLOAD_FORMATS.md`
- Status analysis: `/home/bkode/Desktop/bfg/MQTT_CURRENT_STATUS_ANALYSIS.md`

---

**Fine Documento - Pronto per Handoff a Nuova Sessione AI** ✅
