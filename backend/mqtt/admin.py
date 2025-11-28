from django.contrib import admin
from .models import (
    MqttConnection, MqttTopic, DiscoveredTopic, Gateway, Datalogger, Sensor,
    MqttConnectionLog, MqttParsingLog
)


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
    list_display = ['site', 'is_active', 'broker_host', 'broker_port', 'status', 'topics_count', 'last_connected_at', 'last_heartbeat_at', 'connection_errors']
    list_filter = ['is_active', 'status', 'ssl_enabled', 'created_at']
    search_fields = ['site__name', 'broker_host', 'client_id_prefix']
    readonly_fields = ['last_connected_at', 'last_heartbeat_at', 'connection_errors', 'created_at', 'updated_at']
    list_editable = ['is_active']
    inlines = [MqttTopicInline]

    fieldsets = (
        ('Site', {
            'fields': ('site',)
        }),
        ('Connection', {
            'fields': ('is_active', 'broker_host', 'broker_port', 'client_id_prefix')
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


@admin.register(DiscoveredTopic)
class DiscoveredTopicAdmin(admin.ModelAdmin):
    list_display = ['topic_path', 'site', 'message_count', 'is_processable', 'is_active', 'processor_name', 'first_seen_at', 'last_seen_at', 'message_frequency_display']
    list_filter = ['site', 'is_processable', 'is_active', 'processor_name', 'first_seen_at']
    search_fields = ['topic_path', 'topic_pattern', 'site__name']
    readonly_fields = ['first_seen_at', 'last_seen_at', 'message_count', 'payload_size_avg', 'message_frequency_seconds']
    list_editable = ['is_active']
    ordering = ['-last_seen_at']

    fieldsets = (
        ('Topic Info', {
            'fields': ('site', 'topic_path', 'topic_pattern')
        }),
        ('Discovery Stats', {
            'fields': ('first_seen_at', 'last_seen_at', 'message_count', 'payload_size_avg', 'message_frequency_seconds'),
            'classes': ['collapse']
        }),
        ('Processing', {
            'fields': ('is_processable', 'is_active', 'processor_name')
        }),
        ('Sample Data', {
            'fields': ('sample_payload',),
            'classes': ['collapse']
        }),
    )

    def message_frequency_display(self, obj):
        if obj.message_frequency_seconds:
            return f"{obj.message_frequency_seconds:.1f}s"
        return "-"
    message_frequency_display.short_description = 'Frequency'

    def has_add_permission(self, request):
        # Non permettere creazione manuale - solo auto-discovery
        return False


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
    list_display = ['label', 'site', 'serial_number', 'hostname', 'is_online', 'connection_status', 'cpu_load_percent', 'ram_percent_used', 'disk_percent_used', 'uptime_display']
    list_filter = ['is_online', 'connection_status', 'site', 'created_at']
    search_fields = ['label', 'serial_number', 'site__name', 'hostname', 'ip_address']
    readonly_fields = ['serial_number', 'last_status_change', 'mqtt_api_version', 'created_at', 'updated_at', 'uptime_display']

    fieldsets = (
        ('Gateway Information', {
            'fields': ('site', 'serial_number', 'label', 'hostname', 'ip_address', 'firmware_version', 'os_version', 'mqtt_api_version')
        }),
        ('Status & Monitoring', {
            'fields': ('is_online', 'connection_status', 'last_status_change', 'expected_heartbeat_interval', 'system_uptime', 'uptime_display'),
            'classes': ('wide',)
        }),
        ('CPU Metrics', {
            'fields': ('cpu_load_percent',),
            'classes': ('wide',)
        }),
        ('Memory/RAM Metrics', {
            'fields': ('ram_total_gb', 'ram_used_gb', 'ram_percent_used'),
            'classes': ('wide',)
        }),
        ('Disk Metrics', {
            'fields': ('disk_total_gb', 'disk_free_gb', 'disk_percent_used'),
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
    list_display = ['label', 'site', 'datalogger_type', 'device_id', 'serial_number', 'is_online', 'connection_status', 'sensors_count', 'uptime_percentage', 'last_seen_at']
    list_filter = ['is_online', 'connection_status', 'datalogger_type', 'site', 'last_seen_at', 'created_at']
    search_fields = ['label', 'serial_number', 'site__name', 'datalogger_type', 'device_id']
    readonly_fields = ['serial_number', 'datalogger_type', 'device_id', 'last_seen_at', 'last_status_change', 'total_heartbeats', 'missed_heartbeats', 'mqtt_api_version', 'created_at', 'updated_at']
    inlines = [SensorInline]

    fieldsets = (
        ('Datalogger Information', {
            'fields': ('site', 'serial_number', 'label', 'datalogger_type', 'device_id', 'mqtt_api_version')
        }),
        ('Connection & Monitoring', {
            'fields': ('is_online', 'connection_status', 'last_seen_at', 'last_status_change', 'expected_heartbeat_interval', 'firmware_version', 'ip_address'),
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
# LOGGING SECTION
# ============================================================================

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


# ============================================================================
# Admin Site Configuration
# ============================================================================

# Personalizzazione dell'admin site con la nuova struttura
admin.site.site_header = "BFG MQTT Administration"
admin.site.site_title = "BFG MQTT Admin"
admin.site.index_title = "MQTT Auto-Discovery System Management"

# Riorganizzazione menu tramite app_list_filter se necessario
# Per ora utilizziamo la struttura standard di Django con verbose_name nei modelli