from django.contrib import admin
from .models import MqttConnection, SensorDevice, SensorData, MqttTopic


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



@admin.register(SensorDevice)
class SensorDeviceAdmin(admin.ModelAdmin):
    list_display = ['device_name', 'site', 'device_type', 'is_active', 'is_online', 'last_seen_at', 'total_messages', 'uptime_percentage']
    list_filter = ['is_active', 'is_online', 'device_type', 'site', 'created_at']
    search_fields = ['device_name', 'site__name', 'device_type']
    readonly_fields = ['last_seen_at', 'consecutive_misses', 'total_messages', 'uptime_percentage', 'created_at', 'updated_at']

    fieldsets = (
        ('Device Info', {
            'fields': ('site', 'device_name', 'device_type', 'is_active')
        }),
        ('Status', {
            'fields': ('is_online', 'last_seen_at', 'consecutive_misses'),
            'classes': ('wide',)
        }),
        ('Statistics', {
            'fields': ('total_messages', 'uptime_percentage'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        })
    )

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('site')


@admin.register(SensorData)
class SensorDataAdmin(admin.ModelAdmin):
    list_display = ['sensor_device', 'timestamp', 'acc_x', 'acc_y', 'acc_z', 'incli_x', 'incli_y', 'received_at']
    list_filter = ['sensor_device__site', 'sensor_device__device_name', 'timestamp', 'received_at']
    search_fields = ['sensor_device__device_name', 'sensor_device__site__name']
    readonly_fields = ['received_at']
    date_hierarchy = 'timestamp'

    fieldsets = (
        ('Sensor', {
            'fields': ('sensor_device', 'timestamp')
        }),
        ('Accelerometer', {
            'fields': ('acc_x', 'acc_y', 'acc_z'),
            'classes': ('wide',)
        }),
        ('Inclinometer', {
            'fields': ('incli_x', 'incli_y'),
            'classes': ('wide',)
        }),
        ('Magnetometer', {
            'fields': ('mag_x', 'mag_y', 'mag_z'),
            'classes': ('collapse',)
        }),
        ('Gyroscope', {
            'fields': ('gyro_x', 'gyro_y', 'gyro_z'),
            'classes': ('collapse',)
        }),
        ('Raw Data', {
            'fields': ('raw_data',),
            'classes': ('collapse',)
        }),
        ('Metadata', {
            'fields': ('received_at',),
            'classes': ('collapse',)
        })
    )

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('sensor_device', 'sensor_device__site')

    def has_add_permission(self, request):
        return False  # I dati vengono aggiunti automaticamente dal sistema MQTT



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


# Personalizzazione dell'admin site
admin.site.site_header = "BFG MQTT Administration"
admin.site.site_title = "BFG MQTT Admin"
admin.site.index_title = "MQTT System Management"