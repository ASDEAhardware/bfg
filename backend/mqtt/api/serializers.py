"""
Serializers per API di controllo MQTT
"""
from rest_framework import serializers
from ..models import MqttConnection, Datalogger, Sensor


class MqttConnectionStatusSerializer(serializers.Serializer):
    """Serializer per stato connessione MQTT."""

    connection_id = serializers.IntegerField()
    site_id = serializers.IntegerField()
    site_name = serializers.CharField()
    is_active = serializers.BooleanField()
    status = serializers.CharField()
    broker_host = serializers.CharField()
    broker_port = serializers.IntegerField()
    last_connected_at = serializers.CharField(allow_null=True)
    last_heartbeat_at = serializers.CharField(allow_null=True)
    connection_errors = serializers.IntegerField()
    error_message = serializers.CharField(allow_blank=True)
    handler_running = serializers.BooleanField()
    handler_connected = serializers.BooleanField()
    retry_count = serializers.IntegerField()
    subscribed_topics = serializers.IntegerField()
    # New fields from mqtt_service
    mqtt_retry_count = serializers.IntegerField(required=False)
    mqtt_next_retry = serializers.CharField(allow_null=True, required=False)
    topics_list = serializers.ListField(child=serializers.CharField(), required=False)


class MqttControlResponseSerializer(serializers.Serializer):
    """Serializer per risposta controllo MQTT."""

    success = serializers.BooleanField()
    message = serializers.CharField()
    connection_id = serializers.IntegerField(required=False)


class MqttManagerStatusSerializer(serializers.Serializer):
    """Serializer per stato generale del manager MQTT."""

    is_running = serializers.BooleanField()
    total_connections = serializers.IntegerField()
    active_connections = serializers.IntegerField()
    connected_connections = serializers.IntegerField()
    error_connections = serializers.IntegerField()
    timestamp = serializers.CharField()


class MqttConnectionListSerializer(serializers.ModelSerializer):
    """Serializer per lista connessioni MQTT dal DB."""

    site_name = serializers.CharField(source='site.name', read_only=True)

    class Meta:
        model = MqttConnection
        fields = [
            'id', 'site_id', 'site_name', 'broker_host', 'broker_port',
            'client_id_prefix', 'is_active', 'status', 'last_connected_at',
            'last_heartbeat_at', 'connection_errors', 'error_message'
        ]
        read_only_fields = [
            'id', 'status', 'last_connected_at', 'last_heartbeat_at',
            'connection_errors', 'error_message'
        ]


class DataloggerSerializer(serializers.ModelSerializer):
    """Serializer per Datalogger auto-discovered."""

    site_name = serializers.CharField(source='site.name', read_only=True)
    sensors_count = serializers.SerializerMethodField()
    active_sensors_count = serializers.SerializerMethodField()

    class Meta:
        model = Datalogger
        fields = [
            'id', 'site_id', 'site_name', 'serial_number', 'label',
            'datalogger_type', 'device_id', 'is_online', 'last_seen_at',
            'connection_status', 'mqtt_api_version', 'expected_heartbeat_interval',
            'firmware_version', 'ip_address', 'total_heartbeats', 'missed_heartbeats',
            'uptime_percentage', 'sensors_count', 'active_sensors_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'site_id', 'last_seen_at', 'connection_status', 'mqtt_api_version',
            'expected_heartbeat_interval', 'total_heartbeats', 'missed_heartbeats',
            'uptime_percentage', 'created_at', 'updated_at'
        ]

    def get_sensors_count(self, obj):
        """Conta totale sensori per questo datalogger."""
        return obj.sensors.count()

    def get_active_sensors_count(self, obj):
        """Conta sensori online per questo datalogger."""
        return obj.sensors.filter(is_online=True).count()


class SensorSerializer(serializers.ModelSerializer):
    """Serializer per Sensor auto-discovered."""

    datalogger_label = serializers.CharField(source='datalogger.label', read_only=True)
    site_name = serializers.CharField(source='datalogger.site.name', read_only=True)
    latest_readings = serializers.SerializerMethodField()
    current_value = serializers.SerializerMethodField()

    class Meta:
        model = Sensor
        fields = [
            'id', 'datalogger_label', 'site_name', 'serial_number', 'label',
            'sensor_type', 'unit_of_measure', 'is_online', 'last_reading',
            'total_messages', 'total_readings', 'min_value_ever', 'max_value_ever',
            'first_seen_at', 'last_seen_at', 'uptime_percentage',
            'consecutive_misses', 'latest_readings', 'current_value',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'last_reading', 'total_messages', 'total_readings',
            'min_value_ever', 'max_value_ever', 'first_seen_at', 'last_seen_at',
            'uptime_percentage', 'consecutive_misses', 'created_at', 'updated_at'
        ]

    def get_latest_readings(self, obj):
        """Ritorna ultimi 3 dati del sensore."""
        return obj.get_latest_readings()

    def get_current_value(self, obj):
        """Estrae valore corrente principale del sensore."""
        latest_readings = obj.get_latest_readings()
        if not latest_readings:
            return None

        # Prende il dato più recente
        latest_data = latest_readings[0]['data']

        # Cerca valore principale - SEMPRE dati RAW
        if 'acc00' in latest_data:
            return latest_data['acc00']
        elif 'incli_x' in latest_data:
            return latest_data['incli_x']
        elif 'temperature' in latest_data:
            return latest_data['temperature']
        elif 'value' in latest_data:
            return latest_data['value']

        return None


class SensorDetailSerializer(SensorSerializer):
    """Serializer dettagliato per singolo sensore."""

    datalogger = DataloggerSerializer(read_only=True)

    class Meta(SensorSerializer.Meta):
        fields = SensorSerializer.Meta.fields + ['datalogger']


class DataloggerDetailSerializer(DataloggerSerializer):
    """Serializer dettagliato per singolo datalogger."""

    sensors = SensorSerializer(many=True, read_only=True)

    class Meta(DataloggerSerializer.Meta):
        fields = DataloggerSerializer.Meta.fields + ['sensors']