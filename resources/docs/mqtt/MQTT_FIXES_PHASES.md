# 🔧 MQTT Fixes - Phased Implementation

**Date:** 2025-11-05
**Branch:** mqtt
**Critical Issues:** 4 identified

---

## 📋 Issues Summary

### ❌ Issue 1: Loading stops too early during polling
- **Symptom**: Click Stop → loading disappears → shows "MQTT connected" → then "MQTT disconnected"
- **Root cause**: `stopLoading` cleared after API response, before actual disconnection
- **Impact**: Confusing UX, user doesn't know operation is still in progress

### ❌ Issue 2: UI strings in Italian
- **Symptom**: Mix of Italian/English in UI
- **Root cause**: Original implementation used Italian
- **Impact**: Inconsistent localization

### ❌ Issue 3: Multiple states during Start
- **Symptom**: Shows "🚀 Starting..." → "MQTT connessione..." → "MQTT connesso"
- **Root cause**: Badge shows intermediate DB states during polling
- **Impact**: Confusing UX, too many state changes

### ❌ Issue 4: DUPLICATE CONNECTIONS (CRITICAL!)
- **Symptom**: Two connections with different instance_ids created
  ```
  site_88_i3d4ad457
  site_88_i0b42d773  (15s later)
  ```
- **Root cause**: Monitor thread race condition
- **Impact**: Multiple MQTT clients, possible message duplication, wasted resources

---

## 🎯 Phased Implementation Plan

### Phase 1: Frontend Loading & UX States
**Files:**
- `/frontend/src/plugins/datalogger/DataLoggerListPage.tsx`
- `/frontend/src/hooks/useMqtt.ts`

**Changes:**
1. Keep `startLoading`/`stopLoading` active until polling confirms target state
2. Show single "Connecting..." state during start operation
3. Show single "Disconnecting..." state during stop operation
4. Polling callback stops loading when target state reached

**Complexity:** Medium
**Estimated time:** 20 minutes
**Dependencies:** None

---

### Phase 2: English Translations
**Files:**
- `/frontend/src/plugins/datalogger/DataLoggerListPage.tsx`

**Changes:**
- Badge texts: "MQTT connesso" → "MQTT connected"
- Badge texts: "MQTT disconnesso" → "MQTT disconnected"
- Badge texts: "MQTT non configurato" → "MQTT not configured"
- Badge texts: "MQTT sconosciuto" → "MQTT unknown"
- Badge texts: "MQTT connessione..." → "Connecting..."
- Badge texts: "MQTT device offline" → keep as is
- Toast messages to English
- Button labels to English

**Complexity:** Easy
**Estimated time:** 10 minutes
**Dependencies:** Phase 1 (for new state names)

---

### Phase 3: Fix Duplicate Connections (Backend)
**Files:**
- `/backend/mqtt/services/mqtt_service.py`
- `/backend/mqtt/services/mqtt_connection.py`

**Root Cause Analysis:**

```python
# Current problematic code in monitor_connections():
for conn_id in connection_ids:
    manager = self.connections.get(conn_id)
    if manager and not manager.is_connected():  # ← BUG HERE!
        # Immediately assumes connection is lost
        # Doesn't check if connection is still establishing
        logger.warning(f"[Connection {conn_id}] Lost connection")

        # Disconnects and retries immediately
        manager.disconnect()
        self.connections.pop(conn_id, None)
        self.start_connection(mqtt_conn.site.id, manual=False)
```

**Timeline of the bug:**
```
T=0s:    API start_connection() called
T=0.1s:  manager.connect() returns True (but paho-mqtt still connecting)
T=0.2s:  manager added to registry (self.connections[id] = manager)
T=0.3s:  API returns success to frontend
T=1-5s:  paho-mqtt establishing TCP/TLS connection (manager.is_connected() = False)
T=15s:   Monitor thread runs
T=15.1s: Monitor finds manager.is_connected() = False
T=15.2s: Monitor thinks "connection lost!", calls disconnect + retry
T=15.3s: NEW connection created with NEW instance_id!
T=16s:   Original paho-mqtt connection finally establishes
Result:  TWO connections to broker!
```

**Solution:**

Add "connection age" check to distinguish:
- **Newly created** connection (still establishing) → Don't retry
- **Lost** connection (was connected, now isn't) → Retry

**Implementation:**

1. Add `created_at` timestamp to `MQTTConnectionManager`
2. Add `grace_period` (e.g., 15 seconds) before considering connection "lost"
3. Only retry if `is_running` and `(now - created_at) > grace_period` and `not is_connected()`

**Code changes:**

```python
# In mqtt_connection.py
class MQTTConnectionManager:
    def __init__(self, mqtt_connection_id: int, on_message_callback: Callable):
        # ... existing code ...
        self.created_at = datetime.now()  # NEW
        self.last_connected_at = None  # NEW

    def _on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            self.last_connected_at = datetime.now()  # NEW
            # ... rest of existing code ...

# In mqtt_service.py monitor_connections()
GRACE_PERIOD_SECONDS = 15

for conn_id in connection_ids:
    manager = self.connections.get(conn_id)
    if manager and not manager.is_connected():
        # NEW: Check if connection is still establishing
        connection_age = (datetime.now() - manager.created_at).total_seconds()

        if connection_age < GRACE_PERIOD_SECONDS:
            # Connection is still establishing, don't retry
            logger.debug(
                f"[Connection {conn_id}] Not connected yet, "
                f"but only {connection_age:.1f}s old. Waiting..."
            )
            continue

        # Connection is old enough and not connected → truly lost
        logger.warning(
            f"[Connection {conn_id}] Lost connection, "
            f"retry {manager.retry_count}/{manager.MAX_RETRIES}"
        )

        # ... existing retry logic ...
```

**Complexity:** Medium-High
**Estimated time:** 25 minutes
**Dependencies:** None
**Testing required:** YES - monitor for duplicates

---

## 🔄 Implementation Order

**Recommended:**
1. ✅ **Phase 3 first** (Critical bug - duplicate connections)
2. ✅ **Phase 1** (Loading states)
3. ✅ **Phase 2** (English translations)

**Rationale:** Fix critical backend bug first, then improve UX.

---

## 📝 Detailed Implementation

### PHASE 1: Loading States & Polling

**Problem:** `stopLoading` set to `false` immediately after API success, but connection is still active.

**Solution:** Pass loading state setters to polling hook, let polling control them.

#### Step 1.1: Update `useMqttStatusPolling` hook

**File:** `/frontend/src/hooks/useMqtt.ts`

```typescript
export function useMqttStatusPolling(
  siteId: number | null,
  refreshMqttStatus: () => Promise<void>,
  refreshDataloggers: () => Promise<void>,
  onTargetStateReached?: () => void  // NEW: callback when target reached
) {
  const [isPolling, setIsPolling] = useState(false);
  const [targetStatus, setTargetStatus] = useState<'connected' | 'disconnected' | null>(null);

  const checkStatus = useCallback(async () => {
    await refreshMqttStatus();

    // NEW: Check if target state reached
    // This requires passing current status or checking it
    // We'll need to refactor this...
  }, [refreshMqttStatus]);

  // ... rest of implementation
}
```

**Wait, this is getting complex.** Better approach:

#### Step 1.1 (Revised): Keep loading state until polling confirms

**Strategy:**
- Don't call `setStopLoading(false)` in handler
- Polling checks status every 2.5s
- When status matches target, call `setStopLoading(false)`
- Add timeout fallback (40s)

**Changes in `DataLoggerListPage.tsx`:**

```typescript
const handleMqttStop = async () => {
  setStopLoading(true);

  try {
    const result = await controlConnection(selectedSiteId, 'stop');

    if (result.success) {
      toast.success(`MQTT Connection Stopped`);

      // Start polling - don't clear loading yet!
      await startPolling('disconnected');

      // Polling will clear loading when target reached
      // OR timeout will clear it after 40s
    }
  } catch (error) {
    toast.error(`Failed to stop MQTT`);
    setStopLoading(false);  // Clear on error
  }
  // DON'T clear loading in finally!
}
```

**But polling needs to call `setStopLoading(false)`...**

This requires refactoring polling hook to accept callbacks.

#### Step 1.1 (Final approach): Polling controls loading

```typescript
// In useMqtt.ts
export function useMqttStatusPolling(
  siteId: number | null,
  refreshMqttStatus: () => Promise<void>,
  refreshDataloggers: () => Promise<void>
) {
  // ... existing code ...

  const startPolling = useCallback(async (
    targetStatus: 'connected' | 'disconnected',
    onComplete?: () => void  // NEW: callback when done
  ) => {
    // ... polling logic ...

    // On timeout or target reached:
    if (onComplete) onComplete();

  }, [...]);

  return { isPolling, startPolling, stopPolling };
}

// In DataLoggerListPage.tsx
const handleMqttStop = async () => {
  setStopLoading(true);

  try {
    const result = await controlConnection(selectedSiteId, 'stop');

    if (result.success) {
      toast.success(`MQTT Connection Stopped`);

      // Pass callback to clear loading
      await startPolling('disconnected', () => {
        setStopLoading(false);  // Clear when done
      });
    }
  } catch (error) {
    toast.error(`Failed to stop MQTT`);
    setStopLoading(false);
  }
}
```

#### Step 1.2: Single state during operations

**Problem:** Badge shows intermediate states during polling.

**Solution:** When `isPolling`, don't show DB status, show fixed "Connecting..." or "Disconnecting..."

```typescript
const getMqttStatusBadge = () => {
  if (!selectedSiteId) return null;

  // During start operation: show only "Connecting..."
  if (startLoading || (isPolling && lastAction === 'start')) {
    return {
      variant: "secondary" as const,
      text: "Connecting...",
      className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 animate-pulse"
    };
  }

  // During stop operation: show only "Disconnecting..."
  if (stopLoading || (isPolling && lastAction === 'stop')) {
    return {
      variant: "outline" as const,
      text: "Disconnecting...",
      className: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100 animate-pulse"
    };
  }

  // Normal states...
}
```

Need to track `lastAction` state.

---

### PHASE 2: English Translations

**File:** `/frontend/src/plugins/datalogger/DataLoggerListPage.tsx`

Simple find-replace:

| Italian | English |
|---------|---------|
| MQTT connesso | MQTT connected |
| MQTT disconnesso | MQTT disconnected |
| MQTT non configurato | MQTT not configured |
| MQTT sconosciuto | MQTT unknown |
| MQTT errore | MQTT error |
| MQTT connessione... | Connecting... |
| Starting MQTT connection... | Starting MQTT connection... (already English) |
| Stopping MQTT connection... | Stopping MQTT connection... (already English) |

---

### PHASE 3: Fix Duplicate Connections

**Files:**
- `/backend/mqtt/services/mqtt_connection.py` - Add timestamps
- `/backend/mqtt/services/mqtt_service.py` - Add grace period check

**Step 3.1:** Add timestamps to `MQTTConnectionManager`

```python
# In mqtt_connection.py
from datetime import datetime

class MQTTConnectionManager:
    def __init__(self, mqtt_connection_id: int, on_message_callback: Callable):
        # ... existing code ...
        self.created_at = datetime.now()
        self.last_connected_at = None

    def _on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            self.last_connected_at = datetime.now()
            # ... rest of existing code ...
```

**Step 3.2:** Add grace period in monitor

```python
# In mqtt_service.py monitor_connections()
from datetime import datetime

GRACE_PERIOD_SECONDS = 15

def monitor_connections(self):
    # ... existing code ...

    for conn_id in connection_ids:
        manager = self.connections.get(conn_id)
        if manager and not manager.is_connected():
            # Check connection age
            connection_age = (datetime.now() - manager.created_at).total_seconds()

            if connection_age < GRACE_PERIOD_SECONDS:
                # Still establishing, skip retry
                logger.debug(
                    f"[Connection {conn_id}] Not connected yet, "
                    f"age {connection_age:.1f}s < {GRACE_PERIOD_SECONDS}s grace period"
                )
                continue

            # Truly lost, proceed with retry
            logger.warning(
                f"[Connection {conn_id}] Lost connection (age {connection_age:.1f}s), "
                f"retry {manager.retry_count}/{manager.MAX_RETRIES}"
            )

            # ... existing retry logic ...
```

---

## ✅ Testing Checklist

### Phase 1 & 2 Tests:
- [ ] Click Stop MQTT
- [ ] ✅ Badge shows "Disconnecting..." (not "MQTT connected")
- [ ] ✅ Loading persists until status = 'disconnected'
- [ ] ✅ After ~30s: Badge changes to "MQTT disconnected"
- [ ] ✅ Loading clears
- [ ] Click Start MQTT
- [ ] ✅ Badge shows only "Connecting..." (not intermediate states)
- [ ] ✅ Loading persists until status = 'connected'
- [ ] ✅ Badge changes to "MQTT connected"

### Phase 3 Tests (CRITICAL):
- [ ] Stop MQTT
- [ ] Wait for disconnection
- [ ] Start MQTT
- [ ] Check broker logs immediately
- [ ] ✅ Only ONE connection appears
- [ ] Wait 30 seconds (monitor thread runs)
- [ ] Check broker logs again
- [ ] ✅ Still only ONE connection (no duplicate)
- [ ] Verify instance_id stays same: `site_001_iXXXXXXXX` (same ID throughout)

---

## 🚀 Ready to Proceed

Choose which phase to implement:

**Option A: All at once** (if you want full fix)
**Option B: Phase 3 first** (critical bug fix)
**Option C: Phase 1+2 first** (UX improvements)

Let me know which approach you prefer!
