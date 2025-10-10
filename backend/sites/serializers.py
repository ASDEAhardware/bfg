from rest_framework import serializers
from .models import Site, UserSiteAccess, Datalogger, Sensor


class SiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Site
        fields = [
            'id',
            'name',
            'site_type',
            'latitude',
            'longitude',
            'customer_name',
            'description',
            'is_active',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ('id', 'created_at', 'updated_at')


class SiteListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for dropdown lists"""
    class Meta:
        model = Site
        fields = ['id', 'name', 'customer_name', 'site_type']


class UserSiteAccessSerializer(serializers.ModelSerializer):
    site = SiteListSerializer(read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)
    granted_by_username = serializers.CharField(source='granted_by.username', read_only=True)

    class Meta:
        model = UserSiteAccess
        fields = [
            'id',
            'user',
            'user_username',
            'site',
            'granted_at',
            'granted_by',
            'granted_by_username'
        ]
        read_only_fields = ('id', 'granted_at')


class SensorListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for sensor counts"""
    class Meta:
        model = Sensor
        fields = ['id', 'name', 'sensor_type', 'status', 'is_active']


class DataloggerListSerializer(serializers.ModelSerializer):
    """Serializer optimized for dashboard view"""
    sensors_count = serializers.SerializerMethodField()
    active_sensors_count = serializers.SerializerMethodField()
    site_name = serializers.CharField(source='site.name', read_only=True)

    class Meta:
        model = Datalogger
        fields = [
            'id',
            'name',
            'serial_number',
            'model',
            'firmware_version',
            'ip_address',
            'status',
            'is_active',
            'last_communication',
            'site_name',
            'sensors_count',
            'active_sensors_count'
        ]

    def get_sensors_count(self, obj):
        return obj.sensors.count()

    def get_active_sensors_count(self, obj):
        return obj.sensors.filter(is_active=True).count()


class DataloggerDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer with sensors information"""
    sensors = SensorListSerializer(many=True, read_only=True)
    site_name = serializers.CharField(source='site.name', read_only=True)

    class Meta:
        model = Datalogger
        fields = [
            'id',
            'site',
            'site_name',
            'name',
            'serial_number',
            'model',
            'firmware_version',
            'ip_address',
            'status',
            'description',
            'is_active',
            'installed_at',
            'last_communication',
            'created_at',
            'updated_at',
            'sensors'
        ]
        read_only_fields = ('id', 'installed_at', 'created_at', 'updated_at')


class SensorSerializer(serializers.ModelSerializer):
    datalogger_name = serializers.CharField(source='datalogger.name', read_only=True)
    site_name = serializers.CharField(source='datalogger.site.name', read_only=True)

    class Meta:
        model = Sensor
        fields = [
            'id',
            'datalogger',
            'datalogger_name',
            'site_name',
            'name',
            'sensor_type',
            'channel',
            'unit_of_measure',
            'min_value',
            'max_value',
            'calibration_factor',
            'calibration_offset',
            'status',
            'description',
            'is_active',
            'installed_at',
            'last_reading',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ('id', 'installed_at', 'created_at', 'updated_at')