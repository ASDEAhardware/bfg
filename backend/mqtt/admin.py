from django.contrib import admin
from .models import MqttConnection, MqttTopic, Gateway, Datalogger, Sensor


# ============================================================================
# MQTT SECTION
# ============================================================================

class MqttTopicInline(admin.TabularInline):
    """Inline per gestire i topic MQTT direttamente dalla connessione"""
    model = MqttTopic
    extra = 1
    fields = ['topic_pattern', 'is_active', 'qos_level', 'priority', 'description']
    readonly_fields = ['subscription_count', 'last_subscribed_at']
    classes = ['collapse']


@admin.register(MqttConnection)
class MqttConnectionAdmin(admin.ModelAdmin):
    list_display = ['site', 'is_enabled', 'broker_host', 'broker_port', 'status', 'topics_count', 'last_connected_at', 'last_heartbeat_at', 'connection_errors']
    list_filter = ['is_enabled', 'status', 'ssl_enabled', 'created_at']
    search_fields = ['site__name', 'broker_host', 'client_id_prefix']
    readonly_fields = ['last_connected_at', 'last_heartbeat_at', 'connection_errors', 'created_at', 'updated_at']
    list_editable = ['is_enabled']
    inlines = [MqttTopicInline]

    fieldsets = (
        ('Site', {
            'fields': ('site',)
        }),
        ('Connection', {
            'fields': ('is_enabled', 'broker_host', 'broker_port', 'client_id_prefix')
        }),
        ('Authentication', {
            'fields': ('username', 'password'),
            'classes': ('collapse',)
        }),
        ('Retry Settings', {
            'fields': ('keep_alive_interval', 'retry_attempts', 'retry_delay', 'max_retry_delay'),
            'classes': ('collapse',)
        }),
        ('SSL', {
            'fields': ('ssl_enabled', 'ca_cert_path'),
            'classes': ('collapse',)
        }),
        ('Status', {
            'fields': ('status', 'last_connected_at', 'last_heartbeat_at', 'connection_errors', 'error_message'),
            'classes': ('wide',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('site').prefetch_related('topics')

    def topics_count(self, obj):
        active_count = obj.topics.filter(is_active=True).count()
        total_count = obj.topics.count()
        return f"{active_count}/{total_count}"
    topics_count.short_description = 'Topics (Active/Total)'


@admin.register(MqttTopic)
class MqttTopicAdmin(admin.ModelAdmin):
    list_display = ['get_full_topic', 'mqtt_connection_site', 'is_active', 'qos_level', 'priority', 'description_preview']
    list_filter = ['is_active', 'qos_level', 'priority', 'mqtt_connection__site', 'created_at']
    search_fields = ['topic_pattern', 'mqtt_connection__site__name', 'description']
    readonly_fields = ['subscription_count', 'last_subscribed_at', 'created_at', 'updated_at']
    list_editable = ['is_active', 'qos_level', 'priority']

    fieldsets = (
        ('Topic Configuration', {
            'fields': ('mqtt_connection', 'topic_pattern', 'is_active')
        }),
        ('MQTT Settings', {
            'fields': ('qos_level', 'priority', 'auto_retry'),
            'classes': ('wide',)
        }),
        ('Advanced Settings', {
            'fields': ('max_message_size', 'description'),
            'classes': ('collapse',)
        }),
        ('Statistics', {
            'fields': ('subscription_count', 'last_subscribed_at'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('mqtt_connection', 'mqtt_connection__site')

    def mqtt_connection_site(self, obj):
        return obj.mqtt_connection.site.name
    mqtt_connection_site.short_description = 'Site'
    mqtt_connection_site.admin_order_field = 'mqtt_connection__site__name'

    def description_preview(self, obj):
        return obj.description[:50] + '...' if len(obj.description) > 50 else obj.description
    description_preview.short_description = 'Description'


# ============================================================================
# MONITORING SYSTEM SECTION
# ============================================================================

@admin.register(Gateway)
class GatewayAdmin(admin.ModelAdmin):
    """Admin per Gateway (ex SystemInfo)"""
    list_display = ['label', 'site', 'serial_number', 'hostname', 'is_online', 'cpu_usage_percent', 'memory_usage_percent', 'disk_usage_percent', 'uptime_display', 'last_heartbeat']
    list_filter = ['is_online', 'site', 'last_heartbeat', 'created_at']
    search_fields = ['label', 'serial_number', 'site__name', 'hostname', 'ip_address']
    readonly_fields = ['last_heartbeat', 'last_communication', 'created_at', 'updated_at', 'uptime_display']

    fieldsets = (
        ('Gateway Information', {
            'fields': ('site', 'serial_number', 'label', 'hostname', 'ip_address', 'firmware_version')
        }),
        ('Status', {
            'fields': ('is_online', 'last_heartbeat', 'last_communication'),
            'classes': ('wide',)
        }),
        ('Performance Metrics', {
            'fields': ('cpu_usage_percent', 'memory_usage_percent', 'disk_usage_percent', 'uptime_seconds', 'uptime_display'),
            'classes': ('wide',)
        }),
        ('Raw Data', {
            'fields': ('raw_metadata',),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('site')

    def uptime_display(self, obj):
        """Human-readable uptime"""
        if not obj.uptime_seconds:
            return "Unknown"

        days = obj.uptime_seconds // 86400
        hours = (obj.uptime_seconds % 86400) // 3600
        minutes = (obj.uptime_seconds % 3600) // 60

        if days > 0:
            return f"{days}d {hours}h {minutes}m"
        elif hours > 0:
            return f"{hours}h {minutes}m"
        else:
            return f"{minutes}m"
    uptime_display.short_description = 'Uptime'

    def has_add_permission(self, request):
        return False  # Auto-discovered via MQTT

    def has_delete_permission(self, request, obj=None):
        return True  # Permettiamo cleanup manuale


class SensorInline(admin.TabularInline):
    """Inline per visualizzare sensori del datalogger"""
    model = Sensor
    extra = 0
    fields = ['label', 'serial_number', 'sensor_type', 'is_online', 'total_readings', 'uptime_percentage']
    readonly_fields = ['serial_number', 'total_readings', 'uptime_percentage', 'last_reading']
    classes = ['collapse']


@admin.register(Datalogger)
class DataloggerAdmin(admin.ModelAdmin):
    """Admin per Datalogger auto-discovered"""
    list_display = ['label', 'site', 'datalogger_type', 'instance_number', 'serial_number', 'is_online', 'sensors_count', 'uptime_percentage', 'last_heartbeat']
    list_filter = ['is_online', 'datalogger_type', 'site', 'last_heartbeat', 'created_at']
    search_fields = ['label', 'serial_number', 'site__name', 'datalogger_type']
    readonly_fields = ['serial_number', 'datalogger_type', 'instance_number', 'last_heartbeat', 'last_communication', 'total_heartbeats', 'missed_heartbeats', 'created_at', 'updated_at']
    inlines = [SensorInline]

    fieldsets = (
        ('Datalogger Information', {
            'fields': ('site', 'serial_number', 'label', 'datalogger_type', 'instance_number')
        }),
        ('Connection', {
            'fields': ('is_online', 'last_heartbeat', 'last_communication', 'firmware_version', 'ip_address'),
            'classes': ('wide',)
        }),
        ('Statistics', {
            'fields': ('total_heartbeats', 'missed_heartbeats', 'uptime_percentage', 'last_downtime_start'),
            'classes': ('wide',)
        }),
        ('Raw Data', {
            'fields': ('raw_metadata',),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('site').prefetch_related('sensors')

    def sensors_count(self, obj):
        online_count = obj.sensors.filter(is_online=True).count()
        total_count = obj.sensors.count()
        return f"{online_count}/{total_count}"
    sensors_count.short_description = 'Sensors (Online/Total)'

    def has_add_permission(self, request):
        return False  # Auto-discovered via MQTT

    def has_delete_permission(self, request, obj=None):
        return True  # Permettiamo cleanup manuale


@admin.register(Sensor)
class SensorAdmin(admin.ModelAdmin):
    """Admin per Sensor con dati near real-time integrati"""
    list_display = ['label', 'datalogger', 'sensor_type', 'serial_number', 'is_online', 'last_reading', 'total_readings', 'uptime_percentage', 'min_max_display']
    list_filter = ['is_online', 'sensor_type', 'datalogger__site', 'datalogger__datalogger_type', 'last_reading', 'created_at']
    search_fields = ['label', 'serial_number', 'datalogger__label', 'datalogger__site__name', 'sensor_type']
    readonly_fields = [
        'serial_number', 'last_reading', 'total_messages', 'total_readings',
        'min_value_ever', 'max_value_ever', 'min_recorded_at', 'max_recorded_at',
        'first_seen_at', 'last_seen_at', 'consecutive_misses',
        'last_timestamp_1', 'last_data_1', 'last_timestamp_2', 'last_data_2', 'last_timestamp_3', 'last_data_3',
        'created_at', 'updated_at'
    ]

    fieldsets = (
        ('Sensor Information', {
            'fields': ('datalogger', 'serial_number', 'label', 'sensor_type', 'unit_of_measure')
        }),
        ('Status', {
            'fields': ('is_online', 'last_reading', 'consecutive_misses'),
            'classes': ('wide',)
        }),
        ('Statistics', {
            'fields': ('total_messages', 'total_readings', 'uptime_percentage', 'first_seen_at', 'last_seen_at'),
            'classes': ('wide',)
        }),
        ('Min/Max Records', {
            'fields': ('min_value_ever', 'min_recorded_at', 'max_value_ever', 'max_recorded_at'),
            'classes': ('wide',)
        }),
        ('Near Real-Time Data (Last 3 Readings)', {
            'fields': (
                ('last_timestamp_1', 'last_data_1'),
                ('last_timestamp_2', 'last_data_2'),
                ('last_timestamp_3', 'last_data_3'),
            ),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('datalogger', 'datalogger__site')

    def min_max_display(self, obj):
        """Display min/max values"""
        if obj.min_value_ever is not None and obj.max_value_ever is not None:
            return f"Min: {obj.min_value_ever:.2f} | Max: {obj.max_value_ever:.2f}"
        return "No data"
    min_max_display.short_description = 'Min/Max Values'

    def has_add_permission(self, request):
        return False  # Auto-discovered via MQTT

    def has_delete_permission(self, request, obj=None):
        return True  # Permettiamo cleanup manuale


# ============================================================================
# Admin Site Configuration
# ============================================================================

# Personalizzazione dell'admin site con la nuova struttura
admin.site.site_header = "BFG MQTT Administration"
admin.site.site_title = "BFG MQTT Admin"
admin.site.index_title = "MQTT Auto-Discovery System Management"

# Riorganizzazione menu tramite app_list_filter se necessario
# Per ora utilizziamo la struttura standard di Django con verbose_name nei modelli