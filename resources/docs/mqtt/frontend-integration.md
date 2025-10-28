# Integrazione Frontend MQTT

## Overview

Il frontend utilizza React hooks custom per integrare le funzionalità MQTT tramite API REST. Non c'è comunicazione MQTT diretta dal browser - tutte le operazioni passano attraverso il backend Django.

## Architettura Frontend

```
┌─────────────────────────────────────────────────┐
│              React Components                    │
│  ┌──────────────┐  ┌──────────────────────┐    │
│  │DataLoggerList│  │DataLoggerDetail Page│    │
│  │     Page     │  │                      │    │
│  └──────┬───────┘  └─────────┬────────────┘    │
│         │                     │                  │
│         ▼                     ▼                  │
│  ┌────────────────────────────────────────┐     │
│  │         React Hooks Layer              │     │
│  │  ┌────────────┐  ┌───────────────┐    │     │
│  │  │  useMqtt   │  │useDatalogger  │    │     │
│  │  │            │  │  Control      │    │     │
│  │  └────────────┘  └───────────────┘    │     │
│  └────────────────────────────────────────┘     │
│         │                     │                  │
│         ▼                     ▼                  │
│  ┌────────────────────────────────────────┐     │
│  │        Zustand Store                   │     │
│  │   dataloggerControlStore               │     │
│  └────────────────────────────────────────┘     │
│         │                                        │
└─────────┼────────────────────────────────────────┘
          │
          ▼ HTTP/REST
┌──────────────────────────────────────────────────┐
│            Django Backend API                    │
│          /api/v1/mqtt/*                         │
└──────────────────────────────────────────────────┘
```

## Hooks Principali

### 1. useMqttConnectionStatus

Hook per monitorare lo stato della connessione MQTT di un sito.

**File:** `/frontend/src/hooks/useMqtt.ts`

**Utilizzo:**
```typescript
import { useMqttConnectionStatus } from '@/hooks/useMqtt';

function MyComponent() {
  const {
    connection,      // MqttConnectionStatus | null
    loading,         // boolean
    error,           // string | null
    isHeartbeatTimeout,  // boolean
    refresh          // () => Promise<void>
  } = useMqttConnectionStatus(selectedSiteId);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!connection) return <div>No MQTT configured</div>;

  return (
    <div>
      <Badge variant={connection.status === 'connected' ? 'default' : 'secondary'}>
        {connection.status}
      </Badge>
      <Button onClick={refresh}>Refresh</Button>
    </div>
  );
}
```

**Interfaccia MqttConnectionStatus:**
```typescript
interface MqttConnectionStatus {
  connection_id: number;
  site_id: number;
  site_name: string;
  is_enabled: boolean;
  status: 'connected' | 'connecting' | 'disconnected' | 'error' | 'disabled';
  broker_host: string;
  broker_port: number;
  last_connected_at?: string;
  last_heartbeat_at?: string;
  connection_errors: number;
  error_message?: string;
  handler_running: boolean;
  handler_connected: boolean;
  retry_count: number;
  subscribed_topics: number;
}
```

**Caratteristiche:**
- Auto-refresh quando cambia siteId
- Gestione intelligente heartbeat timeout
- Error handling robusto
- Loading states

---

### 2. useMqttControl

Hook per controllo connessioni MQTT (superuser only).

**Utilizzo:**
```typescript
import { useMqttControl } from '@/hooks/useMqtt';

function AdminPanel() {
  const {
    controlConnection,  // (siteId, action) => Promise<MqttControlResponse>
    forceDiscovery      // (siteId) => Promise<MqttControlResponse>
  } = useMqttControl();

  const handleStart = async () => {
    const result = await controlConnection(siteId, 'start');
    if (result.success) {
      toast.success('MQTT started');
    } else {
      toast.error(result.message);
    }
  };

  const handleForceDiscovery = async () => {
    const result = await forceDiscovery(siteId);
    toast.success(`Processed ${result.success_count} topics`);
  };

  return (
    <>
      <Button onClick={handleStart}>Start MQTT</Button>
      <Button onClick={() => controlConnection(siteId, 'stop')}>
        Stop MQTT
      </Button>
      <Button onClick={handleForceDiscovery}>Force Discovery</Button>
    </>
  );
}
```

---

### 3. useDataloggers

Hook per recuperare lista datalogger.

**Utilizzo:**
```typescript
import { useDataloggers } from '@/hooks/useMqtt';

function DataloggerList() {
  const {
    dataloggers,  // Datalogger[]
    loading,      // boolean
    error,        // string | null
    refresh       // () => Promise<void>
  } = useDataloggers(selectedSiteId);

  // Auto-refresh opzionale
  useEffect(() => {
    const interval = setInterval(refresh, 30000); // 30s
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <div>
      {dataloggers.map(datalogger => (
        <DataloggerCard key={datalogger.id} datalogger={datalogger} />
      ))}
    </div>
  );
}
```

**Interfaccia Datalogger:**
```typescript
interface Datalogger {
  id: number;
  site_id: number;
  site_name: string;
  serial_number: string;
  label: string;
  datalogger_type: string;
  device_id: string;
  is_online: boolean;
  last_seen_at?: string;
  last_heartbeat?: string;
  firmware_version?: string;
  ip_address?: string;
  total_heartbeats: number;
  missed_heartbeats: number;
  uptime_percentage: number;
  sensors_count: number;
  active_sensors_count: number;
  mqtt_api_version?: string;
  created_at: string;
  updated_at: string;
}
```

---

### 4. useSensors

Hook per recuperare lista sensori.

**Utilizzo:**
```typescript
import { useSensors } from '@/hooks/useMqtt';

function SensorList({ dataloggerId }: { dataloggerId: number }) {
  const {
    sensors,   // Sensor[]
    loading,   // boolean
    error,     // string | null
    refresh    // () => Promise<void>
  } = useSensors(dataloggerId);

  return (
    <div className="grid grid-cols-3 gap-4">
      {sensors.map(sensor => (
        <SensorCard key={sensor.id} sensor={sensor} />
      ))}
    </div>
  );
}
```

**Interfaccia Sensor:**
```typescript
interface Sensor {
  id: number;
  datalogger_label: string;
  site_name: string;
  serial_number: string;
  label: string;
  sensor_type: string;
  unit_of_measure?: string;
  is_online: boolean;
  last_reading?: string;
  total_messages: number;
  total_readings: number;
  min_value_ever?: number;
  max_value_ever?: number;
  uptime_percentage: number;
  latest_readings: Array<{
    timestamp: string;
    data: Record<string, any>;
  }>;
  current_value?: number;
  created_at: string;
  updated_at: string;
}
```

---

### 5. useDataloggerControl

Hook avanzato per controllo acquisizione datalogger (comandi MQTT).

**File:** `/frontend/src/hooks/useDataloggerControl.ts`

**Utilizzo:**
```typescript
import { useDataloggerControl } from '@/hooks/useDataloggerControl';

function DataloggerControlPanel({ datalogger, siteId }) {
  const {
    session,        // DataloggerSession | null
    isLogging,      // boolean
    pendingCommand, // string | null
    isPublishing,   // boolean
    error,          // string | null
    sendStart,      // () => Promise<boolean>
    sendStop,       // () => Promise<boolean>
    sendStatus,     // () => Promise<boolean>
    topics          // { input: string, output: string }
  } = useDataloggerControl({ datalogger, siteId });

  return (
    <div>
      <div>Status: {session?.status || 'unknown'}</div>
      <div>Session: {session?.session_id || 'N/A'}</div>

      <Button
        onClick={sendStart}
        disabled={isLogging || isPublishing || pendingCommand === 'start'}
      >
        {isPublishing && pendingCommand === 'start' ? (
          <Loader2 className="animate-spin" />
        ) : (
          'Start'
        )}
      </Button>

      <Button
        onClick={sendStop}
        disabled={!isLogging || isPublishing || pendingCommand === 'stop'}
      >
        Stop
      </Button>

      <Button onClick={sendStatus}>Check Status</Button>
    </div>
  );
}
```

**Funzionalità:**
- Publish comandi MQTT (start/stop/status)
- Session management con Zustand
- Pending command tracking con timeout
- Auto-status polling ogni 60s
- Mock responses in development

---

## Zustand Store

### dataloggerControlStore

Store per gestire le sessioni di controllo datalogger.

**File:** `/frontend/src/store/dataloggerControlStore.ts`

**Struttura:**
```typescript
interface DataloggerSession {
  datalogger_id: number;
  session_id: string | null;
  status: 'running' | 'stopped' | 'terminated forcibly' | 'no process running' | 'unknown';
  last_command: string | null;
  last_command_timestamp: string | null;
  tdengine_status: 'connected' | 'failed' | null;
  software_version: string | null;
  device_info: {
    serial_number?: string;
    ip_address?: string;
    software_version?: string;
  } | null;
  connected_devices_count: number | null;
  last_heartbeat: string | null;
  error_message: string | null;
}
```

**Utilizzo:**
```typescript
import { useDataloggerControlStore } from '@/store/dataloggerControlStore';

function MyComponent() {
  const {
    sessions,           // Record<number, DataloggerSession>
    getSession,         // (id: number) => DataloggerSession | null
    isLogging,          // (id: number) => boolean
    hasPendingCommand,  // (id: number) => string | null
    updateSessionStatus,// (id: number, data: Partial<DataloggerSession>) => void
    setPendingCommand,  // (id: number, command: string) => void
    clearPendingCommand // (id: number) => void
  } = useDataloggerControlStore();

  const session = getSession(dataloggerId);
  const isRunning = isLogging(dataloggerId);
}
```

**Caratteristiche:**
- Persistenza con localStorage
- Timeout automatico comandi pending (30s)
- Session tracking multi-datalogger
- Thread-safe updates

---

## Components

### DataloggerCard

Card per visualizzare un datalogger nella lista.

**File:** `/frontend/src/components/DataloggerCard.tsx`

**Props:**
```typescript
interface DataloggerCardProps {
  datalogger: Datalogger;
  onConnect: (datalogger: Datalogger) => void;
  onLabelUpdate?: (datalogger: Datalogger, newLabel: string) => void;
  compact?: boolean;  // true per list mode, false per grid mode
}
```

**Utilizzo:**
```tsx
<DataloggerCard
  datalogger={datalogger}
  onConnect={(dl) => router.push(`/datalogger/${dl.id}`)}
  onLabelUpdate={handleLabelUpdate}
  compact={viewMode === 'list'}
/>
```

**Caratteristiche:**
- Due modalità: compact (lista) e full (griglia)
- Badge status online/offline
- Metriche: uptime, sensori, heartbeats
- Inline label editing
- Loading state sul pulsante "Visualizza"

---

### SensorCard

Card per visualizzare un sensore.

**File:** `/frontend/src/components/SensorCard.tsx`

**Props:**
```typescript
interface SensorCardProps {
  sensor: Sensor;
  onLabelUpdate?: (sensor: Sensor, newLabel: string) => void;
  showEnhanced?: boolean;  // Mostra statistiche avanzate
  chartOpacity?: number;   // Opacità trend chart (0-100)
  compact?: boolean;
}
```

**Utilizzo:**
```tsx
<SensorCard
  sensor={sensor}
  onLabelUpdate={handleLabelUpdate}
  showEnhanced={true}
  chartOpacity={25}
  compact={viewMode === 'list'}
/>
```

**Caratteristiche:**
- Trend chart background (TrendChart component)
- Supporto multi-axis per accelerometri
- Latest readings display
- Min/max statistics
- Inline label editing
- Badge status online/offline

---

## Pagine Principali

### DataLoggerListPage

Lista di tutti i datalogger del sito.

**Path:** `/frontend/src/plugins/datalogger/DataLoggerListPage.tsx`

**URL:** `http://localhost:3000/datalogger/`

**Caratteristiche:**
- MQTT status badge con indicatore connessione
- Admin menu (superuser): Start/Stop/Force Discovery
- Filtri: search, online only
- View mode: grid / list
- Auto-refresh configurabile
- Settings panel laterale
- System info modal con statistiche aggregate

**Hooks utilizzati:**
```typescript
const { connection, refresh: refreshMqttStatus } = useMqttConnectionStatus(siteId);
const { controlConnection, forceDiscovery } = useMqttControl();
const { dataloggers, loading, error, refresh: refreshDataloggers } = useDataloggers(siteId);
```

---

### DataLoggerDetailPage

Dettaglio singolo datalogger con controllo acquisizione.

**Path:** `/frontend/src/app/(private)/(staff)/datalogger/[id]/page.tsx`

**URL:** `http://localhost:3000/datalogger/15`

**Caratteristiche:**
- Header con info datalogger
- Controlli Start/Stop acquisizione
- Lista sensori con cards
- Scheduler per automazioni
- Real-time session status
- Pending command feedback

**Hooks utilizzati:**
```typescript
const { dataloggers } = useDataloggers(siteId);
const { sensors, refresh: refreshSensors } = useSensors(dataloggerId);
const {
  session,
  isLogging,
  pendingCommand,
  isPublishing,
  sendStart,
  sendStop,
  sendStatus
} = useDataloggerControl({ datalogger, siteId });
```

---

## Patterns e Best Practices

### 1. Loading States

Sempre gestire gli stati di caricamento con feedback visivo:

```typescript
<Button
  onClick={handleAction}
  disabled={isLoading}
>
  {isLoading ? (
    <>
      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      Loading...
    </>
  ) : (
    "Action"
  )}
</Button>
```

### 2. Error Handling

Gestire errori con toast notifications:

```typescript
try {
  const result = await sendStart();
  if (result) {
    toast.success("Command sent successfully");
  }
} catch (error) {
  toast.error(`Error: ${error.message}`);
  console.error('Start command failed:', error);
}
```

### 3. Cleanup

Sempre cleanup subscriptions e intervals:

```typescript
useEffect(() => {
  const interval = setInterval(refresh, 30000);

  return () => {
    clearInterval(interval);
  };
}, [refresh]);
```

### 4. Conditional Rendering

Gestire tutti i casi: loading, error, empty, success:

```typescript
if (loading) return <LoadingSkeleton />;
if (error) return <ErrorMessage error={error} />;
if (!dataloggers.length) return <EmptyState />;

return <DataloggerList dataloggers={dataloggers} />;
```

### 5. Memoization

Usare useMemo e useCallback per performance:

```typescript
const filteredDataloggers = useMemo(() => {
  return dataloggers.filter(dl =>
    dl.label.toLowerCase().includes(searchTerm.toLowerCase())
  );
}, [dataloggers, searchTerm]);

const handleRefresh = useCallback(async () => {
  await refreshDataloggers();
}, [refreshDataloggers]);
```

---

## Testing

### Hook Testing

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useMqttConnectionStatus } from '@/hooks/useMqtt';

test('should fetch MQTT status', async () => {
  const { result } = renderHook(() =>
    useMqttConnectionStatus(1)
  );

  expect(result.current.loading).toBe(true);

  await waitFor(() => {
    expect(result.current.loading).toBe(false);
    expect(result.current.connection).toBeTruthy();
  });
});
```

### Component Testing

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { DataloggerCard } from '@/components/DataloggerCard';

test('should render datalogger card', () => {
  const datalogger = {
    id: 1,
    label: 'Test Datalogger',
    is_online: true,
    // ... other props
  };

  render(<DataloggerCard datalogger={datalogger} onConnect={jest.fn()} />);

  expect(screen.getByText('Test Datalogger')).toBeInTheDocument();
  expect(screen.getByText('Online')).toBeInTheDocument();
});

test('should call onConnect when button clicked', () => {
  const onConnect = jest.fn();
  render(<DataloggerCard datalogger={datalogger} onConnect={onConnect} />);

  fireEvent.click(screen.getByText('Visualizza'));
  expect(onConnect).toHaveBeenCalledWith(datalogger);
});
```

---

## Performance Optimization

### 1. Lazy Loading

```typescript
const SensorCard = lazy(() => import('@/components/SensorCard'));

<Suspense fallback={<Skeleton />}>
  <SensorCard sensor={sensor} />
</Suspense>
```

### 2. Virtual Scrolling

Per liste lunghe di datalogger/sensori:

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

const virtualizer = useVirtualizer({
  count: dataloggers.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 200,
});
```

### 3. Debouncing

Per search e filtri:

```typescript
import { useDebouncedCallback } from 'use-debounce';

const debouncedSearch = useDebouncedCallback(
  (value) => setSearchTerm(value),
  300
);
```

---

## Troubleshooting

### MQTT Status Non Aggiorna

1. Verificare che il `selectedSiteId` sia corretto
2. Controllare console browser per errori API
3. Verificare refresh interval non troppo lungo
4. Testare endpoint API direttamente

### Comandi Non Funzionano

1. Verificare permessi utente (staff/superuser)
2. Controllare che la connessione MQTT sia attiva
3. Verificare topic pattern corretti
4. Testare publish manuale con mosquitto_pub

### Performance Issues

1. Ridurre frequency auto-refresh
2. Implementare paginazione per liste lunghe
3. Usare React.memo per componenti pesanti
4. Profiling con React DevTools

---

## Future Enhancements

- [ ] WebSocket real-time updates invece di polling
- [ ] Notification system per eventi critici
- [ ] Advanced filtering e sorting
- [ ] Bulk operations su datalogger
- [ ] Export data to CSV/Excel
- [ ] Custom dashboards configurabili
- [ ] Mobile responsive improvements
