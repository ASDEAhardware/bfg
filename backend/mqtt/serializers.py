"""
Serializers per MQTT Auto-Discovery Models
Mantiene compatibilità con il frontend esistente
"""

from rest_framework import serializers
from .models import Gateway, Datalogger, Sensor


class GatewaySerializer(serializers.ModelSerializer):
    """Serializer per Gateway (ex SystemInfo)"""

    # Campi compatibilità frontend (mapping)
    name = serializers.CharField(source='label', read_only=True)
    uptime_display = serializers.SerializerMethodField()
    memory_display = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()

    class Meta:
        model = Gateway
        fields = [
            'id', 'serial_number', 'label', 'name',  # name = alias per label
            'hostname', 'ip_address', 'firmware_version',
            'is_online', 'last_heartbeat', 'last_communication',
            'cpu_usage_percent', 'memory_usage_percent', 'disk_usage_percent',
            'uptime_seconds', 'uptime_display', 'memory_display',
            'status_display', 'raw_metadata',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'name']

    def get_uptime_display(self, obj):
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

    def get_memory_display(self, obj):
        """Human-readable memory info"""
        if obj.memory_usage_percent:
            return f"{obj.memory_usage_percent:.1f}%"
        return "Unknown"

    def get_status_display(self, obj):
        """Status display per frontend"""
        if obj.is_online:
            return "Online"
        else:
            return "Offline"


class DataloggerSerializer(serializers.ModelSerializer):
    """
    Serializer per Datalogger con compatibilità frontend esistente
    Mapping: name -> label, model -> datalogger_type
    """

    # Campi compatibilità frontend
    name = serializers.CharField(source='label', read_only=True)
    model = serializers.CharField(source='datalogger_type', read_only=True)
    status = serializers.SerializerMethodField()
    sensors_count = serializers.SerializerMethodField()
    uptime_display = serializers.SerializerMethodField()

    # Info sito
    site_name = serializers.CharField(source='site.name', read_only=True)
    site_code = serializers.CharField(source='site.code', read_only=True)

    class Meta:
        model = Datalogger
        fields = [
            'id', 'serial_number', 'label', 'name',  # name = alias
            'datalogger_type', 'model',  # model = alias
            'instance_number', 'is_online', 'status',
            'last_heartbeat', 'last_communication', 'firmware_version',
            'ip_address', 'sensors_count', 'uptime_display',
            'total_heartbeats', 'missed_heartbeats', 'uptime_percentage',
            'site_name', 'site_code', 'raw_metadata',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'name', 'model', 'status', 'sensors_count',
            'uptime_display', 'site_name', 'site_code',
            'created_at', 'updated_at'
        ]

    def get_status(self, obj):
        """Status mapping per compatibilità"""
        if obj.is_online:
            return "active"
        else:
            return "inactive"

    def get_sensors_count(self, obj):
        """Numero sensori collegati"""
        return obj.sensors.count()

    def get_uptime_display(self, obj):
        """Display uptime percentage"""
        return f"{obj.uptime_percentage:.1f}%"


class SensorBasicDataSerializer(serializers.Serializer):
    """Serializer per dati singola lettura sensore"""
    timestamp = serializers.DateTimeField()
    data = serializers.JSONField()


class SensorSerializer(serializers.ModelSerializer):
    """
    Serializer per Sensor con dati near real-time integrati
    Compatibile con frontend esistente
    """

    # Campi compatibilità frontend
    name = serializers.CharField(source='label', read_only=True)
    channel = serializers.SerializerMethodField()  # Non abbiamo channel fisico
    status = serializers.SerializerMethodField()
    last_value = serializers.SerializerMethodField()

    # Datalogger info
    datalogger_name = serializers.CharField(source='datalogger.label', read_only=True)
    datalogger_type = serializers.CharField(source='datalogger.datalogger_type', read_only=True)

    # Near real-time data
    latest_readings = serializers.SerializerMethodField()

    # Statistiche
    stats = serializers.SerializerMethodField()

    class Meta:
        model = Sensor
        fields = [
            'id', 'serial_number', 'label', 'name',  # name = alias
            'sensor_type', 'unit_of_measure', 'channel',
            'is_online', 'status', 'last_reading',
            'datalogger_name', 'datalogger_type',
            'latest_readings', 'last_value', 'stats',
            'total_messages', 'total_readings',
            'min_value_ever', 'max_value_ever',
            'first_seen_at', 'last_seen_at',
            'uptime_percentage', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'name', 'channel', 'status', 'last_value',
            'datalogger_name', 'datalogger_type', 'latest_readings',
            'stats', 'created_at', 'updated_at'
        ]

    def get_channel(self, obj):
        """Virtual channel number per compatibilità"""
        # Usa hash del serial_number per channel consistente
        return hash(obj.serial_number) % 16 + 1

    def get_status(self, obj):
        """Status mapping"""
        if obj.is_online:
            return "active"
        else:
            return "inactive"

    def get_last_value(self, obj):
        """Ultimo valore per display rapido"""
        if obj.last_data_1:
            # Trova primo valore numerico
            for key, value in obj.last_data_1.items():
                if key.startswith('last_') and isinstance(value, (int, float)):
                    return value
        return None

    def get_latest_readings(self, obj):
        """Ultimi 3 dati formattati"""
        readings = obj.get_latest_readings()
        return SensorBasicDataSerializer(readings, many=True).data

    def get_stats(self, obj):
        """Statistiche aggregate"""
        return {
            'min_ever': obj.min_value_ever,
            'max_ever': obj.max_value_ever,
            'total_readings': obj.total_readings,
            'uptime_percentage': obj.uptime_percentage,
            'days_active': (obj.last_seen_at - obj.first_seen_at).days if (obj.last_seen_at and obj.first_seen_at) else 0
        }


class LabelUpdateSerializer(serializers.Serializer):
    """Serializer per update label utente"""
    label = serializers.CharField(max_length=255, required=True)

    def validate_label(self, value):
        """Validazione label con controlli sicurezza"""
        import re
        from django.utils.html import escape

        if not value or not value.strip():
            raise serializers.ValidationError("Label non può essere vuoto")

        value = value.strip()

        # Controllo caratteri pericolosi
        if re.search(r'[<>"\'\&]', value):
            raise serializers.ValidationError("Label contiene caratteri non consentiti")

        # Lunghezza massima ragionevole
        if len(value) > 255:
            raise serializers.ValidationError("Label troppo lungo (max 255 caratteri)")

        # Escape per sicurezza anche se già validato
        return escape(value)