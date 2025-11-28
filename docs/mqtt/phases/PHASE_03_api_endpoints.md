# PHASE 3: API Endpoints Refactoring

**Priority**: 🟠 HIGH
**Complexity**: ⭐ LOW
**Duration**: 30 minutes
**Dependencies**: PHASE 1 (Database Refactoring)

---

## Obiettivo

Modificare gli API endpoints Start/Stop MQTT per cambiare SOLO il flag `is_active` nel DB, senza chiamare direttamente il service. Il monitor thread farà il lavoro effettivo.

---

## Current Behavior (DA VERIFICARE)

**File**: `backend/mqtt/api/views.py`

Probabilmente ora chiama direttamente il service:
```python
def start_connection(request, site_id):
    # Opzione A (SBAGLIATA - immediata):
    result = mqtt_service.start_connection(site_id)
    return Response(result)
```

**Problema**: Risposta immediata ma non segue architettura decoupled.

---

## Target Behavior

API cambia solo il DB, il monitor fa il resto:

```python
def start_connection(request, site_id):
    # Opzione B (CORRETTA - async via monitor):
    conn.is_active = True
    conn.save()
    return Response({
        'success': True,
        'message': 'Connection will start within 30 seconds',
        'status': conn.status  # Stato corrente (ancora 'disconnected')
    })
```

Frontend riceve risposta immediata → Mostra loading → WebSocket notifica quando effettivamente connesso.

---

## Implementation

### **File**: `backend/mqtt/api/views.py`

**Find**:
```python
class MqttConnectionStartView(APIView):
    # ... current implementation
```

**Replace with**:
```python
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from mqtt.models import MqttConnection
from django.http import Http404


class MqttConnectionStartView(APIView):
    """
    Start MQTT connection for a site.

    Sets is_active=True in DB. Monitor thread will connect within 30 seconds.
    WebSocket will notify frontend when actually connected.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, site_id):
        # Permission check: only staff/superuser
        if not (request.user.is_staff or request.user.is_superuser):
            return Response(
                {'error': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            conn = MqttConnection.objects.select_related('site').get(site_id=site_id)
        except MqttConnection.DoesNotExist:
            return Response(
                {'error': f'MQTT connection for site {site_id} not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # ⭐ Only change DB flag, don't call service
        if conn.is_active:
            return Response({
                'success': True,
                'message': f'MQTT connection for site {site_id} is already active',
                'connection': {
                    'site_id': site_id,
                    'site_name': conn.site.name,
                    'status': conn.status,
                    'is_active': conn.is_active,
                    'broker_host': conn.broker_host,
                    'broker_port': conn.broker_port,
                }
            })

        conn.is_active = True
        conn.save(update_fields=['is_active'])

        return Response({
            'success': True,
            'message': f'MQTT connection for site {site_id} will start within 30 seconds. Monitor via WebSocket for real-time status.',
            'connection': {
                'site_id': site_id,
                'site_name': conn.site.name,
                'status': conn.status,  # Current status (probabilmente 'disconnected')
                'is_active': conn.is_active,  # Now True
                'broker_host': conn.broker_host,
                'broker_port': conn.broker_port,
            }
        }, status=status.HTTP_202_ACCEPTED)  # 202 = Accepted (async processing)


class MqttConnectionStopView(APIView):
    """
    Stop MQTT connection for a site.

    Sets is_active=False in DB. Monitor thread will disconnect within 30 seconds.
    WebSocket will notify frontend when actually disconnected.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, site_id):
        # Permission check: only staff/superuser
        if not (request.user.is_staff or request.user.is_superuser):
            return Response(
                {'error': 'Permission denied'},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            conn = MqttConnection.objects.select_related('site').get(site_id=site_id)
        except MqttConnection.DoesNotExist:
            return Response(
                {'error': f'MQTT connection for site {site_id} not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # ⭐ Only change DB flag
        if not conn.is_active:
            return Response({
                'success': True,
                'message': f'MQTT connection for site {site_id} is already inactive',
                'connection': {
                    'site_id': site_id,
                    'site_name': conn.site.name,
                    'status': conn.status,
                    'is_active': conn.is_active,
                }
            })

        conn.is_active = False
        conn.save(update_fields=['is_active'])

        return Response({
            'success': True,
            'message': f'MQTT connection for site {site_id} will stop within 30 seconds. Monitor via WebSocket for real-time status.',
            'connection': {
                'site_id': site_id,
                'site_name': conn.site.name,
                'status': conn.status,  # Current status (probabilmente 'connected')
                'is_active': conn.is_active,  # Now False
            }
        }, status=status.HTTP_202_ACCEPTED)
```

---

### **Update Serializer**

**File**: `backend/mqtt/api/serializers.py`

**Find**:
```python
class MqttConnectionSerializer(serializers.ModelSerializer):
    # ...
    is_enabled = serializers.BooleanField()
```

**Replace with**:
```python
class MqttConnectionSerializer(serializers.ModelSerializer):
    site_name = serializers.CharField(source='site.name', read_only=True)

    class Meta:
        model = MqttConnection
        fields = [
            'id',
            'site',
            'site_name',
            'broker_host',
            'broker_port',
            'is_active',  # ⭐ CHANGED from is_enabled
            'status',
            'last_connected_at',
            'last_heartbeat_at',
            'connection_errors',
            'error_message',
            'mqtt_retry_count',
            'mqtt_next_retry',
        ]
        read_only_fields = [
            'id',
            'site_name',
            'status',
            'last_connected_at',
            'last_heartbeat_at',
            'connection_errors',
            'mqtt_retry_count',
            'mqtt_next_retry',
        ]
```

---

## Frontend Changes Needed

**File**: `frontend/src/hooks/useMqtt.ts`

Update API response handling:

```typescript
const startConnection = async (siteId: number) => {
  setLoading(true);
  try {
    const response = await api.post(`/api/v1/mqtt/site/${siteId}/start/`);

    if (response.data.success) {
      // ⭐ Show message about delay
      toast.info(response.data.message, { duration: 5000 });

      // Frontend ora mostra "Connecting..." fino a WebSocket event
      // Non fare refetch immediato perché status non è ancora cambiato
    }
  } catch (error) {
    toast.error('Failed to start MQTT connection');
  } finally {
    setLoading(false);
  }
};
```

**WebSocket già gestisce aggiornamento quando effettivamente connesso** (fixato oggi in PHASE 5).

---

## Testing

### Manual API Testing

```bash
# 1. Start connection
curl -X POST http://localhost:8000/api/v1/mqtt/site/1/start/ \
  -H "Authorization: Token YOUR_TOKEN"

# Expected response:
{
  "success": true,
  "message": "MQTT connection for site 1 will start within 30 seconds...",
  "connection": {
    "site_id": 1,
    "site_name": "Laboratorio ASDEA",
    "status": "disconnected",  # Still disconnected!
    "is_active": true,
    "broker_host": "localhost",
    "broker_port": 1883
  }
}

# 2. Wait 30 seconds, check status
curl http://localhost:8000/api/v1/mqtt/site/1/status/ \
  -H "Authorization: Token YOUR_TOKEN"

# Expected:
{
  "status": "connected",  # Now connected!
  "is_active": true
}

# 3. Stop connection
curl -X POST http://localhost:8000/api/v1/mqtt/site/1/stop/ \
  -H "Authorization: Token YOUR_TOKEN"
```

### Integration Test

```python
# backend/mqtt/tests/test_api_endpoints.py

import time
from django.test import TestCase
from rest_framework.test import APIClient
from mqtt.models import MqttConnection, Site
from mqtt.services.mqtt_service import mqtt_service

class TestMqttAPIEndpoints(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.site = Site.objects.create(name="Test Site")
        self.conn = MqttConnection.objects.create(
            site=self.site,
            broker_host="localhost",
            is_active=False,
            status='disconnected'
        )
        # Login as superuser
        from django.contrib.auth import get_user_model
        User = get_user_model()
        self.user = User.objects.create_superuser('admin', 'admin@test.com', 'admin')
        self.client.force_authenticate(user=self.user)

    def test_start_connection_only_changes_db(self):
        """API start cambia solo DB flag, non chiama service direttamente"""
        response = self.client.post(f'/api/v1/mqtt/site/{self.site.id}/start/')

        assert response.status_code == 202  # Accepted
        assert response.data['success'] is True

        # Verify DB changed
        self.conn.refresh_from_db()
        assert self.conn.is_active is True

        # BUT status è ancora 'disconnected' (monitor non ha ancora agito)
        assert self.conn.status == 'disconnected'

    def test_monitor_actually_connects(self):
        """Monitor thread vede il cambio e connette"""
        # Set is_active
        self.conn.is_active = True
        self.conn.save()

        # Wait for monitor cycle (max 35s)
        time.sleep(35)

        # Verify connected
        self.conn.refresh_from_db()
        assert self.conn.status in ['connected', 'connecting']
```

---

## Success Criteria

- [ ] API start/stop ritorna HTTP 202 (Accepted)
- [ ] API NON chiama direttamente `mqtt_service.start/stop_connection()`
- [ ] DB `is_active` cambia immediatamente
- [ ] Status resta invariato fino a monitor cycle
- [ ] Monitor thread (max 30s) vede cambio e agisce
- [ ] WebSocket notifica frontend quando effettivamente connesso
- [ ] Frontend mostra loading durante attesa

---

## Next Phase

After completion: **PHASE 4 - Parser Registry System**

```
"Leggi docs/mqtt/phases/PHASE_04_parser_registry.md e implementa"
```

---

**Status**: 📋 Ready for Implementation
**Estimated Time**: 30 minutes
