from decimal import Decimal
from django.db import models
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator, MaxValueValidator


User = get_user_model()


class SiteType(models.TextChoices):
    BRIDGE = 'bridge', 'Bridge'
    BUILDING = 'building', 'Building'
    TUNNEL = 'tunnel', 'Tunnel'
    DAM = 'dam', 'Dam'
    TOWER = 'tower', 'Tower'
    PIPELINE = 'pipeline', 'Pipeline'
    OTHER = 'other', 'Other'


class Site(models.Model):
    name = models.CharField(max_length=255, unique=True)
    code = models.CharField(max_length=50, unique=True, null=True, help_text="Site code for MQTT topics (e.g., 'sito_001')")
    site_type = models.CharField(
        max_length=20,
        choices=SiteType.choices,
        default=SiteType.OTHER
    )
    latitude = models.DecimalField(
        max_digits=17,
        decimal_places=12,
        default=Decimal(42.445341640630),
        validators=[
            MinValueValidator(-90.0),
            MaxValueValidator(90.0)
        ],
        help_text="Latitude coordinate (-90 to 90 degrees)"
    )
    longitude = models.DecimalField(
        max_digits=17,
        decimal_places=12,
        default=Decimal(14.198652738540),
        validators=[
            MinValueValidator(-180.0),
            MaxValueValidator(180.0)
        ],
        help_text="Longitude coordinate (-180 to 180 degrees)"
    )
    customer_name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Site'
        verbose_name_plural = 'Sites'
        indexes = [
            models.Index(fields=['customer_name']),
            models.Index(fields=['site_type']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return f"{self.name} ({self.customer_name})"


class UserSiteAccess(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='site_accesses')
    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name='user_accesses')
    granted_at = models.DateTimeField(auto_now_add=True)
    granted_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='granted_site_accesses'
    )

    class Meta:
        unique_together = ('user', 'site')
        ordering = ['site__name']
        verbose_name = 'User Site Access'
        verbose_name_plural = 'User Site Accesses'

    def __str__(self):
        return f"{self.user.username} - {self.site.name}"


class DataloggerStatus(models.TextChoices):
    ACTIVE = 'active', 'Active'
    INACTIVE = 'inactive', 'Inactive'
    MAINTENANCE = 'maintenance', 'Maintenance'
    ERROR = 'error', 'Error'


class Datalogger(models.Model):
    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name='dataloggers')
    name = models.CharField(max_length=255)
    serial_number = models.CharField(max_length=100, unique=True)
    model = models.CharField(max_length=100)
    firmware_version = models.CharField(max_length=50, blank=True, null=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    status = models.CharField(
        max_length=20,
        choices=DataloggerStatus.choices,
        default=DataloggerStatus.ACTIVE
    )
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    installed_at = models.DateTimeField(auto_now_add=True)
    last_communication = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['site__name', 'name']
        verbose_name = 'Datalogger'
        verbose_name_plural = 'Dataloggers'
        unique_together = ('site', 'name')
        indexes = [
            models.Index(fields=['site', 'status']),
            models.Index(fields=['serial_number']),
            models.Index(fields=['is_active']),
            models.Index(fields=['last_communication']),
        ]

    def __str__(self):
        return f"{self.name} ({self.site.name})"


class SensorType(models.TextChoices):
    TEMPERATURE = 'temperature', 'Temperature'
    HUMIDITY = 'humidity', 'Humidity'
    PRESSURE = 'pressure', 'Pressure'
    ACCELEROMETER = 'accelerometer', 'Accelerometer'
    STRAIN_GAUGE = 'strain_gauge', 'Strain Gauge'
    DISPLACEMENT = 'displacement', 'Displacement'
    VIBRATION = 'vibration', 'Vibration'
    TILT = 'tilt', 'Tilt'
    WIND_SPEED = 'wind_speed', 'Wind Speed'
    WIND_DIRECTION = 'wind_direction', 'Wind Direction'
    OTHER = 'other', 'Other'


class SensorStatus(models.TextChoices):
    ACTIVE = 'active', 'Active'
    INACTIVE = 'inactive', 'Inactive'
    CALIBRATING = 'calibrating', 'Calibrating'
    ERROR = 'error', 'Error'
    MAINTENANCE = 'maintenance', 'Maintenance'


class Sensor(models.Model):
    datalogger = models.ForeignKey(Datalogger, on_delete=models.CASCADE, related_name='sensors')
    name = models.CharField(max_length=255)
    sensor_type = models.CharField(
        max_length=20,
        choices=SensorType.choices,
        default=SensorType.OTHER
    )
    channel = models.PositiveSmallIntegerField(
        help_text="Channel number on the datalogger"
    )
    unit_of_measure = models.CharField(max_length=50, blank=True, null=True)
    min_value = models.DecimalField(
        max_digits=15,
        decimal_places=6,
        blank=True,
        null=True,
        help_text="Minimum expected value"
    )
    max_value = models.DecimalField(
        max_digits=15,
        decimal_places=6,
        blank=True,
        null=True,
        help_text="Maximum expected value"
    )
    calibration_factor = models.DecimalField(
        max_digits=15,
        decimal_places=6,
        default=Decimal(1.0),
        help_text="Calibration factor to apply to raw values"
    )
    calibration_offset = models.DecimalField(
        max_digits=15,
        decimal_places=6,
        default=Decimal(0.0),
        help_text="Calibration offset to apply to raw values"
    )
    status = models.CharField(
        max_length=20,
        choices=SensorStatus.choices,
        default=SensorStatus.ACTIVE
    )
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    installed_at = models.DateTimeField(auto_now_add=True)
    last_reading = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['datalogger__site__name', 'datalogger__name', 'channel']
        verbose_name = 'Sensor'
        verbose_name_plural = 'Sensors'
        unique_together = ('datalogger', 'channel')
        indexes = [
            models.Index(fields=['datalogger', 'sensor_type']),
            models.Index(fields=['sensor_type']),
            models.Index(fields=['status']),
            models.Index(fields=['is_active']),
            models.Index(fields=['last_reading']),
        ]

    def __str__(self):
        return f"{self.name} (Ch{self.channel} - {self.datalogger.name})"