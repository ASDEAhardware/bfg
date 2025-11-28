# PHASE 1: Database Refactoring

**Priority**: 🔴 CRITICAL
**Complexity**: ⭐ LOW
**Duration**: 30 minutes
**Dependencies**: None

---

## Obiettivo

Rinominare campi database per omogeneità naming e creare nuovi modelli per logging.

---

## Cambiamenti Richiesti

### 1. **Rename `MqttConnection.is_enabled` → `is_active`**

**Rationale**: Omogeneità con `Site.is_active` e `MqttTopic.is_active`

**Migration**:
```bash
python manage.py makemigrations mqtt --name rename_connection_is_enabled_to_is_active
```

**Expected Migration Code**:
```python
# backend/mqtt/migrations/XXXX_rename_connection_is_enabled_to_is_active.py
operations = [
    migrations.RenameField(
        model_name='mqttconnection',
        old_name='is_enabled',
        new_name='is_active',
    ),
]
```

---

### 2. **Rename `DiscoveredTopic.is_processed` → `is_processable`**

**Rationale**: Significato più chiaro - "questo topic è riconoscibile da un parser?"

**Migration**:
```bash
python manage.py makemigrations mqtt --name rename_discoveredtopic_is_processed
```

**Expected Migration Code**:
```python
operations = [
    migrations.RenameField(
        model_name='discoveredtopic',
        old_name='is_processed',
        new_name='is_processable',
    ),
]
```

---

### 3. **Create `MqttConnectionLog` Model**

**File**: `backend/mqtt/models.py`

**Code to Add**:
```python
class MqttConnectionLog(models.Model):
    """
    Log degli eventi/errori delle connessioni MQTT.
    Usato per audit trail e debugging.
    """
    connection = models.ForeignKey(
        MqttConnection,
        on_delete=models.CASCADE,
        related_name='logs'
    )
    timestamp = models.DateTimeField(auto_now_add=True)

    LEVEL_CHOICES = [
        ('DEBUG', 'Debug'),
        ('INFO', 'Info'),
        ('WARNING', 'Warning'),
        ('ERROR', 'Error'),
        ('CRITICAL', 'Critical'),
    ]
    level = models.CharField(max_length=10, choices=LEVEL_CHOICES)

    message = models.TextField()
    exception_type = models.CharField(max_length=255, blank=True)
    exception_traceback = models.TextField(blank=True)

    # Context fields
    broker_host = models.CharField(max_length=255, blank=True)
    retry_attempt = models.IntegerField(null=True, blank=True)

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['connection', '-timestamp']),
            models.Index(fields=['level', '-timestamp']),
        ]
        verbose_name = "MQTT Connection Log"
        verbose_name_plural = "MQTT Connection Logs"

    def __str__(self):
        return f"[{self.level}] {self.connection.site.name} - {self.message[:50]}"
```

**Migration**:
```bash
python manage.py makemigrations mqtt --name add_mqtt_connection_log
```

---

### 4. **Create `MqttParsingLog` Model**

**File**: `backend/mqtt/models.py`

**Code to Add**:
```python
class MqttParsingLog(models.Model):
    """
    Log degli errori di parsing dei messaggi MQTT.
    Traccia messaggi malformati o non riconosciuti.
    """
    site = models.ForeignKey(
        'sites.Site',
        on_delete=models.CASCADE,
        related_name='mqtt_parsing_logs'
    )
    timestamp = models.DateTimeField(auto_now_add=True)

    topic = models.CharField(max_length=500)
    parser_name = models.CharField(max_length=100, blank=True)

    ERROR_TYPE_CHOICES = [
        ('VALIDATION_ERROR', 'JSON Validation Error'),
        ('PARSE_ERROR', 'Topic Parse Error'),
        ('DB_ERROR', 'Database Error'),
        ('UNKNOWN_ERROR', 'Unknown Error'),
    ]
    error_type = models.CharField(max_length=50, choices=ERROR_TYPE_CHOICES)

    error_message = models.TextField()
    exception_type = models.CharField(max_length=255, blank=True)
    exception_traceback = models.TextField(blank=True)

    # Payload sample (truncated se troppo grande)
    payload_sample = models.JSONField(null=True, blank=True)

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['site', '-timestamp']),
            models.Index(fields=['error_type', '-timestamp']),
            models.Index(fields=['topic']),
        ]
        verbose_name = "MQTT Parsing Log"
        verbose_name_plural = "MQTT Parsing Logs"

    def __str__(self):
        return f"[{self.error_type}] {self.site.name} - {self.topic}"
```

**Migration**:
```bash
python manage.py makemigrations mqtt --name add_mqtt_parsing_log
```

---

## Implementation Steps

### Step 1: Update Models

1. Open `backend/mqtt/models.py`
2. Add `MqttConnectionLog` class (after `MqttConnection`)
3. Add `MqttParsingLog` class (after `DiscoveredTopic`)

### Step 2: Create Migrations

Run sequentially:
```bash
# 1. Rename MqttConnection.is_enabled → is_active
python manage.py makemigrations mqtt --name rename_connection_is_enabled_to_is_active

# 2. Rename DiscoveredTopic.is_processed → is_processable
python manage.py makemigrations mqtt --name rename_discoveredtopic_is_processed

# 3. Add MqttConnectionLog model
python manage.py makemigrations mqtt --name add_mqtt_connection_log

# 4. Add MqttParsingLog model
python manage.py makemigrations mqtt --name add_mqtt_parsing_log
```

### Step 3: Apply Migrations

```bash
python manage.py migrate mqtt
```

### Step 4: Update References in Code

**Files to update**:

1. **backend/mqtt/services/mqtt_service.py**
   - Find all `is_enabled` → Replace with `is_active`

2. **backend/mqtt/services/mqtt_connection.py**
   - Find all `is_enabled` → Replace with `is_active`

3. **backend/mqtt/services/message_processor.py**
   - Find all `is_processed` → Replace with `is_processable`

4. **backend/mqtt/services/broadcast.py**
   - Find all `is_enabled` → Replace with `is_active`

5. **backend/mqtt/api/views.py**
   - Find all `is_enabled` → Replace with `is_active`

6. **backend/mqtt/api/serializers.py**
   - Update field name in serializers

**Search & Replace Commands**:
```bash
# Backend files
grep -r "is_enabled" backend/mqtt/ --include="*.py" | grep -v migrations | grep -v __pycache__

# Replace manually or use sed (verify first!)
find backend/mqtt -name "*.py" -not -path "*/migrations/*" -exec sed -i 's/\.is_enabled/.is_active/g' {} +
find backend/mqtt -name "*.py" -not -path "*/migrations/*" -exec sed -i 's/is_enabled =/is_active =/g' {} +
find backend/mqtt -name "*.py" -not -path "*/migrations/*" -exec sed -i "s/'is_enabled'/'is_active'/g" {} +

# Same for is_processed → is_processable
find backend/mqtt -name "*.py" -not -path "*/migrations/*" -exec sed -i 's/\.is_processed/.is_processable/g' {} +
find backend/mqtt -name "*.py" -not -path "*/migrations/*" -exec sed -i 's/is_processed =/is_processable =/g' {} +
find backend/mqtt -name "*.py" -not -path "*/migrations/*" -exec sed -i "s/'is_processed'/'is_processable'/g" {} +
```

### Step 5: Update Django Admin

**File**: `backend/mqtt/admin.py`

Add admin for new models:
```python
from mqtt.models import MqttConnectionLog, MqttParsingLog

@admin.register(MqttConnectionLog)
class MqttConnectionLogAdmin(admin.ModelAdmin):
    list_display = ['timestamp', 'connection', 'level', 'message_short', 'retry_attempt']
    list_filter = ['level', 'timestamp', 'connection']
    search_fields = ['message', 'exception_type']
    readonly_fields = ['timestamp', 'connection', 'level', 'message', 'exception_type', 'exception_traceback', 'broker_host', 'retry_attempt']

    def message_short(self, obj):
        return obj.message[:50] + '...' if len(obj.message) > 50 else obj.message
    message_short.short_description = 'Message'

    def has_add_permission(self, request):
        return False  # Read-only

@admin.register(MqttParsingLog)
class MqttParsingLogAdmin(admin.ModelAdmin):
    list_display = ['timestamp', 'site', 'topic', 'error_type', 'parser_name']
    list_filter = ['error_type', 'timestamp', 'site']
    search_fields = ['topic', 'error_message', 'parser_name']
    readonly_fields = ['timestamp', 'site', 'topic', 'parser_name', 'error_type', 'error_message', 'exception_type', 'exception_traceback', 'payload_sample']

    def has_add_permission(self, request):
        return False  # Read-only
```

---

## Testing

### Unit Tests

```python
# backend/mqtt/tests/test_models.py

class TestMqttConnectionLog:
    def test_create_connection_log(self):
        """Can create connection log"""
        conn = MqttConnection.objects.first()
        log = MqttConnectionLog.objects.create(
            connection=conn,
            level='ERROR',
            message='Connection failed',
            exception_type='ConnectionError',
        )
        assert log.id is not None
        assert str(log).startswith('[ERROR]')

class TestMqttParsingLog:
    def test_create_parsing_log(self):
        """Can create parsing log"""
        site = Site.objects.first()
        log = MqttParsingLog.objects.create(
            site=site,
            topic='test/topic',
            error_type='VALIDATION_ERROR',
            error_message='Invalid JSON',
            payload_sample={'invalid': 'data'}
        )
        assert log.id is not None
```

### Manual Testing

1. **Check migrations applied**:
   ```bash
   python manage.py showmigrations mqtt
   ```
   Should show all 4 new migrations as `[X]`

2. **Check models renamed**:
   ```bash
   python manage.py shell
   ```
   ```python
   from mqtt.models import MqttConnection, DiscoveredTopic
   conn = MqttConnection.objects.first()
   print(conn.is_active)  # Should work
   # print(conn.is_enabled)  # Should raise AttributeError

   topic = DiscoveredTopic.objects.first()
   print(topic.is_processable)  # Should work
   ```

3. **Check Django Admin**:
   - Visit `/admin/mqtt/mqttconnectionlog/`
   - Visit `/admin/mqtt/mqttparsinglog/`
   - Should load without errors

4. **Check API still works**:
   ```bash
   curl http://localhost:8000/api/v1/mqtt/connection-status/
   ```
   Should return connections with `is_active` field

---

## Rollback Plan

If anything breaks:

```bash
# Rollback migrations
python manage.py migrate mqtt <previous_migration_name>

# Restore old field names in code
git diff backend/mqtt/
git checkout backend/mqtt/  # If needed
```

---

## Success Criteria

- [ ] All 4 migrations created and applied successfully
- [ ] No `is_enabled` references in code (except migrations)
- [ ] No `is_processed` references in code (except migrations)
- [ ] Django Admin loads without errors
- [ ] API responses use `is_active` instead of `is_enabled`
- [ ] Unit tests pass

---

## Next Phase

After completion: **PHASE 2 - Monitor Thread Refactoring**

```
"Leggi docs/mqtt/phases/PHASE_02_monitor_thread_refactoring.md e implementa"
```

---

**Status**: 📋 Ready for Implementation
**Estimated Time**: 30 minutes
